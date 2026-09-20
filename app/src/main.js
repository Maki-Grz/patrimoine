/**
 * @fileoverview Main frontend application bootstrap entrypoint.
 * Mounts the root Svelte 5 application into the host DOM element.
 * 
 * @module main
 */

import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

const target = document.getElementById('app');
if (!target) {
  throw new Error("Target DOM element #app was not found in the document");
}

/**
 * Mounted Svelte 5 application instance.
 * @type {Record<string, any>}
 */
const app = mount(App, {
  target
})

export default app
