import { mapWeatherApiCondition } from '../../utils/weatherConditions.js';

/**
 * Fetches weather data from WeatherAPI.com
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} apiKey - WeatherAPI.com API key
 * @returns {Promise<import('../weather.js').WeatherData>}
 */
export async function fetchWeatherApiData(lat, lon, apiKey) {
    if (!apiKey) {
        throw new Error('WeatherAPI key is not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lon}&days=14&aqi=yes`;
        const response = await fetch(url, { signal: controller.signal });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`WeatherAPI returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return normalizeWeatherApiData(data);
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('WeatherAPI request timed out');
        }
        throw error;
    }
}

/**
 * Normalizes WeatherAPI.com response to unified WeatherData schema.
 * @param {object} data - Raw WeatherAPI.com response
 * @returns {import('../weather.js').WeatherData}
 */
function normalizeWeatherApiData(data) {
    const { current, forecast } = data;
    const today = forecast?.forecastday?.[0]?.day;

    const airQuality = current?.air_quality
        ? {
              pm2_5: current.air_quality.pm2_5 ?? null,
              pm10: current.air_quality.pm10 ?? null,
              o3: current.air_quality.o3 ?? null,
              no2: current.air_quality.no2 ?? null,
              so2: current.air_quality.so2 ?? null,
              co: current.air_quality.co ?? null,
              usEpaIndex: current.air_quality['us-epa-index'] ?? null,
          }
        : null;

    return {
        source: 'weatherapi',
        current: {
            temp: current.temp_c,
            condition: mapWeatherApiCondition(current.condition?.text),
            conditionText: current.condition?.text ?? '',
            high: today?.maxtemp_c ?? null,
            low: today?.mintemp_c ?? null,
            feelsLike: current.feelslike_c,
            windSpeed: current.wind_kph,
            humidity: current.humidity,
            pressure: current.pressure_mb,
            uvIndex: current.uv,
            visibility: current.vis_km,
            airQuality,
        },
        hourly: normalizeHourly(forecast?.forecastday ?? []),
        daily: normalizeDaily(forecast?.forecastday ?? []),
    };
}

/**
 * Extracts and normalizes hourly data from forecast days.
 * @param {Array} forecastDays
 * @returns {Array<Object>}
 */
function normalizeHourly(forecastDays) {
    const hours = [];
    for (const day of forecastDays) {
        for (const hour of day.hour ?? []) {
            hours.push({
                time: hour.time,
                temp: hour.temp_c,
                condition: mapWeatherApiCondition(hour.condition?.text),
                conditionText: hour.condition?.text ?? '',
                windSpeed: hour.wind_kph,
                humidity: hour.humidity,
                feelsLike: hour.feelslike_c,
                chanceOfRain: hour.chance_of_rain ?? 0,
            });
        }
    }
    return hours;
}

/**
 * Normalizes daily forecast data.
 * @param {Array} forecastDays
 * @returns {Array<Object>}
 */
function normalizeDaily(forecastDays) {
    return forecastDays.map(day => ({
        date: day.date,
        high: day.day.maxtemp_c,
        low: day.day.mintemp_c,
        condition: mapWeatherApiCondition(day.day.condition?.text),
        conditionText: day.day.condition?.text ?? '',
        avgHumidity: day.day.avghumidity,
        maxWind: day.day.maxwind_kph,
        uvIndex: day.day.uv,
        chanceOfRain: day.day.daily_chance_of_rain ?? 0,
        totalPrecipMm: day.day.totalprecip_mm ?? 0,
    }));
}
