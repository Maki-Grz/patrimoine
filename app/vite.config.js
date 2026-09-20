/**
 * @fileoverview Vite build configuration for the Patrimoine Svelte 5 frontend.
 * Configures development server port, proxy routes to SAP CAP OData v4 endpoints, and plugins.
 * 
 * @module vite.config
 */

import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

/**
 * Vite user configuration.
 * @see https://vite.dev/config/
 */
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
