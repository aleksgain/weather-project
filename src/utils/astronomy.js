const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function getSunPosition(date, latitude, longitude) {
    const dayOfYear = getDayOfYear(date);
    const hours = date.getHours() + date.getMinutes() / 60;

    // Solar declination (approximate)
    const declination = 23.45 * Math.sin(DEG_TO_RAD * (360 / 365) * (dayOfYear - 81));

    // Equation of time (minutes)
    const b = DEG_TO_RAD * (360 / 365) * (dayOfYear - 81);
    const equationOfTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);

    // Solar noon
    const timeOffset = equationOfTime + 4 * longitude;
    const trueSolarTime = hours * 60 + timeOffset;
    const hourAngle = (trueSolarTime / 4) - 180;

    // Solar elevation
    const latRad = latitude * DEG_TO_RAD;
    const decRad = declination * DEG_TO_RAD;
    const haRad = hourAngle * DEG_TO_RAD;

    const elevation = Math.asin(
        Math.sin(latRad) * Math.sin(decRad) +
        Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad)
    ) * RAD_TO_DEG;

    // Solar azimuth
    const azimuth = Math.acos(
        (Math.sin(decRad) - Math.sin(latRad) * Math.sin(elevation * DEG_TO_RAD)) /
        (Math.cos(latRad) * Math.cos(elevation * DEG_TO_RAD))
    ) * RAD_TO_DEG;

    const finalAzimuth = trueSolarTime > 720 ? 360 - azimuth : azimuth;

    return { elevation, azimuth: finalAzimuth };
}

export function getSunriseSunset(date, latitude, longitude) {
    const dayOfYear = getDayOfYear(date);
    const declination = 23.45 * Math.sin(DEG_TO_RAD * (360 / 365) * (dayOfYear - 81));

    const latRad = latitude * DEG_TO_RAD;
    const decRad = declination * DEG_TO_RAD;

    const cosHourAngle = (-Math.sin(0.833 * DEG_TO_RAD) - Math.sin(latRad) * Math.sin(decRad)) /
        (Math.cos(latRad) * Math.cos(decRad));

    // Handle polar day/night
    if (cosHourAngle > 1) return { sunrise: null, sunset: null, polarNight: true };
    if (cosHourAngle < -1) return { sunrise: null, sunset: null, polarDay: true };

    const hourAngle = Math.acos(cosHourAngle) * RAD_TO_DEG;

    const b = DEG_TO_RAD * (360 / 365) * (dayOfYear - 81);
    const equationOfTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    const solarNoonMinutes = 720 - 4 * longitude - equationOfTime;

    const sunriseMinutes = solarNoonMinutes - hourAngle * 4;
    const sunsetMinutes = solarNoonMinutes + hourAngle * 4;

    const toDate = (minutes) => {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        result.setMinutes(Math.round(minutes));
        return result;
    };

    return { sunrise: toDate(sunriseMinutes), sunset: toDate(sunsetMinutes) };
}

export function isDayTime(date, latitude, longitude) {
    const { sunrise, sunset, polarDay, polarNight } = getSunriseSunset(date, latitude, longitude);
    if (polarDay) return true;
    if (polarNight) return false;
    const time = date.getTime();
    return time >= sunrise.getTime() && time <= sunset.getTime();
}

export function getDayLength(date, latitude, longitude) {
    const { sunrise, sunset, polarDay, polarNight } = getSunriseSunset(date, latitude, longitude);
    if (polarDay) return 24;
    if (polarNight) return 0;
    return (sunset.getTime() - sunrise.getTime()) / (1000 * 60 * 60);
}

export function isGoldenHour(date, latitude, longitude) {
    const { sunrise, sunset, polarDay, polarNight } = getSunriseSunset(date, latitude, longitude);
    if (polarDay || polarNight) return false;

    const time = date.getTime();
    const goldenDuration = 60 * 60 * 1000; // 1 hour in ms

    const morningStart = sunrise.getTime();
    const morningEnd = morningStart + goldenDuration;
    const eveningStart = sunset.getTime() - goldenDuration;
    const eveningEnd = sunset.getTime();

    return (time >= morningStart && time <= morningEnd) ||
           (time >= eveningStart && time <= eveningEnd);
}

function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}
