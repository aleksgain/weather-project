import { useEffect, useRef, useState } from 'react';
import {
  X,
  MapPin,
  Navigation,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  ExternalLink,
  Check,
} from 'lucide-react';
import LocationSearch from './LocationSearch';
import { weatherSources, deploymentDefaults, uiConfig } from '../config/weather-sources';
import { readUserSettings } from '../config/userSettings';
import { checkForUpdate } from '../utils/updateCheck';

const SOURCE_NOTES = {
  openMeteo: 'Free, no key',
  metNorway: 'Free, no key · CC BY 4.0',
  nws: 'Free, no key · US only',
  openWeatherMap: 'Free tier with key',
  weatherApi: 'Free tier with key',
  pirateWeather: 'Free tier with key',
};

const SIGNUP_URLS = {
  openWeatherMap: 'https://home.openweathermap.org/api_keys',
  weatherApi: 'https://www.weatherapi.com/my/',
  pirateWeather: 'https://pirate-weather.apiable.io/',
};

/** Draft of the source settings, seeded from what's currently applied. */
function initialDraft() {
  const saved = readUserSettings();
  const sources = {};
  for (const s of Object.values(weatherSources)) {
    sources[s.id] = {
      enabled: s.enabled,
      // Only show keys the user typed; never echo a server-provided key.
      key: saved.sources?.[s.id]?.key ?? '',
    };
  }
  return { sources, showSources: uiConfig.showSources };
}

