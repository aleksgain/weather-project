import { mapWmoCode } from '../../utils/weatherConditions.js';

/**
 * Fetches weather data from the Open-Meteo API and normalizes it.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Normalized weather data
 */
export async function fetchOpenMeteoData(lat, lon) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const currentParams = [
            'temperature_2m',
            'relative_humidity_2m',
            'apparent_temperature',
            'precipitation',
            'weather_code',
            'surface_pressure',
            'wind_speed_10m',
            'wind_direction_10m',
            'wind_gusts_10m',
            'dew_point_2m',
        ].join(',');

        const hourlyParams = [
            'temperature_2m',
            'weather_code',
            'precipitation',
            'precipitation_probability',
            'wind_speed_10m',
            'wind_direction_10m',
            'wind_gusts_10m',
            'dew_point_2m',
        ].join(',');

        const dailyParams = [
            'weather_code',
            'temperature_2m_max',
            'temperature_2m_min',
            'uv_index_max',
            'sunrise',
            'sunset',
            'precipitation_sum',
        ].join(',');

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${currentParams}&hourly=${hourlyParams}&daily=${dailyParams}&timezone=auto`;

        const response = await fetch(url, { signal: controller.signal });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.current || !data.hourly || !data.daily) {
            throw new Error('Invalid response structure from weather API');
        }

        return {
            source: 'openMeteo',
            current: {
                temp: data.current.temperature_2m,
                condition: mapWmoCode(data.current.weather_code),
                high: data.daily.temperature_2m_max[0],
                low: data.daily.temperature_2m_min[0],
                feelsLike: data.current.apparent_temperature,
                windSpeed: data.current.wind_speed_10m,
                windDirection: data.current.wind_direction_10m,
                windGust: data.current.wind_gusts_10m,
                humidity: data.current.relative_humidity_2m,
                dewPoint: data.current.dew_point_2m,
                precipitation: data.current.precipitation ?? 0,
                pressure: Math.round(data.current.surface_pressure),
                uvIndex: data.daily.uv_index_max?.[0] ?? 0,
                visibility: 10, // Open-Meteo doesn't provide visibility in free tier
                sunrise: data.daily.sunrise?.[0] ?? null,
                sunset: data.daily.sunset?.[0] ?? null,
            },
            hourly: data.hourly.time.map((t, i) => ({
                time: t,
                temp: data.hourly.temperature_2m[i],
                condition: mapWmoCode(data.hourly.weather_code[i]),
                precipProbability: data.hourly.precipitation_probability?.[i] ?? null,
                precipAmount: data.hourly.precipitation?.[i] ?? 0,
                windSpeed: data.hourly.wind_speed_10m?.[i] ?? null,
                windDirection: data.hourly.wind_direction_10m?.[i] ?? null,
                windGust: data.hourly.wind_gusts_10m?.[i] ?? null,
                dewPoint: data.hourly.dew_point_2m?.[i] ?? null,
            })).slice(0, 24),
            daily: data.daily.time.map((t, i) => ({
                date: t,
                high: data.daily.temperature_2m_max[i],
                low: data.daily.temperature_2m_min[i],
                condition: mapWmoCode(data.daily.weather_code[i]),
                sunrise: data.daily.sunrise?.[i] ?? null,
                sunset: data.daily.sunset?.[i] ?? null,
                precipitationSum: data.daily.precipitation_sum?.[i] ?? null,
            })),
        };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Weather API request timed out');
        }
        throw err;
    }
}
