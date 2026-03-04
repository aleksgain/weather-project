export function cToF(celsius) {
    return (celsius * 9 / 5) + 32;
}

export function kmhToMph(kmh) {
    return kmh * 0.621371;
}

export function kmToMiles(km) {
    return km * 0.621371;
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

export function getUnitLabel(type, unit) {
    if (unit === 'metric') {
        switch (type) {
            case 'temp': return '°C';
            case 'speed': return 'km/h';
            case 'distance': return 'km';
            default: return '';
        }
    } else {
        switch (type) {
            case 'temp': return '°F';
            case 'speed': return 'mph';
            case 'distance': return 'mi';
            default: return '';
        }
    }
}
