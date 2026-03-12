import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Expose these env vars to the client (no VITE_ prefix needed)
  envPrefix: ['VITE_', 'OPENMETEO', 'OPENWEATHER', 'WEATHERAPI', 'NWS', 'DEFAULT', 'SHOW'],
})
