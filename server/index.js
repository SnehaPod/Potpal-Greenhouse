// Potpal API server.
//
// The Vue app never talks to Plant.id directly: it calls this server, which
// keeps the Plant.id API key secret and checks who the user is first.
//
//   GET  /api/health      → { ok: true }  (handy to check the server is up)
//   POST /api/identify    → identify a plant from a photo
//   /api/plants…          → the user's saved plants
//   /api/plants/:id/health… → health scans for one plant
//   /api/catalog…         → the Discover plant catalogue
//   /api/location…        → where the user lives (for local weather)
//   GET /api/forecast     → "This week": weather + early warnings per plant
//   GET /api/names        → a plant's name in Hindi, Marathi, Tamil, Malayalam
//   /api/wishlist…        → Discover plants the user has saved
//
// In production it also serves the built Vue app (client/dist), so the app and
// the API share one address.
//
// Start it with:  npm run dev   (reads settings from server/.env)

import { existsSync } from 'node:fs'
import path from 'node:path'
import express from 'express'
import cors from 'cors'
import { requireUser } from './middleware/auth.js'
import identifyRoutes from './routes/identify.js'
import plantRoutes from './routes/plants.js'
import healthRoutes from './routes/health.js'
import catalogRoutes from './routes/catalog.js'
import locationRoutes from './routes/location.js'
import forecastRoutes from './routes/forecast.js'
import namesRoutes from './routes/names.js'
import wishlistRoutes from './routes/wishlist.js'
import { plantIdEnabled } from './lib/identify.js'

const app = express()
const PORT = process.env.PORT || 3000

// Allow the Vue dev server (and any origin listed in CLIENT_ORIGIN) to call us
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',') }))
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Everything below needs a signed-in user
app.use('/api/identify', requireUser, identifyRoutes)
app.use('/api/plants/:id/health', requireUser, healthRoutes)
app.use('/api/plants', requireUser, plantRoutes)
app.use('/api/catalog', requireUser, catalogRoutes)
app.use('/api/location', requireUser, locationRoutes)
app.use('/api/forecast', requireUser, forecastRoutes)
app.use('/api/names', requireUser, namesRoutes)
app.use('/api/wishlist', requireUser, wishlistRoutes)

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

// The Vue app itself, once it's been built (`npm run build` → client/dist).
// In development Vite serves the app instead, so this folder may not exist.
const appDir = path.join(import.meta.dirname, '../client/dist')
if (existsSync(appDir)) {
  app.use(express.static(appDir))
  // Any other page (e.g. /discover/snake-plant) is a Vue route: send the app
  // and let Vue Router show the right screen.
  app.get('/{*page}', (_req, res) => res.sendFile(path.join(appDir, 'index.html')))
}

// One place to turn any thrown error into a JSON reply.
// (Express 5 sends errors from async route handlers here automatically.)
app.use((err, _req, res, _next) => {
  // multer's "file too large" error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'That photo is too big. Please use one under 5 MB.' })
  }
  // Postgres "invalid uuid", e.g. /api/plants/not-a-real-id
  if (err.code === '22P02') {
    return res.status(404).json({ error: "We couldn't find that plant." })
  }
  const status = err.status || 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: err.message || 'Something went wrong. Please try again.' })
})

app.listen(PORT, () => {
  console.log(`🪴 Potpal API listening on http://localhost:${PORT}`)
  // Make test mode impossible to miss
  if (!plantIdEnabled()) console.log('🧪 Plant.id is OFF (test mode): using Pl@ntNet. Health scans are paused.')
})
