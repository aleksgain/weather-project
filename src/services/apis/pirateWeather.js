import { mapPirateWeatherIcon } from '../../utils/weatherConditions.js';

/**
 * Pirate Weather adapter (https://pirateweather.net).
 *
 * Dark Sky-compatible JSON schema served from NOAA models (GFS / HRRR / NBM).
 * Free tier: 20,000 calls/month. Requires an API key.
 *
 * Docs: https://docs.pirateweather.net
 * Sign up: https://pirate-weather.apiable.io/
 */

const REQUEST_TIMEOUT = 10000;

/**
 * Convert a unix epoch (seconds) to ISO 8601 string.
 * @param {number|null|undefined} epochSec
 * @returns {string|null}
 */
function epochToIso(epochSec) {
    if (epochSec == null || Number.isNaN(epochSec)) return null;
    return new Date(epochSec * 1000).toISOString();
}

/**
 * Round to one decimal place; null-safe.
 * @param {number|null|undefined} value
 * @returns {number|null}
 */
function round1(value) {
    if (value == null || Number.isNaN(value)) return null;
    return Math.round(value * 10) / 10;
}

/**
 * Fetches weather data from Pirate Weather.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} apiKey - Pirate Weather API key
 * @returns {Promise<Object>} Normalized weather data
 */
export async function fetchPirateWeatherData(lat, lon, apiKey) {
    if (!apiKey) {
        throw new Error('Pirate Weather API key is required. Get one at https://pirate-weather.apiable.io/');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        // units=ca returns: km/h wind, mm precip, hPa pressure, °C temperature
        // (matches the rest of our adapters which all normalize to metric).
        const url = `https://api.pirateweather.net/forecast/${apiKey}/${lat},${lon}?units=ca&exclude=minutely,flags`;

        const response = await fetch(url, { signal: controller.signal });

        clearTimeout(timeoutId);

        if (!response.ok) {
            // Surface common auth errors clearly.
            if (response.status === 401 || response.status === 403) {
                throw new Error('Pirate Weather: invalid or unauthorized API key');
            }
            throw new Error(`Pirate Weather API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const current = data?.currently;
        if (!current) {
            throw new Error('Invalid response structure from Pirate Weather API');
        }

        const dailyData = data?.daily?.data ?? [];
        const todayDaily = dailyData[0];

        // Humidity comes as 0-1; expose as percentage.
        const humidityPct = current.humidity != null
            ? Math.round(current.humidity * 100)
            : null;

        return {
            source: 'pirateWeather',
            current: {
                temp: round1(current.temperature),
                condition: mapPirateWeatherIcon(current.icon),
                conditionText: current.summary ?? '',
                high: round1(todayDaily?.temperatureHigh),
                low: round1(todayDaily?.temperatureLow),
                feelsLike: round1(current.apparentTemperature),
                windSpeed: round1(current.windSpeed),
                windDirection: current.windBearing ?? null,
                windGust: round1(current.windGust),
                humidity: humidityPct,
                dewPoint: round1(current.dewPoint),
                pressure: current.pressure != null ? Math.round(current.pressure) : null,
                uvIndex: current.uvIndex ?? null,
                visibility: round1(current.visibility),
                precipitation: round1(current.precipIntensity) ?? 0,
                sunrise: epochToIso(todayDaily?.sunriseTime),
                sunset: epochToIso(todayDaily?.sunsetTime),
            },
            hourly: (data?.hourly?.data ?? []).slice(0, 24).map(h => ({
                time: epochToIso(h.time),
                temp: round1(h.temperature),
                condition: mapPirateWeatherIcon(h.icon),
                conditionText: h.summary ?? '',
                precipProbability: h.precipProbability != null
                    ? Math.round(h.precipProbability * 100)
                    : null,
                precipAmount: round1(h.precipIntensity) ?? 0,
                windSpeed: round1(h.windSpeed),
                windDirection: h.windBearing ?? null,
                windGust: round1(h.windGust),
                humidity: h.humidity != null ? Math.round(h.humidity * 100) : null,
                dewPoint: round1(h.dewPoint),
            })),
            daily: dailyData.map(d => ({
                date: epochToIso(d.time)?.split('T')[0] ?? null,
                high: round1(d.temperatureHigh),
                low: round1(d.temperatureLow),
                condition: mapPirateWeatherIcon(d.icon),
                conditionText: d.summary ?? '',
                sunrise: epochToIso(d.sunriseTime),
                sunset: epochToIso(d.sunsetTime),
                precipitationSum: round1(d.precipAccumulation ?? d.precipIntensity),
                uvIndex: d.uvIndex ?? null,
            })),
        };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Pirate Weather API request timed out');
        }
        throw err;
    }
}
