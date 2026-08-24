import { getConditionCategory } from './weatherConditions';
import { formatTemp, formatSpeed, getUnitLabel } from './unitConversion';
import { getForecastOutlook } from './forecastInsights';

/**
 * Turns raw current-conditions data into human, "how you'll feel" copy:
 * a headline, a supporting sentence, and 2–3 actionable advice rows.
 *
 * Design principles:
 *
 * 1. SAFETY FIRST. Conditions are run through a hazard assessment before any
 *    copy is chosen (heat stress via feels-like, extreme cold/wind chill,
 *    freezing rain, thunderstorms, damaging wind, blizzard, very high UV…).
 *    When a meaningful hazard is present, the headline and the activity row
 *    come from that hazard's copy — cheerful "great day to be outside"
 *    phrasing is structurally unreachable. A heatwave can never read as
 *    picnic weather again.
 *
 * 2. VARIETY WITHOUT FLICKER. Phrases are drawn from pools via a hash seeded
 *    on the local date + situation, so the same conditions read the same all
 *    day (no flicker on re-render) but differently tomorrow.
 *
 * Returns: { headline, detail, advice: [{ tone, text, meta }], outlook }
 *   tone ∈ 'good' | 'warn' | 'cool' | 'warm' | 'info'  → map to a dot color in the UI.
 *   outlook is a forecast-reactive line ({ text, meta, tone, direction }) or
 *   null — see forecastInsights.js. Pass opts.hourly/opts.daily to enable it.
 *
 * @param {Object} current  data.current
 * @param {string} unit     'metric' | 'imperial'
 * @param {Object} [opts]   { isNight?: boolean, date?: Date, hourly?: Array, daily?: Array }
 */
export function buildFeelsCopy(current, unit = 'metric', opts = {}) {
  if (!current) return { headline: '', detail: '', advice: [], outlook: null };

  const { isNight = false, date = new Date() } = opts;
  const {
    temp, feelsLike, condition, uvIndex, humidity, windSpeed,
    precipProbability, windGust, windGusts,
  } = current;

  const cat = getConditionCategory(condition);       // clear | cloudy | precipitation | severe
  const c = (condition || '').toLowerCase();
  const fl = typeof feelsLike === 'number' ? feelsLike : temp;
  const gust = windGust ?? windGusts ?? null;
  const pop = precipProbability ?? 0;
  const muggy = humidity != null && humidity >= 75;

  const ctx = {
    temp,
    fl,
    // heat is judged on the hotter of measured/feels-like; cold on the colder
    heatIndex: Math.max(temp ?? -Infinity, fl ?? -Infinity),
    chillIndex: Math.min(temp ?? Infinity, fl ?? Infinity),
    cat,
    condition: c,
    isSnow: c.includes('snow') || c.includes('sleet') || c.includes('blizzard'),
    isIce: c.includes('freezing') || c.includes('ice pellets') || c.includes('hail'),
    isFog: c.includes('fog') || c.includes('mist') || c.includes('haze'),
    isHeavy: c.includes('heavy') || c.includes('torrential') || c.includes('downpour') || c.includes('blizzard'),
    uv: uvIndex ?? null,
    humidity: humidity ?? null,
    muggy,
    wind: windSpeed ?? null,
    gust,
    pop,
    isNight,
  };

  const seedBase = `${localDateKey(date)}|${cat}|${bandOf(temp).key}`;
  const hazards = assessHazards(ctx);
  const top = hazards[0] ?? null;

  const outlook = getForecastOutlook(
    { current, hourly: opts.hourly, daily: opts.daily },
    unit,
    {
      date,
      heatActive: hazards.some(h => h.id === 'heat' || h.id === 'extremeHeat'),
      coldActive: hazards.some(h => h.id === 'cold' || h.id === 'extremeCold'),
    }
  );

  const copy = top && top.severity >= 2
    ? buildHazardCopy(top, hazards, ctx, unit, seedBase)
    : buildFairCopy(hazards, ctx, unit, seedBase);
  return { ...copy, outlook };
}

/* ----------------------------------------------------------------------------
 * HAZARD ASSESSMENT
 * Severity: 3 = dangerous, 2 = significant (drives the headline),
 *           1 = caution (surfaced as an advice row, softens the copy).
 * ------------------------------------------------------------------------- */

