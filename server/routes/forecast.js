// GET /api/forecast: "This week" for the signed-in user.
//
//   { place: null }                     no location saved yet
//   { place, source, days: [...], alerts: [...], groups: [...] }
//
// days come from Open-Meteo, or MET Norway as a backup (lib/weather.js; source
// says which, for the credit on the card); alerts from the rules in
// lib/forecast.js, applied to every plant in the user's crew. alerts are one
// per plant (for each care plan); groups combine them per kind of weather
// (for the home screen).

import { Router } from 'express'
import { getWeek } from '../lib/weather.js'
import { buildAlerts, groupAlerts } from '../lib/forecast.js'

const router = Router()

router.get('/', async (req, res) => {
  const { data: settings, error: settingsError } = await req.supabase.from('user_settings').select('*').maybeSingle()
  if (settingsError) throw settingsError
  if (!settings) return res.json({ place: null })

  const [week, { data: plants, error: plantsError }] = await Promise.all([
    getWeek(settings.latitude, settings.longitude),
    req.supabase.from('plants').select('id, nickname, light').order('created_at'),
  ])
  if (plantsError) throw plantsError

  const alerts = buildAlerts(plants, week)
  res.json({
    place: settings.place_name,
    source: week.source ?? null, // "Open-Meteo" or "MET Norway"
    days: week.days,
    alerts,
    groups: groupAlerts(alerts),
  })
})

export default router
