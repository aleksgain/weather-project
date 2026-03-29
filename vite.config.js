import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
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
  ],
  // Expose these env vars to the client (no VITE_ prefix needed)
  envPrefix: ['VITE_', 'OPENMETEO', 'OPENWEATHER', 'WEATHERAPI', 'NWS', 'DEFAULT', 'SHOW'],
})
