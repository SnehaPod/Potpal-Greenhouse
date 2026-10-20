// The user's wishlist, shared by every screen with a heart on it (Discover,
// the plant match screen, Saved plants). Tapping a heart updates the screen at
// once and saves in the background; if saving fails, the heart flips back.
//
//   import { wishlist, loadWishlist, isSaved, toggleSaved } from '../lib/wishlist.js'

import { reactive } from 'vue'
import { auth } from './auth.js'
import { listWishlist, addToWishlist, removeFromWishlist } from './api.js'

export const wishlist = reactive({
  slugs: new Set(), // which catalogue plants are saved
  userId: null, // whose wishlist this is, so switching accounts reloads it
})

/** Load the saved plants once per signed-in user (cheap to call from every screen) */
export async function loadWishlist() {
  if (wishlist.userId === auth.user?.id) return
  const plants = await listWishlist()
  wishlist.slugs = new Set(plants.map((p) => p.slug))
  wishlist.userId = auth.user?.id ?? null
}

export const isSaved = (slug) => wishlist.slugs.has(slug)

/** Save or un-save a plant. Throws (after undoing) if the server says no. */
export async function toggleSaved(slug) {
  const saving = !isSaved(slug)
  saving ? wishlist.slugs.add(slug) : wishlist.slugs.delete(slug)
  try {
    await (saving ? addToWishlist(slug) : removeFromWishlist(slug))
  } catch (e) {
    saving ? wishlist.slugs.delete(slug) : wishlist.slugs.add(slug) // undo
    throw e
  }
}