function assessHazards(ctx) {
  const hazards = [];
  const add = (id, severity) => hazards.push({ id, severity });

  // Convective / severe conditions
  if (ctx.cat === 'severe') add('storm', 3);

  // Ice: freezing rain and hail make surfaces treacherous
  if (ctx.isIce) add('ice', 3);

  // Heat (feels-like based, °C)
  if (ctx.heatIndex >= 40) add('extremeHeat', 3);
  else if (ctx.heatIndex >= 33) add('heat', 2);
  else if (ctx.heatIndex >= 28 && ctx.muggy) add('heatCaution', 1);

  // Cold (feels-like based, °C)
  if (ctx.chillIndex <= -27) add('extremeCold', 3);
  else if (ctx.chillIndex <= -15) add('cold', 2);
  else if (ctx.chillIndex <= -5) add('coldCaution', 1);

  // Wind (km/h)
  if (ctx.gust != null && ctx.gust >= 75) add('damagingWind', 3);
  else if ((ctx.gust != null && ctx.gust >= 55) || (ctx.wind != null && ctx.wind >= 45)) add('strongWind', 2);
  else if ((ctx.gust != null && ctx.gust >= 40) || (ctx.wind != null && ctx.wind > 30)) add('windy', 1);

  // Winter precipitation
  if (ctx.isSnow && ctx.isHeavy) add('heavySnow', 2);
  else if (ctx.isSnow) add('snow', 1);

  // Rain
  if (!ctx.isSnow && !ctx.isIce && ctx.cat === 'precipitation') {
    add(ctx.isHeavy ? 'heavyRain' : 'rain', ctx.isHeavy ? 2 : 1);
  }

  // UV (only worth a headline at extreme levels; otherwise an advice row)
  if (ctx.uv != null && ctx.uv >= 11) add('extremeUv', 2);
  else if (ctx.uv != null && ctx.uv >= 8) add('highUv', 1);

  // Fog
  if (ctx.isFog) add('fog', 1);

  return hazards.sort((a, b) => b.severity - a.severity);
}

/* ----------------------------------------------------------------------------
 * HAZARD COPY (severity >= 2 — the headline is a warning, never an invitation)
 * ------------------------------------------------------------------------- */

