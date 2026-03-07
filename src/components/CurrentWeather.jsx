import { getWeatherIcon, getIconColor } from '../utils/iconMap';
import { formatTemp } from '../utils/unitConversion';

const conditionAnimationStyles = `
@keyframes rainDrop {
  0% { transform: translateY(-10px); opacity: 0; }
  50% { opacity: 0.7; }
  100% { transform: translateY(420px); opacity: 0; }
}
@keyframes snowflakeFall {
  0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
  20% { opacity: 0.8; }
  100% { transform: translateY(420px) rotate(360deg); opacity: 0; }
}
@keyframes sunGlow {
  0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.15); }
}
@keyframes cloudDrift {
  0% { transform: translateX(-100px); opacity: 0; }
  20% { opacity: 0.15; }
  80% { opacity: 0.15; }
  100% { transform: translateX(400px); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .weather-animation * { animation: none !important; }
}
`;

function getConditionType(condition) {
  if (!condition) return 'default';
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return 'rain';
  if (c.includes('snow') || c.includes('sleet') || c.includes('blizzard')) return 'snow';
  if (c.includes('cloud') || c.includes('overcast') || c.includes('fog') || c.includes('mist')) return 'cloudy';
  if (c.includes('clear') || c.includes('sunny') || c.includes('fair')) return 'clear';
  return 'default';
}

function WeatherAnimationBackground({ conditionType, iconColor }) {
  if (conditionType === 'rain') {
    return (
      <div className="weather-animation" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: 0,
            left: `${8 + i * 8}%`,
            width: '2px',
            height: '16px',
            borderRadius: '1px',
            background: 'var(--accent-blue)',
            opacity: 0,
            animation: `rainDrop ${1.2 + (i % 4) * 0.3}s linear ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
    );
  }

  if (conditionType === 'snow') {
    return (
      <div className="weather-animation" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: 0,
            left: `${5 + i * 10}%`,
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.6)',
            opacity: 0,
            animation: `snowflakeFall ${3 + (i % 3) * 1.5}s linear ${i * 0.4}s infinite`,
          }} />
        ))}
      </div>
    );
  }

  if (conditionType === 'clear') {
    return (
      <div className="weather-animation" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${iconColor}20 0%, transparent 70%)`,
          animation: 'sunGlow 4s ease-in-out infinite',
        }} />
      </div>
    );
  }

  if (conditionType === 'cloudy') {
    return (
      <div className="weather-animation" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: `${15 + i * 25}%`,
            left: 0,
            width: '120px',
            height: '40px',
            borderRadius: '20px',
            background: 'var(--text-muted)',
            opacity: 0,
            animation: `cloudDrift ${8 + i * 3}s linear ${i * 2.5}s infinite`,
          }} />
        ))}
      </div>
    );
  }

  return null;
}

export default function CurrentWeather({ data, unit }) {
  if (!data?.current) return null;

  const { temp, condition, high, low, feelsLike } = data.current;
  const precipProbability = data.current.precipProbability;
  const sourceCount = data.current.sourceCount || data.sourceCount;
  const confidence = data.current.confidence || data.confidence;
  const WeatherIcon = getWeatherIcon(condition);
  const iconColor = getIconColor(condition);
  const conditionType = getConditionType(condition);

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
      <style>{conditionAnimationStyles}</style>

      <WeatherAnimationBackground conditionType={conditionType} iconColor={iconColor} />

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

      {precipProbability > 0 && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.85rem',
            color: 'var(--accent-blue)',
            background: 'rgba(96, 165, 250, 0.1)',
            padding: '4px 12px',
            borderRadius: '999px',
            border: '1px solid rgba(96, 165, 250, 0.2)',
            marginBottom: 'var(--spacing-md)',
          }}
          aria-label={`${Math.round(precipProbability)}% precipitation probability`}
        >
          {Math.round(precipProbability)}% {conditionType === 'snow' ? 'snow' : 'rain'}
        </div>
      )}

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

      {sourceCount > 0 && (
        <div
          style={{
            marginTop: 'var(--spacing-md)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            opacity: 0.7,
          }}
        >
          Data from {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
          {confidence != null && ` \u00b7 ${Math.round(confidence)}% confidence`}
        </div>
      )}
    </article>
  );
}
