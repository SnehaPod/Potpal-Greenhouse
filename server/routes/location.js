// Where the user lives, for weather-aware care.
//
//   GET    /api/location            my saved place, or null
//   GET    /api/location/search?q=  find a city → [{ name, latitude, longitude }]
//   PUT    /api/location            save { place_name, latitude, longitude }
//   DELETE /api/location            forget my place
//
// Coordinates are rounded to ~1 km before they're stored. RLS keeps everyone
// inside their own row of user_settings.

import { Router } from 'express'
import { searchPlaces, round2 } from '../lib/weather.js'

const router = Router()

router.get('/', async (req, res) => {
  const { data, error } = await req.supabase.from('user_settings').select('*').maybeSingle()
  if (error) throw error
  res.json(data)
})

router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  if (q.length < 2) return res.json([])
  res.json(await searchPlaces(q))
})

router.put('/', async (req, res) => {
  const { place_name: placeName, latitude, longitude } = req.body ?? {}
  const lat = Number(latitude)
  const lon = Number(longitude)
  if (!placeName?.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: 'Please choose a place from the list.' })
  }

  const { data, error } = await req.supabase
    .from('user_settings')
    .upsert(
      {
        user_id: req.user.id, // RLS also checks this matches the signed-in user
        place_name: placeName.trim().slice(0, 120),
        latitude: round2(lat),
        longitude: round2(lon),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single()
  if (error) throw error
  res.json(data)
})

router.delete('/', async (req, res) => {
  const { error } = await req.supabase.from('user_settings').delete().eq('user_id', req.user.id)
  if (error) throw error
  res.status(204).end()
})

export default router
