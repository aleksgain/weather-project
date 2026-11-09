/**
 * Configuration for available weather API sources.
 *
 * Precedence (highest first):
 *   1. User settings saved on the device (see ./userSettings.js)
 *   2. Docker runtime config, injected via window.__WEATHER_CONFIG__
 *   3. Vite build-time env vars (local dev)
 *   4. Hard-coded defaults below
 */
import { readUserSettings } from './userSettings';

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

/** Deployment-level values (before user overrides), for the settings UI. */
export const deploymentDefaults = Object.freeze({
  sources: Object.fromEntries(
    Object.values(weatherSources).map((s) => [
      s.id,
      Object.freeze({ enabled: s.enabled, hasKey: Boolean(s.key), key: s.key || '' }),
    ])
  ),
  showSources: uiConfig.showSources,
});

/**
 * Apply user settings on top of deployment defaults. Mutates the exported
 * objects in place so every importer sees the change without a reload.
 * @param {ReturnType<typeof readUserSettings>} settings
 */
export function applyUserSettings(settings = readUserSettings()) {
  for (const source of Object.values(weatherSources)) {
    const base = deploymentDefaults.sources[source.id];
    const override = settings.sources?.[source.id] ?? {};
    source.enabled = typeof override.enabled === 'boolean' ? override.enabled : base.enabled;
    if (source.needsKey) {
      const userKey = typeof override.key === 'string' ? override.key.trim() : '';
      source.key = userKey || base.key;
    }
  }
  uiConfig.showSources =
    typeof settings.showSources === 'boolean' ? settings.showSources : deploymentDefaults.showSources;
}

applyUserSettings();
