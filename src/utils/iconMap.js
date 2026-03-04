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
} from 'lucide-react';

/**
 * Maps a weather condition or WMO code to a Lucide icon component.
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

  // String mapping (fallback/mock data)
  if (cond.includes('clear') || cond.includes('sunny')) return isNight ? Moon : Sun;
  if (cond.includes('mainly clear')) return isNight ? Moon : Sun;
  if (cond.includes('partly')) return isNight ? CloudMoon : CloudSun;
  if (cond.includes('overcast')) return Cloud;
  if (cond.includes('fog') || cond.includes('mist')) return CloudFog;
  if (cond.includes('drizzle')) return CloudDrizzle;
  if (cond.includes('freezing')) return Snowflake;
  if (cond.includes('rain') || cond.includes('shower')) return CloudRain;
  if (cond.includes('snow') || cond.includes('sleet')) return CloudSnow;
  if (cond.includes('hail')) return CloudHail;
  if (cond.includes('thunder') || cond.includes('storm')) return CloudLightning;
  if (cond.includes('cloud')) return Cloud;

  return Cloud;
}

/**
 * Returns a color for the icon based on condition
 * @param {string|number} condition - Weather condition
 * @returns {string} CSS color value
 */
export function getIconColor(condition) {
  const cond = typeof condition === 'string' ? condition.toLowerCase() : '';
  const code = typeof condition === 'number' ? condition : null;

  // WMO code colors
  if (code !== null) {
    if (code === 0) return '#facc15'; // Clear - Yellow
    if (code >= 1 && code <= 3) return '#94a3b8'; // Cloudy - Slate
    if (code >= 45 && code <= 48) return '#64748b'; // Fog - Gray
    if (code >= 51 && code <= 67) return '#60a5fa'; // Rain/Drizzle - Blue
    if (code >= 71 && code <= 86) return '#e2e8f0'; // Snow - White
    if (code >= 95) return '#fbbf24'; // Thunderstorm - Amber
    return '#94a3b8';
  }

  // String-based colors
  if (cond.includes('clear') || cond.includes('sunny')) return '#facc15';
  if (cond.includes('partly')) return '#94a3b8';
  if (cond.includes('rain') || cond.includes('drizzle')) return '#60a5fa';
  if (cond.includes('snow')) return '#e2e8f0';
  if (cond.includes('thunder') || cond.includes('storm')) return '#fbbf24';
  if (cond.includes('fog') || cond.includes('mist')) return '#64748b';

  return '#94a3b8';
}
