/**
 * Weighted Weather Data Aggregation Engine
 * Combines data from multiple weather sources using weighted averaging,
 * condition voting, and confidence scoring.
 */

/** Source weights for aggregation */
const SOURCE_WEIGHTS = {
    openMeteo: 1.0,
    owm: 0.9, // legacy alias
    openWeatherMap: 0.9,
    weatherapi: 0.85, // legacy alias
    weatherApi: 0.85,
    nws: 1.1,
};

/** Numeric fields to aggregate on current weather */
const NUMERIC_FIELDS = [
    'temp', 'high', 'low', 'feelsLike',
    'windSpeed', 'humidity', 'pressure', 'uvIndex', 'visibility',
];

/**
 * Maps detailed condition strings to broad categories for voting
 * @param {string} condition
 * @returns {string}
 */
function getConditionCategory(condition) {
    if (!condition) return 'unknown';
    const lower = condition.toLowerCase();

    if (lower.includes('thunder')) return 'thunderstorm';
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
 * Get the weight for a given source
 * @param {string} source
 * @returns {number}
 */
function getWeight(source) {
    return SOURCE_WEIGHTS[source] ?? 1.0;
}

/**
 * Weighted average of a numeric field across datasets
 * @param {Array<Object>} items - Objects containing the field
 * @param {string} field - Field name to average
 * @param {Array<number>} weights - Corresponding weights
 * @returns {number|null}
 */
function weightedAverage(items, field, weights) {
    let sum = 0;
    let totalWeight = 0;

    for (let i = 0; i < items.length; i++) {
        const val = items[i][field];
        if (val != null && !isNaN(val)) {
            sum += val * weights[i];
            totalWeight += weights[i];
        }
    }

    if (totalWeight === 0) return null;
    return Number((sum / totalWeight).toFixed(1));
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
        if (typeof val === 'number' && !Number.isNaN(val)) {
            return val;
        }
    }
    return null;
}

/**
 * Weighted average supporting multiple possible field names.
 * @param {Array<Object>} items
 * @param {Array<string>} fields
 * @param {Array<number>} weights
 * @returns {number|null}
 */
function weightedAverageAlias(items, fields, weights) {
    let sum = 0;
    let totalWeight = 0;

    for (let i = 0; i < items.length; i++) {
        const val = getNumericAlias(items[i], fields);
        if (val != null) {
            sum += val * weights[i];
            totalWeight += weights[i];
        }
    }

    if (totalWeight === 0) return null;
    return Number((sum / totalWeight).toFixed(1));
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
    if (typeof usEpaIndex !== 'number' || Number.isNaN(usEpaIndex)) return null;
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

/**
 * Vote on condition strings using majority-wins with tie-breaking by weight
 * @param {Array<{condition: string, weight: number}>} entries
 * @returns {string}
 */
function voteCondition(entries) {
    if (entries.length === 0) return 'Unknown';
    if (entries.length === 1) return entries[0].condition;

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
    for (const [, data] of Object.entries(categoryVotes)) {
        if (!winner || data.count > winner.count ||
            (data.count === winner.count && data.totalWeight > winner.totalWeight)) {
            winner = data;
        }
    }

    return winner.bestCondition;
}

/**
 * Calculate confidence score (0-1) based on source agreement
 * @param {Array<Object>} datasets - Source datasets
 * @returns {number}
 */
function calculateConfidence(datasets) {
    if (datasets.length <= 1) return 1.0;

    let score = 1.0;

    // Temperature spread penalty
    const temps = datasets.map(d => d.current?.temp).filter(t => t != null);
    if (temps.length > 1) {
        const spread = Math.max(...temps) - Math.min(...temps);
        // >5C spread = low confidence
        score -= Math.min(0.4, spread * 0.08);
    }

    // Condition consensus penalty
    const categories = datasets.map(d => getConditionCategory(d.current?.condition));
    const uniqueCategories = new Set(categories);
    if (uniqueCategories.size > 1) {
        score -= (uniqueCategories.size - 1) * 0.15;
    }

    return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

/**
 * Aggregate current weather data from multiple sources
 * @param {Array<Object>} datasets
 * @param {Array<number>} weights
 * @returns {Object}
 */
function aggregateCurrent(datasets, weights) {
    const currents = datasets.map(d => d.current).filter(Boolean);
    if (currents.length === 0) return {};

    const result = {};

    // Weighted average for numeric fields
    for (const field of NUMERIC_FIELDS) {
        const val = weightedAverage(currents, field, weights);
        if (val != null) result[field] = val;
    }

    // Vote on condition
    const conditionEntries = currents.map((c, i) => ({
        condition: c.condition,
        weight: weights[i],
    })).filter(e => e.condition);
    result.condition = voteCondition(conditionEntries);

    // Aggregate fields not in the base numeric schema
    const windDirection = weightedWindDirection(currents, weights);
    if (windDirection != null) result.windDirection = windDirection;

    const windGust = weightedAverageAlias(currents, ['windGust', 'windGusts'], weights);
    if (windGust != null) result.windGust = windGust;

    const dewPoint = weightedAverageAlias(currents, ['dewPoint'], weights);
    if (dewPoint != null) result.dewPoint = dewPoint;

    const precipitation = weightedAverageAlias(currents, ['precipitation'], weights);
    if (precipitation != null) result.precipitation = precipitation;

    const sunrise = weightedTimeIso(currents, ['sunrise'], weights);
    if (sunrise) result.sunrise = sunrise;

    const sunset = weightedTimeIso(currents, ['sunset'], weights);
    if (sunset) result.sunset = sunset;

    // Prefer first available scalar AQI value (0-500) when present.
    for (const current of currents) {
        const aqi = getNumericAlias(current, ['airQualityAqi', 'airQuality']);
        if (typeof aqi === 'number' && !Number.isNaN(aqi)) {
            result.airQuality = aqi;
            break;
        }
        const fallbackAqi = mapEpaIndexToAqi(current?.airQuality?.usEpaIndex);
        if (fallbackAqi != null) {
            result.airQuality = fallbackAqi;
            break;
        }
    }

    return result;
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
            const key = entry.time;
            if (!key) continue;
            if (!byTime.has(key)) byTime.set(key, []);
            byTime.get(key).push({ entry, weight: weights[i] });
        }
    }

    const result = [];
    for (const [time, items] of byTime) {
        const merged = { time };
        const entries = items.map(i => i.entry);
        const itemWeights = items.map(i => i.weight);

        const temp = weightedAverage(entries, 'temp', itemWeights);
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

        result.push(merged);
    }

    return result.sort((a, b) => new Date(a.time) - new Date(b.time));
}

