/**
 * Weighted Weather Data Aggregation Engine
 * Combines data from multiple weather sources using weighted averaging,
 * condition voting, and confidence scoring.
 */

/** Source weights for aggregation */
const SOURCE_WEIGHTS = {
    openMeteo: 1.0,
    owm: 0.9,
    weatherApi: 0.85,
    nws: 1.1,
    mock: 0.5,
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
    if (!Array.isArray(datasets) || datasets.length === 0) {
        throw new Error('No datasets provided for aggregation');
    }

    // Single-source passthrough
    if (datasets.length === 1) {
        const d = datasets[0];
        return {
            current: { ...d.current },
            hourly: d.hourly ? [...d.hourly] : [],
            daily: d.daily ? [...d.daily] : [],
            confidence: 1.0,
            sources: [d.source || 'unknown'],
        };
    }

    const sources = datasets.map(d => d.source || 'unknown');
    const weights = datasets.map(d => getWeight(d.source));

    return {
        current: aggregateCurrent(datasets, weights),
        hourly: mergeHourly(datasets, weights),
        daily: mergeDaily(datasets, weights),
        confidence: calculateConfidence(datasets),
        sources,
    };
}
