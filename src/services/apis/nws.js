import { UnifiedCondition } from '../../utils/weatherConditions.js';

const NWS_USER_AGENT = '(WeatherApp, contact@example.com)';
const REQUEST_TIMEOUT = 10000;

/**
 * Maps NWS condition strings to unified taxonomy.
 * @param {string} condition - NWS short forecast string
 * @returns {string} Unified condition
 */
function mapNwsCondition(condition) {
    if (!condition) return UnifiedCondition.UNKNOWN;

    const lower = condition.toLowerCase();

    if (/thunder/i.test(lower)) return UnifiedCondition.THUNDERSTORM;
    if (/hail/i.test(lower)) return UnifiedCondition.HAIL;
    if (/freezing rain/i.test(lower)) return UnifiedCondition.FREEZING_RAIN;
    if (/sleet|ice pellets/i.test(lower)) return UnifiedCondition.SLEET;
    if (/heavy snow|blizzard/i.test(lower)) return UnifiedCondition.HEAVY_SNOW;
    if (/snow|flurries/i.test(lower)) return UnifiedCondition.SNOW;
    if (/heavy rain/i.test(lower)) return UnifiedCondition.HEAVY_RAIN;
    if (/rain|showers/i.test(lower)) return UnifiedCondition.RAIN;
    if (/drizzle/i.test(lower)) return UnifiedCondition.DRIZZLE;
    if (/fog|mist|haze/i.test(lower)) return UnifiedCondition.FOG;
    if (/overcast/i.test(lower)) return UnifiedCondition.OVERCAST;
    if (/mostly cloudy|cloudy/i.test(lower)) return UnifiedCondition.CLOUDY;
    if (/partly cloudy|partly sunny/i.test(lower)) return UnifiedCondition.PARTLY_CLOUDY;
    if (/sunny|clear/i.test(lower)) return UnifiedCondition.CLEAR;

    return UnifiedCondition.UNKNOWN;
}

/**
 * Makes a fetch request to the NWS API with proper headers.
 * @param {string} url
 * @param {AbortSignal} signal
 * @returns {Promise<Response>}
 */
async function nwsFetch(url, signal) {
    return fetch(url, {
        signal,
        headers: {
            'User-Agent': NWS_USER_AGENT,
            'Accept': 'application/geo+json',
        },
    });
}

/**
 * Converts Fahrenheit to Celsius.
 * @param {number|null} f
 * @returns {number|null}
 */
function fToC(f) {
    if (f == null) return null;
    return Math.round(((f - 32) * 5) / 9 * 10) / 10;
}

/**
 * Fetches weather data from the NWS API (US-only).
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object|null>} Normalized weather data or null for non-US coordinates
 */
