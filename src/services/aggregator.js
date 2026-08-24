/**
 * Weighted Weather Data Aggregation Engine
 *
 * Combines data from multiple weather sources using:
 * - pre-merge data completion (missing fields computed from what a source
 *   does report, so more sources contribute to every field)
 * - outlier rejection (weighted median + MAD) so one broken source cannot
 *   skew the consensus
 * - severity-aware condition voting (a strong severe-weather minority is
 *   never averaged away)
 * - per-metric and per-day confidence scoring
 *
 * The completion + severity-inference approach is inspired by the Breezy
 * Weather project's aggregation pipeline; all code here is an independent
 * implementation using standard published formulas.
 */

import {
    computeDewPoint,
    computeRelativeHumidity,
    computeFeelsLike,
    inferConditionFromData,
} from '../utils/meteorology';

/** Source weights for aggregation */
const SOURCE_WEIGHTS = {
    openMeteo: 1.0,
    owm: 0.9, // legacy alias
    openWeatherMap: 0.9,
    weatherapi: 0.85, // legacy alias
    weatherApi: 0.85,
    nws: 1.1,
    metNorway: 1.05, // Norwegian Met Institute — strong independent model
    pirateWeather: 0.95, // NOAA-backed (GFS/HRRR/NBM)
};

/** Numeric fields to aggregate on current weather */
const NUMERIC_FIELDS = [
    'temp', 'high', 'low', 'feelsLike',
    'windSpeed', 'humidity', 'pressure', 'uvIndex', 'visibility',
];

/**
 * Absolute deviation floors per field (same unit as the field): a value is
 * only treated as an outlier when it deviates from the weighted median by
 * more than max(3×MAD·1.4826, floor). The floor stops us from dropping
 * sources over meaningless differences when all sources agree closely.
 */
const OUTLIER_FLOORS = {
    temp: 3, high: 3, low: 3, feelsLike: 4, dewPoint: 3,
    windSpeed: 12, humidity: 18, pressure: 8, uvIndex: 3,
    visibility: 6, precipitation: 2, windGust: 18,
};

/** Minimum number of values before outlier rejection makes sense */
const MIN_VALUES_FOR_OUTLIER_CHECK = 3;

/**
 * Maps detailed condition strings to broad categories for voting
 * @param {string} condition
 * @returns {string}
 */
function getConditionCategory(condition) {
    if (!condition) return 'unknown';
    const lower = condition.toLowerCase();

    if (lower.includes('thunder')) return 'thunderstorm';
    if (lower.includes('hail')) return 'hail';
    if (lower.includes('snow') || lower.includes('blizzard') || lower.includes('sleet')) return 'snow';
    if (lower.includes('freezing')) return 'freezing';
    if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower')) return 'rain';
    if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze')) return 'fog';
    if (lower.includes('overcast')) return 'overcast';
    if (lower.includes('cloud') || lower.includes('partly')) return 'cloudy';
    if (lower.includes('clear') || lower.includes('sunny') || lower.includes('fair')) return 'clear';

    return 'unknown';
}

/**
 * Severity rank per condition category. Used so that a significant minority
 * reporting dangerous weather beats an averaged-out "cloudy".
 */
const CATEGORY_SEVERITY = {
    thunderstorm: 5,
    hail: 5,
    freezing: 4,
    snow: 3,
    rain: 2,
    fog: 1,
    overcast: 0,
    cloudy: 0,
    clear: 0,
    unknown: 0,
};

/** Weight share a severe minority needs to override a milder majority */
const SEVERE_OVERRIDE_SHARE = 0.34;

/**
 * Get the weight for a given source
 * @param {string} source
 * @returns {number}
 */
function getWeight(source) {
    return SOURCE_WEIGHTS[source] ?? 1.0;
}

function isNum(v) {
    return typeof v === 'number' && !Number.isNaN(v);
}

/**
 * Resolve the first numeric alias from an item.
 * @param {Object} item
 * @param {Array<string>} fields
 * @returns {number|null}
 */
function getNumericAlias(item, fields) {
    for (const field of fields) {
        const val = item?.[field];
        if (isNum(val)) return val;
    }
    return null;
}

/**
 * Weighted median of {value, weight} pairs.
 * @param {Array<{value: number, weight: number}>} pairs
 * @returns {number|null}
 */