/**
 * Merge daily arrays by matching dates
 * @param {Array<Object>} datasets
 * @param {Array<number>} weights
 * @returns {Array<Object>}
 */
function mergeDaily(datasets, weights) {
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

    const result = [];
    for (const [date, items] of byDate) {
        const merged = { date };
        const entries = items.map(i => i.entry);
        const itemWeights = items.map(i => i.weight);

        const high = weightedAverage(entries, 'high', itemWeights);
        if (high != null) merged.high = high;

        const low = weightedAverage(entries, 'low', itemWeights);
        if (low != null) merged.low = low;

        const condEntries = entries.map((e, idx) => ({
            condition: e.condition,
            weight: itemWeights[idx],
        })).filter(e => e.condition);
        merged.condition = voteCondition(condEntries);

        const sunrise = weightedTimeIso(entries, ['sunrise'], itemWeights);
        if (sunrise) merged.sunrise = sunrise;

        const sunset = weightedTimeIso(entries, ['sunset'], itemWeights);
        if (sunset) merged.sunset = sunset;

        result.push(merged);
    }

    return result.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Aggregates weather data from multiple sources using weighted averaging,
 * condition voting, and confidence scoring.
 *
 * @param {Array<Object>} datasets - Array of normalized weather data objects,
 *   each with { source, current, hourly, daily }
 * @returns {Object} Aggregated weather data with confidence and sources
 */
export function aggregateWeatherData(datasets) {
    const validDatasets = (Array.isArray(datasets) ? datasets : [])
        .filter(d => d && typeof d === 'object' && d.current);

    if (validDatasets.length === 0) {
        throw new Error('No datasets provided for aggregation');
    }

    // Single-source passthrough
    if (validDatasets.length === 1) {
        const d = validDatasets[0];
        return {
            current: { ...d.current },
            hourly: d.hourly ? [...d.hourly] : [],
            daily: d.daily ? [...d.daily] : [],
            confidence: 1.0,
            sources: [d.source || 'unknown'],
        };
    }

    const sources = validDatasets.map(d => d.source || 'unknown');
    const weights = validDatasets.map(d => getWeight(d.source));

    return {
        current: aggregateCurrent(validDatasets, weights),
        hourly: mergeHourly(validDatasets, weights),
        daily: mergeDaily(validDatasets, weights),
        confidence: calculateConfidence(validDatasets),
        sourceCount: validDatasets.length,
        sources,
    };
}