export async function fetchNwsData(lat, lon) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        // Step 1: Lookup gridpoint from coordinates
        const pointsResponse = await nwsFetch(
            `https://api.weather.gov/points/${lat},${lon}`,
            controller.signal
        );

        clearTimeout(timeoutId);

        // Non-US coordinates return 404
        if (pointsResponse.status === 404) {
            return null;
        }

        if (!pointsResponse.ok) {
            throw new Error(`NWS points API returned ${pointsResponse.status}: ${pointsResponse.statusText}`);
        }

        const pointsData = await pointsResponse.json();
        const forecastUrl = pointsData.properties?.forecast;
        const forecastHourlyUrl = pointsData.properties?.forecastHourly;

        if (!forecastUrl || !forecastHourlyUrl) {
            throw new Error('NWS points response missing forecast URLs');
        }

        // Step 2: Fetch daily and hourly forecasts in parallel
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), REQUEST_TIMEOUT);

        const [dailyResponse, hourlyResponse] = await Promise.all([
            nwsFetch(forecastUrl, controller2.signal),
            nwsFetch(forecastHourlyUrl, controller2.signal),
        ]);

        clearTimeout(timeoutId2);

        if (!dailyResponse.ok || !hourlyResponse.ok) {
            throw new Error('NWS forecast API request failed');
        }

        const [dailyData, hourlyData] = await Promise.all([
            dailyResponse.json(),
            hourlyResponse.json(),
        ]);

        const dailyPeriods = dailyData.properties?.periods ?? [];
        const hourlyPeriods = hourlyData.properties?.periods ?? [];

        // Find current period (first hourly period)
        const currentPeriod = hourlyPeriods[0];
        // Find today's day/night periods for high/low
        const todayDay = dailyPeriods.find(p => p.isDaytime);
        const todayNight = dailyPeriods.find(p => !p.isDaytime);

        const currentTemp = currentPeriod?.temperature != null
            ? (currentPeriod.temperatureUnit === 'F' ? fToC(currentPeriod.temperature) : currentPeriod.temperature)
            : null;

        const high = todayDay?.temperature != null
            ? (todayDay.temperatureUnit === 'F' ? fToC(todayDay.temperature) : todayDay.temperature)
            : null;

        const low = todayNight?.temperature != null
            ? (todayNight.temperatureUnit === 'F' ? fToC(todayNight.temperature) : todayNight.temperature)
            : null;

        // Wind speed parsing (e.g., "10 mph" or "5 to 15 mph")
        const parseWindSpeed = (windStr) => {
            if (!windStr) return null;
            const matches = windStr.match(/(\d+)/g);
            if (!matches) return null;
            const mph = matches.length > 1
                ? (parseInt(matches[0]) + parseInt(matches[1])) / 2
                : parseInt(matches[0]);
            return Math.round(mph * 1.60934); // Convert mph to km/h
        };

        return {
            source: 'nws',
            current: {
                temp: currentTemp,
                condition: mapNwsCondition(currentPeriod?.shortForecast),
                high,
                low,
                feelsLike: currentTemp, // NWS doesn't provide feels-like directly
                windSpeed: parseWindSpeed(currentPeriod?.windSpeed),
                windDirection: currentPeriod?.windDirection ?? null,
                windGusts: null,
                humidity: currentPeriod?.relativeHumidity?.value ?? null,
                dewPoint: currentPeriod?.dewpoint?.value != null
                    ? Math.round(currentPeriod.dewpoint.value * 10) / 10
                    : null,
                pressure: null, // NWS forecast API doesn't provide pressure
                uvIndex: null,
                visibility: null,
                sunrise: null,
                sunset: null,
            },
            hourly: hourlyPeriods.slice(0, 24).map(p => ({
                time: p.startTime,
                temp: p.temperatureUnit === 'F' ? fToC(p.temperature) : p.temperature,
                condition: mapNwsCondition(p.shortForecast),
                precipitationProbability: p.probabilityOfPrecipitation?.value ?? null,
                windSpeed: parseWindSpeed(p.windSpeed),
                windDirection: p.windDirection ?? null,
                windGusts: null,
                dewPoint: p.dewpoint?.value != null
                    ? Math.round(p.dewpoint.value * 10) / 10
                    : null,
            })),
            daily: dailyPeriods
                .filter(p => p.isDaytime)
                .map(dayP => {
                    const nightP = dailyPeriods.find(
                        n => !n.isDaytime && n.number === dayP.number + 1
                    );
                    return {
                        date: dayP.startTime?.split('T')[0] ?? dayP.startTime,
                        high: dayP.temperatureUnit === 'F' ? fToC(dayP.temperature) : dayP.temperature,
                        low: nightP
                            ? (nightP.temperatureUnit === 'F' ? fToC(nightP.temperature) : nightP.temperature)
                            : null,
                        condition: mapNwsCondition(dayP.shortForecast),
                        sunrise: null,
                        sunset: null,
                        precipitationSum: null,
                    };
                }),
        };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('NWS API request timed out');
        }
        throw err;
    }
}

/**
 * Fetches active weather alerts from NWS for a given location.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Array|null>} Array of alert objects or null for non-US coordinates
 */
export async function fetchNwsAlerts(lat, lon) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        const response = await nwsFetch(
            `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
            controller.signal
        );

        clearTimeout(timeoutId);

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(`NWS alerts API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const features = data.features ?? [];

        return features.map(f => ({
            id: f.properties?.id ?? null,
            event: f.properties?.event ?? 'Unknown Alert',
            headline: f.properties?.headline ?? null,
            description: f.properties?.description ?? null,
            severity: f.properties?.severity ?? null,
            urgency: f.properties?.urgency ?? null,
            certainty: f.properties?.certainty ?? null,
            onset: f.properties?.onset ?? null,
            expires: f.properties?.expires ?? null,
            senderName: f.properties?.senderName ?? null,
        }));
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('NWS alerts API request timed out');
        }
        throw err;
    }
}
