import { Sun, Wind, Droplets, Thermometer, Gauge, Eye } from 'lucide-react';
import { formatTemp, formatSpeed, formatDistance, getUnitLabel } from '../utils/unitConversion';

function MetricCard({ title, value, unitLabel, description, Icon, color }) {
  return (
    <article
      className="glass-panel"
      style={{
        padding: 'var(--spacing-lg)',
        aspectRatio: '1',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '140px',
      }}
      aria-label={`${title}: ${value} ${unitLabel}. ${description}`}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <Icon size={16} style={{ color: color || 'currentColor' }} aria-hidden="true" />
        {title}
      </div>
      <div>
        <div
          className="mono"
          style={{
            fontSize: 'clamp(1.75rem, 5vw, 2.25rem)',
            fontWeight: 500,
            lineHeight: 1.1,
            color: 'var(--text-primary)',
          }}
        >
          {value}
          <span
            style={{
              fontSize: '1rem',
              color: 'var(--text-muted)',
              marginLeft: '4px',
              fontWeight: 400,
            }}
          >
            {unitLabel}
          </span>
        </div>
        {description && (
          <div
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              marginTop: 'var(--spacing-xs)',
            }}
          >
            {description}
          </div>
        )}
      </div>
    </article>
  );
}

function getUVDescription(uvIndex) {
  if (uvIndex <= 2) return 'Low';
  if (uvIndex <= 5) return 'Moderate';
  if (uvIndex <= 7) return 'High';
  if (uvIndex <= 10) return 'Very High';
  return 'Extreme';
}

function getUVColor(uvIndex) {
  if (uvIndex <= 2) return 'var(--accent-green)';
  if (uvIndex <= 5) return 'var(--accent-yellow)';
  if (uvIndex <= 7) return 'var(--accent-orange)';
  return 'var(--accent-red)';
}

function getHumidityDescription(humidity) {
  if (humidity < 30) return 'Dry';
  if (humidity < 60) return 'Comfortable';
  if (humidity < 80) return 'Humid';
  return 'Very Humid';
}

function getVisibilityDescription(km) {
  if (km >= 10) return 'Excellent';
  if (km >= 5) return 'Good';
  if (km >= 2) return 'Moderate';
  return 'Poor';
}

function getPressureDescription(hPa) {
  if (hPa > 1020) return 'High';
  if (hPa < 1010) return 'Low';
  return 'Normal';
}

export default function DetailedMetrics({ data, unit }) {
  if (!data?.current) return null;

  const { uvIndex, humidity, windSpeed, feelsLike, pressure, visibility, temp } = data.current;

  // Calculate dew point approximation (Magnus formula simplified), clamp inputs to avoid NaN
  const safeTemp = typeof temp === 'number' && !Number.isNaN(temp) ? temp : 20;
  const safeHumidity = typeof humidity === 'number' && !Number.isNaN(humidity) ? Math.min(100, Math.max(0, humidity)) : 50;
  const dewPoint = safeTemp - (100 - safeHumidity) / 5;

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--spacing-md)',
      }}
      aria-label="Detailed weather metrics"
    >
      <MetricCard
        title="UV Index"
        value={uvIndex ?? 0}
        unitLabel=""
        description={getUVDescription(uvIndex)}
        Icon={Sun}
        color={getUVColor(uvIndex)}
      />
      <MetricCard
        title="Humidity"
        value={humidity ?? 0}
        unitLabel="%"
        description={`${getHumidityDescription(humidity ?? 0)} · Dew ${formatTemp(dewPoint, unit)}°`}
        Icon={Droplets}
        color="var(--accent-blue)"
      />
      <MetricCard
        title="Wind"
        value={formatSpeed(windSpeed ?? 0, unit)}
        unitLabel={getUnitLabel('speed', unit)}
        description={(windSpeed ?? 0) > 30 ? 'Strong winds' : (windSpeed ?? 0) > 15 ? 'Breezy' : 'Light winds'}
        Icon={Wind}
        color="var(--accent-cyan)"
      />
      <MetricCard
        title="Feels Like"
        value={formatTemp(feelsLike ?? temp, unit)}
        unitLabel="°"
        description={
          Math.abs((feelsLike ?? temp) - temp) < 2
            ? 'Similar to actual'
            : (feelsLike ?? temp) > temp
              ? 'Feels warmer'
              : 'Feels cooler'
        }
        Icon={Thermometer}
        color="var(--accent-orange)"
      />
      <MetricCard
        title="Pressure"
        value={pressure ?? 1013}
        unitLabel="hPa"
        description={getPressureDescription(pressure)}
        Icon={Gauge}
        color="var(--accent-purple)"
      />
      <MetricCard
        title="Visibility"
        value={formatDistance(visibility ?? 10, unit)}
        unitLabel={getUnitLabel('distance', unit)}
        description={getVisibilityDescription(visibility)}
        Icon={Eye}
        color="var(--accent-green)"
      />
    </section>
  );
}
