// Where the user lives, for weather-aware care.
//
//   GET    /api/location            my saved place, or null
//   PUT    /api/location            save { place_name, latitude, longitude }
//   PATCH  /api/location            { weather_alerts_on }: hot / cold notifications on or off
//   DELETE /api/location            forget my place
//
// Coordinates are rounded to ~1 km before they're stored. RLS keeps everyone
// inside their own row of user_settings. (City search happens in the app,
// straight from the phone: see searchPlaces in client/src/lib/api.js.)

import { Router } from 'express'
import { round2 } from '../lib/weather.js'

const router = Router()

router.get('/', async (req, res) => {
  const { data, error } = await req.supabase.from('user_settings').select('*').maybeSingle()
  if (error) throw error
  res.json(data)
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

router.patch('/', async (req, res) => {
  const on = req.body?.weather_alerts_on
  if (typeof on !== 'boolean') return res.status(400).json({ error: 'weather_alerts_on must be true or false.' })
  const { data, error } = await req.supabase
    .from('user_settings')
    .update({ weather_alerts_on: on })
    .eq('user_id', req.user.id)
    .select()
    .maybeSingle()
  if (error) throw error
  if (!data) return res.status(404).json({ error: 'Choose a place first.' })
  res.json(data)
})

router.delete('/', async (req, res) => {
  const { error } = await req.supabase.from('user_settings').delete().eq('user_id', req.user.id)
  if (error) throw error
  res.status(204).end()
})

export default router
