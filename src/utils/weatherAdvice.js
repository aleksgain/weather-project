import { getConditionCategory } from './weatherConditions';
import { formatTemp, formatSpeed, getUnitLabel } from './unitConversion';

/**
 * Turns raw current-conditions data into human, "how you'll feel" copy:
 * a headline, a supporting sentence, and 2–3 actionable advice rows — the first
 * of which is always an *activity* suggestion ("Perfect for a dog walk",
 * "Prime cycling weather", "Worth heading for the hills", …).
 *
 * Returns: { headline, detail, advice: [{ tone, text, meta }] }
 *   tone ∈ 'good' | 'warn' | 'cool' | 'warm' | 'info'  → map to a dot color in the UI.
 *
 * Everything is derived from data your aggregator already produces; nothing
 * here fetches, and it is a pure function of its inputs (so the same conditions
 * always read the same way). Tune the thresholds/strings to taste — they are
 * intentionally plain so they read like a person talking, not a data dump.
 *
 * @param {Object} current  data.current
 * @param {string} unit     'metric' | 'imperial'
 * @param {Object} [opts]   { isNight?: boolean }  — drives night-specific copy
 */
export function buildFeelsCopy(current, unit = 'metric', opts = {}) {
  if (!current) return { headline: '', detail: '', advice: [] };

  const { isNight = false } = opts;
  const {
    temp, feelsLike, condition, uvIndex, humidity, windSpeed,
    precipProbability, windGust, windGusts,
  } = current;

  const cat = getConditionCategory(condition);       // clear | cloudy | precipitation | severe
  const c = (condition || '').toLowerCase();
  const isSnow = c.includes('snow') || c.includes('sleet') || c.includes('freezing') || c.includes('blizzard');
  const isFog = c.includes('fog') || c.includes('mist') || c.includes('haze');
  const isHeavy = c.includes('heavy') || c.includes('torrential') || c.includes('downpour');
  const fl = feelsLike ?? temp;
  const delta = fl - temp;                            // feels-like offset
  const gust = windGust ?? windGusts ?? null;
  const pop = precipProbability ?? 0;
  const muggy = humidity != null && humidity >= 75;
  // "windy" if sustained wind is strong or gusts are notable (values are km/h, source unit)
  const windy = (windSpeed != null && windSpeed > 30) || (gust != null && gust >= 40);

  // ---- temperature band (in °C, source unit) → a feeling + layer suggestion
  const band =
    temp <= 0 ? { key: 'freezing', word: 'freezing', layer: "bundle up warm" } :
    temp <= 8 ? { key: 'cold', word: 'cold', layer: "you'll want a proper coat" } :
    temp <= 15 ? { key: 'crisp', word: 'crisp', layer: "you'll want a light layer" } :
    temp <= 23 ? { key: 'mild', word: 'mild', layer: "a t-shirt is plenty" } :
    temp <= 30 ? { key: 'warm', word: 'warm', layer: "dress light and hydrate" } :
    { key: 'hot', word: 'hot', layer: "stay in the shade and hydrate" };

  // ---- headline by condition category (+ intensity / fog / band)
  let headline;
  if (cat === 'severe') {
    headline = `Wild and electric — best ridden out indoors.`;
  } else if (cat === 'precipitation' && isSnow) {
    headline = isHeavy ? `Heavy snow — a proper winter scene out there.` : `Cold and snowy — ${band.layer}.`;
  } else if (cat === 'precipitation') {
    headline = isHeavy ? `Soaked and ${band.word} — it's bucketing down.` : `Wet and ${band.word} — bring a proper jacket.`;
  } else if (isFog) {
    headline = `Soft and foggy — low cloud, take it slow.`;
  } else if (cat === 'cloudy') {
    headline = band.key === 'hot' ? `Grey and hot — muggy, but no rain to dodge.`
      : `Grey and ${band.word} — a comfortable, easy day.`;
  } else if (isNight) {
    headline = `${cap(band.word)} and clear — a calm night out.`;
  } else {
    headline = `${cap(band.word)} and clear — ${band.layer}.`;
  }

  // ---- supporting sentence
  const feelsPhrase =
    Math.abs(delta) < 1.5 ? `It reads ${tt(temp, unit)} and feels about the same.`
    : delta < 0 ? `It reads ${tt(temp, unit)} but feels like ${tt(fl, unit)} in the breeze.`
    : `It reads ${tt(temp, unit)} but feels warmer at ${tt(fl, unit)}.`;
  const tail =
    cat === 'severe' ? ' Sudden downpours and gusty winds; lightning risk is elevated.'
    : cat === 'precipitation' ? ' Keep something waterproof to hand through the afternoon.'
    : isFog ? ' Visibility is low, so give yourself a little extra time.'
    : muggy && band.key === 'hot' ? ' The air is humid, so it will feel close.'
    : cat === 'cloudy' ? ' Little sun to warm things up, but no rain to dodge.'
    : windy ? ' A brisk wind is the main thing to factor in.'
    : pop >= 40 ? ' Comfortable now, with rain possible later on.'
    : ' A good window to be outside.';
  const detail = feelsPhrase + tail;

  // ---- advice rows (max 3) ---------------------------------------------------
  const advice = [];

  // 1) activity — the human "what should I do about it?" row
  advice.push(pickActivity({ cat, band, temp, isSnow, isFog, isHeavy, windy, isNight }));

  // 2) the most important condition fact for the day
  if (cat === 'severe') {
    advice.push({ tone: 'warn', text: 'Lightning risk', meta: 'shelter' });
  } else if (cat === 'precipitation') {
    advice.push({ tone: 'info', text: isSnow ? 'Snow settling' : 'Umbrella essential', meta: `${Math.round(pop)}%` });
  } else if (uvIndex != null && uvIndex >= 1) {
    const uvDesc = uvIndex <= 2 ? 'low' : uvIndex <= 5 ? 'moderate' : uvIndex <= 7 ? 'high' : 'very high';
    advice.push({ tone: uvIndex <= 2 ? 'info' : 'warm', text: `UV is ${uvDesc}`, meta: `${uvIndex} / 11` });
  } else if (muggy) {
    advice.push({ tone: 'info', text: 'Humid air', meta: `${Math.round(humidity)}%` });
  }

  // 3) wind, or rain-later — whichever is more notable
  if (gust != null && gust >= 35) {
    advice.push({ tone: 'cool', text: 'Gusty', meta: `${formatSpeed(gust, unit)} ${getUnitLabel('speed', unit)}` });
  } else if (cat === 'clear' && pop >= 30) {
    advice.push({ tone: 'cool', text: 'Umbrella later', meta: `${Math.round(pop)}%` });
  } else if (windSpeed != null) {
    const desc = windSpeed > 30 ? 'Strong winds' : windSpeed > 15 ? 'Breezy' : 'Light winds';
    advice.push({ tone: 'cool', text: desc, meta: `${formatSpeed(windSpeed, unit)} ${getUnitLabel('speed', unit)}` });
  }

  return { headline, detail, advice: advice.slice(0, 3) };
}