const HAZARD_COPY = {
  storm: {
    headlines: [
      'Thunderstorms about — ride it out indoors.',
      'Wild and electric — not an afternoon for the open.',
      'Storm cells around — keep plans flexible and inside.',
    ],
    tail: ' Sudden downpours and gusty winds; lightning risk is elevated.',
    action: { tone: 'warn', text: 'Stay indoors until the storms pass', meta: 'shelter' },
    fact: { tone: 'warn', text: 'Lightning risk', meta: 'shelter' },
  },
  ice: {
    headlines: [
      'Freezing rain — ice on roads and pavements.',
      'Ice risk — surfaces are glazing over.',
      'Slick and icy — walking and driving are treacherous.',
    ],
    tail: ' Untreated surfaces will be slippery; allow extra time for any trip.',
    action: { tone: 'warn', text: 'Avoid travel if you can — black ice about', meta: 'ice' },
    fact: { tone: 'warn', text: 'Icy surfaces', meta: 'take care' },
  },
  extremeHeat: {
    headlines: [
      'Dangerous heat — take it seriously today.',
      'Extreme heat — the day is best spent somewhere cool.',
      'Furnace-level heat — limit time outdoors.',
    ],
    tail: ' Heat at this level is a health risk: stay in the shade or AC, drink water constantly, and skip strenuous activity.',
    action: { tone: 'warn', text: 'Avoid exertion — keep to shade and AC', meta: 'danger' },
    fact: { tone: 'warn', text: 'Check on kids, pets and older people', meta: 'heat' },
  },
  heat: {
    headlines: [
      'Heatwave conditions — pace yourself out there.',
      'Seriously hot — the shade is your friend today.',
      'Baking heat — plan around the midday sun.',
    ],
    tail: ' Drink water often, keep out of the midday sun, and save any exercise for early or late.',
    action: { tone: 'warn', text: 'Outdoors early or late only — midday is for shade', meta: 'hydrate' },
    fact: { tone: 'warm', text: 'Heat stress risk through the afternoon', meta: 'heat' },
  },
  extremeCold: {
    headlines: [
      'Brutally cold — exposed skin freezes fast.',
      'Dangerous cold — keep trips outside short.',
      'Arctic conditions — frostbite is a real risk.',
    ],
    tail: ' Cover all exposed skin; frostbite can set in within minutes at this wind chill.',
    action: { tone: 'warn', text: 'Minutes outside, not hours — cover up fully', meta: 'frostbite' },
    fact: { tone: 'cool', text: 'Extreme wind chill', meta: 'danger' },
  },
  cold: {
    headlines: [
      'Bitterly cold — dress like you mean it.',
      'Deep cold — layers, hat and gloves are non-negotiable.',
      'Icy air — keep outdoor stints short.',
    ],
    tail: ' The wind chill bites; layer up properly and keep moving when outside.',
    action: { tone: 'cool', text: 'Short, brisk outings — full winter kit', meta: 'wrap up' },
    fact: { tone: 'cool', text: 'Significant wind chill', meta: 'layers' },
  },
  damagingWind: {
    headlines: [
      'Damaging gusts — give trees and loose objects a wide berth.',
      'Violent wind — a day to stay out of the gusts.',
      'Dangerous gusts — secure anything that can fly.',
    ],
    tail: ' Gusts this strong can bring down branches; avoid exposed routes and high-sided vehicles.',
    action: { tone: 'warn', text: 'Stay clear of trees and scaffolding', meta: 'gusts' },
    fact: { tone: 'warn', text: 'Damaging wind gusts', meta: 'secure' },
  },
  strongWind: {
    headlines: [
      'Properly windy — brace for the gusts.',
      'Blowing a gale — not a day for umbrellas.',
      'Strong winds — cycling and high routes will be hard work.',
    ],
    tail: ' Expect it to feel harsher than the number; cycling and exposed paths will be a slog.',
    action: { tone: 'cool', text: 'Keep to sheltered routes if you head out', meta: 'windy' },
    fact: { tone: 'cool', text: 'Strong sustained wind', meta: 'gusty' },
  },
  heavySnow: {
    headlines: [
      'Heavy snow — travel will be slow and messy.',
      'Snow piling up — a proper winter storm.',
      'Whiteout tendencies — only essential trips.',
    ],
    tail: ' Roads and visibility will deteriorate; if you must travel, allow much more time.',
    action: { tone: 'warn', text: 'Delay non-essential travel', meta: 'snow' },
    fact: { tone: 'info', text: 'Snow accumulating fast', meta: 'roads' },
  },
  heavyRain: {
    headlines: [
      "It's bucketing down — waterproofs, not umbrellas.",
      'Torrential stuff — the gutters are earning their keep.',
      'Drenching rain — a day for dry plans.',
    ],
    tail: ' Expect surface water and spray on the roads; keep anything electronic well wrapped.',
    action: { tone: 'cool', text: 'One for indoors — tea and a book', meta: 'stay dry' },
    fact: { tone: 'info', text: 'Localized flooding possible', meta: 'rain' },
  },
  extremeUv: {
    headlines: [
      'Extreme UV — skin burns in minutes out there.',
      'Off-the-scale UV — treat the sun as hostile today.',
    ],
    tail: ' Unprotected skin burns in under 10 minutes; cover up, high SPF, and keep to shade around midday.',
    action: { tone: 'warn', text: 'Cover up — SPF, hat, shade at midday', meta: 'UV 11+' },
    fact: { tone: 'warm', text: 'Extreme UV index', meta: 'burn risk' },
  },
};

