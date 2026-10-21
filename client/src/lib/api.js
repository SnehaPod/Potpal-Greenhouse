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
/** Undo the last "watered" (tapped by mistake) */
export const unwaterPlant = (id) => request(`/plants/${id}/unwater`, { method: 'POST' })
export const deletePlant = (id) => request(`/plants/${id}`, { method: 'DELETE' })

// ─── Discover catalogue ─────────────────────────────────────────────────────────

export const listCatalog = () => request('/catalog')
export const getCatalogPlant = (slug) => request(`/catalog/${slug}`)
/** How often I've opened each plant: { slug: { count, last_viewed_at } } */
export const getCatalogViews = () => request('/catalog/views')
/** "I opened this plant" (helps Discover keep suggestions fresh) */
export const recordCatalogView = (slug) => request(`/catalog/${slug}/view`, { method: 'POST' })

// ─── Add a plant by name ───────────────────────────────────────────────────────

/** "snake plant" → { results, nudge, group } (spelling fixed; see server/lib/plantSearch.js) */
export const searchSpecies = (q) => request(`/species/search?q=${encodeURIComponent(q)}`)
/** One species' care details, shaped like a photo identification's suggestion */
export function speciesDetails(name, commonName) {
  const params = new URLSearchParams({ name, common: commonName ?? '' })
  return request(`/species/details?${params}`)
}

// ─── Weather-aware care ─────────────────────────────────────────────────────────

/** My saved place ({ place_name, latitude, longitude }), or null */
export const getLocation = () => request('/location')
/**
 * City search → [{ name, latitude, longitude }], up to 5 places.
 * Straight from the phone to Open-Meteo's free geocoder (no key needed), not via
 * our server: Open-Meteo's free limit is per IP address, and our server shares
 * its IP with other apps on the host, so it can run out early.
 */
export async function searchPlaces(q) {
  const params = new URLSearchParams({ name: q, count: '5', language: 'en', format: 'json' })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`).catch(() => null)
  if (!response?.ok) throw new Error("We couldn't search for places just now. Please try again in a bit.")
  const { results = [] } = await response.json()
  const round2 = (n) => Math.round(n * 100) / 100 // ~1 km: all we keep (the server rounds again)
  return results.map((r) => ({
    // "London, England, United Kingdom" (skipping any parts that are missing)
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    latitude: round2(r.latitude),
    longitude: round2(r.longitude),
  }))
}
export const saveLocation = (place) => request('/location', { method: 'PUT', body: place })
export const clearLocation = () => request('/location', { method: 'DELETE' })
/** "This week": { place: null } or { place, days, alerts } */
export const getForecast = () => request('/forecast')

// ─── Wishlist ───────────────────────────────────────────────────────────────────

/** My saved Discover plants, newest first (catalogue rows + saved_at) */
export const listWishlist = () => request('/wishlist')
export const addToWishlist = (slug) => request(`/wishlist/${slug}`, { method: 'PUT' })
export const removeFromWishlist = (slug) => request(`/wishlist/${slug}`, { method: 'DELETE' })

// ─── Notifications ──────────────────────────────────────────────────────────────

/** The public key this phone subscribes with → { key } */
export const getPushKey = () => request('/push/key')
/** Save this phone's subscription, and its time zone so reminders arrive at local times */
export const savePushSubscription = (subscription, timeZone) =>
  request('/push/subscriptions', { method: 'POST', body: { subscription, timeZone } })
export const deletePushSubscription = (endpoint) => request('/push/subscriptions', { method: 'DELETE', body: { endpoint } })
/** "Test from Potpal" to all my phones → { sent } */
export const testPush = () => request('/push/test', { method: 'POST' })
/** Hot / cold notifications on or off (needs a saved place) */
export const setWeatherAlerts = (on) => request('/location', { method: 'PATCH', body: { weather_alerts_on: on } })

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
