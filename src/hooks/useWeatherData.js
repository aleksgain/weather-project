import { useState, useEffect, useCallback } from 'react';
import { fetchWeatherData, fetchAlerts, clearCache } from '../services/weather';

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
        clearCache();
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch weather data and alerts in parallel
      const [data, alertsData] = await Promise.all([
        fetchWeatherData(latitude, longitude, forceRefresh),
        fetchAlerts(latitude, longitude).catch(() => []),
      ]);

      setWeatherData(data);
      setAlerts(alertsData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load weather data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
