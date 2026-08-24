import { useState } from 'react';
import { ChevronDown, Thermometer, CloudRainWind, Wind, Shapes, AlertTriangle } from 'lucide-react';
import { weatherSources } from '../config/weather-sources';
import { formatTemp } from '../utils/unitConversion';

/** Human-readable name for a source id */
function sourceName(id) {
  return weatherSources[id]?.name ?? id;
}

function agreementColor(score) {
  if (score == null) return 'var(--text-muted)';
  if (score >= 0.8) return 'var(--accent-green)';
  if (score >= 0.6) return 'var(--accent-yellow)';
  return 'var(--accent-orange)';
}

/** Horizontal agreement bar for one metric */
function MetricBar({ icon: Icon, label, score }) {
  const pct = score != null ? Math.round(score * 100) : null;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
      role="listitem"
      aria-label={pct != null ? `${label} agreement ${pct} percent` : `${label} agreement not available`}
    >
      <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '86px' }}>
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: '6px',
          background: 'var(--glass-bg)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}
        aria-hidden="true"
      >
        {pct != null && (
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: '3px',
              background: agreementColor(score),
              transition: 'width 0.4s ease',
            }}
          />
        )}
      </div>
      <span
        className="mono"
        style={{
          fontSize: '0.75rem',
          color: pct != null ? 'var(--text-primary)' : 'var(--text-muted)',
          minWidth: '36px',
          textAlign: 'right',
        }}
      >
        {pct != null ? `${pct}%` : '—'}
      </span>
    </div>
  );
}

/**
 * Expandable panel showing how the aggregated forecast was built:
 * per-metric cross-source agreement, and each source's reported values
 * with deviation from the consensus (outliers flagged).
 */
export default function SourceBreakdown({ data, unit }) {
  const [open, setOpen] = useState(false);

  const details = data?.sourceDetails;
  if (!Array.isArray(details) || details.length < 2) return null;

  const breakdown = data.confidenceBreakdown ?? {};
  const confidence = data.confidence;
  const outlierFields = data.outlierFields ?? {};
  const droppedAnywhere = new Set(Object.values(outlierFields).flat());

  return (
    <section
      className="glass-panel"
      style={{ padding: 'var(--spacing-lg)' }}
      aria-labelledby="source-breakdown-heading"
    >
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="source-breakdown-content"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
        }}
      >
        <h3 id="source-breakdown-heading" style={{ margin: 0 }}>
          Source Agreement
        </h3>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {confidence != null && (
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 500,
                color: agreementColor(confidence),
              }}
            >
              {Math.round(confidence * 100)}%
            </span>
          )}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {details.length} sources
          </span>
          <ChevronDown
            size={16}
            style={{
              color: 'var(--text-muted)',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <div
          id="source-breakdown-content"
          style={{ marginTop: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}
        >
          {/* Per-metric agreement */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}
            role="list"
            aria-label="Cross-source agreement by metric"
          >
            <MetricBar icon={Thermometer} label="Temperature" score={breakdown.temperature} />
            <MetricBar icon={Shapes} label="Conditions" score={breakdown.condition} />
            <MetricBar icon={CloudRainWind} label="Precipitation" score={breakdown.precipitation} />
            <MetricBar icon={Wind} label="Wind" score={breakdown.wind} />
          </div>

          {/* Per-source table */}
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.8rem',
              }}
            >
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px 4px 0', fontWeight: 500 }}>Source</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'right' }}>Temp</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'right' }}>Δ</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>Condition</th>
                </tr>
              </thead>
              <tbody>
                {details.map(s => {
                  const dropped = droppedAnywhere.has(s.id);
                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderTop: '1px solid var(--glass-border)',
                        color: 'var(--text-secondary)',
                        opacity: dropped ? 0.65 : 1,
                      }}
                    >
                      <td style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {sourceName(s.id)}
                          {dropped && (
                            <span
                              title="One or more values from this source were excluded as outliers"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.7rem',
                                color: 'var(--accent-orange)',
                              }}
                            >
                              <AlertTriangle size={11} aria-hidden="true" />
                              outlier
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="mono" style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>
                        {s.temp != null ? `${formatTemp(s.temp, unit)}°` : '—'}
                      </td>
                      <td
                        className="mono"
                        style={{
                          padding: '6px 8px',
                          textAlign: 'right',
                          color:
                            s.tempDeviation == null || Math.abs(s.tempDeviation) < 1
                              ? 'var(--text-muted)'
                              : Math.abs(s.tempDeviation) < 2.5
                                ? 'var(--accent-yellow)'
                                : 'var(--accent-orange)',
                        }}
                        title="Deviation from the aggregated temperature"
                      >
                        {s.tempDeviation != null
                          ? (() => {
                              const dev = unit === 'imperial' ? s.tempDeviation * 1.8 : s.tempDeviation;
                              return `${dev > 0 ? '+' : ''}${dev.toFixed(1)}`;
                            })()
                          : '—'}
                      </td>
                      <td style={{ padding: '6px 8px' }}>{s.condition ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            The forecast is a weighted blend of the sources above. Values that
            deviate strongly from the group median are excluded before averaging,
            and a significant severe-weather minority overrides a milder majority.
          </p>
        </div>
      )}
    </section>
  );
}
