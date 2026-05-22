import { mapMetNoSymbol } from '../../utils/weatherConditions.js';

/**
 * MET Norway (api.met.no) locationforecast/2.0 adapter.
 *
 * Free, no API key. Released under CC BY 4.0 — commercial use is allowed.
 * Requires a descriptive User-Agent header identifying the application
 * (https://api.met.no/doc/TermsOfService).
 *
 * Note: browsers strip User-Agent overrides on `fetch`, so the request still
 * carries the browser's UA. MET Norway accepts that for low-volume client-side
 * use; for production / high volume, proxy through your own server and set a
 * proper UA there.
 */

const REQUEST_TIMEOUT = 10000;
const MET_USER_AGENT = 'WeatherApp/1.0 github.com/aleksbgs/weather-project';

/**
 * Convert m/s wind speed to km/h, rounded to 0.1.
 * @param {number|null|undefined} mps
 * @returns {number|null}
 */
function msToKmh(mps) {
    if (mps == null || Number.isNaN(mps)) return null;
    return Math.round(mps * 3.6 * 10) / 10;
}

/**
 * Round to one decimal place; null-safe.
 * @param {number|null|undefined} value
 * @returns {number|null}
 */
function round1(value) {
    if (value == null || Number.isNaN(value)) return null;
    return Math.round(value * 10) / 10;
}

/**
 * Pick the best-available "next N hours" block from a MET timeseries entry.
 * @param {object} entry - A timeseries entry's `.data`
 * @returns {{ symbol: string|null, precip: number|null }}
 */
function pickForecastBlock(entry) {
    const blocks = [entry?.next_1_hours, entry?.next_6_hours, entry?.next_12_hours];
    for (const block of blocks) {
        if (!block) continue;
        const symbol = block.summary?.symbol_code ?? null;
        const precip = block.details?.precipitation_amount ?? null;
        if (symbol || precip != null) {
            return { symbol, precip };
        }
    }
    return { symbol: null, precip: null };
}

/**
 * Fetches weather data from MET Norway's locationforecast service.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Normalized weather data
 */
export async function fetchMetNorwayData(lat, lon) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        // MET Norway recommends truncating to 4 decimal places to improve cache hit rate.
        const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                // Browsers ignore custom User-Agent for fetch(), but we set it for
                // any non-browser runtime (SSR/Node) that may proxy this call.
                'User-Agent': MET_USER_AGENT,
                'Accept': 'application/json',
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`MET Norway API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const timeseries = data?.properties?.timeseries;

        if (!Array.isArray(timeseries) || timeseries.length === 0) {
            throw new Error('Invalid response structure from MET Norway API');
        }

        // ----- current -----
        const first = timeseries[0];
        const instantNow = first.data?.instant?.details ?? {};
        const { symbol: currentSymbol, precip: currentPrecip } = pickForecastBlock(first.data ?? {});

        // ----- hourly: next 24 hourly steps -----
        const hourly = timeseries.slice(0, 24).map(entry => {
            const det = entry.data?.instant?.details ?? {};
            const { symbol, precip } = pickForecastBlock(entry.data ?? {});
            return {
                time: entry.time,
                temp: round1(det.air_temperature),
                condition: mapMetNoSymbol(symbol),
                precipProbability: det.probability_of_precipitation ?? null,
                precipAmount: precip ?? 0,
                windSpeed: msToKmh(det.wind_speed),
                windDirection: det.wind_from_direction != null ? Math.round(det.wind_from_direction) : null,
                windGust: msToKmh(det.wind_speed_of_gust),
                humidity: det.relative_humidity != null ? Math.round(det.relative_humidity) : null,
                dewPoint: round1(det.dew_point_temperature),
            };
        });

        // ----- daily: roll up hourly entries by YYYY-MM-DD (UTC) -----
        // MET Norway returns 1h resolution for ~48h then 6h resolution beyond.
        // We compute high/low/precip-sum from whatever resolution is available.
        const byDate = new Map();
        for (const entry of timeseries) {
            const date = (entry.time || '').slice(0, 10);
            if (!date) continue;

            const det = entry.data?.instant?.details ?? {};
            const { symbol, precip } = pickForecastBlock(entry.data ?? {});
            const temp = det.air_temperature;

            if (!byDate.has(date)) {
                byDate.set(date, {
                    high: -Infinity,
                    low: Infinity,
                    precipSum: 0,
                    symbols: [],
                });
            }
            const bucket = byDate.get(date);
            if (typeof temp === 'number') {
                if (temp > bucket.high) bucket.high = temp;
                if (temp < bucket.low) bucket.low = temp;
            }
            if (typeof precip === 'number') {
                bucket.precipSum += precip;
            }
            if (symbol) bucket.symbols.push(symbol);
        }

        const daily = [...byDate.entries()]
            .map(([date, bucket]) => {
                // Pick the most frequently-occurring symbol for the day,
                // tie-broken by preferring "worse" weather (later in the
                // mapping table — overlaps with our voting logic anyway).
                let dominantSymbol = null;
                if (bucket.symbols.length > 0) {
                    const counts = {};
                    for (const s of bucket.symbols) counts[s] = (counts[s] || 0) + 1;
                    dominantSymbol = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
                }
                return {
                    date,
                    high: bucket.high === -Infinity ? null : round1(bucket.high),
                    low: bucket.low === Infinity ? null : round1(bucket.low),
                    condition: mapMetNoSymbol(dominantSymbol),
                    sunrise: null, // MET locationforecast does not return sunrise/sunset
                    sunset: null,
                    precipitationSum: round1(bucket.precipSum),
                };
            })
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            source: 'metNorway',
            current: {
                temp: round1(instantNow.air_temperature),
                condition: mapMetNoSymbol(currentSymbol),
                high: daily[0]?.high ?? null,
                low: daily[0]?.low ?? null,
                feelsLike: round1(instantNow.air_temperature), // MET does not provide apparent temp
                windSpeed: msToKmh(instantNow.wind_speed),
                windDirection: instantNow.wind_from_direction != null
                    ? Math.round(instantNow.wind_from_direction)
                    : null,
                windGust: msToKmh(instantNow.wind_speed_of_gust),
                humidity: instantNow.relative_humidity != null
                    ? Math.round(instantNow.relative_humidity)
                    : null,
                dewPoint: round1(instantNow.dew_point_temperature),
                pressure: instantNow.air_pressure_at_sea_level != null
                    ? Math.round(instantNow.air_pressure_at_sea_level)
                    : null,
                uvIndex: instantNow.ultraviolet_index_clear_sky ?? null,
                visibility: null, // not reported
                precipitation: currentPrecip ?? 0,
                sunrise: null,
                sunset: null,
            },
            hourly,
            daily,
        };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('MET Norway API request timed out');
        }
        throw err;
    }
}
