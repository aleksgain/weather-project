import { weatherSources } from '../config/weather-sources';
import { fetchOpenMeteoData } from './apis/openMeteo';
import { fetchOpenWeatherMapData } from './apis/openWeatherMap';
import { fetchWeatherApiData } from './apis/weatherApi';
import { fetchNwsData, fetchNwsAlerts } from './apis/nws';
import { aggregateWeatherData } from './aggregator';

// Standardized Weather Data Interface (JSDoc)
/**
 * @typedef {Object} WeatherData
 * @property {object} current
 * @property {number} current.temp - Temperature in Celsius
 * @property {string} current.condition - Text description (e.g., "Partly Cloudy")
 * @property {number} current.high - Daily high in Celsius
 * @property {number} current.low - Daily low in Celsius
 * @property {number} current.feelsLike - Feels like temp in Celsius
 * @property {number} current.windSpeed - km/h
 * @property {number} current.humidity - %
 * @property {number} current.pressure - hPa
 * @property {number} current.uvIndex - 0-11+
 * @property {number} current.visibility - km
 * @property {Array<Object>} hourly - Array of hourly forecast objects
 * @property {Array<Object>} daily - Array of daily forecast objects
 */

/** Max age before refetching (persisted + in-memory); aligns with background refresh interval */
export const WEATHER_UI_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

const UI_CACHE_STORAGE_KEY = 'weatherUiBundle';
const UI_CACHE_VERSION = 1;

// Simple in-memory cache (session); hydrated from localStorage on cold start
const cache = {
    data: null,
    timestamp: null,
    location: null,
    CACHE_DURATION: WEATHER_UI_CACHE_MAX_AGE_MS,
};

/**
 * Validates and sanitizes coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {{lat: number, lon: number}} - Sanitized coordinates
 * @throws {Error} - If coordinates are invalid
 */
function validateCoordinates(lat, lon) {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
        throw new Error('Invalid coordinates: must be numbers');
    }

    if (parsedLat < -90 || parsedLat > 90) {
        throw new Error('Invalid latitude: must be between -90 and 90');
    }

    if (parsedLon < -180 || parsedLon > 180) {
        throw new Error('Invalid longitude: must be between -180 and 180');
    }

    // Round to 4 decimal places for privacy and API consistency
    return {
        lat: Math.round(parsedLat * 10000) / 10000,
        lon: Math.round(parsedLon * 10000) / 10000,
    };
}

/**
 * Check if cached data is still valid
 */
function getCachedData(lat, lon) {
    if (!cache.data || !cache.timestamp || !cache.location) {
        return null;
    }

    const isExpired = Date.now() - cache.timestamp >= cache.CACHE_DURATION;
    const isSameLocation =
        Math.abs(cache.location.lat - lat) < 0.01 &&
        Math.abs(cache.location.lon - lon) < 0.01;

    if (isExpired || !isSameLocation) {
        return null;
    }

    return cache.data;
}

/**
 * Store data in cache
 */
function setCachedData(data, lat, lon) {
    cache.data = data;
    cache.timestamp = Date.now();
    cache.location = { lat, lon };
}

/** Drop in-memory cache only (user refresh: force network without wiping cold-start snapshot). */
export function clearMemoryCache() {
    cache.data = null;
    cache.timestamp = null;
    cache.location = null;
}

/**
 * Clear in-memory and persisted UI cache (e.g. location change).
 */
export function clearCache() {
    clearMemoryCache();
    try {
        localStorage.removeItem(UI_CACHE_STORAGE_KEY);
    } catch {
        // ignore
    }
}

/**
 * Restore in-memory cache from a persisted snapshot timestamp (for TTL correctness).
 * @param {WeatherData} data
 * @param {number} lat
 * @param {number} lon
 * @param {number} fetchedAt - epoch ms when snapshot was written
 */
export function hydrateMemoryCacheFromSnapshot(data, lat, lon, fetchedAt) {
    const coords = validateCoordinates(lat, lon);
    cache.data = data;
    cache.timestamp = fetchedAt;
    cache.location = { lat: coords.lat, lon: coords.lon };
}

/**
 * @returns {{ data: WeatherData, alerts: unknown[], fetchedAt: number } | null}
 */
