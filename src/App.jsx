import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { RefreshCw, CloudOff, MapPin } from 'lucide-react';
import { useGeolocation } from './hooks/useGeolocation';
import { useWeatherData } from './hooks/useWeatherData';
import CurrentWeather from './components/CurrentWeather';
import Forecast from './components/Forecast';
import DetailedMetrics from './components/DetailedMetrics';
import UnitToggle from './components/UnitToggle';
import LocationSearch from './components/LocationSearch';
import WeatherAlerts from './components/WeatherAlerts';
import PrecipitationChart from './components/PrecipitationChart';
import SunriseSunset from './components/SunriseSunset';
import WindCompass from './components/WindCompass';

// Lazy-load heavy map components
const WeatherMapOverlays = lazy(() => import('./components/WeatherMapOverlays'));

import './App.css';

/** Map WMO weather codes to condition categories for body class */
function getConditionCategory(weatherData) {
  if (!weatherData?.current?.weatherCode) return 'clear';
  const code = weatherData.current.weatherCode;
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'foggy';
  if (code >= 51 && code <= 67) return 'rainy';
  if (code >= 71 && code <= 77) return 'snowy';
  if (code >= 80 && code <= 82) return 'rainy';
  if (code >= 85 && code <= 86) return 'snowy';
  if (code >= 95) return 'stormy';
  return 'cloudy';
}

function App() {
  const geo = useGeolocation();
  const [overrideLocation, setOverrideLocation] = useState(null);

  const activeLocation = overrideLocation || {
    latitude: geo.latitude,
    longitude: geo.longitude,
  };
  const activeLocationName = overrideLocation
    ? overrideLocation.name
    : geo.locationName;

  const {
    weatherData,
    alerts,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
    unit,
    toggleUnit,
  } = useWeatherData(geo.loading ? null : activeLocation);

  // Set condition-responsive body class
  useEffect(() => {
    const category = getConditionCategory(weatherData);
    document.body.className = `condition-${category}`;
    return () => {
      document.body.className = '';
    };
  }, [weatherData]);

  const handleLocationSelect = useCallback((location) => {
    setOverrideLocation({
      latitude: location.lat,
      longitude: location.lon,
      name: location.displayName || `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`,
    });
  }, []);

  const handleUseMyLocation = useCallback(() => {
    setOverrideLocation(null);
    geo.retry();
  }, [geo]);

  if (loading || geo.loading) {
    return (
      <div className="loading-container" role="status" aria-live="polite">
        <div className="loading-spinner" aria-hidden="true" />
        <p className="loading-text">Fetching weather data...</p>
        <div className="loading-skeleton-grid" aria-hidden="true">
          <div className="skeleton loading-skeleton-item" />
          <div className="skeleton loading-skeleton-item" />
        </div>
        <span className="sr-only">Loading weather information, please wait.</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container" role="alert" aria-live="assertive">
        <CloudOff className="error-icon" aria-hidden="true" />
        <h1 className="error-title">Unable to Load Weather</h1>
        <p className="error-message">{error}</p>
        <div className="error-actions">
          <button
            className="retry-button"
            onClick={refresh}
            aria-label="Retry loading weather data"
          >
            <RefreshCw size={18} aria-hidden="true" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const displayData = weatherData
    ? {
        ...weatherData,
        locationName: activeLocationName,
        lat: activeLocation.latitude,
        lon: activeLocation.longitude,
      }
    : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <header className="app-header">
        <LocationSearch onLocationSelect={handleLocationSelect} />
        <UnitToggle unit={unit} onToggle={toggleUnit} />
        <button
          className={`refresh-button ${refreshing ? 'spinning' : ''}`}
          onClick={refresh}
          disabled={refreshing}
          aria-label={refreshing ? 'Refreshing...' : 'Refresh weather data'}
          title="Refresh"
        >
          <RefreshCw size={20} aria-hidden="true" />
        </button>
        {overrideLocation && (
          <button
            className="refresh-button"
            onClick={handleUseMyLocation}
            aria-label="Use my current location"
            title="Use my location"
          >
            <MapPin size={20} aria-hidden="true" />
          </button>
        )}
        {lastUpdated && (
          <span className="last-updated">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </header>

      <main id="main-content" tabIndex={-1}>
        <WeatherAlerts alerts={alerts} />

        <CurrentWeather data={displayData} unit={unit} />

        <Forecast data={displayData} unit={unit} />

        <PrecipitationChart data={displayData} unit={unit} />

        <div className="widgets-row">
          <SunriseSunset data={displayData} />
          <WindCompass data={displayData} unit={unit} />
        </div>

        <DetailedMetrics data={displayData} unit={unit} />

        <Suspense
          fallback={
            <div
              className="glass-panel"
              style={{
                minHeight: 280,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                className="skeleton"
                style={{
                  width: '100%',
                  height: 260,
                  borderRadius: 'var(--card-radius-sm)',
                }}
              />
            </div>
          }
        >
          <WeatherMapOverlays
            lat={displayData?.lat}
            lon={displayData?.lon}
            locationName={displayData?.locationName}
          />
        </Suspense>

        <footer className="app-footer">
          <p>Weather data from Open-Meteo</p>
          <p>Built with React & Vite</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
