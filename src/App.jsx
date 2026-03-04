import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { RefreshCw, CloudOff } from 'lucide-react';
import { fetchWeatherData, clearCache } from './services/weather';
import { defaultLocation } from './config/weather-sources';

// Nominatim usage policy: max 1 request per second
let lastNominatimCall = 0;
async function nominatimRateLimit() {
  const elapsed = Date.now() - lastNominatimCall;
  if (elapsed < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - elapsed));
  }
  lastNominatimCall = Date.now();
}
import CurrentWeather from './components/CurrentWeather';
import Forecast from './components/Forecast';
import DetailedMetrics from './components/DetailedMetrics';
import UnitToggle from './components/UnitToggle';

// Lazy-load map (Leaflet needs DOM; avoids init issues in Docker)
const LocationMap = lazy(() => import('./components/LocationMap'));
import './App.css';

function App() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [unit, setUnit] = useState(() => {
    // Persist unit preference
    const saved = localStorage.getItem('weatherUnit');
    return saved === 'imperial' ? 'imperial' : 'metric';
  });
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
        clearCache();
      } else {
        setLoading(true);
      }
      setError(null);

      let lat = defaultLocation.lat;
      let lon = defaultLocation.lon;
      let locationName = defaultLocation.name;

      // Try to get user location
      if ('geolocation' in navigator) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 8000,
              maximumAge: 300000, // Cache position for 5 minutes
              enableHighAccuracy: false,
            });
          });
          lat = position.coords.latitude;
          lon = position.coords.longitude;

          // Reverse geocode to get location name (Nominatim: 1 req/sec max)
          try {
            await nominatimRateLimit();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const geoResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
              {
                signal: controller.signal,
                headers: {
                  'User-Agent': 'WeatherApp/1.0',
                },
              }
            );

            clearTimeout(timeoutId);

            if (geoResponse.ok) {
              const geoData = await geoResponse.json();
              locationName =
                geoData.address?.city ||
                geoData.address?.town ||
                geoData.address?.village ||
                geoData.address?.county ||
                formatCoordinates(lat, lon);
            }
          } catch {
            locationName = formatCoordinates(lat, lon);
          }
        } catch (geoError) {
          console.info('Using default location:', geoError.message);
        }
      }

      const data = await fetchWeatherData(lat, lon, forceRefresh);
      data.locationName = locationName;
      data.lat = lat;
      data.lon = lon;
      setWeatherData(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load weather data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save unit preference
  useEffect(() => {
    localStorage.setItem('weatherUnit', unit);
  }, [unit]);

  const toggleUnit = () => {
    setUnit((prev) => (prev === 'metric' ? 'imperial' : 'metric'));
  };

  const handleRefresh = () => {
    if (!refreshing) {
      loadData(true);
    }
  };

  if (loading) {
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
            onClick={() => loadData()}
            aria-label="Retry loading weather data"
          >
            <RefreshCw size={18} aria-hidden="true" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <header className="app-header">
        {lastUpdated && (
          <span className="last-updated">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          className={`refresh-button ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label={refreshing ? 'Refreshing...' : 'Refresh weather data'}
          title="Refresh"
        >
          <RefreshCw size={20} aria-hidden="true" />
        </button>
        <UnitToggle unit={unit} onToggle={toggleUnit} />
      </header>

      <main id="main-content" tabIndex={-1}>
        <CurrentWeather data={weatherData} unit={unit} />
        <Forecast data={weatherData} unit={unit} />
        <DetailedMetrics data={weatherData} unit={unit} />
        <Suspense fallback={<div className="glass-panel location-map-card" style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="skeleton" style={{ width: '100%', height: 260, borderRadius: 'var(--card-radius-sm)' }} /></div>}>
          <LocationMap lat={weatherData.lat} lon={weatherData.lon} locationName={weatherData.locationName} />
        </Suspense>

        <footer className="app-footer">
          <p>Weather data from Open-Meteo</p>
          <p>Built with React & Vite</p>
        </footer>
      </main>
    </div>
  );
}

function formatCoordinates(lat, lon) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}

export default App;
