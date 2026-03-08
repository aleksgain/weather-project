const CARDINAL_DIRECTIONS = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
];

export function formatTime(date, locale = 'en-US', options = {}) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
        ...options
    });
}

export function formatDate(date, locale = 'en-US', options = {}) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...options
    });
}

export function formatRelativeTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const absDiff = Math.abs(diffMs);
    const isFuture = diffMs < 0;

    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let value, unit;
    if (seconds < 60) { value = seconds; unit = 'second'; }
    else if (minutes < 60) { value = minutes; unit = 'minute'; }
    else if (hours < 24) { value = hours; unit = 'hour'; }
    else { value = days; unit = 'day'; }

    const plural = value !== 1 ? 's' : '';
    if (isFuture) return `in ${value} ${unit}${plural}`;
    if (seconds < 10) return 'just now';
    return `${value} ${unit}${plural} ago`;
}

export function formatWindDirection(degrees) {
    if (degrees == null || isNaN(degrees)) return '--';
    const normalized = ((degrees % 360) + 360) % 360;
    const index = Math.round(normalized / 22.5) % 16;
    return CARDINAL_DIRECTIONS[index];
}
