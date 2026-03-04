#!/bin/sh
set -e

# Generate runtime config from environment variables
# This allows configuration at container runtime, not just build time

cat > /usr/share/nginx/html/config.js << EOF
window.__WEATHER_CONFIG__ = {
  // API Source Toggles
  OPENMETEO_ENABLED: "${OPENMETEO_ENABLED:-true}",
  OPENWEATHER_ENABLED: "${OPENWEATHER_ENABLED:-false}",
  WEATHERAPI_ENABLED: "${WEATHERAPI_ENABLED:-false}",
  MOCK_ENABLED: "${MOCK_ENABLED:-false}",
  
  // API Keys (keep these secret in production!)
  OPENWEATHER_API_KEY: "${OPENWEATHER_API_KEY:-}",
  WEATHERAPI_KEY: "${WEATHERAPI_KEY:-}",
  
  // Default Location (used when geolocation is denied)
  DEFAULT_LAT: "${DEFAULT_LAT:-40.7128}",
  DEFAULT_LON: "${DEFAULT_LON:-74.0060}",
  DEFAULT_LOCATION_NAME: "${DEFAULT_LOCATION_NAME:-New York}"
};
console.log('[Weather App] Runtime config loaded');
EOF

echo "Runtime config generated:"
echo "  - Open-Meteo: ${OPENMETEO_ENABLED:-true}"
echo "  - OpenWeatherMap: ${OPENWEATHER_ENABLED:-false}"
echo "  - WeatherAPI: ${WEATHERAPI_ENABLED:-false}"
echo "  - Mock Data: ${MOCK_ENABLED:-false}"
echo "  - Default Location: ${DEFAULT_LOCATION_NAME:-New York}"
# Note: API keys are never logged for security

# Execute the main container command (nginx)
exec "$@"

