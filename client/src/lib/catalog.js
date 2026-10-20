// Helpers for the Discover tab: turning a catalogue plant + the user's room
// choices into a "match %", the reasons it fits, and the care tiles.
//
// The catalogue rows come from the API (GET /api/catalog). Everything here is
// pure, so it's easy to read and to test.

// The three light options shown as chips on Discover (match plant_catalog.light)
export const LIGHT_LEVELS = ['Low', 'Medium', 'Bright, indirect']

// Light is a gentle scale; neighbours (Low↔Medium, Medium↔Bright) partly overlap.
function lightDistance(a, b) {
  return Math.abs(LIGHT_LEVELS.indexOf(a) - LIGHT_LEVELS.indexOf(b))
}

// What each room tends to want. Small nudges, so the ranking feels considered
// without pretending to be exact.
const ROOM_PREF = {
  'Living room': {}, //            bright and open: no strong steer
  Bedroom: { light: 'Low' }, //    often dimmer, calmer
  Kitchen: { petSafe: true }, //   busy, food, pets underfoot
  Office: { careLevel: 'Easy-going' }, // forgiving of a missed watering
  Bathroom: { humidity: true }, // steamy: humidity-lovers thrive
}

/**
 * How well a plant fits the user's space, as a 0–99 "% match".
 * @param plant    a catalogue row
 * @param filters  { light, room, petSafeOnly }
 */
export function scorePlant(plant, { light, room }) {
  let score = 72

  // Light is the biggest factor
  const distance = lightDistance(plant.light, light)
  if (distance === 0) score += 20
  else if (distance === 1) score += 8

  if (plant.pet_safe) score += 4 // a safe plant suits more homes

  // Small room-based nudges
  const pref = ROOM_PREF[room] ?? {}
  if (pref.light && plant.light === pref.light) score += 6
  if (pref.careLevel && plant.care_level === pref.careLevel) score += 5
  if (pref.humidity && plant.humidity_min >= 50) score += 6
  if (pref.petSafe && plant.pet_safe) score += 4

  return Math.min(99, score)
}

/** The "Why you two click" list on the detail screen. */
export function buildReasons(plant, { light, room }) {
  const reasons = []

  // Light
  if (plant.light === light) {
    reasons.push({
      icon: 'sun',
      title: 'Your light is just right',
      detail: `Loves the ${light.toLowerCase()} light you chose.`,
    })
  } else {
    reasons.push({
      icon: 'sun',
      title: 'Adaptable to your light',
      detail: `Happiest in ${plant.light.toLowerCase()} light, but flexible.`,
    })
  }

  // Pets
  reasons.push(
    plant.pet_safe
      ? { icon: 'paw', title: 'A friend to your furry friends', detail: 'Non-toxic to cats and dogs.' }
      : { icon: 'paw', title: 'Keep it up and out of reach', detail: 'Can be toxic to pets if chewed.' },
  )

  // Size / room
  reasons.push({
    icon: 'sofa',
    title: `Made for your ${room.toLowerCase()}`,
    detail: `Grows to ${plant.min_height_cm}–${plant.max_height_cm} cm indoors.`,
  })

  return reasons
}

/** The three care tiles ("A little love looks like…"). */
export function buildCare(plant) {
  return [
    { icon: 'drop', value: `Every ${plant.water_min_days}–${plant.water_max_days} days`, label: 'Water' },
    { icon: 'cloud', value: `${plant.humidity_min}–${plant.humidity_max}%`, label: 'Humidity' },
    { icon: 'care', value: plant.care_level, label: 'Care level' },
  ]
}

// ─── "For you" ordering ───────────────────────────────────────────────────────
// Keeps Discover fresh: plants you've saved step aside (they're in Saved plants),
// plants you've opened a lot sink, and plants you've never opened get a nudge.
// This only changes the ORDER. The match % shown is always the real fit.

export const FOR_YOU = {
  visitPenalty: 4, //    points off per recent visit…
  maxVisitPenalty: 12, // …but never more than this (3+ visits = "visited often")
  visitWindowDays: 30, // visits older than this don't count
  newBonus: 2, //        never opened? a small nudge up
  shuffleMax: 3, //      0–3 points that change daily, so near-ties take turns
}

/** How many visits still count (0 if the last one was over 30 days ago) */
export function recentVisits(view, today = new Date()) {
  if (!view) return 0
  const ageDays = (today - new Date(view.last_viewed_at)) / 86_400_000
  return ageDays > FOR_YOU.visitWindowDays ? 0 : view.count
}

/** "2026-10-19" in the user's own time zone (the shuffle changes at local midnight) */
function localDay(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 0…shuffleMax, the same all day for this user and plant, different tomorrow */
export function dailyShuffle(userId, day, slug) {
  // FNV-1a: a tiny, well-known string hash. Not for security, just for variety.
  let hash = 2166136261
  for (const ch of `${userId}|${day}|${slug}`) {
    hash ^= ch.codePointAt(0)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return (hash % 1000) / 1000 * FOR_YOU.shuffleMax
}

/**
 * The Discover suggestions, best first.
 * @param plants     catalogue rows
 * @param filters    { light, room, petSafeOnly }  (from the Discover screen)
 * @param savedSlugs Set of slugs in the wishlist (left out of the suggestions)
 * @param views      { slug: { count, last_viewed_at } }  (GET /api/catalog/views)
 * @param userId     for the daily shuffle
 * @param today      a Date (pass one in tests to make the order predictable)
 * @returns plants with { match, rank, visits, isNew } added
 */
export function rankForYou(plants, { filters, savedSlugs = new Set(), views = {}, userId = '', today = new Date() }) {
  const day = localDay(today)
  return plants
    .filter((p) => !filters.petSafeOnly || p.pet_safe)
    .filter((p) => !savedSlugs.has(p.slug))
    .map((p) => {
      const match = scorePlant(p, filters) // the honest fit, shown as "% match"
      const visits = recentVisits(views[p.slug], today)
      const isNew = !views[p.slug] // never opened
      const rank =
        match -
        Math.min(FOR_YOU.maxVisitPenalty, visits * FOR_YOU.visitPenalty) +
        (isNew ? FOR_YOU.newBonus : 0) +
        dailyShuffle(userId, day, p.slug)
      return { ...p, match, rank, visits, isNew }
    })
    .toSorted((a, b) => b.rank - a.rank)
}
