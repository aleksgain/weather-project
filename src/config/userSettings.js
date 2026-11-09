/**
 * User-editable settings persisted on the device (localStorage).
 *
 * These override the deployment config (Docker `window.__WEATHER_CONFIG__` or
 * Vite env vars). A missing value means "use the deployment default", so a
 * Docker install with no user changes behaves exactly as before, and the
 * Android build (which has no deployment config) is configured entirely here.
 *
 * Shape:
 * {
 *   sources: { [sourceId]: { enabled?: boolean, key?: string } },
 *   showSources?: boolean,
 * }
 */

const STORAGE_KEY = 'weatherSettings';

export function readUserSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sources: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { sources: {} };
    return {
      ...parsed,
      sources: parsed.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
    };
  } catch {
    return { sources: {} };
  }
}

export function writeUserSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function clearUserSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
