import { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { RefreshCw, CloudOff } from 'lucide-react';
import { useGeolocation } from './hooks/useGeolocation';
import { useTheme } from './hooks/useTheme';
import { useWeatherData } from './hooks/useWeatherData';
import { clearCache } from './services/weather';
import { uiConfig } from './config/weather-sources';
import CurrentWeather from './components/CurrentWeather';
import Forecast from './components/Forecast';
import DetailedMetrics from './components/DetailedMetrics';
import UnitToggle from './components/UnitToggle';
import LocationSearch from './components/LocationSearch';
import WeatherAlerts from './components/WeatherAlerts';
import PrecipitationChart from './components/PrecipitationChart';
import SunriseSunset from './components/SunriseSunset';
import WindCompass from './components/WindCompass';
import ThemeToggle from './components/ThemeToggle';

// Lazy-load heavy map components
const WeatherMapOverlays = lazy(() => import('./components/WeatherMapOverlays'));

import './App.css';

/** Map the aggregated condition string to a category for the body class */
function getConditionCategory(weatherData) {
  const condition = weatherData?.current?.condition;
  if (!condition) return 'clear';
  const c = condition.toLowerCase();
  if (c.includes('thunder')) return 'stormy';
  if (c.includes('snow') || c.includes('sleet') || c.includes('blizzard')) return 'snowy';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower') || c.includes('freezing')) return 'rainy';
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return 'foggy';
  if (c.includes('cloud') || c.includes('overcast')) return 'cloudy';
  if (c.includes('clear') || c.includes('sunny') || c.includes('fair')) return 'clear';
  return 'cloudy';
}

const STORAGE_KEY = 'weatherLocation';

/** Read manualLocation from localStorage with error handling */
function readStoredLocation() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (
      typeof parsed?.lat === 'number' &&
      typeof parsed?.lon === 'number' &&
      typeof parsed?.name === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function App() {
  const geo = useGeolocation();
  const { themeMode, resolvedTheme, cycleThemeMode } = useTheme();
  const [manualLocation, setManualLocation] = useState(readStoredLocation);

  // Persist manualLocation to localStorage
  useEffect(() => {
    if (manualLocation) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(manualLocation));
      } catch {
        // Storage full or unavailable — ignore
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [manualLocation]);

  // When manualLocation is set, use it directly (skip geolocation)
  const effectiveOverride = useMemo(
    () =>
      manualLocation
        ? { latitude: manualLocation.lat, longitude: manualLocation.lon, name: manualLocation.name }
        : null,
    [manualLocation]
  );

  const activeLocation = useMemo(() => {
    if (effectiveOverride) return effectiveOverride;
    return {
      latitude: geo.latitude,
      longitude: geo.longitude,
    };
  }, [effectiveOverride, geo.latitude, geo.longitude]);
  const activeLocationName = effectiveOverride
    ? effectiveOverride.name
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
  } = useWeatherData(manualLocation || !geo.loading ? activeLocation : null);

  // Set condition-responsive body class
  useEffect(() => {
    const category = getConditionCategory(weatherData);
    document.body.className = `condition-${category}`;
    return () => {
      document.body.className = '';
    };
  }, [weatherData]);

  /** Set a persistent manual location, clear cache, and reload weather */
  const handleLocationChange = useCallback((location) => {
    setManualLocation({ lat: location.lat, lon: location.lon, name: location.name });
    clearCache();
    // refresh will be triggered by activeLocation change via useWeatherData
  }, []);

  /** Clear manual location, revert to geolocation detection */
  const handleResetLocation = useCallback(() => {
    setManualLocation(null);
    clearCache();
    geo.retry();
  }, [geo]);

  if (loading || (!manualLocation && geo.loading)) {
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

  const showSourcesBadge = uiConfig.showSources && displayData?.sources?.length > 0;
  const sourceNames = showSourcesBadge ? displayData.sources.join(', ') : '';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <header className="app-header">
        <div className="app-header-location">
          <LocationSearch
            currentLocation={activeLocationName}
            isManual={!!manualLocation}
            onLocationSelect={handleLocationChange}
            onReset={handleResetLocation}
          />
        </div>
        <div className="app-header-controls">
          <ThemeToggle mode={themeMode} resolvedTheme={resolvedTheme} onToggle={cycleThemeMode} />
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
          {lastUpdated && (
            <span className="last-updated">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {showSourcesBadge && (
            <span className="last-updated" title={`Sources: ${sourceNames}`}>
              Sources: {sourceNames}
              {displayData.confidence != null ? ` · ${Math.round(displayData.confidence * 100)}% confidence` : ''}
            </span>
          )}
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <WeatherAlerts alerts={alerts} />

        <div className="layout-columns">
          <section className="layout-col layout-col-main">
            <div className="panel-hero">
              <CurrentWeather
                data={displayData}
                unit={unit}
                isManualLocation={!!manualLocation}
                referenceTime={lastUpdated}
              />
            </div>
            <div className="panel-precip">
              <PrecipitationChart data={displayData} unit={unit} referenceTime={lastUpdated} />
            </div>
          </section>

          <section className="layout-col layout-col-side">
            <div className="panel-forecast">
              <Forecast data={displayData} unit={unit} referenceTime={lastUpdated} />
            </div>
            <div className="widgets-row panel-widgets">
              <SunriseSunset data={displayData} unit={unit} />
              <WindCompass data={displayData} unit={unit} />
            </div>
          </section>
        </div>

        <section className="layout-metrics">
          <DetailedMetrics data={displayData} unit={unit} />
        </section>

        <section className="layout-map">
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
        </section>

        <footer className="app-footer">
          <p>Weather data aggregated from multiple sources</p>
          <p>Built with React & Vite</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
