// POST /api/identify
//
// Body: multipart/form-data with one field, "photo" (the image file).
// 1. Work out what plant it is (lib/identify.js: cache → Plant.id → Pl@ntNet)
// 2. If it's a plant, save the photo to Supabase Storage
// 3. Reply with { photoUrl, suggestions: [...], source: 'plantid' | 'plantnet' }

import { Router } from 'express'
import { identifyPlant } from '../lib/plantId.js'
import { identifyWithPlantNet } from '../lib/plantnet.js'
import { addCareFromDatabase } from '../lib/careFallback.js'
import { identify, plantIdEnabled, supabaseCache } from '../lib/identify.js'
import { photoUpload, savePhoto } from '../lib/photos.js'

const router = Router()

router.post('/', photoUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please choose a photo of your plant.' })
  }

  // 1. What plant is this?
  const { isPlant, suggestions, source } = await identify(req.file.buffer, req.file.mimetype, {
    enabled: plantIdEnabled(), // PLANT_ID_ENABLED=false → straight to Pl@ntNet (test mode)
    plantId: identifyPlant,
    plantNet: identifyWithPlantNet,
    enrichCare: (list) => addCareFromDatabase(req.supabase, list), // Pl@ntNet gives names only
    cache: supabaseCache(req.supabase),
  })

  if (!isPlant || suggestions.length === 0) {
    return res.status(422).json({
      error: "Hmm, we couldn't identify a plant there. Try again with one leaf in the frame, in natural light.",
    })
  }

  // 2. Save the photo so the plant card can show it later.
  //    (If the user decides not to add the plant, the photo just stays unused.)
  const photoUrl = await savePhoto(req)

  // 3. Done!
  res.json({ photoUrl, suggestions, source })
})

export default router
