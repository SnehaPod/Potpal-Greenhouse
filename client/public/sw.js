// Potpal's service worker, kept deliberately small.
//
// Android needs one before it will install Potpal as an app. It does two things:
//   • shows a friendly "You're offline" page when a screen can't load
//   • shows notifications (watering reminders, weather warnings) and opens the
//     right screen when one is tapped
// It never caches the app, your plants, photos or API answers: those always
// come fresh from the network.
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

// A notification from the server (routes/cron.js, or "Send a test"):
//   { title, body, url, tag }
self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data?.json() ?? {}
  } catch {
    message = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(message.title || 'Potpal', {
      body: message.body,
      icon: '/icon-192.png',
      tag: message.tag, // a newer reminder of the same kind replaces the old one
      data: { url: message.url || '/' },
    }),
  )
})

// Tapped: bring Potpal to the front on the right screen (or open it)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        return open.navigate(url).catch(() => self.clients.openWindow(url))
      }
      return self.clients.openWindow(url)
    })(),
  )
})