/** Secondary advice rows for lower-priority hazards, used to fill slot 3 */
const HAZARD_FACT_ROWS = {
  heatCaution: (ctx, unit) => ({ tone: 'warm', text: 'Hot and humid — it will feel close', meta: tt(ctx.heatIndex, unit) }),
  coldCaution: (ctx, unit) => ({ tone: 'cool', text: 'Feels colder in the wind', meta: tt(ctx.chillIndex, unit) }),
  windy: (ctx, unit) => ({ tone: 'cool', text: 'Gusty', meta: ctx.gust != null ? `${formatSpeed(ctx.gust, unit)} ${getUnitLabel('speed', unit)}` : 'wind' }),
  snow: () => ({ tone: 'info', text: 'Snow settling', meta: 'wrap up' }),
  rain: (ctx) => ({ tone: 'info', text: 'Umbrella essential', meta: ctx.pop ? `${Math.round(ctx.pop)}%` : 'rain' }),
  highUv: (ctx) => ({ tone: 'warm', text: 'UV is very high — SPF up', meta: `${ctx.uv} / 11` }),
  fog: () => ({ tone: 'cool', text: 'Low visibility', meta: 'go slow' }),
  storm: () => HAZARD_COPY.storm.fact,
  ice: () => HAZARD_COPY.ice.fact,
  extremeHeat: () => HAZARD_COPY.extremeHeat.fact,
  heat: () => HAZARD_COPY.heat.fact,
  extremeCold: () => HAZARD_COPY.extremeCold.fact,
  cold: () => HAZARD_COPY.cold.fact,
  damagingWind: () => HAZARD_COPY.damagingWind.fact,
  strongWind: () => HAZARD_COPY.strongWind.fact,
  heavySnow: () => HAZARD_COPY.heavySnow.fact,
  heavyRain: () => HAZARD_COPY.heavyRain.fact,
  extremeUv: () => HAZARD_COPY.extremeUv.fact,
};

/** Night-specific overrides where the daytime wording would read oddly */
const HAZARD_NIGHT = {
  heat: {
    headlines: [
      'A tropical night — sleep will take some engineering.',
      'Hot after dark — the air is not letting go.',
    ],
    action: { tone: 'warm', text: 'Cool the bedroom — fan, water, light covers', meta: 'hot night' },
  },
  extremeHeat: {
    action: { tone: 'warn', text: 'Stay somewhere cool overnight — hydrate', meta: 'danger' },
  },
};

function buildHazardCopy(top, hazards, ctx, unit, seedBase) {
  const copy = HAZARD_COPY[top.id];
  const night = ctx.isNight ? HAZARD_NIGHT[top.id] : null;
  const headline = pick(night?.headlines ?? copy.headlines, `${seedBase}|hz|${top.id}`);
  const detail = feelsPhrase(ctx, unit, seedBase) + copy.tail;

  const advice = [night?.action ?? copy.action];
  for (const h of hazards.slice(1)) {
    if (advice.length >= 3) break;
    const row = HAZARD_FACT_ROWS[h.id]?.(ctx, unit);
    if (row && !advice.some(a => a.text === row.text)) advice.push(row);
  }
  // Pad with the most relevant neutral fact if there's room
  if (advice.length < 3) {
    const fact = neutralFactRow(ctx, unit);
    if (fact && !advice.some(a => a.text === fact.text)) advice.push(fact);
  }
  return { headline, detail, advice: advice.slice(0, 3) };
}

/* ----------------------------------------------------------------------------
 * FAIR-WEATHER COPY (no significant hazards — this is the only path where
 * upbeat "get outside" copy can appear, and severity-1 cautions still temper it)
 * ------------------------------------------------------------------------- */

function bandOf(temp) {
  return temp <= 0 ? { key: 'freezing', word: 'freezing', layer: 'bundle up warm' } :
    temp <= 8 ? { key: 'cold', word: 'cold', layer: "you'll want a proper coat" } :
    temp <= 15 ? { key: 'crisp', word: 'crisp', layer: "you'll want a light layer" } :
    temp <= 23 ? { key: 'mild', word: 'mild', layer: 'a t-shirt is plenty' } :
    temp <= 30 ? { key: 'warm', word: 'warm', layer: 'dress light and hydrate' } :
    { key: 'hot', word: 'hot', layer: 'stay in the shade and hydrate' };
}

