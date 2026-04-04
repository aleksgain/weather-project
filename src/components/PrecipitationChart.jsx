import { CloudRain } from 'lucide-react';
import { mmToInches } from '../utils/unitConversion';

export default function PrecipitationChart({ data, unit }) {
  if (!data?.hourly) return null;

  const now = Date.now();
  const sortedHours = [...data.hourly].sort((a, b) => new Date(a.time) - new Date(b.time));
  const futureHours = sortedHours.filter((h) => {
    const ts = new Date(h.time).getTime();
    return !Number.isNaN(ts) && ts >= now;
  });
  const hours = (futureHours.length > 0 ? futureHours : sortedHours).slice(0, 48);
  const precipUnit = unit === 'imperial' ? 'in' : 'mm';

  const hasAnyPrecip = hours.some(
    (h) => (h.precipProbability ?? h.precipitationProbability ?? 0) > 0 || (h.precipAmount ?? 0) > 0
  );

  const formatAmount = (mm) => {
    const val = unit === 'imperial' ? mmToInches(mm) : mm;
    return Math.round(val * 100) / 100;
  };

  const amountValues = hours.map((h) => formatAmount(h.precipAmount ?? 0));
  const maxAmount = Math.max(0.1, ...amountValues);

  const formatHourlyLabel = (time) =>
    new Date(time).toLocaleTimeString(undefined, { hour: 'numeric', hour12: unit === 'imperial' });

  return (
    <section
      className="glass-panel"
      style={{ padding: 'var(--spacing-lg)' }}
      aria-labelledby="precip-heading"
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
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <CloudRain size={16} style={{ color: 'var(--accent-blue)' }} aria-hidden="true" />
        <span id="precip-heading">Precipitation Forecast</span>
      </div>

      {!hasAnyPrecip ? (
        <div
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            textAlign: 'center',
            padding: 'var(--spacing-xl) 0',
          }}
        >
          No precipitation expected
        </div>
      ) : (
        <div
          className="hourly-scroll"
          role="list"
          aria-label="Hourly precipitation forecast"
        >
          {hours.map((hour, i) => {
            const prob = Math.min(100, Math.max(0, hour.precipProbability ?? hour.precipitationProbability ?? 0));
            const amount = formatAmount(hour.precipAmount ?? 0);

            return (
              <div
                key={hour.time ?? `precip-${i}`}
                className="hourly-scroll-item"
                role="listitem"
                aria-label={`${formatHourlyLabel(hour.time)}: ${Math.round(prob)}% chance${amount > 0 ? `, ${amount} ${precipUnit}` : ''}`}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.1,
                  }}
                >
                  {formatHourlyLabel(hour.time)}
                </span>

                {/* Chance bar */}
                <div className="precip-bar-track">
                  <div
                    className="precip-bar-fill precip-bar-fill--chance"
                    style={{
                      height: `${prob}%`,
                      minHeight: prob > 0 ? '2px' : '0',
                    }}
                  />
                </div>
                <span
                  className="mono"
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--accent-blue)',
                    fontWeight: 500,
                  }}
                >
                  {Math.round(prob)}%
                </span>

                {/* Amount bar */}
                <div className="precip-bar-track precip-bar-track--sm">
                  <div
                    className="precip-bar-fill precip-bar-fill--amount"
                    style={{
                      height: `${maxAmount > 0 ? (amount / maxAmount) * 100 : 0}%`,
                      minHeight: amount > 0 ? '2px' : prob > 0 ? '2px' : '0',
                    }}
                  />
                </div>
                <span
                  className="mono"
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--accent-cyan)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {amount > 0 ? `${amount}${precipUnit}` : prob > 0 ? `0${precipUnit}` : `0${precipUnit}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
