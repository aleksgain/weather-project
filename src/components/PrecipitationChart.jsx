import { useState } from 'react';
import { CloudRain } from 'lucide-react';
import { mmToInches } from '../utils/unitConversion';

export default function PrecipitationChart({ data, unit }) {
  const [activeChanceBar, setActiveChanceBar] = useState(null);
  const [activeAmountBar, setActiveAmountBar] = useState(null);

  if (!data?.hourly) return null;

  const now = Date.now();
  const sortedHours = [...data.hourly].sort((a, b) => new Date(a.time) - new Date(b.time));
  const futureHours = sortedHours.filter((h) => {
    const ts = new Date(h.time).getTime();
    return !Number.isNaN(ts) && ts >= now;
  });
  const hours = (futureHours.length > 0 ? futureHours : sortedHours).slice(0, 24);
  const barCount = Math.max(1, hours.length);
  const precipUnit = unit === 'imperial' ? 'in' : 'mm';

  const hasAnyPrecip = hours.some(
    (h) => (h.precipProbability ?? 0) > 0 || (h.precipAmount ?? 0) > 0
  );

  const formatAmount = (mm) => {
    const val = unit === 'imperial' ? mmToInches(mm) : mm;
    return Math.round(val * 100) / 100;
  };

  const amountValues = hours.map((h) => formatAmount(h.precipAmount ?? 0));
  const maxAmount = Math.max(0.1, ...amountValues);

  // SVG dimensions
  const padding = { top: 20, right: 10, bottom: 30, left: 10 };
  const yAxisWidth = 30;
  const chartStartX = padding.left + yAxisWidth;
  const viewW = 480;
  const viewH = 140;
  const chartW = viewW - chartStartX - padding.right;
  const chartH = viewH - padding.top - padding.bottom;
  const barWidth = chartW / barCount;

  const gridlines = [25, 50, 75];
  const maxLabels = 6;
  const labelStep = Math.max(1, Math.ceil(barCount / maxLabels));
  const formatHourlyLabel = (time) =>
    new Date(time).toLocaleTimeString(undefined, {
      hour: 'numeric',
    });
  const chartContainerStyle = {
    width: '100%',
    overflow: 'hidden',
  };
  const clearInteraction = () => {
    setActiveChanceBar(null);
    setActiveAmountBar(null);
  };

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
        <div style={{ position: 'relative', display: 'grid', gap: 'var(--spacing-sm)' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Chance (%)
            </div>
            <div style={chartContainerStyle}>
              <svg
                viewBox={`0 0 ${viewW} ${viewH}`}
                style={{ width: '100%', height: 'auto', display: 'block' }}
                role="img"
                aria-label={`Hourly precipitation chance from now for next ${hours.length} hours`}
                onMouseLeave={() => setActiveChanceBar(null)}
                onTouchEnd={() => setActiveChanceBar(null)}
              >
              <defs>
                <linearGradient id="precip-prob-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-blue)" />
                  <stop offset="100%" stopColor="var(--accent-cyan)" />
                </linearGradient>
              </defs>

              {gridlines.map((pct) => {
                const y = padding.top + chartH - (pct / 100) * chartH;
                return (
                  <g key={pct}>
                    <line
                      x1={chartStartX}
                      x2={viewW - padding.right}
                      y1={y}
                      y2={y}
                      stroke="var(--glass-border)"
                      strokeDasharray="3,3"
                    />
                    <text
                      x={chartStartX - 4}
                      y={y - 3}
                      fill="var(--text-muted)"
                      fontSize="8"
                      fontFamily="inherit"
                      textAnchor="end"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {hours.map((hour, i) => {
                const prob = Math.min(100, Math.max(0, hour.precipProbability ?? 0));
                const barH = (prob / 100) * chartH;
                const x = chartStartX + i * barWidth;
                const y = padding.top + chartH - barH;

                return (
                  <rect
                    key={i}
                    x={x + 1}
                    y={barH > 0 ? y : padding.top + chartH}
                    width={Math.max(0, barWidth - 2)}
                    height={Math.max(0, barH)}
                    fill="url(#precip-prob-gradient)"
                    opacity={activeChanceBar === i ? 1 : 0.65}
                    rx={2}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                    onMouseEnter={() => setActiveChanceBar(i)}
                    onTouchStart={() => setActiveChanceBar(i)}
                  />
                );
              })}

              {hours.map((hour, i) => {
                if (i % labelStep !== 0) return null;
                const x = chartStartX + i * barWidth + barWidth / 2;
                return (
                  <text
                    key={i}
                    x={x}
                    y={viewH - 5}
                    fill="var(--text-muted)"
                    fontSize="9"
                    fontFamily="inherit"
                    textAnchor="middle"
                  >
                    {formatHourlyLabel(hour.time)}
                  </text>
                );
              })}
              </svg>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Amount ({precipUnit})
            </div>
            <div style={chartContainerStyle}>
              <svg
                viewBox={`0 0 ${viewW} ${viewH}`}
                style={{ width: '100%', height: 'auto', display: 'block' }}
                role="img"
                aria-label={`Hourly precipitation amount from now for next ${hours.length} hours`}
                onMouseLeave={() => setActiveAmountBar(null)}
                onTouchEnd={() => setActiveAmountBar(null)}
              >
              <defs>
                <linearGradient id="precip-amount-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-cyan)" />
                  <stop offset="100%" stopColor="var(--accent-blue)" />
                </linearGradient>
              </defs>

              {gridlines.map((pct) => {
                const y = padding.top + chartH - (pct / 100) * chartH;
                const amountTick = Math.round((maxAmount * (pct / 100)) * 100) / 100;
                return (
                  <g key={pct}>
                    <line
                      x1={chartStartX}
                      x2={viewW - padding.right}
                      y1={y}
                      y2={y}
                      stroke="var(--glass-border)"
                      strokeDasharray="3,3"
                    />
                    <text
                      x={chartStartX - 4}
                      y={y - 3}
                      fill="var(--text-muted)"
                      fontSize="8"
                      fontFamily="inherit"
                      textAnchor="end"
                    >
                      {amountTick}
                    </text>
                  </g>
                );
              })}

              {hours.map((hour, i) => {
                const amount = formatAmount(hour.precipAmount ?? 0);
                const barH = (amount / maxAmount) * chartH;
                const x = chartStartX + i * barWidth;
                const y = padding.top + chartH - barH;

                return (
                  <rect
                    key={i}
                    x={x + 1}
                    y={barH > 0 ? y : padding.top + chartH}
                    width={Math.max(0, barWidth - 2)}
                    height={Math.max(0, barH)}
                    fill="url(#precip-amount-gradient)"
                    opacity={activeAmountBar === i ? 1 : 0.65}
                    rx={2}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                    onMouseEnter={() => setActiveAmountBar(i)}
                    onTouchStart={() => setActiveAmountBar(i)}
                  />
                );
              })}

              {hours.map((hour, i) => {
                if (i % labelStep !== 0) return null;
                const x = chartStartX + i * barWidth + barWidth / 2;
                return (
                  <text
                    key={i}
                    x={x}
                    y={viewH - 5}
                    fill="var(--text-muted)"
                    fontSize="9"
                    fontFamily="inherit"
                    textAnchor="middle"
                  >
                    {formatHourlyLabel(hour.time)}
                  </text>
                );
              })}
              </svg>
            </div>
          </div>

          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              minHeight: '1.2em',
            }}
            onMouseLeave={clearInteraction}
          >
            {activeChanceBar != null && `${Math.round(hours[activeChanceBar].precipProbability ?? 0)}% chance`}
            {activeChanceBar != null && activeAmountBar != null && ' · '}
            {activeAmountBar != null && `${formatAmount(hours[activeAmountBar].precipAmount ?? 0)} ${precipUnit} expected`}
          </div>
        </div>
      )}
    </section>
  );
}
