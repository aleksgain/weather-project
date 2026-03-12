# Weather App

A beautiful, accessible weather application built with React and Vite. Features real-time forecasts with hourly and 10-day predictions.

## Features

- 🌤️ Real-time weather data from multiple sources
- 📍 Automatic geolocation with fallback to default location
- 🌡️ Toggle between Celsius and Fahrenheit
- 📱 Responsive design (mobile, tablet, desktop)
- ♿ Accessible (ARIA labels, keyboard navigation)
- 🎨 Beautiful dark aurora-themed UI
- 🐳 Docker-ready with runtime configuration

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173

### Docker

```bash
# Build and run with default settings
docker build -t weather-app .
docker run -p 8080:80 weather-app

# Or use docker compose
docker compose up --build
```

Open http://localhost:8080

## Configuration

The app supports multiple weather API sources. Configure them via environment variables:

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENMETEO_ENABLED` | `true` | Enable Open-Meteo (free, no key required) |
| `OPENWEATHER_ENABLED` | `false` | Enable OpenWeatherMap |
| `OPENWEATHER_API_KEY` | - | OpenWeatherMap API key |
| `WEATHERAPI_ENABLED` | `false` | Enable WeatherAPI |
| `WEATHERAPI_KEY` | - | WeatherAPI key |
| `NWS_ENABLED` | `false` | Enable National Weather Service (US only) |
| `SHOW_SOURCES` | `false` | Show debug badge with contributing weather sources |
| `DEFAULT_LAT` | `40.7128` | Default latitude |
| `DEFAULT_LON` | `-74.0060` | Default longitude |
| `DEFAULT_LOCATION_NAME` | `New York` | Default location name |

### Docker with Custom Configuration

```bash
# Using docker run
docker run -p 8080:80 \
  -e OPENWEATHER_ENABLED=true \
  -e OPENWEATHER_API_KEY=your_api_key \
  -e DEFAULT_LOCATION_NAME="London" \
  -e DEFAULT_LAT=51.5074 \
  -e DEFAULT_LON=-0.1278 \
  weather-app

# Using docker compose with .env file
# Create a .env file with your variables, then:
docker compose up
```

### Local Development with Environment Variables

Create a `.env` file in the project root:

```env
OPENMETEO_ENABLED=true
OPENWEATHER_ENABLED=true
OPENWEATHER_API_KEY=your_api_key_here
NWS_ENABLED=true
SHOW_SOURCES=true
DEFAULT_LOCATION_NAME=London
```

Then run `npm run dev`.

## Unraid Template

This repo includes a Community Applications template: `unraid-template.xml`.

### Install via Community Applications

1. In Unraid, open **Apps**.
2. Add your template repository URL:
   - `https://raw.githubusercontent.com/aleksgain/weather-project/main/unraid-template.xml`
3. Search for **Weather App** and install.
4. Set API keys and fallback location values in the container template (optional).

## Weather API Sources

### Open-Meteo (Default)
- **Free**: No API key required
- **Data**: Temperature, humidity, wind, pressure, UV index, hourly/daily forecasts
- **Docs**: https://open-meteo.com/

### OpenWeatherMap
- **Free tier**: 1,000 calls/day
- **Sign up**: https://openweathermap.org/api
- **Features**: Current weather, forecasts, air quality

### WeatherAPI
- **Free tier**: 1,000,000 calls/month
- **Sign up**: https://www.weatherapi.com/
- **Features**: Current weather, forecasts, astronomy

### National Weather Service (NWS)
- **Free**: No API key required
- **Coverage**: US only (`api.weather.gov`)
- **Features**: Forecasts and active weather alerts

## Tech Stack

- **React 19** - UI framework
- **Vite 7** - Build tool
- **Lucide React** - Icons
- **Nginx** - Production server (Docker)

## Project Structure

```
src/
├── components/      # React components
│   ├── CurrentWeather.jsx
│   ├── DetailedMetrics.jsx
│   ├── Forecast.jsx
│   └── UnitToggle.jsx
├── config/          # App configuration
│   └── weather-sources.js
├── services/        # API services
│   └── weather.js
├── utils/           # Utility functions
│   ├── iconMap.js
│   └── unitConversion.js
├── App.jsx
├── App.css
├── index.css
└── main.jsx
```

## Security

- **API keys**: When using OpenWeatherMap or WeatherAPI, keys are injected at build/runtime and exposed in the client bundle. For production, consider using a backend proxy to keep keys server-side.
- **Geolocation**: The app requests location only when loading; no coordinates are stored or transmitted except to weather APIs.
- **Environment files**: Never commit `.env` with secrets. Use `.env.example` as a template.

## License

MIT
