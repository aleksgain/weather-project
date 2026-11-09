import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/**
 * The Android build (`vite build --mode android`, see `npm run build:android`)
 * is bundled into the APK and served from the device. It has no Docker
 * entrypoint and needs no service worker, so both are stripped.
 */
function stripRuntimeConfig() {
  return {
    name: 'strip-runtime-config',
    transformIndexHtml(html) {
      return html
        .replace(/\s*<!-- Runtime config[^>]*-->\s*<script src="\/config\.js"><\/script>/, '')
        .replace(/\s*<link rel="manifest"[^>]*>/, '')
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isAndroid = mode === 'android'
  // CI passes the release tag (e.g. v2.2.0); local builds fall back to package.json.
  const appVersion = (process.env.APP_VERSION || pkg.version).replace(/^v/, '')

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_REPO__: JSON.stringify('aleksgain/weather-project'),
    },
    plugins: [
      react(),
      isAndroid && stripRuntimeConfig(),
      VitePWA({
        // Assets are already local inside the APK; a service worker in a
        // WebView only adds a stale-cache failure mode.
        disable: isAndroid,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'favicon.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'Weather - Real-time Forecasts',
          short_name: 'Weather',
          description: 'Multi-source weather aggregation with accurate forecasts.',
          theme_color: '#07080a',
          background_color: '#07080a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ].filter(Boolean),
    // Expose these env vars to the client (no VITE_ prefix needed)
    envPrefix: ['VITE_', 'OPENMETEO', 'OPENWEATHER', 'WEATHERAPI', 'NWS', 'METNORWAY', 'PIRATEWEATHER', 'DEFAULT', 'SHOW'],
  }
})
