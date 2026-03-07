import { mapOwmCondition } from '../../utils/weatherConditions.js';

/**
 * Converts wind direction in degrees to compass direction string.
 * @param {number} degrees - Wind direction in degrees (0-360)
 * @returns {string} Compass direction (e.g., "N", "NE", "SW")
 */
function degreesToDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

/**
 * Fetches weather data from OpenWeatherMap API (free tier 2.5 endpoints).
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} apiKey - OpenWeatherMap API key
 * @returns {Promise<import('../weather.js').WeatherData>}
 */
export async function fetchOpenWeatherMapData(lat, lon, apiKey) {
    if (!apiKey) {
        throw new Error('OpenWeatherMap API key is required. Set it in your weather sources configuration.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const baseUrl = 'https://api.openweathermap.org/data/2.5';
        const params = `lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

        const [weatherRes, forecastRes] = await Promise.all([
            fetch(`${baseUrl}/weather?${params}`, { signal: controller.signal }),
            fetch(`${baseUrl}/forecast?${params}`, { signal: controller.signal }),
        ]);

        clearTimeout(timeoutId);

        if (!weatherRes.ok) {
            throw new Error(`OWM weather API returned ${weatherRes.status}: ${weatherRes.statusText}`);
        }
        if (!forecastRes.ok) {
            throw new Error(`OWM forecast API returned ${forecastRes.status}: ${forecastRes.statusText}`);
        }

        const weather = await weatherRes.json();
        const forecast = await forecastRes.json();

        // Extract daily highs/lows from forecast data
        const dailyMap = {};
        for (const entry of forecast.list) {
            const date = entry.dt_txt.split(' ')[0];
            if (!dailyMap[date]) {
                dailyMap[date] = { high: -Infinity, low: Infinity, conditions: [], dt: entry.dt };
            }
            dailyMap[date].high = Math.max(dailyMap[date].high, entry.main.temp_max);
            dailyMap[date].low = Math.min(dailyMap[date].low, entry.main.temp_min);
            dailyMap[date].conditions.push(entry.weather[0].id);
        }

        const daily = Object.entries(dailyMap).map(([date, d]) => {
            // Pick most frequent condition
            const condCounts = {};
            for (const c of d.conditions) {
                condCounts[c] = (condCounts[c] || 0) + 1;
            }
            const dominantId = Object.entries(condCounts).sort((a, b) => b[1] - a[1])[0][0];
            return {
                date: new Date(date).toISOString(),
                high: Math.round(d.high * 10) / 10,
                low: Math.round(d.low * 10) / 10,
                condition: mapOwmCondition(dominantId),
            };
        });

        // Build hourly from forecast (3-hour intervals)
        const hourly = forecast.list.map(entry => ({
            time: new Date(entry.dt * 1000).toISOString(),
            temp: Math.round(entry.main.temp * 10) / 10,
            condition: mapOwmCondition(entry.weather[0].id),
            humidity: entry.main.humidity,
            windSpeed: Math.round((entry.wind.speed * 3.6) * 10) / 10, // m/s to km/h
        }));

        const todayKey = new Date().toISOString().split('T')[0];
        const todayData = dailyMap[todayKey];

        return {
            source: 'openweathermap',
            current: {
                temp: Math.round(weather.main.temp * 10) / 10,
                condition: mapOwmCondition(weather.weather[0].id),
                high: todayData ? Math.round(todayData.high * 10) / 10 : Math.round(weather.main.temp_max * 10) / 10,
                low: todayData ? Math.round(todayData.low * 10) / 10 : Math.round(weather.main.temp_min * 10) / 10,
                feelsLike: Math.round(weather.main.feels_like * 10) / 10,
                windSpeed: Math.round((weather.wind.speed * 3.6) * 10) / 10, // m/s to km/h
                windDirection: degreesToDirection(weather.wind.deg ?? 0),
                windGust: weather.wind.gust ? Math.round((weather.wind.gust * 3.6) * 10) / 10 : null,
                humidity: weather.main.humidity,
                pressure: weather.main.pressure,
                uvIndex: null, // Not available in free tier 2.5
                visibility: weather.visibility ? Math.round(weather.visibility / 100) / 10 : null, // m to km
                precipitation: weather.rain?.['1h'] ?? weather.snow?.['1h'] ?? 0,
                sunrise: weather.sys.sunrise ? new Date(weather.sys.sunrise * 1000).toISOString() : null,
                sunset: weather.sys.sunset ? new Date(weather.sys.sunset * 1000).toISOString() : null,
            },
            hourly,
            daily,
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('OpenWeatherMap API request timed out after 10 seconds');
        }
        throw error;
    }
}
