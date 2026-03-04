import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom marker (avoids CDN dependency, works in Docker/production)
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

export default function LocationMap({ lat, lon, locationName }) {
  const latitude = typeof lat === 'number' && !Number.isNaN(lat) ? lat : 40.7128;
  const longitude = typeof lon === 'number' && !Number.isNaN(lon) ? lon : -74.006;
  const center = useMemo(() => [latitude, longitude], [latitude, longitude]);
  const displayName = locationName || `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
  const icon = useMemo(createCustomIcon, []);

  return (
    <article
      className="glass-panel location-map-card"
      style={{
        padding: 0,
        overflow: 'hidden',
        minHeight: '280px',
      }}
      aria-label="Location map"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', padding: 'var(--spacing-sm) var(--spacing-lg)', borderBottom: '1px solid var(--glass-border)' }}>
        <MapPin size={18} style={{ color: 'var(--accent-cyan)' }} aria-hidden="true" />
        <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Location
        </h3>
      </div>
      <div style={{ height: '260px', width: '100%' }}>
        <MapContainer
          center={center}
          zoom={10}
          style={{ height: '100%', width: '100%', background: 'var(--bg-gradient-mid)' }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <MapUpdater center={center} zoom={10} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            subdomains={['a', 'b', 'c']}
          />
          <Marker position={center} icon={icon}>
            <Popup>{displayName}</Popup>
          </Marker>
        </MapContainer>
      </div>
    </article>
  );
}
