// Add a plant by name (signed-in users).
//
//   GET /api/species/search?q=snake plant
//       → { results: [...], nudge, group }   (see lib/plantSearch.js)
//   GET /api/species/details?name=Dracaena trifasciata&common=Snake plant
//       → one "suggestion", the same shape the photo identification gives,
//         with care from Potpal's catalogue (or general houseplant tips)
//
// Reads only the shared, read-only plant lists. Nothing about the user is stored.

import { Router } from 'express'
import { searchPlants } from '../lib/plantSearch.js'
import { curatedRows } from '../lib/names.js'
import { addCareFromDatabase } from '../lib/careFallback.js'

const router = Router()

// The catalogue's names and photos rarely change: keep them for 10 minutes
let catalog = { at: 0, rows: [] }
async function catalogRows(supabase) {
  if (Date.now() - catalog.at < 10 * 60 * 1000) return catalog.rows
  const { data, error } = await supabase.from('plant_catalog').select('scientific_name, common_name, image_url')
  if (error) throw error
  catalog = { at: Date.now(), rows: data }
  return data
}

router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80)
  const [rows, nameRows] = await Promise.all([catalogRows(req.supabase), curatedRows(req.supabase)])
  res.json(await searchPlants(q, { catalog: rows, nameRows }))
})

router.get('/details', async (req, res) => {
  const name = String(req.query.name ?? '').trim().slice(0, 120)
  const commonName = String(req.query.common ?? '').trim().slice(0, 120) || null
  if (!name) return res.status(400).json({ error: 'Which plant? (missing name)' })
  // Care is looked up by the scientific name only: a shared common name ("rubber tree"
  // is also Ficus elastica's nickname) mustn't give one species another's care
  const [suggestion] = await addCareFromDatabase(req.supabase, [{ name, commonName: null, probability: null, otherNames: [] }])
  res.json({ ...suggestion, commonName })
})

export default router
