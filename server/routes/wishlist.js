// Wishlist: catalogue plants the user has hearted on Discover.
//
//   GET    /api/wishlist         my saved plants, newest first (full catalogue rows + saved_at)
//   PUT    /api/wishlist/:slug   save a plant (saving it twice is fine)
//   DELETE /api/wishlist/:slug   un-save a plant
//
// Runs as the signed-in user, so RLS keeps everyone inside their own wishlist.

import { Router } from 'express'

const router = Router()

router.get('/', async (req, res) => {
  // "plant:plant_catalog(*)" pulls in the catalogue row each saved slug points to
  const { data, error } = await req.supabase
    .from('wishlist')
    .select('created_at, plant:plant_catalog(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  res.json(data.map((row) => ({ ...row.plant, saved_at: row.created_at })))
})

router.put('/:slug', async (req, res) => {
  const { error } = await req.supabase
    .from('wishlist')
    .upsert(
      { user_id: req.user.id, catalog_slug: req.params.slug },
      { onConflict: 'user_id,catalog_slug', ignoreDuplicates: true }, // already saved: nothing to do
    )
  // 23503: no catalogue plant with that slug
  if (error?.code === '23503') return res.status(404).json({ error: "We couldn't find that plant." })
  if (error) throw error
  res.status(204).end()
})

router.delete('/:slug', async (req, res) => {
  const { error } = await req.supabase.from('wishlist').delete().eq('catalog_slug', req.params.slug)
  if (error) throw error
  res.status(204).end() // removing something that wasn't saved is fine too
})

export default router
