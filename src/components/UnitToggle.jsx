export default function UnitToggle({ unit, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="glass-panel"
      style={{
        padding: 'var(--spacing-xs) var(--spacing-md)',
        fontSize: '0.875rem',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        cursor: 'pointer',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--card-radius-sm)',
        minWidth: '72px',
        justifyContent: 'center',
      }}
      aria-label={`Switch to ${unit === 'metric' ? 'Fahrenheit' : 'Celsius'}. Currently showing ${unit === 'metric' ? 'Celsius' : 'Fahrenheit'}`}
      title={`Switch to ${unit === 'metric' ? '°F' : '°C'}`}
    >
      <span
        style={{
          color: unit === 'metric' ? 'var(--accent-cyan)' : 'var(--text-muted)',
          transition: 'color 0.2s ease',
        }}
        aria-hidden="true"
      >
        °C
      </span>
      <span style={{ color: 'var(--text-muted)' }} aria-hidden="true">
        /
      </span>
      <span
        style={{
          color: unit === 'imperial' ? 'var(--accent-orange)' : 'var(--text-muted)',
          transition: 'color 0.2s ease',
        }}
        aria-hidden="true"
      >
        °F
      </span>
    </button>
  );
}
