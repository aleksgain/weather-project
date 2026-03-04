import { getWeatherIcon } from '../utils/iconMap';
import { formatTemp } from '../utils/unitConversion';

export default function Forecast({ data, unit }) {
  if (!data?.hourly || !data?.daily) return null;

  const hourly = data.hourly;
  const daily = data.daily;

  // Calculate temperature range for proper bar positioning
  const allTemps = daily.flatMap((d) => [d.high, d.low]).filter((t) => typeof t === 'number' && !Number.isNaN(t));
  const minTemp = allTemps.length ? Math.min(...allTemps) : 0;
  const maxTemp = allTemps.length ? Math.max(...allTemps) : 10;
  const tempRange = maxTemp - minTemp || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', height: '100%' }}>
      {/* Hourly Forecast */}
      <section
        className="glass-panel"
        style={{ padding: 'var(--spacing-lg)' }}
        aria-labelledby="hourly-heading"
      >
        <h3 id="hourly-heading" style={{ marginBottom: 'var(--spacing-md)' }}>
          Hourly Forecast
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(56px, 1fr))',
            gap: 'var(--spacing-sm)',
            width: '100%',
          }}
          role="list"
          aria-label="Hourly weather forecast"
        >
          {hourly.slice(0, 12).map((hour, index) => {
            const Icon = getWeatherIcon(hour.condition);
            const hourNum = new Date(hour.time).getHours();
            const isNow = index === 0;

            return (
              <div
                key={hour.time ?? `hour-${index}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--card-radius-sm)',
                  background: isNow ? 'var(--glass-bg-hover)' : 'transparent',
                  border: isNow ? '1px solid var(--glass-border-hover)' : '1px solid transparent',
                  transition: 'all 0.2s ease',
                }}
                role="listitem"
                aria-label={`${isNow ? 'Now' : `${hourNum}:00`}: ${formatTemp(hour.temp, unit)} degrees, ${hour.condition}`}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: isNow ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontWeight: isNow ? 600 : 400,
                  }}
                >
                  {isNow ? 'Now' : `${hourNum}:00`}
                </span>
                <Icon
                  size={22}
                  strokeWidth={1.5}
                  style={{ color: 'var(--text-secondary)' }}
                  aria-hidden="true"
                />
                <span
                  className="mono"
                  style={{
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                  }}
                >
                  {formatTemp(hour.temp, unit)}°
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Daily Forecast */}
      <section
        className="glass-panel"
        style={{ padding: 'var(--spacing-lg)', flex: 1 }}
        aria-labelledby="daily-heading"
      >
        <h3 id="daily-heading" style={{ marginBottom: 'var(--spacing-md)' }}>
          {daily.length}-Day Forecast
        </h3>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
            width: '100%',
          }}
          role="list"
          aria-label="Daily weather forecast"
        >
          {daily.map((day, index) => {
            const Icon = getWeatherIcon(day.condition);
            const date = new Date(day.date);
            const isToday = index === 0;
            const dayKey = day.date ?? `day-${index}`;
            const dayName = isToday
              ? 'Today'
              : date.toLocaleDateString('en-US', { weekday: 'short' });

            // Calculate bar positions based on actual temperature range
            const lowPercent = ((day.low - minTemp) / tempRange) * 100;
            const highPercent = ((day.high - minTemp) / tempRange) * 100;

            return (
              <div
                key={dayKey}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)',
                  borderBottom:
                    index !== daily.length - 1 ? '1px solid var(--glass-border)' : 'none',
                  paddingBottom: index !== daily.length - 1 ? 'var(--spacing-sm)' : '0',
                }}
                role="listitem"
                aria-label={`${dayName}: High ${formatTemp(day.high, unit)} degrees, Low ${formatTemp(day.low, unit)} degrees, ${day.condition}`}
              >
                {/* Day name */}
                <span
                  style={{
                    fontWeight: isToday ? 600 : 400,
                    minWidth: '48px',
                    fontSize: '0.9rem',
                    color: isToday ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {dayName}
                </span>

                {/* Icon */}
                <Icon
                  size={22}
                  strokeWidth={1.5}
                  style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
                  aria-hidden="true"
                />

                {/* Low temp */}
                <span
                  className="mono"
                  style={{
                    color: 'var(--text-muted)',
                    minWidth: '32px',
                    textAlign: 'right',
                    fontSize: '0.9rem',
                  }}
                >
                  {formatTemp(day.low, unit)}°
                </span>

                {/* Temperature range bar */}
                <div
                  style={{
                    flex: 1,
                    height: '6px',
                    background: 'var(--glass-bg)',
                    borderRadius: '3px',
                    position: 'relative',
                    minWidth: '60px',
                    overflow: 'hidden',
                  }}
                  aria-hidden="true"
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: `${lowPercent}%`,
                      right: `${100 - highPercent}%`,
                      top: 0,
                      bottom: 0,
                      background: 'var(--gradient-temp)',
                      borderRadius: '3px',
                      minWidth: '8px',
                    }}
                  />
                </div>

                {/* High temp */}
                <span
                  className="mono"
                  style={{
                    fontWeight: 500,
                    minWidth: '32px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  {formatTemp(day.high, unit)}°
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
