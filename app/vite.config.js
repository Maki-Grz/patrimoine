import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      '/odata': {
        target: 'http://localhost:4004',
        changeOrigin: true,
        secure: false
      }
    }
  }
})