export function readPersistedUiBundle(lat, lon) {
    try {
        const coords = validateCoordinates(lat, lon);
        const raw = localStorage.getItem(UI_CACHE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.v !== UI_CACHE_VERSION || !parsed?.data || typeof parsed.fetchedAt !== 'number') {
            return null;
        }
        const sameLocation =
            Math.abs(parsed.lat - coords.lat) < 0.01 && Math.abs(parsed.lon - coords.lon) < 0.01;
        if (!sameLocation) return null;
        const alerts = Array.isArray(parsed.alerts) ? parsed.alerts : [];
        return { data: parsed.data, alerts, fetchedAt: parsed.fetchedAt };
    } catch {
        try {
            localStorage.removeItem(UI_CACHE_STORAGE_KEY);
        } catch {
            // ignore
        }
        return null;
    }
}

/**
 * @param {WeatherData} data
 * @param {unknown[]} alerts
 * @param {number} fetchedAt - epoch ms
 */
export function writePersistedUiBundle(lat, lon, data, alerts, fetchedAt) {
    try {
        const coords = validateCoordinates(lat, lon);
        const payload = {
            v: UI_CACHE_VERSION,
            lat: coords.lat,
            lon: coords.lon,
            data,
            alerts,
            fetchedAt,
        };
        localStorage.setItem(UI_CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // quota / private mode — ignore
    }
}

/**
 * Check if coordinates are roughly within the continental US
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean}
 */
function isUSCoordinates(lat, lon) {
    return lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66;
}

/**
 * Fetches weather data from all enabled sources and aggregates it.
 * @param {number} lat
 * @param {number} lon
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 * @returns {Promise<WeatherData>}
 */
export async function fetchWeatherData(lat, lon, forceRefresh = false) {
    // Validate and sanitize coordinates
    const coords = validateCoordinates(lat, lon);

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
        const cached = getCachedData(coords.lat, coords.lon);
        if (cached) {
            return cached;
        }
    }

    const promises = [];

    // Build fetch promises dynamically from weather sources config
    for (const source of Object.values(weatherSources)) {
        if (!source.enabled) continue;

        // Skip sources that need an API key but don't have one
        if (source.needsKey && !source.key) continue;

        switch (source.id) {
            case 'openMeteo':
                promises.push(fetchOpenMeteoData(coords.lat, coords.lon));
                break;
            case 'openWeatherMap':
                promises.push(fetchOpenWeatherMapData(coords.lat, coords.lon, source.key));
                break;
            case 'weatherApi':
                promises.push(fetchWeatherApiData(coords.lat, coords.lon, source.key));
                break;
            case 'nws':
                // NWS only works for US coordinates
                if (isUSCoordinates(coords.lat, coords.lon)) {
                    promises.push(fetchNwsData(coords.lat, coords.lon));
                }
                break;
            default:
                break;
        }
    }

    if (promises.length === 0) {
        throw new Error('No weather sources are enabled or available');
    }

    const results = await Promise.allSettled(promises);
    const successfulData = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(d => d && typeof d === 'object' && d.current);

    if (successfulData.length === 0) {
        const errors = results
            .filter(r => r.status === 'rejected')
            .map(r => r.reason?.message || 'Unknown error');
        if (errors.length > 0) {
            throw new Error(`No weather data available: ${errors.join(', ')}`);
        }
        throw new Error('No weather data available for this location from enabled sources');
    }

    const aggregated = aggregateWeatherData(successfulData);

    // Cache the result
    setCachedData(aggregated, coords.lat, coords.lon);

    return aggregated;
}

/**
 * Fetches weather alerts from available sources.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Array<Object>>} - Array of alert objects
 */
export async function fetchAlerts(lat, lon) {
    const coords = validateCoordinates(lat, lon);
    const alertPromises = [];

    // NWS alerts (US only)
    if (weatherSources.nws.enabled && isUSCoordinates(coords.lat, coords.lon)) {
        alertPromises.push(fetchNwsAlerts(coords.lat, coords.lon));
    }

    if (alertPromises.length === 0) {
        return [];
    }

    const results = await Promise.allSettled(alertPromises);
    const allAlerts = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);

    return allAlerts;
}
