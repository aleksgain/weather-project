import { Sun, Wind, Droplets, Thermometer, Gauge, Eye, Droplet, Compass, Sunrise, Sunset, CloudRain, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatTemp, formatSpeed, formatDistance, getUnitLabel } from '../utils/unitConversion';

function MetricCard({ title, value, unitLabel, description, color }) {
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

function getWindDirection(degrees) {
  if (typeof degrees !== 'number' || Number.isNaN(degrees)) return 'N/A';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
  return directions[index];
}

function getPressureTrendIcon(pressure) {
  if (pressure > 1013) return TrendingUp;
  if (pressure < 1013) return TrendingDown;
  return Minus;
}

function getPressureTrendDescription(pressure) {
  if (pressure > 1020) return 'Rising · Clear skies likely';
  if (pressure > 1013) return 'Rising';
  if (pressure < 1005) return 'Falling · Storm possible';
  if (pressure < 1013) return 'Falling';
  return 'Steady';
}

function getAQIDescription(aqi) {
  if (aqi <= 1) return 'Good';
  if (aqi <= 2) return 'Moderate';
  if (aqi <= 3) return 'Unhealthy (Sensitive)';
  if (aqi <= 4) return 'Unhealthy';
  return 'Very Unhealthy';
}

function getAQIColor(aqi) {
  if (aqi <= 1) return 'var(--accent-green)';
  if (aqi <= 2) return 'var(--accent-yellow)';
  if (aqi <= 3) return 'var(--accent-orange)';
  return 'var(--accent-red)';
}

function formatTime(timestamp) {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatPressure(hPa, unit) {
  if (unit === 'imperial') {
    return (hPa * 0.02953).toFixed(2);
  }
  return Math.round(hPa);
}

function getPressureUnitLabel(unit) {
  return unit === 'imperial' ? 'inHg' : 'hPa';
}

export default function DetailedMetrics({ data, unit }) {
  if (!data?.current) return null;

  const {
    uvIndex, humidity, windSpeed, feelsLike, pressure, visibility, temp,
    windDeg, windGust, sunrise, sunset, precipitation, airQuality,
  } = data.current;

  // Calculate dew point approximation (Magnus formula simplified), clamp inputs to avoid NaN
  const safeTemp = typeof temp === 'number' && !Number.isNaN(temp) ? temp : 20;
  const safeHumidity = typeof humidity === 'number' && !Number.isNaN(humidity) ? Math.min(100, Math.max(0, humidity)) : 50;
  const dewPoint = safeTemp - (100 - safeHumidity) / 5;

  const pressureValue = pressure ?? 1013;
  const PressureTrendIcon = getPressureTrendIcon(pressureValue);

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--spacing-md)',
      }}
      className="detailed-metrics-grid"
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
        description={getHumidityDescription(humidity ?? 0)}
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
        value={formatPressure(pressureValue, unit)}
        unitLabel={getPressureUnitLabel(unit)}
        description={getPressureDescription(pressureValue)}
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
      <MetricCard
        title="Dew Point"
        value={formatTemp(dewPoint, unit)}
        unitLabel="°"
        description={dewPoint > 20 ? 'Muggy' : dewPoint > 10 ? 'Comfortable' : 'Dry'}
        Icon={Droplet}
        color="var(--accent-blue)"
      />
      <MetricCard
        title="Wind Direction"
        value={getWindDirection(windDeg)}
        unitLabel=""
        description={windGust ? `Gusts ${formatSpeed(windGust, unit)} ${getUnitLabel('speed', unit)}` : 'No gusts'}
        Icon={Compass}
        color="var(--accent-cyan)"
      />
      <MetricCard
        title="Sunrise"
        value={formatTime(sunrise)}
        unitLabel=""
        description={sunset ? `Sunset ${formatTime(sunset)}` : ''}
        Icon={Sunrise}
        color="var(--accent-yellow)"
      />
      <MetricCard
        title="Precipitation"
        value={precipitation ?? 0}
        unitLabel={unit === 'imperial' ? 'in' : 'mm'}
        description={(precipitation ?? 0) > 10 ? 'Heavy' : (precipitation ?? 0) > 2 ? 'Moderate' : 'Light or none'}
        Icon={CloudRain}
        color="var(--accent-blue)"
      />
      <MetricCard
        title="Pressure Trend"
        value={formatPressure(pressureValue, unit)}
        unitLabel={getPressureUnitLabel(unit)}
        description={getPressureTrendDescription(pressureValue)}
        Icon={PressureTrendIcon}
        color="var(--accent-purple)"
      />
      {airQuality != null && (
        <MetricCard
          title="Air Quality"
          value={airQuality}
          unitLabel="AQI"
          description={getAQIDescription(airQuality)}
          Icon={Wind}
          color={getAQIColor(airQuality)}
        />
      )}
    </section>
  );
}
