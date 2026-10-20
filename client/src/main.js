// App entry point: load the design system, restore any saved sign-in,
// then mount Vue with the router.

import { createApp } from 'vue'
import './assets/main.css'
import App from './App.vue'
import { router } from './router.js'
import { initAuth } from './lib/auth.js'

// Wait for the saved session first, so the router guard knows if we're signed in
initAuth().then(() => {
  createApp(App).use(router).mount('#app')
})

// In the built app, register the service worker (public/sw.js). It shows a
// friendly page when you're offline, and Android needs it to install Potpal.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {}) // nice-to-have: ignore failures
}
