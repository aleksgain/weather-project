import { weatherSources } from '../config/weather-sources';

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

// Simple in-memory cache
const cache = {
    data: null,
    timestamp: null,
    location: null,
    CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
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

    const isExpired = Date.now() - cache.timestamp > cache.CACHE_DURATION;
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

/**
 * Clear the weather data cache
 */
export function clearCache() {
    cache.data = null;
    cache.timestamp = null;
    cache.location = null;
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

    if (weatherSources.mock.enabled) {
        promises.push(fetchMockData());
    }

    if (weatherSources.openMeteo.enabled) {
        promises.push(fetchOpenMeteoData(coords.lat, coords.lon));
    }

    // Add other sources here when enabled

    const results = await Promise.allSettled(promises);
    const successfulData = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

    if (successfulData.length === 0) {
        const errors = results
            .filter(r => r.status === 'rejected')
            .map(r => r.reason?.message || 'Unknown error');
        throw new Error(`No weather data available: ${errors.join(', ')}`);
    }

    const aggregated = aggregateData(successfulData);

    // Cache the result
    setCachedData(aggregated, coords.lat, coords.lon);

    return aggregated;
}

// --- Fetchers ---

async function fetchMockData() {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
        source: 'mock',
        current: {
            temp: 22,
            condition: 'Partly Cloudy',
            high: 26,
            low: 18,
            feelsLike: 23,
            windSpeed: 12,
            humidity: 45,
            pressure: 1012,
            uvIndex: 4,
            visibility: 10,
        },
        // Populate hourly/daily with mock data as needed
        hourly: Array.from({ length: 24 }, (_, i) => ({
            time: new Date(Date.now() + i * 3600000).toISOString(),
            temp: 20 + Math.sin(i / 4) * 5,
            condition: i > 6 && i < 18 ? 'Sunny' : 'Clear'
        })),
        daily: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() + i * 86400000).toISOString(),
            high: 25 + Math.random() * 5,
            low: 15 + Math.random() * 5,
            condition: 'Sunny'
        }))
    };
}

async function fetchOpenMeteoData(lat, lon) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto`,
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Validate response structure
        if (!data.current || !data.hourly || !data.daily) {
            throw new Error('Invalid response structure from weather API');
        }

        // Normalize Open-Meteo data
        return {
            source: 'openMeteo',
            current: {
                temp: data.current.temperature_2m,
                condition: interpretWeatherCode(data.current.weather_code),
                high: data.daily.temperature_2m_max[0],
                low: data.daily.temperature_2m_min[0],
                feelsLike: data.current.apparent_temperature,
                windSpeed: data.current.wind_speed_10m,
                humidity: data.current.relative_humidity_2m,
                pressure: Math.round(data.current.surface_pressure),
                uvIndex: data.daily.uv_index_max?.[0] ?? 0,
                visibility: 10, // Open-Meteo doesn't provide visibility in free tier
            },
            hourly: data.hourly.time.map((t, i) => ({
                time: t,
                temp: data.hourly.temperature_2m[i],
                condition: interpretWeatherCode(data.hourly.weather_code[i])
            })).slice(0, 24),
            daily: data.daily.time.map((t, i) => ({
                date: t,
                high: data.daily.temperature_2m_max[i],
                low: data.daily.temperature_2m_min[i],
                condition: interpretWeatherCode(data.daily.weather_code[i])
            }))
        };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Weather API request timed out');
        }
        console.error("Open-Meteo fetch failed:", err);
        throw err;
    }
}

// --- Aggregation ---

function aggregateData(datasets) {
    if (datasets.length === 1) return datasets[0];

    // Simple averaging for numeric values
    const count = datasets.length;
    const result = {
        current: { ...datasets[0].current },
        hourly: [...datasets[0].hourly],
        daily: [...datasets[0].daily]
    };

    // Average current stats
    const numericKeys = ['temp', 'high', 'low', 'feelsLike', 'windSpeed', 'humidity', 'pressure', 'uvIndex', 'visibility'];

    numericKeys.forEach(key => {
        const sum = datasets.reduce((acc, d) => acc + (d.current[key] || 0), 0);
        result.current[key] = Number((sum / count).toFixed(1));
    });

    // For conditions, we just take the first source's condition for now (voting logic is complex)

    return result;
}

// --- Helpers ---

/**
 * Interprets WMO weather codes into human-readable conditions
 * Full WMO code table: https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
 */
function interpretWeatherCode(code) {
    // WMO Weather interpretation codes (WW)
    const codeMap = {
        0: 'Clear',
        1: 'Mainly Clear',
        2: 'Partly Cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Depositing Rime Fog',
        51: 'Light Drizzle',
        53: 'Moderate Drizzle',
        55: 'Dense Drizzle',
        56: 'Light Freezing Drizzle',
        57: 'Dense Freezing Drizzle',
        61: 'Slight Rain',
        63: 'Moderate Rain',
        65: 'Heavy Rain',
        66: 'Light Freezing Rain',
        67: 'Heavy Freezing Rain',
        71: 'Slight Snow',
        73: 'Moderate Snow',
        75: 'Heavy Snow',
        77: 'Snow Grains',
        80: 'Slight Rain Showers',
        81: 'Moderate Rain Showers',
        82: 'Violent Rain Showers',
        85: 'Slight Snow Showers',
        86: 'Heavy Snow Showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with Slight Hail',
        99: 'Thunderstorm with Heavy Hail',
    };

    return codeMap[code] ?? 'Unknown';
}