function weightedMedian(pairs) {
    if (pairs.length === 0) return null;
    const sorted = [...pairs].sort((a, b) => a.value - b.value);
    const total = sorted.reduce((s, p) => s + p.weight, 0);
    let cumulative = 0;
    for (const p of sorted) {
        cumulative += p.weight;
        if (cumulative >= total / 2) return p.value;
    }
    return sorted[sorted.length - 1].value;
}

/**
 * Robust weighted average with outlier rejection.
 * With 3+ values: values deviating from the weighted median by more than
 * max(3×scaled MAD, floor) are excluded from the average.
 *
 * @param {Array<Object>} items
 * @param {Array<string>} fields - field name aliases, first match wins
 * @param {Array<number>} weights
 * @param {number} [floor] - absolute deviation floor (see OUTLIER_FLOORS)
 * @returns {{value: number|null, outlierIndexes: Array<number>, count: number}}
 */
function robustWeightedAverage(items, fields, weights, floor = Infinity) {
    const pairs = [];
    for (let i = 0; i < items.length; i++) {
        const val = getNumericAlias(items[i], fields);
        if (val != null) pairs.push({ value: val, weight: weights[i], index: i });
    }
    if (pairs.length === 0) return { value: null, outlierIndexes: [], count: 0 };

    let usable = pairs;
    const outlierIndexes = [];

    if (pairs.length >= MIN_VALUES_FOR_OUTLIER_CHECK && Number.isFinite(floor)) {
        const median = weightedMedian(pairs);
        const deviations = pairs.map(p => Math.abs(p.value - median));
        const mad = weightedMedian(deviations.map((d, i) => ({ value: d, weight: pairs[i].weight })));
        // 1.4826 scales MAD to a stdev-equivalent for normal distributions
        const tolerance = Math.max(3 * 1.4826 * (mad ?? 0), floor);
        usable = pairs.filter((p, i) => {
            const keep = deviations[i] <= tolerance;
            if (!keep) outlierIndexes.push(p.index);
            return keep;
        });
        if (usable.length === 0) usable = pairs; // never drop everything
    }

    let sum = 0;
    let totalWeight = 0;
    for (const p of usable) {
        sum += p.value * p.weight;
        totalWeight += p.weight;
    }
    if (totalWeight === 0) return { value: null, outlierIndexes: [], count: 0 };
    return {
        value: Number((sum / totalWeight).toFixed(1)),
        outlierIndexes,
        count: usable.length,
    };
}

/**
 * Weighted average supporting multiple possible field names.
 * @param {Array<Object>} items
 * @param {Array<string>} fields
 * @param {Array<number>} weights
 * @returns {number|null}
 */
function weightedAverageAlias(items, fields, weights) {
    return robustWeightedAverage(items, fields, weights).value;
}

/**
 * Weighted circular mean for directional degrees.
 * @param {Array<Object>} items
 * @param {Array<number>} weights
 * @returns {number|null}
 */
function weightedWindDirection(items, weights) {
    let sinSum = 0;
    let cosSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < items.length; i++) {
        const deg = getNumericAlias(items[i], ['windDirection', 'windDeg']);
        if (deg == null) continue;
        const normalized = ((deg % 360) + 360) % 360;
        const rad = normalized * Math.PI / 180;
        sinSum += Math.sin(rad) * weights[i];
        cosSum += Math.cos(rad) * weights[i];
        totalWeight += weights[i];
    }

    if (totalWeight === 0) return null;
    const angle = Math.atan2(sinSum / totalWeight, cosSum / totalWeight) * 180 / Math.PI;
    return Number((((angle + 360) % 360)).toFixed(0));
}

/**
 * Weighted average of timestamps, returned as ISO string.
 * @param {Array<Object>} items
 * @param {Array<string>} fields
 * @param {Array<number>} weights
 * @returns {string|null}
 */
function weightedTimeIso(items, fields, weights) {
    let sum = 0;
    let totalWeight = 0;

    for (let i = 0; i < items.length; i++) {
        for (const field of fields) {
            const raw = items[i]?.[field];
            if (!raw) continue;
            const ts = new Date(raw).getTime();
            if (Number.isNaN(ts)) continue;
            sum += ts * weights[i];
            totalWeight += weights[i];
            break;
        }
    }

    if (totalWeight === 0) return null;
    return new Date(sum / totalWeight).toISOString();
}

