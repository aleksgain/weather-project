import { useState, useCallback, useRef } from 'react';
import { nominatimRateLimit } from '../utils/nominatim';

export function useLocationSearch() {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const controllerRef = useRef(null);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Cancel any in-flight request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      await nominatimRateLimit();
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=5`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'WeatherApp/1.0' },
        }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      const mapped = data.map((item) => ({
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        displayName: item.display_name,
      }));

      if (!controller.signal.aborted) {
        setResults(mapped);
        setLoading(false);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Search failed');
        setLoading(false);
      }
    }
  }, []);

  const setQuery = useCallback(
    (value) => {
      setQueryState(value);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    },
    [performSearch]
  );

  const selectLocation = useCallback((location) => {
    setQueryState(location.displayName || '');
    setResults([]);
    return location;
  }, []);

  const clearResults = useCallback(() => {
    setQueryState('');
    setResults([]);
    setError(null);
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
  }, []);

  return { query, setQuery, results, loading, error, selectLocation, clearResults };
}
