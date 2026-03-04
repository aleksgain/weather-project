import { getWeatherIcon, getIconColor } from '../utils/iconMap';
import { formatTemp } from '../utils/unitConversion';

export default function CurrentWeather({ data, unit }) {
  if (!data?.current) return null;

  const { temp, condition, high, low, feelsLike } = data.current;
  const WeatherIcon = getWeatherIcon(condition);
  const iconColor = getIconColor(condition);

  return (
    <article
      className="glass-panel"
      style={{
        padding: 'var(--spacing-xl)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '420px',
      }}
      aria-label="Current weather conditions"
    >
      {/* Subtle glow effect behind icon */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -60%)',
          width: '200px',
          height: '200px',
          background: `radial-gradient(circle, ${iconColor}15 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      <h2
        style={{
          fontSize: 'clamp(1.25rem, 4vw, 1.5rem)',
          fontWeight: 500,
          margin: 0,
          color: 'var(--text-secondary)',
          marginBottom: 'var(--spacing-lg)',
        }}
      >
        {data.locationName || 'Current Location'}
      </h2>

      <div
        style={{
          margin: 'var(--spacing-lg) 0',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-lg)',
        }}
      >
        <WeatherIcon
          size={80}
          strokeWidth={1.2}
          color={iconColor}
          style={{
            filter: `drop-shadow(0 0 20px ${iconColor}40)`,
          }}
          aria-hidden="true"
        />
        <div
          className="mono"
          style={{
            fontSize: 'clamp(4rem, 12vw, 6rem)',
            fontWeight: 300,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            background: 'var(--gradient-cool)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
          aria-label={`${formatTemp(temp, unit)} degrees ${unit === 'metric' ? 'Celsius' : 'Fahrenheit'}`}
        >
          {formatTemp(temp, unit)}°
        </div>
      </div>

      <div
        style={{
          fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
          fontWeight: 500,
          marginBottom: 'var(--spacing-md)',
          color: 'var(--text-primary)',
        }}
      >
        {condition}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-xl)',
          fontSize: 'clamp(1rem, 3vw, 1.25rem)',
          color: 'var(--text-secondary)',
        }}
        aria-label={`High ${formatTemp(high, unit)} degrees, Low ${formatTemp(low, unit)} degrees`}
      >
        <span>
          <span style={{ color: 'var(--accent-orange)', marginRight: '4px' }}>↑</span>
          {formatTemp(high, unit)}°
        </span>
        <span>
          <span style={{ color: 'var(--accent-blue)', marginRight: '4px' }}>↓</span>
          {formatTemp(low, unit)}°
        </span>
      </div>

      <div
        style={{
          marginTop: 'var(--spacing-lg)',
          fontSize: '1rem',
          color: 'var(--text-muted)',
          background: 'var(--glass-bg)',
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          borderRadius: '999px',
          border: '1px solid var(--glass-border)',
        }}
        aria-label={`Feels like ${formatTemp(feelsLike, unit)} degrees`}
      >
        Feels like {formatTemp(feelsLike, unit)}°
      </div>
    </article>
  );
}
