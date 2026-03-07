import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Moon,
  CloudMoon,
  Snowflake,
  CloudHail,
  Wind,
  Eye,
} from 'lucide-react';

/**
 * Maps a weather condition or WMO code to a Lucide icon component.
 * Supports OpenWeatherMap, WeatherAPI, NWS, and WMO conditions.
 * @param {string|number} condition - Weather condition string or WMO code
 * @param {boolean} isNight - Whether it is currently night time
 * @returns {React.Component} Lucide Icon component
 */
export function getWeatherIcon(condition, isNight = false) {
  // Normalize string conditions to lower case for easier matching
  const cond = typeof condition === 'string' ? condition.toLowerCase() : '';

  // WMO Code mapping (if number passed)
  if (typeof condition === 'number') {
    if (condition === 0) return isNight ? Moon : Sun;
    if (condition >= 1 && condition <= 3) return isNight ? CloudMoon : CloudSun;
    if (condition >= 45 && condition <= 48) return CloudFog;
    if (condition >= 51 && condition <= 57) return CloudDrizzle;
    if (condition >= 61 && condition <= 67) return CloudRain;
    if (condition >= 71 && condition <= 77) return CloudSnow;
    if (condition >= 80 && condition <= 82) return CloudRain;
    if (condition >= 85 && condition <= 86) return CloudSnow;
    if (condition === 95) return CloudLightning;
    if (condition >= 96 && condition <= 99) return CloudHail;
    return Cloud; // Default
  }

  // String mapping for OpenWeatherMap, WeatherAPI, NWS, and generic conditions
  if (cond.includes('tornado')) return Wind;
  if (cond.includes('squall')) return Wind;
  if (cond.includes('thunderstorm') || cond.includes('thunder') || cond.includes('storm')) return CloudLightning;
  if (cond.includes('hurricane') || cond.includes('tropical')) return Wind;
  if (cond.includes('hail') || cond.includes('ice pellet')) return CloudHail;
  if (cond.includes('freezing rain') || cond.includes('freezing drizzle') || cond.includes('freezing')) return Snowflake;
  if (cond.includes('blizzard') || cond.includes('heavy snow')) return CloudSnow;
  if (cond.includes('sleet')) return CloudSnow;
  if (cond.includes('snow')) return CloudSnow;
  if (cond.includes('drizzle')) return CloudDrizzle;
  if (cond.includes('rain') || cond.includes('shower')) return CloudRain;
  if (cond.includes('fog') || cond.includes('mist')) return CloudFog;
  if (cond.includes('haze')) return CloudFog;
  if (cond.includes('smoke')) return CloudFog;
  if (cond.includes('dust') || cond.includes('sand')) return Eye;
  if (cond.includes('clear') || cond.includes('sunny') || cond.includes('fair')) return isNight ? Moon : Sun;
  if (cond.includes('mainly clear')) return isNight ? Moon : Sun;
  if (cond.includes('partly') || cond.includes('mostly sunny') || cond.includes('mostly clear')) return isNight ? CloudMoon : CloudSun;
  if (cond.includes('mostly cloudy') || cond.includes('broken')) return isNight ? CloudMoon : CloudSun;
  if (cond.includes('overcast') || cond.includes('cloudy')) return Cloud;
  if (cond.includes('cloud')) return Cloud;
  if (cond.includes('wind') || cond.includes('breezy') || cond.includes('gusty')) return Wind;

  return Cloud;
}

/**
 * Returns a color for the icon based on condition
 * @param {string|number} condition - Weather condition
 * @param {boolean} isNight - Whether it is currently night time
 * @returns {string} CSS color value
 */
export function getIconColor(condition, isNight = false) {
  const cond = typeof condition === 'string' ? condition.toLowerCase() : '';
  const code = typeof condition === 'number' ? condition : null;

  // WMO code colors
  if (code !== null) {
    if (code === 0) return isNight ? '#c4b5fd' : '#facc15'; // Clear - Yellow/Purple at night
    if (code >= 1 && code <= 3) return '#94a3b8'; // Cloudy - Slate
    if (code >= 45 && code <= 48) return '#64748b'; // Fog - Gray
    if (code >= 51 && code <= 67) return '#60a5fa'; // Rain/Drizzle - Blue
    if (code >= 71 && code <= 86) return '#e2e8f0'; // Snow - White
    if (code >= 95) return '#fbbf24'; // Thunderstorm - Amber
    return '#94a3b8';
  }

  // String-based colors
  if (cond.includes('tornado') || cond.includes('squall') || cond.includes('hurricane')) return '#ef4444';
  if (cond.includes('thunder') || cond.includes('storm')) return '#fbbf24';
  if (cond.includes('clear') || cond.includes('sunny') || cond.includes('fair')) return isNight ? '#c4b5fd' : '#facc15';
  if (cond.includes('partly') || cond.includes('mostly')) return '#94a3b8';
  if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) return '#60a5fa';
  if (cond.includes('snow') || cond.includes('sleet') || cond.includes('blizzard')) return '#e2e8f0';
  if (cond.includes('freezing') || cond.includes('ice')) return '#bfdbfe';
  if (cond.includes('fog') || cond.includes('mist') || cond.includes('haze')) return '#64748b';
  if (cond.includes('smoke')) return '#78716c';
  if (cond.includes('dust') || cond.includes('sand')) return '#d97706';
  if (cond.includes('wind') || cond.includes('breezy')) return '#94a3b8';
  if (cond.includes('cloud') || cond.includes('overcast')) return '#94a3b8';

  return '#94a3b8';
}