/**
 * Approximate numeric AQI from EPA index buckets (1-6).
 * @param {number|null|undefined} usEpaIndex
 * @returns {number|null}
 */
function mapEpaIndexToAqi(usEpaIndex) {
    if (!isNum(usEpaIndex)) return null;
    const midpointByIndex = {
        1: 25,
        2: 75,
        3: 125,
        4: 175,
        5: 250,
        6: 350,
    };
    return midpointByIndex[usEpaIndex] ?? null;
}

/*
 * DATA COMPLETION (pre-merge)
 */

/**
 * Returns a condition string usable for voting, or null.
 * @param {string|null|undefined} condition
 */
function usableCondition(condition) {
    if (!condition || typeof condition !== 'string') return null;
    if (getConditionCategory(condition) === 'unknown') return null;
    return condition;
}

/**
 * Complete a source dataset with fields it didn't report but that can be
 * computed from what it did report. Returns a new dataset; the input is
 * not mutated.
 * @param {Object} dataset
 * @returns {Object}
 */
export function completeDataset(dataset) {
    if (!dataset?.current) return dataset;
    const c = dataset.current;

    const humidity = isNum(c.humidity) ? c.humidity : computeRelativeHumidity(c.temp, c.dewPoint);
    const dewPoint = isNum(c.dewPoint) ? c.dewPoint : computeDewPoint(c.temp, humidity);
    const feelsLike = isNum(c.feelsLike) ? c.feelsLike : computeFeelsLike(c.temp, humidity, c.windSpeed);
    const condition = usableCondition(c.condition) ?? inferConditionFromData({
        temp: c.temp,
        precipAmount: c.precipitation,
        visibility: c.visibility,
        cloudCover: c.cloudCover,
    }) ?? c.condition;

    const current = { ...c };
    if (humidity != null) current.humidity = humidity;
    if (dewPoint != null) current.dewPoint = dewPoint;
    if (feelsLike != null) current.feelsLike = feelsLike;
    if (condition != null) current.condition = condition;

    const hourly = Array.isArray(dataset.hourly)
        ? dataset.hourly.map(h => {
            if (usableCondition(h?.condition)) return h;
            const inferred = inferConditionFromData({
                temp: h?.temp,
                precipAmount: getNumericAlias(h, ['precipAmount', 'precipitation', 'precipitationAmount']),
                precipProbability: getNumericAlias(h, ['precipProbability', 'precipitationProbability', 'chanceOfRain']),
            });
            return inferred ? { ...h, condition: inferred } : h;
        })
        : dataset.hourly;

    return { ...dataset, current, hourly };
}

/*
 * CONDITION VOTING
 */

/**
 * Vote on condition strings: majority wins with weight tie-breaking, but a
 * severe-weather minority above SEVERE_OVERRIDE_SHARE of total weight
 * overrides a milder majority (safety bias).
 *
 * @param {Array<{condition: string, weight: number}>} entries
 * @returns {{condition: string, agreement: number|null}}
 *   agreement = weight share of the winning category (null if <2 entries)
 */
function voteConditionDetailed(entries) {
    if (entries.length === 0) return { condition: 'Unknown', agreement: null };
    if (entries.length === 1) return { condition: entries[0].condition, agreement: null };

    const totalWeight = entries.reduce((s, e) => s + e.weight, 0);

    // Group by category
    const categoryVotes = {};
    for (const { condition, weight } of entries) {
        const cat = getConditionCategory(condition);
        if (!categoryVotes[cat]) {
            categoryVotes[cat] = { count: 0, totalWeight: 0, bestCondition: condition, bestWeight: 0 };
        }
        categoryVotes[cat].count += 1;
        categoryVotes[cat].totalWeight += weight;
        if (weight > categoryVotes[cat].bestWeight) {
            categoryVotes[cat].bestWeight = weight;
            categoryVotes[cat].bestCondition = condition;
        }
    }

    // Find winner: most votes, then highest total weight
    let winner = null;
    let winnerCat = null;
    for (const [cat, data] of Object.entries(categoryVotes)) {
        if (!winner || data.count > winner.count ||
            (data.count === winner.count && data.totalWeight > winner.totalWeight)) {
            winner = data;
            winnerCat = cat;
        }
    }

    // Severity override: a significant minority reporting more dangerous
    // weather beats a milder majority.
    for (const [cat, data] of Object.entries(categoryVotes)) {
        if (cat === winnerCat) continue;
        const moreSevere = (CATEGORY_SEVERITY[cat] ?? 0) > (CATEGORY_SEVERITY[winnerCat] ?? 0);
        const significant = totalWeight > 0 && data.totalWeight / totalWeight >= SEVERE_OVERRIDE_SHARE;
        if (moreSevere && significant) {
            winner = data;
            winnerCat = cat;
        }
    }

    return {
        condition: winner.bestCondition,
        agreement: totalWeight > 0 ? Number((winner.totalWeight / totalWeight).toFixed(2)) : null,
    };
}

