export function cToF(celsius) {
    return (celsius * 9 / 5) + 32;
}

export function kmhToMph(kmh) {
    return kmh * 0.621371;
}

export function kmToMiles(km) {
    return km * 0.621371;
}

export function hPaToInHg(hPa) {
    return hPa * 0.02953;
}

export function mmToInches(mm) {
    return mm * 0.0393701;
}

export function degreesToCardinal(degrees) {
    const directions = [
        'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
    ];
    const index = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
    return directions[index];
}

export function formatTemp(celsius, unit) {
    const value = unit === 'imperial' ? cToF(celsius) : celsius;
    return Math.round(value);
}

export function formatSpeed(kmh, unit) {
    const value = unit === 'imperial' ? kmhToMph(kmh) : kmh;
    return Math.round(value);
}

export function formatDistance(km, unit) {
    const value = unit === 'imperial' ? kmToMiles(km) : km;
    return Math.round(value * 10) / 10; // Keep 1 decimal for visibility
}

export function formatPressure(hPa, unit) {
    if (unit === 'imperial') {
        return Math.round(hPaToInHg(hPa) * 100) / 100; // Keep 2 decimals for inHg
    }
    return Math.round(hPa);
}

export function getUnitLabel(type, unit) {
    if (unit === 'metric') {
        switch (type) {
            case 'temp': return '°C';
            case 'speed': return 'km/h';
            case 'distance': return 'km';
            case 'pressure': return 'hPa';
            case 'precipitation': return 'mm';
            default: return '';
        }
    } else {
        switch (type) {
            case 'temp': return '°F';
            case 'speed': return 'mph';
            case 'distance': return 'mi';
            case 'pressure': return 'inHg';
            case 'precipitation': return 'in';
            default: return '';
        }
    }
}
