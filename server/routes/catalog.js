// Plant catalogue API: the plants shown on the Discover tab.
//
//   GET  /api/catalog              every plant in the catalogue (ordered)
//   GET  /api/catalog/views        how often I've opened each plant (for keeping Discover fresh)
//   GET  /api/catalog/:slug        one plant, by its slug
//   POST /api/catalog/:slug/view   "I opened this plant" (adds one visit)
//
// The plants themselves are shared read-only reference data; only the visit
// counts are per user (RLS keeps them private). The matching and ordering
// happen in the app (client/src/lib/catalog.js).

import { Router } from 'express'

const router = Router()

router.get('/', async (req, res) => {
  const { data, error } = await req.supabase
    .from('plant_catalog')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  res.json(data)
})

// Declared before "/:slug" so "views" isn't mistaken for a plant's slug
router.get('/views', async (req, res) => {
  const { data, error } = await req.supabase.from('catalog_views').select('catalog_slug, view_count, last_viewed_at')
  if (error) throw error
  // { "calathea-orbifolia": { count: 3, last_viewed_at: "…" }, … }
  res.json(Object.fromEntries(data.map((v) => [v.catalog_slug, { count: v.view_count, last_viewed_at: v.last_viewed_at }])))
})

router.post('/:slug/view', async (req, res) => {
  const { error } = await req.supabase.rpc('record_catalog_view', { slug: req.params.slug })
  // 23503: no catalogue plant with that slug
  if (error?.code === '23503') return res.status(404).json({ error: "We couldn't find that plant." })
  if (error) throw error
  res.status(204).end()
})

router.get('/:slug', async (req, res) => {
  const { data, error } = await req.supabase
    .from('plant_catalog')
    .select('*')
    .eq('slug', req.params.slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return res.status(404).json({ error: "We couldn't find that plant." })
  res.json(data)
})

export default router