/**
 * Back-compat helper returning only the winning condition string.
 * @param {Array<{condition: string, weight: number}>} entries
 * @returns {string}
 */
function voteCondition(entries) {
    return voteConditionDetailed(entries).condition;
}

/*
 * CONFIDENCE SCORING
 */

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

function spreadOf(values) {
    if (values.length < 2) return null;
    return Math.max(...values) - Math.min(...values);
}

/**
 * Per-metric agreement scores (each 0-1, or null when <2 sources report
 * that metric) and a weighted overall confidence.
 *
 * @param {Array<Object>} datasets - completed source datasets
 * @param {Array<number>} weights
 * @returns {{overall: number, breakdown: Object}}
 */
function calculateConfidenceDetailed(datasets, weights) {
    // Temperature agreement: 6°C spread across sources → 0
    const temps = datasets.map(d => d.current?.temp).filter(isNum);
    const tempSpread = spreadOf(temps);
    const temperature = tempSpread == null ? null : Number(clamp01(1 - tempSpread / 6).toFixed(2));

    // Condition agreement: weight share of the winning category
    const conditionEntries = datasets
        .map((d, i) => ({ condition: d.current?.condition, weight: weights[i] }))
        .filter(e => usableCondition(e.condition));
    const { agreement: condition } = voteConditionDetailed(conditionEntries);

    // Precipitation agreement: mean precip probability over the next 12
    // merged-forecast hours per source; 60-point spread → 0
    const perSourcePrecip = datasets.map(d => {
        if (!Array.isArray(d.hourly)) return null;
        const probs = d.hourly
            .slice(0, 12)
            .map(h => getNumericAlias(h, ['precipProbability', 'precipitationProbability', 'chanceOfRain']))
            .filter(isNum);
        if (probs.length === 0) return null;
        return probs.reduce((s, p) => s + p, 0) / probs.length;
    }).filter(isNum);
    const precipSpread = spreadOf(perSourcePrecip);
    const precipitation = precipSpread == null ? null : Number(clamp01(1 - precipSpread / 60).toFixed(2));

    // Wind agreement: 20 km/h spread → 0
    const winds = datasets.map(d => d.current?.windSpeed).filter(isNum);
    const windSpread = spreadOf(winds);
    const wind = windSpread == null ? null : Number(clamp01(1 - windSpread / 20).toFixed(2));

    const parts = [
        { score: temperature, weight: 0.35 },
        { score: condition, weight: 0.30 },
        { score: precipitation, weight: 0.20 },
        { score: wind, weight: 0.15 },
    ].filter(p => p.score != null);

    let overall = 1.0;
    if (parts.length > 0) {
        const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
        overall = Number(
            (parts.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight).toFixed(2)
        );
    }

    return {
        overall: clamp01(overall),
        breakdown: { temperature, condition, precipitation, wind },
    };
}

/*
 * CURRENT AGGREGATION
 */

/**
 * Aggregate current weather data from multiple sources.
 * @param {Array<Object>} datasets - completed datasets
 * @param {Array<number>} weights
 * @returns {{current: Object, outlierFields: Object}}
 *   outlierFields maps field name → array of source ids dropped as outliers
 */
