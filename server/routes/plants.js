// Plants API: the user's "leafy crew".
//
//   GET    /api/plants             list my plants
//   GET    /api/plants/:id         one plant
//   POST   /api/plants             add a plant (after identifying it)
//   PATCH  /api/plants/:id         change nickname, room or reminder settings
//   POST   /api/plants/:id/water   "I checked the soil & watered"
//   DELETE /api/plants/:id         remove a plant
//
// Every query runs through req.supabase, which acts as the signed-in user, so
// row-level security keeps each user inside their own plants. No "where
// user_id = …" checks are needed in this file.

import { Router } from 'express'
import { getWeek } from '../lib/weather.js'
import { waterShift } from '../lib/forecast.js'

const router = Router()

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Days until the next watering, plus a note if the weather moved it.
 * Only when the plant's "Let AI adjust the timing" switch is on and the user
 * has saved a location. If the weather can't be fetched, watering still works
 * on the normal schedule.
 */
async function adjustedInterval(req, plant) {
  const usual = { intervalDays: plant.water_min_days, note: null }
  if (!plant.ai_adjust) return usual

  const { data: settings } = await req.supabase.from('user_settings').select('latitude, longitude').maybeSingle()
  if (!settings) return usual

  try {
    return waterShift(plant, await getWeek(settings.latitude, settings.longitude))
  } catch (e) {
    console.error('Weather lookup failed; using the normal schedule', e.message)
    return usual
  }
}

// Fields the app may set when adding a plant (anything else is ignored)
const CREATE_FIELDS = [
  'nickname', 'room', 'species', 'common_name', 'description', 'photo_url', 'confidence',
  'light', 'light_tips', 'water_min_days', 'water_max_days', 'watering_tips', 'care_level', 'toxicity',
]
// Fields the app may change later
const UPDATE_FIELDS = ['nickname', 'room', 'reminders_on', 'reminder_time', 'ai_adjust']

/** Copy only the allowed keys from `source` */
function pick(source, keys) {
  return Object.fromEntries(keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]))
}

/** Send a 404 if the plant doesn't exist (or belongs to someone else) */
function sendPlant(res, plant) {
  if (!plant) return res.status(404).json({ error: "We couldn't find that plant." })
  res.json(plant)
}

router.get('/', async (req, res) => {
  const { data, error } = await req.supabase
    .from('plants')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  res.json(data)
})

router.get('/:id', async (req, res) => {
  const { data, error } = await req.supabase.from('plants').select('*').eq('id', req.params.id).maybeSingle()
  if (error) throw error
  sendPlant(res, data)
})

router.post('/', async (req, res) => {
  const plant = pick(req.body, CREATE_FIELDS)
  if (!plant.nickname?.trim() || !plant.species) {
    return res.status(400).json({ error: 'A plant needs a nickname and a species.' })
  }
  plant.nickname = plant.nickname.trim()

  // user_id is filled in by the database (default auth.uid())
  const { data, error } = await req.supabase.from('plants').insert(plant).select().single()
  if (error) throw error
  res.status(201).json(data)
})

router.patch('/:id', async (req, res) => {
  const changes = pick(req.body, UPDATE_FIELDS)
  const { data, error } = await req.supabase
    .from('plants')
    .update(changes)
    .eq('id', req.params.id)
    .select()
    .maybeSingle()
  if (error) throw error
  sendPlant(res, data)
})

router.post('/:id/water', async (req, res) => {
  // Look up the plant first so we know its watering rhythm
  const { data: plant, error: findError } = await req.supabase
    .from('plants')
    .select('water_min_days, water_max_days, ai_adjust')
    .eq('id', req.params.id)
    .maybeSingle()
  if (findError) throw findError
  if (!plant) return sendPlant(res, null)

  // Next check-in is at the short end of the range: "check soil first" beats overwatering.
  // If "Let AI adjust the timing" is on, this week's weather can move it a little.
  const { intervalDays, note } = await adjustedInterval(req, plant)

  const now = new Date()
  const { data, error } = await req.supabase
    .from('plants')
    .update({
      last_watered_at: now.toISOString(),
      next_water_due_at: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
      water_note: note, // null clears an old explanation
    })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) throw error
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  // .select() returns the deleted rows, so we can tell "deleted" from "not yours / not found"
  const { data, error } = await req.supabase.from('plants').delete().eq('id', req.params.id).select('id')
  if (error) throw error
  if (data.length === 0) return sendPlant(res, null)
  res.status(204).end()
})

export default router
