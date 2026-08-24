/**
 * Meteorological computation utilities.
 *
 * Used by the aggregation engine to fill gaps in source data before merging,
 * so more sources can contribute to every field ("data completion" — an
 * approach inspired by the Breezy Weather project's aggregation pipeline;
 * implemented independently here using standard published formulas).
 *
 * All temperatures are °C, wind speeds km/h, distances km, humidity %.
 */

import { UnifiedCondition } from './weatherConditions';

/** Magnus formula coefficients (Alduchov & Eskridge 1996) */
const MAGNUS_A = 17.625;
const MAGNUS_B = 243.04; // °C

function isNum(v) {
    return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Dew point from temperature and relative humidity (Magnus formula).
 * @param {number} tempC
 * @param {number} humidityPct - 1..100
 * @returns {number|null} dew point °C
 */
export function computeDewPoint(tempC, humidityPct) {
    if (!isNum(tempC) || !isNum(humidityPct) || humidityPct <= 0 || humidityPct > 100) {
        return null;
    }
    const gamma = Math.log(humidityPct / 100) + (MAGNUS_A * tempC) / (MAGNUS_B + tempC);
    const dp = (MAGNUS_B * gamma) / (MAGNUS_A - gamma);
    return Number(dp.toFixed(1));
}

/**
 * Relative humidity from temperature and dew point (inverse Magnus).
 * @param {number} tempC
 * @param {number} dewPointC
 * @returns {number|null} humidity % (0..100)
 */
export function computeRelativeHumidity(tempC, dewPointC) {
    if (!isNum(tempC) || !isNum(dewPointC)) return null;
    const rh = 100 * Math.exp(
        (MAGNUS_A * dewPointC) / (MAGNUS_B + dewPointC) -
        (MAGNUS_A * tempC) / (MAGNUS_B + tempC)
    );
    if (!Number.isFinite(rh)) return null;
    return Number(Math.min(100, Math.max(0, rh)).toFixed(0));
}

/**
 * Water vapour pressure in hPa from temperature and relative humidity.
 * @param {number} tempC
 * @param {number} humidityPct
 * @returns {number|null}
 */
function vapourPressure(tempC, humidityPct) {
    if (!isNum(tempC) || !isNum(humidityPct)) return null;
    return (humidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
}

/**
 * Apparent temperature (Steadman / Australian BoM formulation):
 * AT = T + 0.33·e − 0.70·ws − 4.00
 * where e is vapour pressure (hPa) and ws wind speed at 10m in m/s.
 * @param {number} tempC
 * @param {number} humidityPct
 * @param {number} windSpeedKmh
 * @returns {number|null}
 */
export function computeApparentTemperature(tempC, humidityPct, windSpeedKmh) {
    if (!isNum(tempC)) return null;
    const e = vapourPressure(tempC, isNum(humidityPct) ? humidityPct : 50);
    if (e == null) return null;
    const windMs = isNum(windSpeedKmh) ? windSpeedKmh / 3.6 : 0;
    return Number((tempC + 0.33 * e - 0.7 * windMs - 4.0).toFixed(1));
}

/**
 * North American / UK Met wind chill index.
 * Only defined for temp ≤ 10°C and wind > 4.8 km/h; returns null otherwise.
 * @param {number} tempC
 * @param {number} windSpeedKmh
 * @returns {number|null}
 */
export function computeWindChill(tempC, windSpeedKmh) {
    if (!isNum(tempC) || !isNum(windSpeedKmh)) return null;
    if (tempC > 10 || windSpeedKmh <= 4.8) return null;
    const v = Math.pow(windSpeedKmh, 0.16);
    return Number((13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v).toFixed(1));
}

/**
 * Best-available "feels like": wind chill when cold and windy,
 * apparent temperature otherwise.
 * @param {number} tempC
 * @param {number} humidityPct
 * @param {number} windSpeedKmh
 * @returns {number|null}
 */
export function computeFeelsLike(tempC, humidityPct, windSpeedKmh) {
    const windChill = computeWindChill(tempC, windSpeedKmh);
    if (windChill != null) return windChill;
    return computeApparentTemperature(tempC, humidityPct, windSpeedKmh);
}

/** Thresholds for inferring a condition from quantitative observations */
const INFER = {
    minPrecipMm: 0.1, // per-hour precip considered "raining"
    minPrecipProbability: 30, // %
    fogVisibilityKm: 1,
    windyKmh: 36, // ~10 m/s
    snowTempC: 0.5,
};

/**
 * Infer a unified condition string from quantitative data when a source
 * doesn't report a usable condition. This lets sources that only report
 * numbers still participate in condition voting.
 *
 * Decision order (severity first): precipitation → fog → cloud cover.
 * @param {object} obs
 * @param {number} [obs.temp] - °C
 * @param {number} [obs.precipAmount] - mm (per hour)
 * @param {number} [obs.precipProbability] - %
 * @param {number} [obs.visibility] - km
 * @param {number} [obs.cloudCover] - %
 * @returns {string|null} a UnifiedCondition, or null if not enough data
 */
export function inferConditionFromData(obs) {
    if (!obs || typeof obs !== 'object') return null;
    const { temp, precipAmount, precipProbability, visibility, cloudCover } = obs;

    const precipitating =
        (isNum(precipAmount) && precipAmount >= INFER.minPrecipMm) &&
        (!isNum(precipProbability) || precipProbability >= INFER.minPrecipProbability);
    if (precipitating) {
        if (isNum(temp) && temp <= INFER.snowTempC) return UnifiedCondition.SNOW;
        if (isNum(precipAmount) && precipAmount >= 4) return UnifiedCondition.HEAVY_RAIN;
        if (isNum(precipAmount) && precipAmount < 0.5) return UnifiedCondition.DRIZZLE;
        return UnifiedCondition.RAIN;
    }

    if (isNum(visibility) && visibility < INFER.fogVisibilityKm) {
        return UnifiedCondition.FOG;
    }

    if (isNum(cloudCover)) {
        if (cloudCover >= 88) return UnifiedCondition.OVERCAST;
        if (cloudCover >= 60) return UnifiedCondition.CLOUDY;
        if (cloudCover >= 25) return UnifiedCondition.PARTLY_CLOUDY;
        return UnifiedCondition.CLEAR;
    }

    return null;
}
