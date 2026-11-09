import { useCallback, useEffect, useState } from 'react';

const CITIES_KEY = 'weatherCities';
const ACTIVE_KEY = 'weatherActiveCity';
/** Pre-multi-city single manual location; migrated on first load. */
const LEGACY_LOCATION_KEY = 'weatherLocation';

function isValidCity(c) {
  return (
    c &&
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lon)
  );
}

function cityId(lat, lon) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readInitialState() {
  let cities = readJson(CITIES_KEY);
  cities = Array.isArray(cities) ? cities.filter(isValidCity) : [];
  let activeId = readJson(ACTIVE_KEY);

  const legacy = readJson(LEGACY_LOCATION_KEY);
  if (legacy && Number.isFinite(legacy.lat) && Number.isFinite(legacy.lon)) {
    const id = cityId(legacy.lat, legacy.lon);
    if (!cities.some((c) => c.id === id)) {
      cities = [...cities, { id, name: legacy.name || id, lat: legacy.lat, lon: legacy.lon }];
    }
    activeId = id;
    try {
      localStorage.removeItem(LEGACY_LOCATION_KEY);
    } catch {
      // ignore
    }
  }

  if (typeof activeId !== 'string' || !cities.some((c) => c.id === activeId)) {
    activeId = null; // null = follow device location
  }
  return { cities, activeId };
}

/**
 * Saved cities plus the active selection, persisted in localStorage.
 * activeId === null means "current location" (geolocation).
 */
export function useCities() {
  const [state, setState] = useState(readInitialState);
  const { cities, activeId } = state;

  useEffect(() => {
    try {
      localStorage.setItem(CITIES_KEY, JSON.stringify(cities));
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeId));
    } catch {
      // Storage full or unavailable — ignore
    }
  }, [cities, activeId]);

  /** Add a city (or re-select it if already saved) and make it active. */
  const addCity = useCallback(({ lat, lon, name }) => {
    const id = cityId(lat, lon);
    setState((prev) => ({
      cities: prev.cities.some((c) => c.id === id)
        ? prev.cities
        : [...prev.cities, { id, name, lat, lon }],
      activeId: id,
    }));
  }, []);

  const removeCity = useCallback((id) => {
    setState((prev) => ({
      cities: prev.cities.filter((c) => c.id !== id),
      activeId: prev.activeId === id ? null : prev.activeId,
    }));
  }, []);

  const moveCity = useCallback((id, delta) => {
    setState((prev) => {
      const from = prev.cities.findIndex((c) => c.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.cities.length) return prev;
      const next = [...prev.cities];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...prev, cities: next };
    });
  }, []);

  /** Select a saved city by id, or null for current location. */
  const selectCity = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      activeId: id === null || prev.cities.some((c) => c.id === id) ? id : prev.activeId,
    }));
  }, []);

  const activeCity = cities.find((c) => c.id === activeId) ?? null;

  return { cities, activeId, activeCity, addCity, removeCity, moveCity, selectCity };
}