/** Headline pools by situation. `{word}` and `{layer}` are filled per band. */
const FAIR_HEADLINES = {
  snowLight: [
    'Snow in the air — {layer}.',
    'A dusting of snow — winter doing its thing.',
    'Flurries about — soft, cold and quiet.',
  ],
  rainLight: [
    'Wet and {word} — bring a proper jacket.',
    'Showery and {word} — dodge the drops.',
    'Damp out there — an umbrella kind of day.',
    'Rain on and off — plan around the gaps.',
  ],
  fog: [
    'Soft and foggy — low cloud, take it slow.',
    'Murky start — the world ends fifty meters away.',
    'Fog-bound — atmospheric, but give it time.',
  ],
  cloudyHot: [
    'Grey and hot — muggy, but no rain to dodge.',
    'Overcast and warm — close, sticky air.',
  ],
  cloudy: [
    'Grey and {word} — a comfortable, easy day.',
    'Soft grey skies — calm and {word}.',
    'Cloud-capped and {word} — steady, unfussy weather.',
    'Muted skies — {word}, with no surprises in them.',
  ],
  clearNight: [
    '{Word} and clear — a calm night out.',
    'Starry and {word} — a good night for a look up.',
    'Clear night air — {word} and still.',
  ],
  clear: [
    '{Word} and clear — {layer}.',
    '{Word} and sunny — the sky is on your side.',
    'Bright and {word} — as good as it looks.',
    'Blue skies, {word} air — enjoy it.',
  ],
};

/** Activity pools per band (only reachable with no significant hazards). */
const FAIR_ACTIVITIES = {
  hot: [
    { tone: 'warm', text: 'Beat the heat — shade, water, easy pace', meta: 'go early' },
    { tone: 'warm', text: 'Morning or evening outings — midday in the shade', meta: 'hydrate' },
  ],
  warmClear: [
    { tone: 'good', text: 'Beach, picnic or a swim — take your pick', meta: 'great' },
    { tone: 'good', text: 'Golden evening ahead — eat outside', meta: 'great' },
    { tone: 'good', text: 'A proper summer day — make the most of it', meta: 'great' },
  ],
  warm: [
    { tone: 'good', text: 'Warm enough for a long, easy outing', meta: 'great' },
    { tone: 'good', text: 'T-shirt weather — a good day to be out', meta: 'nice' },
  ],
  mildClear: [
    { tone: 'good', text: 'Perfect for a dog walk', meta: 'now' },
    { tone: 'good', text: 'Prime weather for a bike ride', meta: 'now' },
    { tone: 'good', text: 'Worth heading for the hills', meta: 'now' },
    { tone: 'good', text: 'Great day for a long run', meta: 'now' },
    { tone: 'good', text: 'Lovely for a picnic in the park', meta: 'now' },
    { tone: 'good', text: 'Coffee outside kind of morning', meta: 'now' },
  ],
  mild: [
    { tone: 'good', text: 'Comfortable for a walk or a ride', meta: 'now' },
    { tone: 'good', text: 'Easy weather for a stroll', meta: 'now' },
    { tone: 'good', text: 'Good for a relaxed run', meta: 'now' },
  ],
  crisp: [
    { tone: 'good', text: 'Brisk and lovely — walk, run or ride', meta: 'now' },
    { tone: 'good', text: 'Fresh air therapy — grab a jacket and go', meta: 'now' },
    { tone: 'good', text: 'Crisp and clean — great running weather', meta: 'now' },
  ],
  cold: [
    { tone: 'cool', text: 'Bundle up for a brisk walk', meta: 'wrap up' },
    { tone: 'cool', text: 'Cold but doable — hat and gloves on', meta: 'wrap up' },
  ],
  freezing: [
    { tone: 'cool', text: 'Quick dash out, then warm up', meta: 'wrap up' },
    { tone: 'cool', text: 'Hot drink weather — keep outings short', meta: 'wrap up' },
  ],
  snow: [
    { tone: 'info', text: 'Snow day — sledding, or hit the slopes', meta: 'wrap up' },
    { tone: 'info', text: 'Fresh snow — get out before it turns to slush', meta: 'wrap up' },
  ],
  rain: [
    { tone: 'info', text: 'Quick errands only — keep a brolly handy', meta: 'brolly' },
    { tone: 'info', text: 'Gaps between showers — time your exits', meta: 'brolly' },
  ],
  fog: [
    { tone: 'cool', text: 'Atmospheric stroll — mind the low visibility', meta: 'go slow' },
    { tone: 'cool', text: 'Moody walking weather — lights on if you ride', meta: 'go slow' },
  ],
  clearNight: [
    { tone: 'info', text: 'Clear night — great for stargazing', meta: 'look up' },
    { tone: 'info', text: 'Still and clear — a fine evening walk', meta: 'look up' },
  ],
  breezy: [
    { tone: 'cool', text: 'Blustery but bright — a kite or coastal walk', meta: 'gusty' },
    { tone: 'cool', text: 'Fresh wind about — lean into it', meta: 'gusty' },
  ],
};

