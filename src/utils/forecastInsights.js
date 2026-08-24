import { getConditionCategory } from './weatherConditions';
import { formatTemp } from './unitConversion';

/**
 * Forecast-reactive insight for the hero card.
 *
 * Scans the aggregated hourly and daily forecast for the single most useful
 * upcoming change and phrases it as one short "outlook" line:
 *   "Rain arrives around 17:00 — get out before it."
 *   "Cooler air tonight — down to 12° by morning."
 *   "The heat breaks Thursday (27°)."
 *
 * Detection is priority-ordered (imminent + actionable first) and hazard-aware:
 * during a heatwave or deep cold, relief in the daily forecast outranks
 * everything else, because that's the question people actually have.
 *
 * Deterministic per (local date, insight): stable across re-renders, phrased
 * differently on different days.
 *
 * @param {Object} data      { current, hourly, daily } (aggregated)
 * @param {string} unit      'metric' | 'imperial'
 * @param {Object} [opts]    { date?: Date, heatActive?: boolean, coldActive?: boolean }
 * @returns {{ text: string, meta: string, tone: string, direction: string } | null}
 *   direction ∈ 'up' | 'down' | 'rain' | 'clear' | 'storm' — for an icon in the UI.
 */
export function getForecastOutlook(data, unit = 'metric', opts = {}) {
  const { date = new Date(), heatActive = false, coldActive = false } = opts;
  const current = data?.current;
  if (!current) return null;

  const now = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const nowTs = now.getTime();
  const seedBase = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

  const hours = (Array.isArray(data.hourly) ? data.hourly : [])
    .filter(h => h?.time && isNum(h.temp ?? h.precipProbability))
    .map(h => ({ ...h, ts: new Date(h.time).getTime() }))
    .filter(h => Number.isFinite(h.ts) && h.ts > nowTs - 30 * 60 * 1000)
    .sort((a, b) => a.ts - b.ts)
    .slice(0, 24);

  const days = (Array.isArray(data.daily) ? data.daily : [])
    .filter(d => d?.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Ordered checks — first hit wins.
  const checks = [];
  if (heatActive) checks.push(() => detectHeatBreak(days, unit, seedBase));
  if (coldActive) checks.push(() => detectColdBreak(days, unit, seedBase));
  checks.push(
    () => detectRainStart(current, hours, now, unit, seedBase),
    () => detectRainEnd(current, hours, now, unit, seedBase),
    () => detectTempSwing(current, hours, now, unit, seedBase),
    // fallback break-detectors when the hazard isn't active right now but
    // today is still clearly hot/cold (e.g. checking in the evening)
    () => (heatActive || !isNum(days[0]?.high) || days[0].high < 32
      ? null
      : detectHeatBreak(days, unit, seedBase)),
    () => (coldActive || !isNum(days[0]?.high) || days[0].high > -3
      ? null
      : detectColdBreak(days, unit, seedBase)),
    () => detectStormTomorrow(days, now, seedBase),
    () => detectTomorrowDelta(days, unit, seedBase),
    () => detectMultiDayTrend(days, unit, seedBase)
  );

  for (const check of checks) {
    const insight = check();
    if (insight) return insight;
  }
  return null;
}

/* ----------------------------------------------------------------------------
 * DETECTORS
 * ------------------------------------------------------------------------- */

/** Dry now, but rain likely within the next 12 h → when it starts. */
function detectRainStart(current, hours, now, unit, seed) {
  if (isPrecipNow(current)) return null;
  const horizon = now.getTime() + 12 * 3600 * 1000;
  const first = hours.find(h => h.ts <= horizon && isWetHour(h));
  if (!first) return null;

  const t = clock(first.ts, unit);
  const soon = first.ts - now.getTime() <= 2.5 * 3600 * 1000;
  const text = soon
    ? pick([
        `Rain moves in around ${t} — squeeze plans in now.`,
        `Dry for the moment, but rain arrives by ${t}.`,
        `The window closes around ${t} — rain on the way.`,
      ], `${seed}|rainSoon`)
    : pick([
        `Rain arrives around ${t} — get out before it.`,
        `Dry until about ${t}, then the rain starts.`,
        `Plans before ${t} stay dry; after that, umbrella time.`,
      ], `${seed}|rainLater`);
  const pop = num(first.precipProbability);
  return { text, meta: pop != null ? `${Math.round(pop)}%` : t, tone: 'cool', direction: 'rain' };
}

/** Raining now → when it stops (2 consecutive dry-ish hours), or not today. */
function detectRainEnd(current, hours, now, unit, seed) {
  if (!isPrecipNow(current)) return null;
  const horizon = now.getTime() + 14 * 3600 * 1000;
  const scope = hours.filter(h => h.ts <= horizon);

  for (let i = 0; i < scope.length - 1; i++) {
    if (!isWetHour(scope[i]) && !isWetHour(scope[i + 1])) {
      const t = clock(scope[i].ts, unit);
      const text = pick([
        `The rain clears by about ${t}.`,
        `Wet now, but drying out around ${t}.`,
        `Hold on — this clears up around ${t}.`,
      ], `${seed}|rainEnd`);
      return { text, meta: t, tone: 'good', direction: 'clear' };
    }
  }
  if (scope.length >= 6) {
    const text = pick([
      'This rain is settled in for the day.',
      'No dry window in sight — plan around the wet.',
    ], `${seed}|rainAllDay`);
    return { text, meta: 'all day', tone: 'info', direction: 'rain' };
  }
  return null;
}

/** ≥6 °C change coming within 12 h → cooler/warmer air with a target temp. */
function detectTempSwing(current, hours, now, unit, seed) {
  if (!isNum(current.temp)) return null;
  const horizon = now.getTime() + 12 * 3600 * 1000;
  const scope = hours.filter(h => h.ts <= horizon && isNum(h.temp));
  if (scope.length < 3) return null;

  let extreme = null;
  for (const h of scope) {
    if (!extreme || Math.abs(h.temp - current.temp) > Math.abs(extreme.temp - current.temp)) {
      extreme = h;
    }
  }
  const delta = extreme.temp - current.temp;
  if (Math.abs(delta) < 6) return null;

  const when = partOfDay(extreme.ts);
  const target = tt(extreme.temp, unit);
  if (delta < 0) {
    const text = pick([
      `Cooler air arrives ${when} — down to ${target}.`,
      `Temperatures slide ${when}, bottoming out near ${target}.`,
      `A noticeable drop ${when} — plan for ${target}.`,
    ], `${seed}|drop`);
    return { text, meta: target, tone: 'cool', direction: 'down' };
  }
  const text = pick([
    `Warming fast — up to ${target} by ${clock(extreme.ts, unit)}.`,
    `Temperatures climb through the ${when.replace('this ', '')}, peaking near ${target}.`,
  ], `${seed}|rise`);
  return { text, meta: target, tone: 'warm', direction: 'up' };
}

/** During (or after) a hot spell: first upcoming day with a high ≤ 29 °C. */
function detectHeatBreak(days, unit, seed) {
  const upcoming = days.slice(1, 7).filter(d => isNum(d.high));
  if (upcoming.length === 0) return null;
  if (!upcoming.some(d => d.high >= 31)) {
    // no hot days ahead — only meaningful if the break is tomorrow-ish
    const first = upcoming[0];
    if (first.high <= 29 && isNum(days[0]?.high) && days[0].high >= 32) {
      return heatBreakInsight(first, unit, seed);
    }
    return null;
  }
  const breakDay = upcoming.find(d => d.high <= 29);
  if (!breakDay) {
    return {
      text: pick([
        'No break in the heat this week — pace yourself.',
        'The hot spell runs on for days yet.',
      ], `${seed}|heatOn`),
      meta: 'heat holds',
      tone: 'warm',
      direction: 'up',
    };
  }
  return heatBreakInsight(breakDay, unit, seed);
}

function heatBreakInsight(day, unit, seed) {
  const name = weekday(day.date);
  const high = tt(day.high, unit);
  return {
    text: pick([
      `The heat breaks ${name} (${high}).`,
      `Relief arrives ${name} — highs back to ${high}.`,
      `Hold out until ${name}: ${high} and easier air.`,
    ], `${seed}|heatBreak`),
    meta: name,
    tone: 'good',
    direction: 'down',
  };
}

/** During deep cold: first upcoming day with a high above freezing. */
function detectColdBreak(days, unit, seed) {
  const upcoming = days.slice(1, 7).filter(d => isNum(d.high));
  const breakDay = upcoming.find(d => d.high >= 0);
  if (!breakDay) {
    if (upcoming.length >= 3) {
      return {
        text: pick([
          'The deep freeze holds all week.',
          'No thaw in sight — winter has settled in.',
        ], `${seed}|coldOn`),
        meta: 'cold holds',
        tone: 'cool',
        direction: 'down',
      };
    }
    return null;
  }
  const name = weekday(breakDay.date);
  return {
    text: pick([
      `Milder air from ${name} (${tt(breakDay.high, unit)}).`,
      `The cold eases ${name} — back up to ${tt(breakDay.high, unit)}.`,
    ], `${seed}|coldBreak`),
    meta: name,
    tone: 'good',
    direction: 'up',
  };
}

/** Thunderstorms in tomorrow's daily forecast. */
function detectStormTomorrow(days, now, seed) {
  const tomorrow = days.find(d => isTomorrow(d.date, now));
  if (!tomorrow) return null;
  if (getConditionCategory(tomorrow.condition) !== 'severe') return null;
  return {
    text: pick([
      'Thunderstorms likely tomorrow — plan around them.',
      'Tomorrow turns stormy; today is the better day out.',
    ], `${seed}|stormTmrw`),
    meta: 'tomorrow',
    tone: 'warn',
    direction: 'storm',
  };
}

/** Tomorrow ≥5 °C warmer or cooler than today. */
function detectTomorrowDelta(days, unit, seed) {
  if (days.length < 2) return null;
  const [today, tomorrow] = days;
  if (!isNum(today?.high) || !isNum(tomorrow?.high)) return null;
  const delta = tomorrow.high - today.high;
  if (Math.abs(delta) < 5) return null;

  const target = tt(tomorrow.high, unit);
  if (delta < 0) {
    return {
      text: pick([
        `Tomorrow runs ${degDelta(delta, unit)} cooler — a high of ${target}.`,
        `Make the most of today: tomorrow tops out at ${target}.`,
      ], `${seed}|tmrwCooler`),
      meta: target,
      tone: 'cool',
      direction: 'down',
    };
  }
  return {
    text: pick([
      `Tomorrow runs ${degDelta(delta, unit)} warmer — up to ${target}.`,
      `Warmer day tomorrow: a high of ${target}.`,
    ], `${seed}|tmrwWarmer`),
    meta: target,
    tone: 'warm',
    direction: 'up',
  };
}

/** Sustained warming/cooling: ≥6 °C between today and day 3–4. */
function detectMultiDayTrend(days, unit, seed) {
  const scope = days.slice(0, 5).filter(d => isNum(d.high));
  if (scope.length < 4) return null;
  const first = scope[0].high;
  const last = scope[scope.length - 1].high;
  const delta = last - first;
  if (Math.abs(delta) < 6) return null;

  // require a broadly consistent direction (no big zig-zag)
  let consistent = true;
  for (let i = 1; i < scope.length; i++) {
    if ((scope[i].high - scope[i - 1].high) * delta < -3) { consistent = false; break; }
  }
  if (!consistent) return null;

  const name = weekday(scope[scope.length - 1].date);
  const target = tt(last, unit);
  if (delta > 0) {
    return {
      text: pick([
        `A warming trend builds — ${target} by ${name}.`,
        `Each day a touch warmer, reaching ${target} on ${name}.`,
      ], `${seed}|trendUp`),
      meta: target,
      tone: 'warm',
      direction: 'up',
    };
  }
  return {
    text: pick([
      `Cooling off day by day — ${target} by ${name}.`,
      `A cooler stretch ahead, sliding to ${target} on ${name}.`,
    ], `${seed}|trendDown`),
    meta: target,
    tone: 'cool',
    direction: 'down',
  };
}

/* ----------------------------------------------------------------------------
 * HELPERS
 * ------------------------------------------------------------------------- */

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function num(v) { return isNum(v) ? v : null; }

function isPrecipNow(current) {
  return getConditionCategory(current?.condition) === 'precipitation';
}

/** An hourly entry that reads as wet: decent probability, or a precip condition. */
function isWetHour(h) {
  const pop = num(h.precipProbability);
  const wetCond = getConditionCategory(h.condition) === 'precipitation' ||
    getConditionCategory(h.condition) === 'severe';
  if (pop != null) return pop >= 55 || (pop >= 40 && wetCond);
  return wetCond;
}

function clock(ts, unit) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    hour12: unit === 'imperial',
  });
}

function partOfDay(ts) {
  const h = new Date(ts).getHours();
  if (h < 6) return 'overnight';
  if (h < 12) return 'this morning';
  if (h < 18) return 'this afternoon';
  return 'this evening';
}

function weekday(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'soon';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function isTomorrow(dateStr, now) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  return d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate();
}

function degDelta(deltaC, unit) {
  const v = Math.abs(unit === 'imperial' ? deltaC * 1.8 : deltaC);
  return `${Math.round(v)}°`;
}

function tt(v, unit) { return `${formatTemp(v, unit)}°`; }

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(pool, seed) {
  if (!Array.isArray(pool) || pool.length === 0) return '';
  return pool[hashString(seed) % pool.length];
}
