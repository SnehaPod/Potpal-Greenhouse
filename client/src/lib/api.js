// Small wrappers around our Node API.
// Each call attaches the user's Supabase access token so the server knows who
// is asking. Errors come back as `Error` objects with a friendly message.

import { supabase } from './supabase.js'

async function request(path, { method = 'GET', body, form } = {}) {
  // getSession() refreshes the token for us if it's about to expire
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers = { Authorization: `Bearer ${token}` }
  if (body) headers['Content-Type'] = 'application/json'

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    // FormData (photos) sets its own Content-Type; JSON needs stringifying
    body: form ?? (body ? JSON.stringify(body) : undefined),
  })

  if (response.status === 204) return null
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error || 'Something went wrong. Please try again.')
  return json
}

// ─── Identify ─────────────────────────────────────────────────────────────────

/** Send a photo (Blob) to Plant.id via our server → { photoUrl, suggestions } */
export function identifyPhoto(blob) {
  const form = new FormData()
  form.append('photo', blob, 'plant.jpg')
  return request('/identify', { method: 'POST', form })
}

// ─── Plants ───────────────────────────────────────────────────────────────────

export const listPlants = () => request('/plants')
export const getPlant = (id) => request(`/plants/${id}`)
export const addPlant = (plant) => request('/plants', { method: 'POST', body: plant })
export const updatePlant = (id, changes) => request(`/plants/${id}`, { method: 'PATCH', body: changes })
export const waterPlant = (id) => request(`/plants/${id}/water`, { method: 'POST' })
export const deletePlant = (id) => request(`/plants/${id}`, { method: 'DELETE' })

// ─── Discover catalogue ─────────────────────────────────────────────────────────

export const listCatalog = () => request('/catalog')
export const getCatalogPlant = (slug) => request(`/catalog/${slug}`)
/** How often I've opened each plant: { slug: { count, last_viewed_at } } */
export const getCatalogViews = () => request('/catalog/views')
/** "I opened this plant" (helps Discover keep suggestions fresh) */
export const recordCatalogView = (slug) => request(`/catalog/${slug}/view`, { method: 'POST' })

// ─── Weather-aware care ─────────────────────────────────────────────────────────

/** My saved place ({ place_name, latitude, longitude }), or null */
export const getLocation = () => request('/location')
/** City search → [{ name, latitude, longitude }] */
export const searchPlaces = (q) => request(`/location/search?q=${encodeURIComponent(q)}`)
export const saveLocation = (place) => request('/location', { method: 'PUT', body: place })
export const clearLocation = () => request('/location', { method: 'DELETE' })
/** "This week": { place: null } or { place, days, alerts } */
export const getForecast = () => request('/forecast')

// ─── Wishlist ───────────────────────────────────────────────────────────────────

/** My saved Discover plants, newest first (catalogue rows + saved_at) */
export const listWishlist = () => request('/wishlist')
export const addToWishlist = (slug) => request(`/wishlist/${slug}`, { method: 'PUT' })
export const removeFromWishlist = (slug) => request(`/wishlist/${slug}`, { method: 'DELETE' })

// ─── Names in Indian languages ──────────────────────────────────────────────────

/** → { names: { hi, mr, ta, ml }, source: 'potpal' | 'wikidata' | null } */
export function getLocalNames(species, commonName) {
  const params = new URLSearchParams({ species: species ?? '', common: commonName ?? '' })
  return request(`/names?${params}`)
}

// ─── Health scans ─────────────────────────────────────────────────────────────

/** Send a photo (Blob) of one plant for a Plant.id health scan → the saved scan */
export function scanHealth(plantId, blob) {
  const form = new FormData()
  form.append('photo', blob, 'plant.jpg')
  return request(`/plants/${plantId}/health`, { method: 'POST', form })
}

/** Every health scan for a plant, oldest first (for the health journal) */
export const listScans = (plantId) => request(`/plants/${plantId}/health`)

/** One past health scan */
export const getScan = (plantId, scanId) => request(`/plants/${plantId}/health/${scanId}`)

/** The plant's most recent health scan, or null if it hasn't had one */
export const getLatestScan = (plantId) => request(`/plants/${plantId}/health/latest`)
