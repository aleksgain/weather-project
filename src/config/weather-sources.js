/**
 * Configuration for available weather API sources.
 * 
 * In Docker, these are injected at runtime via window.__WEATHER_CONFIG__
 * For local dev, they're read from Vite's import.meta.env
 */

// Runtime config (injected by Docker entrypoint) or build-time config
const runtimeConfig = typeof window !== 'undefined' ? window.__WEATHER_CONFIG__ : null;

/**
 * Helper to get config value with runtime override support
 */
function getEnvVar(key, defaultValue = '') {
  // First check runtime config (Docker)
  if (runtimeConfig && runtimeConfig[key] !== undefined) {
    return runtimeConfig[key];
  }
  // Fall back to build-time env vars (Vite exposes these via envPrefix)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Parse boolean from string (for env vars)
 */
function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
}

export const weatherSources = {
  openMeteo: {
    id: 'openMeteo',
    name: 'Open-Meteo',
    enabled: parseBool(getEnvVar('OPENMETEO_ENABLED'), true), // Default enabled (free, no key needed)
    needsKey: false,
    baseUrl: 'https://api.open-meteo.com/v1',
  },
  openWeatherMap: {
    id: 'openWeatherMap',
    name: 'OpenWeatherMap',
    enabled: parseBool(getEnvVar('OPENWEATHER_ENABLED'), false),
    needsKey: true,
    key: getEnvVar('OPENWEATHER_API_KEY', ''),
    baseUrl: 'https://api.openweathermap.org/data/2.5',
  },
  weatherApi: {
    id: 'weatherApi',
    name: 'WeatherAPI',
    enabled: parseBool(getEnvVar('WEATHERAPI_ENABLED'), false),
    needsKey: true,
    key: getEnvVar('WEATHERAPI_KEY', ''),
    baseUrl: 'https://api.weatherapi.com/v1',
  },
  nws: {
    id: 'nws',
    name: 'National Weather Service',
    // Free, no API key, US only. Enabled by default — non-US coords fall back gracefully.
    enabled: parseBool(getEnvVar('NWS_ENABLED'), true),
    needsKey: false,
    baseUrl: 'https://api.weather.gov',
  },
  metNorway: {
    id: 'metNorway',
    name: 'MET Norway',
    // Free, no API key, CC BY 4.0 license. Enabled by default.
    enabled: parseBool(getEnvVar('METNORWAY_ENABLED'), true),
    needsKey: false,
    baseUrl: 'https://api.met.no/weatherapi/locationforecast/2.0',
  },
  pirateWeather: {
    id: 'pirateWeather',
    name: 'Pirate Weather',
    // 20K calls/month free with registration. Off by default until a key is set.
    enabled: parseBool(getEnvVar('PIRATEWEATHER_ENABLED'), false),
    needsKey: true,
    key: getEnvVar('PIRATEWEATHER_API_KEY', ''),
    baseUrl: 'https://api.pirateweather.net/forecast',
  },
};

export const defaultLocation = {
  lat: parseFloat(getEnvVar('DEFAULT_LAT', '40.7128')),
  lon: parseFloat(getEnvVar('DEFAULT_LON', '-74.0060')),
  name: getEnvVar('DEFAULT_LOCATION_NAME', 'New York'),
};

export const uiConfig = {
  showSources: parseBool(getEnvVar('SHOW_SOURCES'), false),
};
