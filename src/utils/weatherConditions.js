/**
 * Unified Weather Condition Taxonomy
 * Maps condition codes/strings from various weather APIs to a unified set of conditions.
 */

/** @enum {string} */
export const UnifiedCondition = {
    CLEAR: 'Clear',
    PARTLY_CLOUDY: 'Partly Cloudy',
    CLOUDY: 'Cloudy',
    OVERCAST: 'Overcast',
    FOG: 'Fog',
    DRIZZLE: 'Drizzle',
    RAIN: 'Rain',
    HEAVY_RAIN: 'Heavy Rain',
    FREEZING_RAIN: 'Freezing Rain',
    SNOW: 'Snow',
    HEAVY_SNOW: 'Heavy Snow',
    SLEET: 'Sleet',
    THUNDERSTORM: 'Thunderstorm',
    HAIL: 'Hail',
    UNKNOWN: 'Unknown',
};

/** @enum {string} */
export const ConditionCategory = {
    CLEAR: 'clear',
    CLOUDY: 'cloudy',
    PRECIPITATION: 'precipitation',
    SEVERE: 'severe',
};

const conditionCategoryMap = {
    [UnifiedCondition.CLEAR]: ConditionCategory.CLEAR,
    [UnifiedCondition.PARTLY_CLOUDY]: ConditionCategory.CLOUDY,
    [UnifiedCondition.CLOUDY]: ConditionCategory.CLOUDY,
    [UnifiedCondition.OVERCAST]: ConditionCategory.CLOUDY,
    [UnifiedCondition.FOG]: ConditionCategory.CLOUDY,
    [UnifiedCondition.DRIZZLE]: ConditionCategory.PRECIPITATION,
    [UnifiedCondition.RAIN]: ConditionCategory.PRECIPITATION,
    [UnifiedCondition.HEAVY_RAIN]: ConditionCategory.PRECIPITATION,
    [UnifiedCondition.FREEZING_RAIN]: ConditionCategory.PRECIPITATION,
    [UnifiedCondition.SNOW]: ConditionCategory.PRECIPITATION,
    [UnifiedCondition.HEAVY_SNOW]: ConditionCategory.PRECIPITATION,
    [UnifiedCondition.SLEET]: ConditionCategory.PRECIPITATION,
    [UnifiedCondition.THUNDERSTORM]: ConditionCategory.SEVERE,
    [UnifiedCondition.HAIL]: ConditionCategory.SEVERE,
    [UnifiedCondition.UNKNOWN]: ConditionCategory.CLEAR,
};

/**
 * Maps WMO weather codes (used by Open-Meteo) to unified conditions.
 * @param {number} code - WMO weather code
 * @returns {string} Unified condition string
 */
export function mapWmoCode(code) {
    const num = Number(code);
    const wmoMap = {
        0: UnifiedCondition.CLEAR,
        1: UnifiedCondition.CLEAR,
        2: UnifiedCondition.PARTLY_CLOUDY,
        3: UnifiedCondition.OVERCAST,
        45: UnifiedCondition.FOG,
        48: UnifiedCondition.FOG,
        51: UnifiedCondition.DRIZZLE,
        53: UnifiedCondition.DRIZZLE,
        55: UnifiedCondition.DRIZZLE,
        56: UnifiedCondition.FREEZING_RAIN,
        57: UnifiedCondition.FREEZING_RAIN,
        61: UnifiedCondition.RAIN,
        63: UnifiedCondition.RAIN,
        65: UnifiedCondition.HEAVY_RAIN,
        66: UnifiedCondition.FREEZING_RAIN,
        67: UnifiedCondition.FREEZING_RAIN,
        71: UnifiedCondition.SNOW,
        73: UnifiedCondition.SNOW,
        75: UnifiedCondition.HEAVY_SNOW,
        77: UnifiedCondition.SNOW,
        80: UnifiedCondition.RAIN,
        81: UnifiedCondition.RAIN,
        82: UnifiedCondition.HEAVY_RAIN,
        85: UnifiedCondition.SNOW,
        86: UnifiedCondition.HEAVY_SNOW,
        95: UnifiedCondition.THUNDERSTORM,
        96: UnifiedCondition.HAIL,
        99: UnifiedCondition.HAIL,
    };
    return wmoMap[num] ?? UnifiedCondition.UNKNOWN;
}

/**
 * Maps OpenWeatherMap condition IDs to unified conditions.
 * @param {number} id - OWM condition ID
 * @returns {string} Unified condition string
 */