function aggregateCurrent(datasets, weights) {
    const currents = datasets.map(d => d.current).filter(Boolean);
    if (currents.length === 0) return { current: {}, outlierFields: {} };

    const result = {};
    const outlierFields = {};

    const recordOutliers = (field, outlierIndexes) => {
        if (outlierIndexes.length === 0) return;
        outlierFields[field] = outlierIndexes.map(i => datasets[i]?.source ?? 'unknown');
    };

    // Robust weighted average for numeric fields
    for (const field of NUMERIC_FIELDS) {
        const { value, outlierIndexes } = robustWeightedAverage(
            currents, [field], weights, OUTLIER_FLOORS[field]
        );
        if (value != null) result[field] = value;
        recordOutliers(field, outlierIndexes);
    }

    // Vote on condition (severity-aware)
    const conditionEntries = currents.map((c, i) => ({
        condition: c.condition,
        weight: weights[i],
    })).filter(e => e.condition);
    result.condition = voteCondition(conditionEntries);

    // Aggregate fields not in the base numeric schema
    const windDirection = weightedWindDirection(currents, weights);
    if (windDirection != null) result.windDirection = windDirection;

    const windGust = robustWeightedAverage(currents, ['windGust', 'windGusts'], weights, OUTLIER_FLOORS.windGust);
    if (windGust.value != null) result.windGust = windGust.value;
    recordOutliers('windGust', windGust.outlierIndexes);

    const dewPoint = robustWeightedAverage(currents, ['dewPoint'], weights, OUTLIER_FLOORS.dewPoint);
    if (dewPoint.value != null) result.dewPoint = dewPoint.value;
    recordOutliers('dewPoint', dewPoint.outlierIndexes);

    const precipitation = robustWeightedAverage(currents, ['precipitation'], weights, OUTLIER_FLOORS.precipitation);
    if (precipitation.value != null) result.precipitation = precipitation.value;

    const sunrise = weightedTimeIso(currents, ['sunrise'], weights);
    if (sunrise) result.sunrise = sunrise;

    const sunset = weightedTimeIso(currents, ['sunset'], weights);
    if (sunset) result.sunset = sunset;

    // Prefer first available scalar AQI value (0-500) when present.
    for (const current of currents) {
        const aqi = getNumericAlias(current, ['airQualityAqi', 'airQuality']);
        if (isNum(aqi)) {
            result.airQuality = aqi;
            break;
        }
        const fallbackAqi = mapEpaIndexToAqi(current?.airQuality?.usEpaIndex);
        if (fallbackAqi != null) {
            result.airQuality = fallbackAqi;
            break;
        }
    }

    return { current: result, outlierFields };
}

/*
 * HOURLY MERGE
 */

/**
 * Normalize an hourly timestamp to a consistent key for merging.
 * Different APIs return the same hour in different formats
 * (e.g. "2024-01-15T10:00" vs "2024-01-15T10:00:00-05:00"),
 * so we parse to epoch and round to the nearest hour.
 * @param {string} timeStr
 * @returns {string} UTC ISO string rounded to the hour, or the original string as fallback
 */
function normalizeHourKey(timeStr) {
    const ms = new Date(timeStr).getTime();
    if (Number.isNaN(ms)) return timeStr;
    return new Date(Math.round(ms / 3600000) * 3600000).toISOString();
}

/**
 * Merge hourly arrays by matching timestamps
 * @param {Array<Object>} datasets
 * @param {Array<number>} weights
 * @returns {Array<Object>}
 */
function mergeHourly(datasets, weights) {
    const byTime = new Map();

    for (let i = 0; i < datasets.length; i++) {
        const hourly = datasets[i].hourly;
        if (!Array.isArray(hourly)) continue;

        for (const entry of hourly) {
            if (!entry.time) continue;
            const key = normalizeHourKey(entry.time);
            if (!byTime.has(key)) byTime.set(key, []);
            byTime.get(key).push({ entry, weight: weights[i] });
        }
    }

    const result = [];
    for (const [time, items] of byTime) {
        const merged = { time };
        const entries = items.map(i => i.entry);
        const itemWeights = items.map(i => i.weight);

        const temp = robustWeightedAverage(entries, ['temp'], itemWeights, OUTLIER_FLOORS.temp).value;
        if (temp != null) merged.temp = temp;

        const condEntries = entries.map((e, idx) => ({
            condition: e.condition,
            weight: itemWeights[idx],
        })).filter(e => e.condition);
        merged.condition = voteCondition(condEntries);

        const precipProbability = weightedAverageAlias(entries, ['precipProbability', 'precipitationProbability', 'chanceOfRain'], itemWeights);
        if (precipProbability != null) merged.precipProbability = precipProbability;

        const precipAmount = weightedAverageAlias(entries, ['precipAmount', 'precipitation', 'precipitationAmount'], itemWeights);
        if (precipAmount != null) merged.precipAmount = precipAmount;

        const windSpeed = weightedAverageAlias(entries, ['windSpeed'], itemWeights);
        if (windSpeed != null) merged.windSpeed = windSpeed;

        const windDirection = weightedWindDirection(entries, itemWeights);
        if (windDirection != null) merged.windDirection = windDirection;

        // How many sources contributed to this hour (for UI transparency)
        merged.sourceCount = entries.length;

        result.push(merged);
    }

    return result.sort((a, b) => new Date(a.time) - new Date(b.time));
}

