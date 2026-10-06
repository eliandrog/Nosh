import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Extra bundle + polyfills for older phones' browsers; modern browsers still get the modern bundle.
    legacy({ targets: ['defaults', 'not IE 11'] }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