/**
 * Pick a single, fitting activity suggestion for the conditions. Pure and
 * deterministic: the same conditions always yield the same suggestion, and a
 * stable rotation (keyed off temperature) adds variety across days/places
 * without flickering on re-render.
 */
function pickActivity({ cat, band, temp, isSnow, isFog, isHeavy, windy, isNight }) {
  // Severe — keep people inside.
  if (cat === 'severe') {
    return { tone: 'warn', text: 'A day to stay cozy indoors', meta: 'indoors' };
  }

  // Precipitation.
  if (cat === 'precipitation') {
    if (isSnow) {
      return band.key === 'freezing' || band.key === 'cold'
        ? { tone: 'info', text: 'Snow day — sledding, or hit the slopes', meta: 'wrap up' }
        : { tone: 'info', text: 'Wet snow — best enjoyed from indoors', meta: 'stay dry' };
    }
    if (isHeavy) {
      return { tone: 'cool', text: 'One for indoors — tea and a book', meta: 'stay dry' };
    }
    return { tone: 'info', text: 'Quick errands only — keep a brolly handy', meta: 'brolly' };
  }

  // Fog — outdoors is fine, just slower.
  if (isFog) {
    return { tone: 'cool', text: 'Atmospheric stroll — mind the low visibility', meta: 'go slow' };
  }

  // Clear night — a nudge to look up.
  if (cat === 'clear' && isNight && band.key !== 'freezing') {
    return { tone: 'info', text: 'Clear night — great for stargazing', meta: 'look up' };
  }

  // Blustery but dry — lean into it.
  if (windy && (band.key === 'crisp' || band.key === 'mild' || band.key === 'warm')) {
    return { tone: 'cool', text: 'Blustery but bright — a kite or coastal walk', meta: 'gusty' };
  }

  // Dry conditions by temperature band.
  switch (band.key) {
    case 'hot':
      return { tone: 'warm', text: 'Beat the heat — shade, water, easy pace', meta: 'go early' };
    case 'warm':
      return cat === 'clear'
        ? { tone: 'good', text: 'Beach, picnic or a swim — take your pick', meta: 'great' }
        : { tone: 'good', text: 'Warm enough for a long, easy outing', meta: 'great' };
    case 'mild': {
      // The sweet spot — rotate among equally good options, deterministically.
      const options = cat === 'clear'
        ? [
            'Perfect for a dog walk',
            'Prime weather for a bike ride',
            'Worth heading for the hills',
            'Great day for a long run',
            'Lovely for a picnic in the park',
          ]
        : [
            'Comfortable for a walk or a ride',
            'Easy weather for a stroll',
            'Good for a relaxed run',
          ];
      const i = Math.abs(Math.round(temp ?? 0)) % options.length;
      return { tone: 'good', text: options[i], meta: 'now' };
    }
    case 'crisp':
      return { tone: 'good', text: 'Brisk and lovely — walk, run or ride', meta: 'now' };
    case 'cold':
      return { tone: 'cool', text: 'Bundle up for a brisk walk', meta: 'wrap up' };
    case 'freezing':
    default:
      return { tone: 'cool', text: 'Quick dash out, then warm up', meta: 'wrap up' };
  }
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
