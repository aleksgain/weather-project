import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  LayersControl,
} from 'react-leaflet';
import { Map } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const createCustomIcon = () =>
  L.divIcon({
    className: 'location-map-marker',
    html: '<div style="width:24px;height:24px;background:#58d1eb;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

const OWM_LAYERS = [
  { id: 'temp_new', label: 'Temperature' },
  { id: 'precipitation_new', label: 'Precipitation' },
  { id: 'wind_new', label: 'Wind' },
  { id: 'clouds_new', label: 'Clouds' },
];

function useRainViewerTimestamp() {
  const [timestamp, setTimestamp] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.radar?.past?.length) {
          const latest = data.radar.past[data.radar.past.length - 1];
          setTimestamp(latest.path);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return timestamp;
}

export default function WeatherMapOverlays({ lat, lon, locationName, weatherSources }) {
  const latitude = typeof lat === 'number' && !Number.isNaN(lat) ? lat : 40.7128;
  const longitude = typeof lon === 'number' && !Number.isNaN(lon) ? lon : -74.006;
  const center = useMemo(() => [latitude, longitude], [latitude, longitude]);
  const displayName = locationName || `${latitude.toFixed(2)}\u00b0, ${longitude.toFixed(2)}\u00b0`;
  const icon = useMemo(() => createCustomIcon(), []);
  const rainViewerPath = useRainViewerTimestamp();

  const owmKey = weatherSources?.openweathermap?.apiKey || weatherSources?.owmApiKey || null;

  return (
    <article
      className="glass-panel weather-map-overlays-card"
      style={{ padding: 0, overflow: 'hidden', minHeight: '360px' }}
      aria-label="Weather map with overlays"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        <Map size={18} style={{ color: 'var(--accent-cyan)' }} aria-hidden="true" />
        <h3
          style={{
            margin: 0,
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Weather Map
        </h3>
      </div>

      <style>{`
        .weather-map-overlays-card .leaflet-control-layers {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.85);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }
        .weather-map-overlays-card .leaflet-control-layers-separator {
          border-top-color: rgba(255, 255, 255, 0.1);
        }
        .weather-map-overlays-card .leaflet-control-layers label {
          color: rgba(255, 255, 255, 0.85);
        }
        .weather-map-overlays-card .leaflet-control-layers-toggle {
          background-color: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
        }
      `}</style>

      <div style={{ height: '340px', width: '100%' }}>
        <MapContainer
          center={center}
          zoom={7}
          style={{ height: '100%', width: '100%', background: 'var(--bg-gradient-mid)' }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <MapUpdater center={center} zoom={7} />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Dark Matter">
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains={['a', 'b', 'c', 'd']}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="OpenStreetMap">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                subdomains={['a', 'b', 'c']}
              />
            </LayersControl.BaseLayer>

            {owmKey &&
              OWM_LAYERS.map((layer) => (
                <LayersControl.Overlay key={layer.id} name={layer.label}>
                  <TileLayer
                    url={`https://tile.openweathermap.org/map/${layer.id}/{z}/{x}/{y}.png?appid=${owmKey}`}
                    opacity={0.6}
                  />
                </LayersControl.Overlay>
              ))}

            {rainViewerPath && (
              <LayersControl.Overlay checked name="Rain Radar">
                <TileLayer
                  url={`https://tilecache.rainviewer.com${rainViewerPath}/256/{z}/{x}/{y}/2/1_1.png`}
                  opacity={0.5}
                />
              </LayersControl.Overlay>
            )}
          </LayersControl>

          <Marker position={center} icon={icon}>
            <Popup>{displayName}</Popup>
          </Marker>
        </MapContainer>
      </div>
    </article>
  );
}
