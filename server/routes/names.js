// GET /api/names?species=<scientific name>&common=<English name>
//   → { names: { hi, mr, ta, ml }, source: 'potpal' | 'wikidata' | null }
//
// The plant's name in Hindi, Marathi, Tamil and Malayalam, where we know one.
// See lib/names.js for where the names come from.

import { Router } from 'express'
import { localNames } from '../lib/names.js'

const router = Router()

router.get('/', async (req, res) => {
  const species = String(req.query.species ?? '').slice(0, 120)
  const commonName = String(req.query.common ?? '').slice(0, 120)
  if (!species && !commonName) return res.json({ names: {}, source: null })
  res.json(await localNames(req.supabase, { species, commonName }))
})

export default router
