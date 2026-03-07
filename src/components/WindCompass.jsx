import { formatSpeed, getUnitLabel } from '../utils/unitConversion';

const DIRECTIONS = [
  { label: 'N', angle: 0 },
  { label: 'NE', angle: 45 },
  { label: 'E', angle: 90 },
  { label: 'SE', angle: 135 },
  { label: 'S', angle: 180 },
  { label: 'SW', angle: 225 },
  { label: 'W', angle: 270 },
  { label: 'NW', angle: 315 },
];

const DEG_TO_RAD = Math.PI / 180;

export default function WindCompass({ data, unit }) {
  if (!data?.current) return null;

  const { windSpeed, windDirection, windGust } = data.current;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 90;
  const labelR = 70;
  const dir = windDirection ?? 0;

  return (
    <article
      className="glass-panel"
      style={{ padding: 'var(--spacing-lg)' }}
      aria-label={`Wind from ${dir} degrees at ${formatSpeed(windSpeed ?? 0, unit)} ${getUnitLabel('speed', unit)}`}
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
        Wind Direction
      </div>

      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        style={{ maxWidth: `${size}px`, display: 'block', margin: '0 auto' }}
        aria-hidden="true"
      >
        {/* Outer circle */}
        <circle
          cx={cx}
          cy={cy}
          r={outerR}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1"
          opacity="0.3"
        />

        {/* Tick marks and labels */}
        {DIRECTIONS.map(({ label, angle }) => {
          const rad = (angle - 90) * DEG_TO_RAD;
          const isCardinal = label.length === 1;
          const tickStart = isCardinal ? outerR - 8 : outerR - 5;
          const x1 = cx + tickStart * Math.cos(rad);
          const y1 = cy + tickStart * Math.sin(rad);
          const x2 = cx + outerR * Math.cos(rad);
          const y2 = cy + outerR * Math.sin(rad);
          const lx = cx + labelR * Math.cos(rad);
          const ly = cy + labelR * Math.sin(rad);

          return (
            <g key={label}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--text-muted)"
                strokeWidth={isCardinal ? 2 : 1}
                opacity={isCardinal ? 0.6 : 0.3}
              />
              {isCardinal && (
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--text-secondary)"
                  fontSize="12"
                  fontWeight="600"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* Wind direction arrow */}
        <g
          style={{
            transform: `rotate(${dir}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: 'transform 0.6s ease-out',
          }}
        >
          <line
            x1={cx}
            y1={cy + 25}
            x2={cx}
            y2={cy - outerR + 15}
            stroke="var(--accent-cyan)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <polygon
            points={`${cx},${cy - outerR + 10} ${cx - 6},${cy - outerR + 22} ${cx + 6},${cy - outerR + 22}`}
            fill="var(--accent-cyan)"
          />
        </g>

        {/* Center speed display */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-primary)"
          fontSize="22"
          fontWeight="500"
          className="mono"
        >
          {formatSpeed(windSpeed ?? 0, unit)}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-muted)"
          fontSize="10"
        >
          {getUnitLabel('speed', unit)}
        </text>

        {/* Gust speed */}
        {windGust != null && (
          <text
            x={cx}
            y={cy + 30}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--text-muted)"
            fontSize="10"
          >
            Gust {formatSpeed(windGust, unit)}
          </text>
        )}
      </svg>
    </article>
  );
}
