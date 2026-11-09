import { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { RefreshCw, CloudOff, Menu, Navigation } from 'lucide-react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { useGeolocation } from './hooks/useGeolocation';
import { useCities } from './hooks/useCities';
import { useTheme } from './hooks/useTheme';
import { useWeatherData } from './hooks/useWeatherData';
import { clearCache } from './services/weather';
import { uiConfig, applyUserSettings } from './config/weather-sources';
import { readUserSettings, writeUserSettings } from './config/userSettings';
import AtmosphericHero from './components/AtmosphericHero';
import Forecast from './components/Forecast';
import DetailedMetrics from './components/DetailedMetrics';
import UnitToggle from './components/UnitToggle';
import LocationSearch from './components/LocationSearch';
import WeatherAlerts from './components/WeatherAlerts';
import PrecipitationChart from './components/PrecipitationChart';
import SunriseSunset from './components/SunriseSunset';
import WindCompass from './components/WindCompass';
import ThemeToggle from './components/ThemeToggle';
import SourceBreakdown from './components/SourceBreakdown';
import SettingsDrawer from './components/SettingsDrawer';

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

const isNative = Capacitor.isNativePlatform();

function App() {
  const geo = useGeolocation();
  const { themeMode, resolvedTheme, setThemeMode, cycleThemeMode } = useTheme();
  const { cities, activeId, activeCity, addCity, removeCity, moveCity, selectCity } = useCities();
  const manualLocation = activeCity;
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Bumped when source settings change so uiConfig-dependent UI re-renders.
  const [, setSettingsVersion] = useState(0);

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

  // No GPS fix (denied/unavailable) but cities are saved: switch to the first
  // one instead of the deployment default location. Once per session, so
  // picking "Current location" again still retries GPS.
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (autoPickedRef.current || activeId !== null || geo.loading || !geo.usingDefault) return;
    if (cities.length === 0) return;
    autoPickedRef.current = true;
    selectCity(cities[0].id);
  }, [activeId, geo.loading, geo.usingDefault, cities, selectCity]);

  // Android: status-bar icon contrast follows the theme; back closes the drawer.
  useEffect(() => {
    if (!isNative) return;
    SystemBars.setStyle({
      style: resolvedTheme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    }).catch(() => {});
  }, [resolvedTheme]);

  const drawerOpenRef = useRef(drawerOpen);
  useEffect(() => {
    drawerOpenRef.current = drawerOpen;
  }, [drawerOpen]);
  useEffect(() => {
    if (!isNative) return undefined;
    const handle = NativeApp.addListener('backButton', () => {
      if (drawerOpenRef.current) setDrawerOpen(false);
      else NativeApp.exitApp();
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }, []);

  // Set condition-responsive body class
  useEffect(() => {
    const category = getConditionCategory(weatherData);
    document.body.className = `condition-${category}`;
    return () => {
      document.body.className = '';
    };
  }, [weatherData]);

  /** Add (or re-select) a saved city and make it active. Snapshots are per-location, so no cache wipe. */
  const handleLocationChange = useCallback(
    (location) => addCity({ lat: location.lat, lon: location.lon, name: location.name }),
    [addCity]
  );

  /** Switch to device location. */
  const handleResetLocation = useCallback(() => {
    selectCity(null);
    geo.retry();
  }, [geo, selectCity]);

  const handleSelectCity = useCallback(
    (id) => {
      if (id === null) handleResetLocation();
      else selectCity(id);
    },
    [handleResetLocation, selectCity]
  );

  const handleUnitChange = useCallback(
    (next) => {
      if (next !== unit) toggleUnit();
    },
    [unit, toggleUnit]
  );

  /** Persist source settings, apply them live, and refetch with the new mix. */
  const handleSaveSources = useCallback(
    (draft) => {
      const prev = readUserSettings();
      const sources = {};
      for (const [id, d] of Object.entries(draft.sources)) {
        sources[id] = { enabled: d.enabled, key: d.key.trim() };
      }
      writeUserSettings({ ...prev, sources, showSources: draft.showSources });
      applyUserSettings();
      clearCache();
      setSettingsVersion((v) => v + 1);
      refresh();
    },
    [refresh]
  );

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const drawer = (
    <SettingsDrawer
      open={drawerOpen}
      onClose={closeDrawer}
      isNative={isNative}
      cities={cities}
      activeId={activeId}
      currentLocationName={geo.usingDefault ? null : geo.locationName}
      onSelectCity={handleSelectCity}
      onAddCity={handleLocationChange}
      onRemoveCity={removeCity}
      onMoveCity={moveCity}
      unit={unit}
      onUnitChange={handleUnitChange}
      themeMode={themeMode}
      onThemeChange={setThemeMode}
      onSaveSources={handleSaveSources}
    />
  );

  const menuButton = (
    <button
      type="button"
      className="icon-button menu-button"
      onClick={() => setDrawerOpen(true)}
      aria-label="Open menu: locations, settings, about"
      title="Menu"
    >
      <Menu size={20} aria-hidden="true" />
    </button>
  );

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
          <button className="retry-button secondary" onClick={() => setDrawerOpen(true)}>
            <Menu size={18} aria-hidden="true" />
            Settings
          </button>
          <button
            className="retry-button"
            onClick={refresh}
            aria-label="Retry loading weather data"
          >
            <RefreshCw size={18} aria-hidden="true" />
            Try Again
          </button>
        </div>
        {drawer}
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
        <div className="app-header-bar">
          {menuButton}
          <div className="app-header-location">
            <LocationSearch
              currentLocation={activeLocationName}
              isManual={!!manualLocation}
              onLocationSelect={handleLocationChange}
              onReset={handleResetLocation}
            />
          </div>
          <button
            className={`refresh-button ${refreshing ? 'spinning' : ''}`}
            onClick={refresh}
            disabled={refreshing}
            aria-label={refreshing ? 'Refreshing...' : 'Refresh weather data'}
            title="Refresh"
          >
            <RefreshCw size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="app-header-controls">
          <span className="desktop-only">
            <ThemeToggle mode={themeMode} resolvedTheme={resolvedTheme} onToggle={cycleThemeMode} />
          </span>
          <span className="desktop-only">
            <UnitToggle unit={unit} onToggle={toggleUnit} />
          </span>
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

      {cities.length > 0 && (
        <nav className="city-chips" aria-label="Saved locations">
          <button
            type="button"
            className={`city-chip ${activeId === null ? 'active' : ''}`}
            onClick={() => handleSelectCity(null)}
            aria-pressed={activeId === null}
          >
            <Navigation size={14} aria-hidden="true" />
            <span className="sr-only">Current location</span>
          </button>
          {cities.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`city-chip ${activeId === c.id ? 'active' : ''}`}
              onClick={() => handleSelectCity(c.id)}
              aria-pressed={activeId === c.id}
            >
              {c.name}
            </button>
          ))}
        </nav>
      )}

      <main id="main-content" tabIndex={-1}>
        <WeatherAlerts alerts={alerts} />

        <div className="layout-columns">
          <section className="layout-col layout-col-main">
            <div className="panel-hero">
              <AtmosphericHero
                data={displayData}
                unit={unit}
                isManualLocation={!!manualLocation}
                referenceTime={lastUpdated}
              />
            </div>
            <div className="panel-precip">
              <PrecipitationChart data={displayData} unit={unit} referenceTime={lastUpdated} />
            </div>
            <SourceBreakdown data={displayData} unit={unit} />
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
      {drawer}
    </div>
  );
}

export default App;
