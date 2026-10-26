// Vite configuration: Vue SFCs, UpperCamelCase source folders, and a dev proxy to the server.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const serverUrl = process.env.EKKLESIAZOUS_SERVER ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [vue()],
  publicDir: 'Public',
  server: {
    port: 5173,
    proxy: {
      '/api': serverUrl,
      '/ws': { target: serverUrl.replace(/^http/, 'ws'), ws: true },
    },
  },
})
