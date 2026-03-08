import { useState } from 'react';
import { CloudRain } from 'lucide-react';
import { mmToInches } from '../utils/unitConversion';

export default function PrecipitationChart({ data, unit }) {
  const [activeBar, setActiveBar] = useState(null);

  if (!data?.hourly) return null;

  const hours = data.hourly.slice(0, 24);
  const precipUnit = unit === 'imperial' ? 'in' : 'mm';

  const hasAnyPrecip = hours.some(
    (h) => (h.precipProbability ?? 0) > 0 || (h.precipAmount ?? 0) > 0
  );

  const formatAmount = (mm) => {
    const val = unit === 'imperial' ? mmToInches(mm) : mm;
    return Math.round(val * 100) / 100;
  };

  // SVG dimensions
  const padding = { top: 20, right: 10, bottom: 30, left: 10 };
  const viewW = 480;
  const viewH = 200;
  const chartW = viewW - padding.left - padding.right;
  const chartH = viewH - padding.top - padding.bottom;
  const barWidth = chartW / 24;

  const gridlines = [25, 50, 75];

  const handleInteraction = (index) => setActiveBar(index);
  const clearInteraction = () => setActiveBar(null);

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
        <span id="precip-heading">Precipitation</span>
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
        <div style={{ position: 'relative' }}>
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            role="img"
            aria-label="Hourly precipitation chart for next 24 hours"
            onMouseLeave={clearInteraction}
            onTouchEnd={clearInteraction}
          >
            <defs>
              <linearGradient id="precip-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-blue)" />
                <stop offset="100%" stopColor="var(--accent-cyan)" />
              </linearGradient>
            </defs>

            {/* Horizontal gridlines */}
            {gridlines.map((pct) => {
              const y = padding.top + chartH - (pct / 100) * chartH;
              return (
                <g key={pct}>
                  <line
                    x1={padding.left}
                    x2={viewW - padding.right}
                    y1={y}
                    y2={y}
                    stroke="var(--glass-border)"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={padding.left + 2}
                    y={y - 3}
                    fill="var(--text-muted)"
                    fontSize="8"
                    fontFamily="inherit"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {hours.map((hour, i) => {
              const prob = Math.min(100, Math.max(0, hour.precipProbability ?? 0));
              const amount = hour.precipAmount ?? 0;
              const barH = (prob / 100) * chartH;
              const x = padding.left + i * barWidth;
              const y = padding.top + chartH - barH;
              const opacity = amount > 0 ? Math.min(1, 0.3 + (amount / 10) * 0.7) : 0.3;

              return (
                <rect
                  key={i}
                  x={x + 1}
                  y={barH > 0 ? y : padding.top + chartH}
                  width={Math.max(0, barWidth - 2)}
                  height={Math.max(0, barH)}
                  fill="url(#precip-gradient)"
                  opacity={activeBar === i ? 1 : opacity}
                  rx={2}
                  style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                  onMouseEnter={() => handleInteraction(i)}
                  onTouchStart={() => handleInteraction(i)}
                />
              );
            })}

            {/* Time labels every 3 hours */}
            {hours.map((hour, i) => {
              if (i % 3 !== 0) return null;
              const hourNum = new Date(hour.time).getHours();
              const x = padding.left + i * barWidth + barWidth / 2;
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
                  {hourNum}:00
                </text>
              );
            })}

            {/* Tooltip */}
            {activeBar !== null && (() => {
              const hour = hours[activeBar];
              const prob = hour.precipProbability ?? 0;
              const amount = hour.precipAmount ?? 0;
              const x = padding.left + activeBar * barWidth + barWidth / 2;
              const barH = (Math.min(100, Math.max(0, prob)) / 100) * chartH;
              const y = padding.top + chartH - barH - 8;
              const tooltipX = Math.min(viewW - 70, Math.max(70, x));

              return (
                <g>
                  <rect
                    x={tooltipX - 55}
                    y={y - 30}
                    width={110}
                    height={28}
                    rx={6}
                    fill="var(--glass-bg-hover)"
                    stroke="var(--glass-border-hover)"
                    strokeWidth={1}
                  />
                  <text
                    x={tooltipX}
                    y={y - 12}
                    fill="var(--text-primary)"
                    fontSize="10"
                    fontFamily="inherit"
                    textAnchor="middle"
                  >
                    {prob}% &middot; {formatAmount(amount)} {precipUnit}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>
      )}
    </section>
  );
}
