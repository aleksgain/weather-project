import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchWeatherData,
  fetchAlerts,
  clearMemoryCache,
  hydrateMemoryCacheFromSnapshot,
  readPersistedUiBundle,
  writePersistedUiBundle,
  WEATHER_UI_CACHE_MAX_AGE_MS,
} from '../services/weather';

/**
 * High-level hook that orchestrates weather data loading.
 * @param {{ latitude: number, longitude: number } | null} location
 * @returns {object}
 */
export function useWeatherData(location) {
  const [weatherData, setWeatherData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  /** True once we can show a non-error screen (network or persisted). */
  const hasDisplayableDataRef = useRef(false);
  const [unit, setUnit] = useState(() => {
    const saved = localStorage.getItem('weatherUnit');
    return saved === 'imperial' ? 'imperial' : 'metric';
  });

  const latitude = location?.latitude ?? null;
  const longitude = location?.longitude ?? null;

  const toggleUnit = useCallback(() => {
    setUnit((prev) => (prev === 'metric' ? 'imperial' : 'metric'));
  }, []);

  // Persist unit preference
  useEffect(() => {
    localStorage.setItem('weatherUnit', unit);
  }, [unit]);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (latitude == null || longitude == null) {
      setLoading(false);
      return;
    }

    try {
      if (forceRefresh) {
        setRefreshing(true);
        clearMemoryCache();
        if (!hasDisplayableDataRef.current) {
          setLoading(true);
        }
      } else {
        const persisted = readPersistedUiBundle(latitude, longitude);
        if (persisted) {
          hasDisplayableDataRef.current = true;
          hydrateMemoryCacheFromSnapshot(
            persisted.data,
            latitude,
            longitude,
            persisted.fetchedAt
          );
          setWeatherData(persisted.data);
          setAlerts(persisted.alerts);
          setLastUpdated(new Date(persisted.fetchedAt));
          setLoading(false);
          setError(null);
          const stale = Date.now() - persisted.fetchedAt >= WEATHER_UI_CACHE_MAX_AGE_MS;
          if (!stale) {
            return;
          }
          setRefreshing(true);
        } else {
          hasDisplayableDataRef.current = false;
          setWeatherData(null);
          setAlerts([]);
          setLastUpdated(null);
          setLoading(true);
        }
      }
      setError(null);

      const [data, alertsData] = await Promise.all([
        fetchWeatherData(latitude, longitude, forceRefresh),
        fetchAlerts(latitude, longitude).catch(() => []),
      ]);

      const now = Date.now();
      setWeatherData(data);
      setAlerts(alertsData);
      setLastUpdated(new Date(now));
      hasDisplayableDataRef.current = true;
      writePersistedUiBundle(latitude, longitude, data, alertsData, now);
    } catch (err) {
      if (!hasDisplayableDataRef.current) {
        setError(err.message || 'Failed to load weather data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (latitude == null || longitude == null) return undefined;
    const id = setInterval(() => {
      loadData(false);
    }, WEATHER_UI_CACHE_MAX_AGE_MS);
    return () => clearInterval(id);
  }, [latitude, longitude, loadData]);

  const refresh = useCallback(() => {
    if (!refreshing) {
      loadData(true);
    }
  }, [refreshing, loadData]);

  return {
    weatherData,
    alerts,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
    sources: weatherData?.sources ?? [],
    confidence: weatherData?.confidence ?? null,
    unit,
    toggleUnit,
  };
}
