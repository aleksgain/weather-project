import { Sunrise, Sunset } from 'lucide-react';
import { getSunriseSunset, getDayLength } from '../utils/astronomy';

function formatTime(date) {
  if (!date) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDayLength(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function parseSunInstant(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function SunriseSunset({ data }) {
  const lat = data?.location?.lat ?? data?.lat;
  const lon = data?.location?.lon ?? data?.lon;
  if (lat == null || lon == null) return null;
  const now = new Date();

  const apiSunrise = parseSunInstant(data?.current?.sunrise);
  const apiSunset = parseSunInstant(data?.current?.sunset);

  let sunrise;
  let sunset;
  let polarDay;
  let polarNight;
  let dayLength;

  if (
    apiSunrise &&
    apiSunset &&
    apiSunset.getTime() > apiSunrise.getTime()
  ) {
    sunrise = apiSunrise;
    sunset = apiSunset;
    polarDay = false;
    polarNight = false;
    dayLength = (sunset.getTime() - sunrise.getTime()) / (1000 * 60 * 60);
  } else {
    const astro = getSunriseSunset(now, lat, lon);
    sunrise = astro.sunrise;
    sunset = astro.sunset;
    polarDay = !!astro.polarDay;
    polarNight = !!astro.polarNight;
    dayLength = getDayLength(now, lat, lon);
  }

  // Calculate sun progress along arc (0 = sunrise, 1 = sunset)
  let progress = 0;
  let isNight = true;

  if (polarDay) {
    progress = 0.5;
    isNight = false;
  } else if (!polarNight && sunrise && sunset) {
    const nowMs = now.getTime();
    const riseMs = sunrise.getTime();
    const setMs = sunset.getTime();
    if (nowMs >= riseMs && nowMs <= setMs) {
      progress = (nowMs - riseMs) / (setMs - riseMs);
      isNight = false;
    } else if (nowMs > setMs) {
      progress = 1;
    }
  }

  // SVG arc geometry
  const width = 280;
  const height = 160;
  const cx = width / 2;
  const cy = height - 20;
  const r = 110;

  // Arc from left to right (180 degrees)
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;

  // Sun position on arc
  const angle = Math.PI - progress * Math.PI;
  const sunX = cx + r * Math.cos(angle);
  const sunY = cy - r * Math.sin(angle);

  const arcPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;

  return (
    <article
      className="glass-panel"
      style={{ padding: 'var(--spacing-lg)' }}
      aria-label={`Sunrise at ${formatTime(sunrise)}, sunset at ${formatTime(sunset)}, day length ${formatDayLength(dayLength)}`}
    >
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        Sunrise & Sunset
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: `${width}px`, display: 'block', margin: '0 auto' }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sun-arc-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-orange)" />
            <stop offset="50%" stopColor="var(--accent-yellow)" />
            <stop offset="100%" stopColor="var(--accent-blue)" />
          </linearGradient>
        </defs>

        {/* Dashed baseline */}
        <line
          x1={startX}
          y1={cy}
          x2={endX}
          y2={cy}
          stroke="var(--text-muted)"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.3"
        />

        {/* Arc path */}
        <path
          d={arcPath}
          fill="none"
          stroke="url(#sun-arc-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity={isNight ? 0.3 : 0.8}
        />

        {/* Sun indicator */}
        {!isNight && !polarNight && (
          <>
            <circle
              cx={sunX}
              cy={sunY}
              r="10"
              fill="var(--accent-yellow)"
              opacity="0.3"
            />
            <circle
              cx={sunX}
              cy={sunY}
              r="6"
              fill="var(--accent-yellow)"
            />
          </>
        )}
      </svg>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--spacing-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <Sunrise size={16} style={{ color: 'var(--accent-orange)' }} aria-hidden="true" />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {formatTime(sunrise)}
          </span>
        </div>

        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {isNight && !polarDay ? 'Night' : formatDayLength(dayLength)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <Sunset size={16} style={{ color: 'var(--accent-blue)' }} aria-hidden="true" />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {formatTime(sunset)}
          </span>
        </div>
      </div>
    </article>
  );
}
