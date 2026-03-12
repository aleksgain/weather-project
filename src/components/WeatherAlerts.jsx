import { useState } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';

const SEVERITY_COLORS = {
  Advisory: 'var(--accent-yellow, #f59e0b)',
  Watch: 'var(--accent-orange, #f97316)',
  Warning: 'var(--accent-red, #ef4444)',
};

function getSeverityColor(severity) {
  return SEVERITY_COLORS[severity] || SEVERITY_COLORS.Advisory;
}

function getDismissedIds() {
  try {
    return JSON.parse(sessionStorage.getItem('dismissedAlerts') || '[]');
  } catch {
    return [];
  }
}

function saveDismissedIds(ids) {
  try {
    sessionStorage.setItem('dismissedAlerts', JSON.stringify(ids));
  } catch {
    // sessionStorage unavailable
  }
}

function AlertCard({ alert, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const color = getSeverityColor(alert.severity);

  return (
    <article
      className="glass-panel"
      role="alert"
      style={{
        padding: 'var(--spacing-md)',
        borderLeft: `4px solid ${color}`,
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--spacing-sm)',
        }}
      >
        <AlertTriangle
          size={20}
          style={{ color, flexShrink: 0, marginTop: '2px' }}
          aria-hidden="true"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color,
              }}
            >
              {alert.severity || 'Alert'}
            </span>
            {alert.event && (
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                &middot; {alert.event}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
            }}
          >
            {alert.headline}
          </div>
          {alert.description && (
            <button
              onClick={() => setExpanded((e) => !e)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                marginTop: 'var(--spacing-xs)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Less' : 'More'}
            </button>
          )}
          {expanded && alert.description && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginTop: 'var(--spacing-sm)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {alert.description}
            </div>
          )}
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
          aria-label="Dismiss alert"
        >
          <X size={16} />
        </button>
      </div>
    </article>
  );
}

export default function WeatherAlerts({ alerts }) {
  const [dismissedIds, setDismissedIds] = useState(getDismissedIds);

  if (!alerts || alerts.length === 0) return null;

  const visibleAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));

  if (visibleAlerts.length === 0) return null;

  function handleDismiss(id) {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    saveDismissedIds(updated);
  }

  return (
    <section
      className="weather-alerts"
      aria-label="Weather alerts"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
      }}
    >
      {visibleAlerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onDismiss={handleDismiss} />
      ))}
    </section>
  );
}
