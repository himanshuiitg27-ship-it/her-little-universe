import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api to the FastAPI backend, so no API URL or key ever lives in the browser.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          motion: ['framer-motion'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000', changeOrigin: true } },
  },
})
