// Potpal's service worker, kept deliberately tiny.
//
// Android needs one before it will install Potpal as an app. All it does is
// show a friendly "You're offline" page when a screen can't load. It never
// caches the app, your plants, photos or API answers: those always come
// fresh from the network.
//
// Registered in src/main.js, in the built app only (not in `npm run dev`).

const CACHE = 'potpal-offline-v1'
const OFFLINE_PAGE = '/offline.html'

// Keep a copy of the offline page, ready for when there's no connection
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_PAGE)))
  self.skipWaiting() // a new version takes over straight away
})

// Remove offline pages saved by older versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// Only page loads are handled. Everything else (API calls, photos, scripts)
// goes to the network exactly as if there were no service worker.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_PAGE)))
})
