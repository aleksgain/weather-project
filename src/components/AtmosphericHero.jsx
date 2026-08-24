import { MapPin, TrendingUp, TrendingDown, CloudRain, Sun, CloudLightning } from 'lucide-react';
import { formatTemp } from '../utils/unitConversion';
import { buildFeelsCopy, ADVICE_TONE_COLOR } from '../utils/weatherAdvice';
import WeatherIcon from './WeatherIcon';

/**
 * Direction B — "How you'll feel" hero.
 *
 * Drop-in replacement for <CurrentWeather> inside the .panel-hero slot in App.jsx.
 * Same props as CurrentWeather. The reactive atmospheric BACKGROUND is supplied by
 * the existing body.condition-* mechanism in App.jsx (see index.css for the
 * softened gradients) — this component renders transparent on top of it.
 *
 * Layout: temp + animated icon up top, condition + hi/lo, multi-source confidence,
 * then the big human headline, a supporting line, and 2–3 advice rows.
 */
export default function AtmosphericHero({ data, unit, isManualLocation, referenceTime }) {
  if (!data?.current) return null;

  const cur = data.current;
  const { temp, condition, high, low, sunrise, sunset } = cur;

  // day/night for the icon (clear → sun vs moon), mirrors CurrentWeather logic
  const nowTs = referenceTime instanceof Date ? referenceTime.getTime() : NaN;
  const effectiveNowTs = Number.isFinite(nowTs)
    ? nowTs
    : new Date(data.hourly?.[0]?.time ?? sunrise ?? sunset ?? 0).getTime();
  const sr = sunrise ? new Date(sunrise).getTime() : NaN;
  const ss = sunset ? new Date(sunset).getTime() : NaN;
  const isNight = Number.isFinite(sr) && Number.isFinite(ss)
    ? effectiveNowTs < sr || effectiveNowTs > ss
    : new Date(effectiveNowTs).getHours() < 6 || new Date(effectiveNowTs).getHours() >= 18;

  const sourceCount = cur.sourceCount || data.sourceCount || (data.sources?.length ?? 0);
  const confidence = cur.confidence ?? data.confidence; // 0–1
  const confPct = confidence != null ? Math.round(confidence * 100) : null;
  const confColor = confPct == null ? 'var(--text-muted)'
    : confPct >= 75 ? 'var(--accent-green)'
    : confPct >= 65 ? 'var(--accent-yellow)' : 'var(--accent-orange)';

  const { headline, detail, advice, outlook } = buildFeelsCopy(cur, unit, {
    isNight,
    date: new Date(effectiveNowTs),
    hourly: data.hourly,
    daily: data.daily,
  });

  const OutlookIcon = outlook
    ? { up: TrendingUp, down: TrendingDown, rain: CloudRain, clear: Sun, storm: CloudLightning }[outlook.direction] ?? TrendingUp
    : null;

  return (
    <article
      className="atmo-hero"
      aria-label="Current weather conditions"
      style={{ display: 'flex', flexDirection: 'column', padding: 'var(--spacing-lg)' }}
    >
      {/* location */}
      <div className="atmo-row" style={{ alignItems: 'center', gap: 8 }}>
        <MapPin size={15} style={{ opacity: 0.7, flex: 'none' }} aria-hidden="true" />
        <span style={{ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
          {data.locationName || 'Current location'}
        </span>
        {isManualLocation && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>· manual</span>
        )}
      </div>

      {/* temp + animated icon up top */}
      <div className="atmo-row" style={{ alignItems: 'center', gap: 6, marginTop: 'var(--spacing-lg)' }}>
        <WeatherIcon condition={condition} isNight={isNight} size={112} />
        <div style={{ display: 'flex', alignItems: 'flex-start', lineHeight: 0.85 }}>
          <span className="mono" style={{ fontSize: 'clamp(4.5rem, 16vw, 6rem)', fontWeight: 500, letterSpacing: '-0.05em' }}>
            {formatTemp(temp, unit)}
          </span>
          <span className="mono" style={{ fontSize: '2.2rem', fontWeight: 300, marginTop: 8, opacity: 0.75 }}>°</span>
        </div>
      </div>

      <div className="atmo-row" style={{ alignItems: 'center', gap: 14, marginTop: 4 }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{condition}</span>
        <span className="mono" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          ↑{formatTemp(high, unit)}°&nbsp;&nbsp;↓{formatTemp(low, unit)}°
        </span>
      </div>

      {/* multi-source confidence — the app's headline feature */}
      {sourceCount > 0 && (
        <div className="atmo-chip" style={{ marginTop: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }} aria-hidden="true">
            {['var(--accent-green)', 'var(--accent-blue)', 'var(--accent-yellow)'].slice(0, Math.min(3, sourceCount)).map((c, i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c, marginLeft: i ? -4 : 0, border: '1.5px solid var(--glass-bg)' }} />
            ))}
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Blended from <strong style={{ color: 'var(--text-primary)' }}>{sourceCount} {sourceCount === 1 ? 'source' : 'sources'}</strong>
          </span>
          {confPct != null && (
            <>
              <span style={{ width: 1, height: 14, background: 'var(--glass-border)' }} />
              <span className="mono" style={{ fontSize: '0.82rem', fontWeight: 600, color: confColor }}>{confPct}%</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>confidence</span>
            </>
          )}
        </div>
      )}

      {/* how you'll feel */}
      <h2 style={{ fontSize: 'clamp(1.9rem, 6vw, 2.15rem)', lineHeight: 1.08, fontWeight: 600, letterSpacing: '-0.02em', margin: 'var(--spacing-lg) 0 0', textWrap: 'balance', maxWidth: '18ch' }}>
        {headline}
      </h2>
      <p style={{ fontSize: '1rem', lineHeight: 1.55, color: 'var(--text-secondary)', margin: 'var(--spacing-sm) 0 0', maxWidth: '34ch' }}>
        {detail}
      </p>

      {/* advice rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 'var(--spacing-lg)' }}>
        {advice.map((a, i) => (
          <div key={i} className="atmo-advice">
            <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: ADVICE_TONE_COLOR[a.tone] || 'var(--accent-cyan)' }} />
            <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 500 }}>{a.text}</span>
            <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.meta}</span>
          </div>
        ))}
      </div>

      {/* forecast-reactive outlook */}
      {outlook && (
        <div
          className="atmo-advice"
          style={{
            marginTop: 'var(--spacing-md)',
            paddingTop: 'var(--spacing-md)',
            borderTop: '1px solid var(--glass-border)',
          }}
          aria-label={`Outlook: ${outlook.text}`}
        >
          <OutlookIcon
            size={15}
            style={{ flex: 'none', color: ADVICE_TONE_COLOR[outlook.tone] || 'var(--accent-cyan)' }}
            aria-hidden="true"
          />
          <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 500 }}>{outlook.text}</span>
          <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{outlook.meta}</span>
        </div>
      )}
    </article>
  );
}