export function mapOwmCondition(id) {
    const num = Number(id);
    if (num >= 200 && num < 300) return UnifiedCondition.THUNDERSTORM;
    if (num >= 300 && num < 400) return UnifiedCondition.DRIZZLE;
    if (num >= 500 && num < 505) return UnifiedCondition.RAIN;
    if (num === 511) return UnifiedCondition.FREEZING_RAIN;
    if (num >= 520 && num < 532) return UnifiedCondition.HEAVY_RAIN;
    if (num >= 600 && num < 613) return UnifiedCondition.SNOW;
    if (num >= 613 && num < 623) return UnifiedCondition.SLEET;
    if (num >= 700 && num < 800) return UnifiedCondition.FOG;
    if (num === 800) return UnifiedCondition.CLEAR;
    if (num === 801 || num === 802) return UnifiedCondition.PARTLY_CLOUDY;
    if (num === 803) return UnifiedCondition.CLOUDY;
    if (num === 804) return UnifiedCondition.OVERCAST;
    return UnifiedCondition.UNKNOWN;
}

/**
 * Maps WeatherAPI condition text to unified conditions.
 * @param {string} text - WeatherAPI condition text
 * @returns {string} Unified condition string
 */
export function mapWeatherApiCondition(text) {
    if (!text || typeof text !== 'string') return UnifiedCondition.UNKNOWN;
    const lower = text.toLowerCase();

    if (lower.includes('thunder')) return UnifiedCondition.THUNDERSTORM;
    if (lower.includes('hail') || lower.includes('ice pellets')) return UnifiedCondition.HAIL;
    if (lower.includes('freezing rain') || lower.includes('freezing drizzle')) return UnifiedCondition.FREEZING_RAIN;
    if (lower.includes('heavy snow') || lower.includes('blizzard')) return UnifiedCondition.HEAVY_SNOW;
    if (lower.includes('snow') || lower.includes('sleet')) return UnifiedCondition.SNOW;
    if (lower.includes('heavy rain') || lower.includes('torrential')) return UnifiedCondition.HEAVY_RAIN;
    if (lower.includes('rain')) return UnifiedCondition.RAIN;
    if (lower.includes('drizzle')) return UnifiedCondition.DRIZZLE;
    if (lower.includes('fog') || lower.includes('mist')) return UnifiedCondition.FOG;
    if (lower.includes('overcast')) return UnifiedCondition.OVERCAST;
    if (lower.includes('cloudy') || lower.includes('cloud')) return UnifiedCondition.PARTLY_CLOUDY;
    if (lower.includes('clear') || lower.includes('sunny')) return UnifiedCondition.CLEAR;

    return UnifiedCondition.UNKNOWN;
}

/**
 * Maps NWS short forecast text to unified conditions.
 * @param {string} text - NWS short forecast text
 * @returns {string} Unified condition string
 */
export function mapNwsCondition(text) {
    if (!text || typeof text !== 'string') return UnifiedCondition.UNKNOWN;
    const lower = text.toLowerCase();

    if (lower.includes('thunder')) return UnifiedCondition.THUNDERSTORM;
    if (lower.includes('hail')) return UnifiedCondition.HAIL;
    if (lower.includes('freezing rain') || lower.includes('ice')) return UnifiedCondition.FREEZING_RAIN;
    if (lower.includes('heavy snow') || lower.includes('blizzard')) return UnifiedCondition.HEAVY_SNOW;
    if (lower.includes('snow') || lower.includes('flurries')) return UnifiedCondition.SNOW;
    if (lower.includes('sleet')) return UnifiedCondition.SLEET;
    if (lower.includes('heavy rain')) return UnifiedCondition.HEAVY_RAIN;
    if (lower.includes('rain') || lower.includes('showers')) return UnifiedCondition.RAIN;
    if (lower.includes('drizzle')) return UnifiedCondition.DRIZZLE;
    if (lower.includes('fog') || lower.includes('haze') || lower.includes('mist')) return UnifiedCondition.FOG;
    if (lower.includes('overcast')) return UnifiedCondition.OVERCAST;
    if (lower.includes('mostly cloudy') || lower.includes('partly cloudy') || lower.includes('partly sunny')) return UnifiedCondition.PARTLY_CLOUDY;
    if (lower.includes('cloudy')) return UnifiedCondition.CLOUDY;
    if (lower.includes('clear') || lower.includes('sunny') || lower.includes('fair')) return UnifiedCondition.CLEAR;

    return UnifiedCondition.UNKNOWN;
}

/**
 * Returns the broad category for a unified condition.
 * @param {string} condition - A unified condition string
 * @returns {string} Category: 'clear', 'cloudy', 'precipitation', or 'severe'
 */
export function getConditionCategory(condition) {
    return conditionCategoryMap[condition] ?? ConditionCategory.CLEAR;
}
