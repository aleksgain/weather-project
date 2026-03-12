import { useEffect, useState, useCallback, useRef } from 'react';
import { defaultLocation } from '../config/weather-sources';
import { nominatimRateLimit } from '../utils/nominatim';

function formatCoordinates(lat, lon) {
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

async function reverseGeocode(lat, lon) {
  await nominatimRateLimit();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'WeatherApp/1.0',
          'Accept-Language': 'en',
        },
      }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return (
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.county ||
        formatCoordinates(lat, lon)
      );
    }
  } catch {
    clearTimeout(timeoutId);
  }
  return formatCoordinates(lat, lon);
}

function getCurrentPosition(options) {
  return new Promise((res, rej) => {
    navigator.geolocation.getCurrentPosition(res, rej, options);
  });
}

export function useGeolocation() {
  const [state, setState] = useState({
    latitude: defaultLocation.lat,
    longitude: defaultLocation.lon,
    locationName: defaultLocation.name,
    loading: true,
    error: null,
    usingDefault: true,
  });
  const mountedRef = useRef(true);

  const resolve = useCallback(async () => {
    if (!mountedRef.current) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    let lat = defaultLocation.lat;
    let lon = defaultLocation.lon;
    let locationName = defaultLocation.name;
    let usingDefault = true;

    if ('geolocation' in navigator) {
      try {
        // First try for a fresh GPS fix to avoid stale cached locations.
        let position;
        try {
          position = await getCurrentPosition({
            timeout: 12000,
            maximumAge: 0,
            enableHighAccuracy: true,
          });
        } catch {
          // Fallback to a faster, potentially cached estimate.
          position = await getCurrentPosition({
            timeout: 8000,
            maximumAge: 300000,
            enableHighAccuracy: false,
          });
        }
        lat = position.coords.latitude;
        lon = position.coords.longitude;
        usingDefault = false;
        locationName = await reverseGeocode(lat, lon);
      } catch {
        // Fall back to default location
      }
    }

    if (mountedRef.current) {
      setState({
        latitude: lat,
        longitude: lon,
        locationName,
        loading: false,
        error: null,
        usingDefault,
      });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Schedule resolve to avoid synchronous setState within effect body
    const id = setTimeout(() => resolve(), 0);
    return () => {
      clearTimeout(id);
      mountedRef.current = false;
    };
  }, [resolve]);

  return { ...state, retry: resolve };
}
