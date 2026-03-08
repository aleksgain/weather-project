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
    enabled: parseBool(getEnvVar('NWS_ENABLED'), false),
    needsKey: false,
    baseUrl: 'https://api.weather.gov',
  },
  mock: {
    id: 'mock',
    name: 'Mock Data',
    enabled: parseBool(getEnvVar('MOCK_ENABLED'), false),
    needsKey: false,
  },
};

export const defaultLocation = {
  lat: parseFloat(getEnvVar('DEFAULT_LAT', '40.7128')),
  lon: parseFloat(getEnvVar('DEFAULT_LON', '-74.0060')),
  name: getEnvVar('DEFAULT_LOCATION_NAME', 'New York'),
};
