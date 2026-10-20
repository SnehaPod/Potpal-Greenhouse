// Health scans for one plant.
//
//   POST /api/plants/:id/health          multipart "photo" → run a health scan, save and return it
//   GET  /api/plants/:id/health/latest   the most recent scan, or null if there isn't one yet
//
// Like plants.js, every query runs as the signed-in user, so row-level
// security keeps people inside their own plants and scans.

import { Router } from 'express'
import { assessHealth } from '../lib/plantId.js'
import { plantIdEnabled } from '../lib/identify.js'
import { photoUpload, savePhoto } from '../lib/photos.js'

// mergeParams: lets this router read ":id" from the path it's mounted on in index.js
const router = Router({ mergeParams: true })

router.post('/', photoUpload, async (req, res) => {
  // Test mode (PLANT_ID_ENABLED=false): health scans need Plant.id, and Pl@ntNet
  // can't assess health, so pause them rather than spend a credit.
  if (!plantIdEnabled()) {
    return res.status(503).json({
      error: 'Health scans are paused while Potpal is in test mode. They need Plant.id, which is switched off to save credits.',
    })
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Please choose a photo of your plant.' })
  }

  // 1. Make sure the plant is yours before spending a Plant.id credit.
  //    (RLS hides other people's plants, so they come back as "not found".)
  const { data: plant, error: findError } = await req.supabase
    .from('plants')
    .select('id, nickname')
    .eq('id', req.params.id)
    .maybeSingle()
  if (findError) throw findError
  if (!plant) return res.status(404).json({ error: "We couldn't find that plant." })

  // 2. Ask Plant.id how the plant is doing
  const { isPlant, ...scan } = await assessHealth(req.file.buffer, req.file.mimetype, plant.nickname)

  if (!isPlant) {
    return res.status(422).json({
      error: "Hmm, we couldn't see a plant there. Try again with one leaf filling the frame, in natural light.",
    })
  }

  // 3. Keep the photo, then save the scan (user_id is filled in by the database)
  const photoUrl = await savePhoto(req)

  const { data, error } = await req.supabase
    .from('health_scans')
    .insert({ plant_id: plant.id, photo_url: photoUrl, ...scan })
    .select()
    .single()
  if (error) throw error

  res.status(201).json(data)
})

// The health journal: every scan for this plant, oldest first (that's the
// order the chart draws them in). A year of weekly scans is plenty.
router.get('/', async (req, res) => {
  const { data, error } = await req.supabase
    .from('health_scans')
    .select('id, score, headline, created_at, photo_url, issues')
    .eq('plant_id', req.params.id)
    .order('created_at', { ascending: true })
    .limit(52)
  if (error) throw error
  res.json(data) // [] for a plant with no scans (or someone else's plant)
})

router.get('/latest', async (req, res) => {
  const { data, error } = await req.supabase
    .from('health_scans')
    .select('*')
    .eq('plant_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  res.json(data) // null when this plant hasn't been scanned yet
})

// One past scan, opened from the journal. (Declared after /latest so that
// "latest" isn't mistaken for a scan id.)
router.get('/:scanId', async (req, res) => {
  const { data, error } = await req.supabase
    .from('health_scans')
    .select('*')
    .eq('plant_id', req.params.id)
    .eq('id', req.params.scanId)
    .maybeSingle()
  if (error) throw error
  if (!data) return res.status(404).json({ error: "We couldn't find that health scan." })
  res.json(data)
})

export default router