/** Neutral closing sentences when nothing needs flagging. */
const FAIR_TAILS = [
  ' A good window to be outside.',
  ' No excuses weather — the outdoors is open.',
  ' Conditions are as friendly as they get.',
  ' Nothing in the sky to plan around.',
];

function buildFairCopy(hazards, ctx, unit, seedBase) {
  const band = bandOf(ctx.temp);
  const cautions = hazards.filter(h => h.severity === 1);
  const has = id => cautions.some(h => h.id === id);

  // ---- headline
  let pool;
  if (ctx.cat === 'precipitation' && ctx.isSnow) pool = FAIR_HEADLINES.snowLight;
  else if (ctx.cat === 'precipitation') pool = FAIR_HEADLINES.rainLight;
  else if (ctx.isFog) pool = FAIR_HEADLINES.fog;
  else if (ctx.cat === 'cloudy') pool = band.key === 'hot' ? FAIR_HEADLINES.cloudyHot : FAIR_HEADLINES.cloudy;
  else if (ctx.isNight) pool = FAIR_HEADLINES.clearNight;
  else pool = FAIR_HEADLINES.clear;
  const headline = fill(pick(pool, `${seedBase}|hl`), band);

  // ---- supporting sentence
  const tail =
    ctx.cat === 'precipitation' ? ' Keep something waterproof to hand through the day.'
    : ctx.isFog ? ' Visibility is low, so give yourself a little extra time.'
    : has('heatCaution') ? ' The air is humid, so it will feel closer than the number.'
    : has('coldCaution') ? ' The wind makes it feel colder than it reads, so layer up.'
    : has('windy') ? ' A brisk wind is the main thing to factor in.'
    : has('highUv') ? ' The sun is strong today — worth sunscreen if you linger.'
    : ctx.cat === 'cloudy' ? ' Little sun to warm things up, but no rain to dodge.'
    : ctx.pop >= 40 ? ' Comfortable now, with rain possible later on.'
    : pick(FAIR_TAILS, `${seedBase}|tail`);
  const detail = feelsPhrase(ctx, unit, seedBase) + tail;

  // ---- advice rows
  const advice = [];

  // 1) activity — gated by the caution list
  advice.push(pickFairActivity(ctx, band, cautions, seedBase));

  // 2) cautions get priority for the fact slots
  for (const h of cautions) {
    if (advice.length >= 3) break;
    const row = HAZARD_FACT_ROWS[h.id]?.(ctx, unit);
    if (row && !advice.some(a => a.text === row.text)) advice.push(row);
  }

  // 3) fill remaining slots with useful neutral facts
  while (advice.length < 3) {
    const fact = neutralFactRow(ctx, unit, advice);
    if (!fact) break;
    advice.push(fact);
  }

  return { headline, detail, advice: advice.slice(0, 3) };
}

function pickFairActivity(ctx, band, cautions, seedBase) {
  const seed = `${seedBase}|act`;
  const has = id => cautions.some(h => h.id === id);

  if (ctx.cat === 'precipitation' && ctx.isSnow) {
    return band.key === 'freezing' || band.key === 'cold'
      ? pick(FAIR_ACTIVITIES.snow, seed)
      : { tone: 'info', text: 'Wet snow — best enjoyed from indoors', meta: 'stay dry' };
  }
  if (ctx.cat === 'precipitation') return pick(FAIR_ACTIVITIES.rain, seed);
  if (ctx.isFog) return pick(FAIR_ACTIVITIES.fog, seed);
  if (ctx.cat === 'clear' && ctx.isNight && band.key !== 'freezing') {
    return pick(FAIR_ACTIVITIES.clearNight, seed);
  }
  if (has('windy') && ['crisp', 'mild', 'warm'].includes(band.key)) {
    return pick(FAIR_ACTIVITIES.breezy, seed);
  }

  switch (band.key) {
    case 'hot': return pick(FAIR_ACTIVITIES.hot, seed);
    case 'warm':
      // humid-warm or very sunny days get the tempered copy, not "beach all day"
      return ctx.cat === 'clear' && !has('heatCaution') && !has('highUv')
        ? pick(FAIR_ACTIVITIES.warmClear, seed)
        : pick(FAIR_ACTIVITIES.warm, seed);
    case 'mild':
      return pick(ctx.cat === 'clear' ? FAIR_ACTIVITIES.mildClear : FAIR_ACTIVITIES.mild, seed);
    case 'crisp': return pick(FAIR_ACTIVITIES.crisp, seed);
    case 'cold': return pick(FAIR_ACTIVITIES.cold, seed);
    case 'freezing':
    default: return pick(FAIR_ACTIVITIES.freezing, seed);
  }
}