function Segmented({ label, value, options, onChange }) {
  return (
    <div className="drawer-row">
      <span className="drawer-row-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? 'active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  );
}

function KeyInput({ sourceId, value, onChange }) {
  const [visible, setVisible] = useState(false);
  const serverHasKey = deploymentDefaults.sources[sourceId]?.hasKey;
  return (
    <div className="key-input">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={serverHasKey ? 'Using server key' : 'API key'}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={`${weatherSources[sourceId].name} API key`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide key' : 'Show key'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function UpdateChecker({ isNative }) {
  const [state, setState] = useState({ status: 'idle' });

  const run = async () => {
    setState({ status: 'checking' });
    try {
      const result = await checkForUpdate();
      setState({ status: 'done', ...result });
    } catch (err) {
      setState({ status: 'error', message: err.message || 'Check failed' });
    }
  };

  if (!isNative) {
    return <p className="drawer-hint">This copy is served by your server and updates with it.</p>;
  }

  return (
    <div className="update-checker">
      <button type="button" className="drawer-button" onClick={run} disabled={state.status === 'checking'}>
        <RefreshCw size={16} className={state.status === 'checking' ? 'spin' : ''} aria-hidden="true" />
        {state.status === 'checking' ? 'Checking…' : 'Check for updates'}
      </button>
      {state.status === 'error' && <p className="drawer-hint warn">{state.message}</p>}
      {state.status === 'done' && !state.hasUpdate && (
        <p className="drawer-hint">
          <Check size={14} aria-hidden="true" /> Up to date (latest is v{state.latest})
        </p>
      )}
      {state.status === 'done' && state.hasUpdate && (
        <div className="update-available">
          <p className="drawer-hint ok">Version {state.latest} is available.</p>
          {/* Plain links: Capacitor opens external URLs in the system browser. */}
          {state.apkUrl && (
            <a className="drawer-button primary" href={state.apkUrl}>
              <Download size={16} aria-hidden="true" /> Download APK
            </a>
          )}
          <a className="drawer-link" href={state.releaseUrl}>
            Release notes <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}

export default function SettingsDrawer({
  open,
  onClose,
  isNative,
  cities,
  activeId,
  currentLocationName,
  onSelectCity,
  onAddCity,
  onRemoveCity,
  onMoveCity,
  unit,
  onUnitChange,
  themeMode,
  onThemeChange,
  onSaveSources,
}) {
  const closeRef = useRef(null);
  const [draft, setDraft] = useState(initialDraft);
  const [dirty, setDirty] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  // Re-seed the draft each time the drawer opens (render-time state sync).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(initialDraft());
      setDirty(false);
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const updateSource = (id, patch) => {
    setDraft((d) => ({ ...d, sources: { ...d.sources, [id]: { ...d.sources[id], ...patch } } }));
    setDirty(true);
  };

  const save = () => {
    onSaveSources(draft);
    setDirty(false);
  };

  const enabledCount = Object.entries(draft.sources).filter(([id, s]) => {
    const needsKey = weatherSources[id].needsKey;
    return s.enabled && (!needsKey || s.key.trim() || deploymentDefaults.sources[id].hasKey);
  }).length;

  const select = (id) => {
    onSelectCity(id);
    onClose();
  };

  return (
    <>
      <div
        className={`drawer-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`drawer ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="drawer-header">
          <span className="drawer-title">Weather</span>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <div className="drawer-body">
          <section className="drawer-section">
            <h2 className="drawer-section-title">Locations</h2>
            <ul className="city-list">
              <li className={activeId === null ? 'active' : ''}>
                <button type="button" className="city-select" onClick={() => select(null)}>
                  <Navigation size={16} aria-hidden="true" />
                  <span className="city-name">
                    Current location
                    {activeId === null && currentLocationName && (
                      <span className="city-sub">{currentLocationName}</span>
                    )}
                  </span>
                </button>
              </li>
              {cities.map((c, i) => (
                <li key={c.id} className={activeId === c.id ? 'active' : ''}>
                  <button type="button" className="city-select" onClick={() => select(c.id)}>
                    <MapPin size={16} aria-hidden="true" />
                    <span className="city-name">{c.name}</span>
                  </button>
                  <div className="city-actions">
                    <button
                      type="button"
                      onClick={() => onMoveCity(c.id, -1)}
                      disabled={i === 0}
                      aria-label={`Move ${c.name} up`}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveCity(c.id, 1)}
                      disabled={i === cities.length - 1}
                      aria-label={`Move ${c.name} down`}
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button type="button" onClick={() => onRemoveCity(c.id)} aria-label={`Remove ${c.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="drawer-add-city">
              <LocationSearch
                currentLocation="Add a city…"
                isManual={false}
                onLocationSelect={(loc) => {
                  onAddCity(loc);
                  onClose();
                }}
              />
            </div>
          </section>

          <section className="drawer-section">
            <h2 className="drawer-section-title">Display</h2>
            <Segmented
              label="Units"
              value={unit}
              onChange={onUnitChange}
              options={[
                { value: 'metric', label: '°C · hPa' },
                { value: 'imperial', label: '°F · inHg' },
              ]}
            />
            <Segmented
              label="Theme"
              value={themeMode}
              onChange={onThemeChange}
              options={[
                { value: 'system', label: 'Auto' },
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
            />
          </section>

          <section className="drawer-section">
            <h2 className="drawer-section-title">Data sources</h2>
            <p className="drawer-hint">
              Stored on this device only. Requests go straight from this device to each provider.
            </p>
            <ul className="source-list">
              {Object.values(weatherSources).map((s) => {
                const d = draft.sources[s.id];
                return (
                  <li key={s.id}>
                    <div className="drawer-row">
                      <span className="drawer-row-label">
                        {s.name}
                        <span className="city-sub">{SOURCE_NOTES[s.id]}</span>
                      </span>
                      <Switch
                        checked={d.enabled}
                        onChange={(v) => updateSource(s.id, { enabled: v })}
                        label={`Use ${s.name}`}
                      />
                    </div>
                    {s.needsKey && d.enabled && (
                      <>
                        <KeyInput sourceId={s.id} value={d.key} onChange={(v) => updateSource(s.id, { key: v })} />
                        {!d.key.trim() && !deploymentDefaults.sources[s.id].hasKey && (
                          <a className="drawer-link" href={SIGNUP_URLS[s.id]}>
                            Get a key <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="drawer-row">
              <span className="drawer-row-label">
                Show sources badge
                <span className="city-sub">Debug: which providers answered</span>
              </span>
              <Switch
                checked={draft.showSources}
                onChange={(v) => {
                  setDraft((dr) => ({ ...dr, showSources: v }));
                  setDirty(true);
                }}
                label="Show sources badge"
              />
            </div>
            {enabledCount === 0 && <p className="drawer-hint warn">Enable at least one usable source.</p>}
            <button
              type="button"
              className="drawer-button primary"
              onClick={save}
              disabled={!dirty || enabledCount === 0}
            >
              Save &amp; reload data
            </button>
          </section>

          <section className="drawer-section">
            <h2 className="drawer-section-title">About</h2>
            <p className="about-version">
              Version {__APP_VERSION__} · {isNative ? 'Android app' : 'Web'}
            </p>
            <UpdateChecker isNative={isNative} />
            <p className="drawer-hint">
              Forecasts from Open-Meteo, MET Norway (CC BY 4.0), NWS and optional keyed providers.
              Geocoding © OpenStreetMap contributors via Nominatim. Radar by RainViewer.
            </p>
            <a className="drawer-link" href={`https://github.com/${__APP_REPO__}`}>
              Source on GitHub <ExternalLink size={12} aria-hidden="true" />
            </a>
          </section>
        </div>
      </aside>
    </>
  );
}
