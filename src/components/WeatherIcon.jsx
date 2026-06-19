import { getConditionCategory } from '../utils/weatherConditions';

/**
 * Animated, hand-built weather icon (pure CSS — no SVG illustration libraries).
 * Drop-in replacement for the Lucide icon in the hero. Keyframes live in
 * index.css (wx-spin, wx-glow, wx-drift, wx-float, wx-rain, wx-snow, wx-flash)
 * so they are defined once for all instances.
 *
 * Props:
 *   condition  unified condition string (e.g. "Clear", "Rain", "Thunderstorm")
 *   isNight    boolean — swaps the sun for a moon on clear nights
 *   size       px (default 96). Internals are authored at 112px and scaled.
 */
export default function WeatherIcon({ condition, isNight = false, size = 96 }) {
  const kind = getIconKind(condition, isNight);
  const scale = size / 112;

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 112,
          height: 112,
          transform: `scale(${scale})`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {kind === 'sun' && <Sun />}
        {kind === 'moon' && <Moon />}
        {kind === 'cloud' && <Cloud drift />}
        {kind === 'rain' && <Precip drops />}
        {kind === 'snow' && <Precip snow />}
        {kind === 'storm' && <Storm />}
      </div>
    </div>
  );
}

function getIconKind(condition, isNight) {
  const cat = getConditionCategory(condition);
  const c = (condition || '').toLowerCase();
  if (cat === 'severe') return 'storm';
  if (cat === 'precipitation') {
    return c.includes('snow') || c.includes('sleet') || c.includes('freezing') ? 'snow' : 'rain';
  }
  if (cat === 'cloudy') return 'cloud';
  return isNight ? 'moon' : 'sun'; // clear
}

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function Sun() {
  return (
    <div style={{ position: 'relative', width: 112, height: 112, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, animation: 'wx-spin 26s linear infinite' }}>
        {RAY_ANGLES.map((a) => (
          <div
            key={a}
            style={{
              position: 'absolute', left: '50%', top: '50%', width: 5, height: 13,
              margin: '-6.5px 0 0 -2.5px', borderRadius: 3, background: '#f6c44e',
              transform: `rotate(${a}deg) translateY(-44px)`,
            }}
          />
        ))}
      </div>
      <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%, #fff7e0, #f7c948 72%)', animation: 'wx-glow 4s ease-in-out infinite' }} />
    </div>
  );
}

function Moon() {
  return (
    <div style={{ position: 'relative', width: 60, height: 60, animation: 'wx-float 6s ease-in-out infinite' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, var(--wx-moon-a), var(--wx-moon-b) 75%)', boxShadow: '0 0 22px 3px var(--wx-moon-glow)' }} />
      <div style={{ position: 'absolute', top: -6, right: -10, width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-primary, #0d1117)' }} />
    </div>
  );
}

function Cloud({ tone = 'var(--wx-cloud)', drift = false }) {
  return (
    <div style={{ position: 'relative', width: 112, height: 78, animation: drift ? 'wx-drift 7s ease-in-out infinite' : 'none' }}>
      <div style={{ position: 'absolute', left: 8, bottom: 6, width: 90, height: 32, borderRadius: 17, background: tone }} />
      <div style={{ position: 'absolute', left: 16, bottom: 18, width: 46, height: 46, borderRadius: '50%', background: tone }} />
      <div style={{ position: 'absolute', left: 46, bottom: 22, width: 38, height: 38, borderRadius: '50%', background: 'var(--wx-cloud-light)' }} />
    </div>
  );
}

function Precip({ drops = false }) {
  const tone = 'var(--wx-cloud-rain)';
  return (
    <div style={{ position: 'relative', width: 112, height: 112 }}>
      <div style={{ position: 'absolute', left: 12, top: 16, width: 90, height: 30, borderRadius: 16, background: tone, animation: 'wx-float 5s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', left: 20, top: 5, width: 42, height: 42, borderRadius: '50%', background: tone, animation: 'wx-float 5s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', left: 48, top: 9, width: 36, height: 36, borderRadius: '50%', background: 'var(--wx-cloud-rain-light)', animation: 'wx-float 5s ease-in-out infinite' }} />
      {[0, 1, 2].map((i) =>
        drops ? (
          <div key={i} style={{ position: 'absolute', left: 38 + i * 17, top: 54, width: 3, height: 13, borderRadius: 2, background: 'var(--wx-drop)', animation: 'wx-rain 1s linear infinite', animationDelay: `${i * 0.32}s` }} />
        ) : (
          <div key={i} style={{ position: 'absolute', left: 40 + i * 17, top: 56, width: 8, height: 8, borderRadius: '50%', background: 'var(--wx-snow)', animation: 'wx-snow 2.4s linear infinite', animationDelay: `${i * 0.75}s` }} />
        )
      )}
    </div>
  );
}

function Storm() {
  return (
    <div style={{ position: 'relative', width: 112, height: 112 }}>
      <div style={{ position: 'absolute', left: 12, top: 12, width: 90, height: 30, borderRadius: 16, background: 'var(--wx-cloud-storm)', animation: 'wx-float 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', left: 20, top: 1, width: 42, height: 42, borderRadius: '50%', background: 'var(--wx-cloud-storm)', animation: 'wx-float 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', left: 48, top: 5, width: 36, height: 36, borderRadius: '50%', background: 'var(--wx-cloud-storm-light)', animation: 'wx-float 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', left: 46, top: 50, animation: 'wx-flash 3.5s ease-in-out infinite' }}>
        <svg width="28" height="40" viewBox="0 0 24 36" fill="none">
          <polygon points="13,0 2,21 10,21 6,36 22,13 13,13" fill="var(--wx-bolt)" />
        </svg>
      </div>
    </div>
  );
}