/*
 * DAILY MERGE
 */

/**
 * Merge daily arrays by matching dates, enriched from the merged hourly
 * forecast (precipitation probability/totals, max wind) and scored with a
 * per-day confidence that reflects cross-source agreement for that day.
 *
 * @param {Array<Object>} datasets
 * @param {Array<number>} weights
 * @param {Array<Object>} mergedHourly - result of mergeHourly
 * @returns {Array<Object>}
 */
function mergeDaily(datasets, weights, mergedHourly = []) {
    const byDate = new Map();

    for (let i = 0; i < datasets.length; i++) {
        const daily = datasets[i].daily;
        if (!Array.isArray(daily)) continue;

        for (const entry of daily) {
            // Normalize date key to YYYY-MM-DD
            const key = (entry.date || '').slice(0, 10);
            if (!key) continue;
            if (!byDate.has(key)) byDate.set(key, []);
            byDate.get(key).push({ entry, weight: weights[i] });
        }
    }

    // Group merged hourly entries by local date for enrichment
    const hourlyByDate = new Map();
    for (const hour of mergedHourly) {
        const key = (hour.time || '').slice(0, 10);
        if (!key) continue;
        if (!hourlyByDate.has(key)) hourlyByDate.set(key, []);
        hourlyByDate.get(key).push(hour);
    }

    const result = [];
    for (const [date, items] of byDate) {
        const merged = { date };
        const entries = items.map(i => i.entry);
        const itemWeights = items.map(i => i.weight);

        const high = robustWeightedAverage(entries, ['high'], itemWeights, OUTLIER_FLOORS.high).value;
        if (high != null) merged.high = high;

        const low = robustWeightedAverage(entries, ['low'], itemWeights, OUTLIER_FLOORS.low).value;
        if (low != null) merged.low = low;

        const condEntries = entries.map((e, idx) => ({
            condition: e.condition,
            weight: itemWeights[idx],
        })).filter(e => e.condition);
        const { condition, agreement: conditionAgreement } = voteConditionDetailed(condEntries);
        merged.condition = condition;

        const sunrise = weightedTimeIso(entries, ['sunrise'], itemWeights);
        if (sunrise) merged.sunrise = sunrise;

        const sunset = weightedTimeIso(entries, ['sunset'], itemWeights);
        if (sunset) merged.sunset = sunset;

        const dayHours = hourlyByDate.get(date) ?? [];

        // Precipitation probability: prefer daily source fields, fall back
        // to the max merged hourly probability for that day.
        let precipProbability = weightedAverageAlias(
            entries, ['precipProbability', 'precipitationProbability', 'chanceOfRain'], itemWeights
        );
        if (precipProbability == null && dayHours.length > 0) {
            const probs = dayHours.map(h => h.precipProbability).filter(isNum);
            if (probs.length > 0) precipProbability = Math.max(...probs);
        }
        if (precipProbability != null) merged.precipProbability = precipProbability;

        // Precipitation total: prefer daily source sums, fall back to the
        // sum of merged hourly amounts (only when the day is fully covered).
        let precipSum = weightedAverageAlias(
            entries, ['precipitationSum', 'precipSum'], itemWeights
        );
        if (precipSum == null && dayHours.length >= 20) {
            const amounts = dayHours.map(h => h.precipAmount).filter(isNum);
            if (amounts.length > 0) {
                precipSum = Number(amounts.reduce((s, a) => s + a, 0).toFixed(1));
            }
        }
        if (precipSum != null) merged.precipitationSum = precipSum;

        // Max sustained wind for the day from merged hourly data
        if (dayHours.length > 0) {
            const dayWinds = dayHours.map(h => h.windSpeed).filter(isNum);
            if (dayWinds.length > 0) merged.windMax = Math.max(...dayWinds);
        }

        // Per-day confidence: temperature + condition agreement for the day.
        // Forecast disagreement naturally grows with lead time, so this
        // gives users a feel for how solid each day of the forecast is.
        if (entries.length >= 2) {
            const highs = entries.map(e => e.high).filter(isNum);
            const lows = entries.map(e => e.low).filter(isNum);
            const spreads = [spreadOf(highs), spreadOf(lows)].filter(s => s != null);
            const tempAgreement = spreads.length > 0
                ? clamp01(1 - (spreads.reduce((s, v) => s + v, 0) / spreads.length) / 6)
                : null;
            const parts = [
                { score: tempAgreement, weight: 0.6 },
                { score: conditionAgreement, weight: 0.4 },
            ].filter(p => p.score != null);
            if (parts.length > 0) {
                const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
                merged.confidence = Number(
                    (parts.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight).toFixed(2)
                );
            }
        }
        merged.sourceCount = entries.length;

        result.push(merged);
    }

    return result.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/*
 * SOURCE TRANSPARENCY
 */

/**
 * Per-source snapshot of current conditions with deviation from the final
 * consensus, for the transparency UI.
 * @param {Array<Object>} datasets - completed datasets
 * @param {Array<number>} weights
 * @param {Object} consensusCurrent - aggregated current object
 * @param {Object} outlierFields - field → source ids dropped as outliers
 * @returns {Array<Object>}
 */
function buildSourceDetails(datasets, weights, consensusCurrent, outlierFields) {
    const tempOutliers = new Set(outlierFields.temp ?? []);
    return datasets.map((d, i) => {
        const c = d.current ?? {};
        const detail = {
            id: d.source ?? 'unknown',
            weight: weights[i],
            temp: isNum(c.temp) ? c.temp : null,
            feelsLike: isNum(c.feelsLike) ? c.feelsLike : null,
            condition: c.condition ?? null,
            windSpeed: isNum(c.windSpeed) ? c.windSpeed : null,
            humidity: isNum(c.humidity) ? c.humidity : null,
            pressure: isNum(c.pressure) ? c.pressure : null,
        };
        detail.tempDeviation = isNum(c.temp) && isNum(consensusCurrent.temp)
            ? Number((c.temp - consensusCurrent.temp).toFixed(1))
            : null;
        detail.isTempOutlier = tempOutliers.has(detail.id);
        return detail;
    });
}

/*
 * ENTRY POINT
 */

/**
 * Aggregates weather data from multiple sources using data completion,
 * robust weighted averaging, severity-aware condition voting, and
 * per-metric confidence scoring.
 *
 * @param {Array<Object>} datasets - Array of normalized weather data objects,
 *   each with { source, current, hourly, daily }
 * @returns {Object} Aggregated weather data with confidence, breakdown,
 *   per-source details, and sources
 */
export function aggregateWeatherData(datasets) {
    const validDatasets = (Array.isArray(datasets) ? datasets : [])
        .filter(d => d && typeof d === 'object' && d.current)
        .map(completeDataset);

    if (validDatasets.length === 0) {
        throw new Error('No datasets provided for aggregation');
    }

    const sources = validDatasets.map(d => d.source || 'unknown');
    const weights = validDatasets.map(d => getWeight(d.source));

    // Single-source passthrough (still completed)
    if (validDatasets.length === 1) {
        const d = validDatasets[0];
        return {
            current: { ...d.current },
            hourly: d.hourly ? [...d.hourly] : [],
            daily: d.daily ? [...d.daily] : [],
            confidence: 1.0,
            confidenceBreakdown: null,
            sourceCount: 1,
            sources,
            sourceDetails: buildSourceDetails(validDatasets, weights, d.current, {}),
            outlierFields: {},
        };
    }

    const { current, outlierFields } = aggregateCurrent(validDatasets, weights);
    const hourly = mergeHourly(validDatasets, weights);
    const daily = mergeDaily(validDatasets, weights, hourly);
    const { overall, breakdown } = calculateConfidenceDetailed(validDatasets, weights);

    return {
        current,
        hourly,
        daily,
        confidence: overall,
        confidenceBreakdown: breakdown,
        sourceCount: validDatasets.length,
        sources,
        sourceDetails: buildSourceDetails(validDatasets, weights, current, outlierFields),
        outlierFields,
    };
}