/* ----------------------------------------------------------------------------
 * SHARED FRAGMENTS
 * ------------------------------------------------------------------------- */

/** "It reads X and feels…" — with a couple of phrasings for variety */
function feelsPhrase(ctx, unit, seedBase) {
  const { temp, fl } = ctx;
  const delta = fl - temp;
  if (Math.abs(delta) < 1.5) {
    return pick([
      `It reads ${tt(temp, unit)} and feels about the same.`,
      `A straightforward ${tt(temp, unit)} — no surprises in the feel.`,
    ], `${seedBase}|fp`);
  }
  if (delta < 0) {
    return pick([
      `It reads ${tt(temp, unit)} but feels like ${tt(fl, unit)} in the wind.`,
      `${tt(temp, unit)} on paper, closer to ${tt(fl, unit)} on your skin.`,
    ], `${seedBase}|fp`);
  }
  return pick([
    `It reads ${tt(temp, unit)} but feels warmer at ${tt(fl, unit)}.`,
    `${tt(temp, unit)} on paper, more like ${tt(fl, unit)} in the air.`,
  ], `${seedBase}|fp`);
}

/** Best remaining neutral fact (UV, humidity, wind) not already shown. */
function neutralFactRow(ctx, unit, existing = []) {
  const taken = text => existing.some(a => a.text === text);

  if (ctx.uv != null && ctx.uv >= 1 && !ctx.isNight) {
    const uvDesc = ctx.uv <= 2 ? 'low' : ctx.uv <= 5 ? 'moderate' : ctx.uv <= 7 ? 'high' : 'very high';
    const text = `UV is ${uvDesc}`;
    if (!taken(text)) {
      return { tone: ctx.uv <= 2 ? 'info' : 'warm', text, meta: `${ctx.uv} / 11` };
    }
  }
  if (ctx.muggy) {
    const text = 'Humid air';
    if (!taken(text)) return { tone: 'info', text, meta: `${Math.round(ctx.humidity)}%` };
  }
  if (ctx.cat === 'clear' && ctx.pop >= 30) {
    const text = 'Umbrella later';
    if (!taken(text)) return { tone: 'cool', text, meta: `${Math.round(ctx.pop)}%` };
  }
  if (ctx.wind != null) {
    const text = ctx.wind > 30 ? 'Strong winds' : ctx.wind > 15 ? 'Breezy' : 'Light winds';
    if (!taken(text)) {
      return { tone: 'cool', text, meta: `${formatSpeed(ctx.wind, unit)} ${getUnitLabel('speed', unit)}` };
    }
  }
  return null;
}

/* ----------------------------------------------------------------------------
 * SEEDED VARIETY — deterministic per (local date, situation): stable across
 * re-renders, different tomorrow.
 * ------------------------------------------------------------------------- */

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

function localDateKey(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Fill {word}/{Word}/{layer} placeholders from the temperature band. */
function fill(template, band) {
  return template
    .replaceAll('{word}', band.word)
    .replaceAll('{Word}', cap(band.word))
    .replaceAll('{layer}', band.layer);
}

/** Map an advice tone to a token color (see index.css). */
export const ADVICE_TONE_COLOR = {
  good: 'var(--accent-green)',
  warn: 'var(--accent-orange)',
  cool: 'var(--accent-blue)',
  warm: 'var(--accent-yellow)',
  info: 'var(--accent-cyan)',
};

function tt(v, unit) { return `${formatTemp(v, unit)}°`; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
