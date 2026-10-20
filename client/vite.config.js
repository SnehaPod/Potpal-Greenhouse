import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // In development, "/api/…" requests are forwarded to the Node server,
    // so the app can use relative URLs and we avoid CORS headaches.
    // API_TARGET lets you point the app at another API, e.g. one running a
    // made-up weather week:  API_TARGET=http://localhost:3001 npm run dev
    proxy: {
      '/api': process.env.API_TARGET || 'http://localhost:3000',
    },
  },
})
