// A free photo for any species, with its credit, for "Add a plant by name".
//
//   speciesInfo(name) → { observations, photo }   (never throws; cached for a week)
//     observations  how often people have recorded it on iNaturalist: a rough
//                   "how well-known is this plant?" used to rank search results
//     photo         { url, author, licence, licenceUrl, sourceUrl, via } or null
//
// Where the photo comes from, in order:
//   1. iNaturalist (https://www.inaturalist.org): its photos of the species,
//      but only ones whose owners chose a licence that lets anyone reuse them
//      (CC0, CC BY, CC BY-SA). "All rights reserved" and "non-commercial only"
//      photos are skipped, so Potpal can use what it shows.
//   2. Wikipedia's lead photo for the species, from Wikimedia Commons (always
//      freely licensed), with its author and licence.
//   3. Nothing: the app shows its plant placeholder.
// Only the species' scientific name is sent. Both services are free and keyless.

const USER_AGENT = 'Potpal/1.0 (+https://potpal-greenhouse.onrender.com)' // both ask apps to say who they are
const TIMEOUT_MS = 4000
const CACHE_MS = 7 * 24 * 60 * 60 * 1000

// Licences that let Potpal show a photo, with credit
const FREE_LICENCES = {
  cc0: { name: 'CC0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  'cc-by': { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  'cc-by-sa': { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
}

/** "(c) Sue Carnahan, some rights reserved (CC BY), uploaded by Sue" → "Sue Carnahan" */
export function authorFrom(attribution) {
  const match = /^\(c\)\s*(.+?),\s*(some|no) rights reserved/i.exec(attribution ?? '')
  return match ? match[1].trim() : null
}

/**
 * The first iNaturalist photo of a taxon that we're allowed to reuse.
 * @param taxon  an iNaturalist taxon (default_photo and/or taxon_photos)
 */
export function pickINatPhoto(taxon) {
  const photos = [taxon?.default_photo, ...(taxon?.taxon_photos ?? []).map((tp) => tp.photo)].filter(Boolean)
  const photo = photos.find((p) => FREE_LICENCES[p.license_code])
  if (!photo) return null
  const licence = FREE_LICENCES[photo.license_code]
  return {
    url: photo.medium_url ?? photo.url,
    author: authorFrom(photo.attribution) ?? 'an iNaturalist member',
    licence: licence.name,
    licenceUrl: licence.url,
    sourceUrl: `https://www.inaturalist.org/photos/${photo.id}`,
    via: 'iNaturalist',
  }
}

/** Commons' file details → a photo credit, or null if anything's missing */
export function commonsPhoto(imageinfo) {
  const meta = imageinfo?.extmetadata ?? {}
  const licence = meta.LicenseShortName?.value
  if (!imageinfo?.thumburl || !licence) return null
  // The author comes as a bit of HTML ("<a href=…>Cataleirxs</a>"): keep the text
  const author = (meta.Artist?.value ?? '').replace(/<[^>]*>/g, '').trim() || null
  return {
    url: imageinfo.thumburl,
    author: author ?? 'unknown author',
    licence,
    licenceUrl: meta.LicenseUrl?.value ?? null,
    sourceUrl: imageinfo.descriptionurl,
    via: 'Wikimedia Commons',
  }
}

// ─── Fetching ─────────────────────────────────────────────────────────────────

async function getJson(url) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    return response.ok ? await response.json() : null
  } catch {
    return null
  }
}

/** iNaturalist: the taxon with exactly this name (with its photos), or null */
async function iNatTaxon(name) {
  const search = await getJson(`https://api.inaturalist.org/v1/taxa?per_page=1&is_active=true&q=${encodeURIComponent(name)}`)
  const found = search?.results?.[0]
  if (!found || found.name?.toLowerCase() !== name.toLowerCase()) return null
  // The search only gives the main photo; when that one isn't free to reuse, the full record lists more
  if (FREE_LICENCES[found.default_photo?.license_code]) return found
  const full = await getJson(`https://api.inaturalist.org/v1/taxa/${found.id}`)
  return full?.results?.[0] ?? found
}

/** Wikipedia's lead photo for the species, with its Commons credit, or null */
async function wikipediaPhoto(name) {
  const summary = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, '_'))}`)
  const source = summary?.originalimage?.source
  if (!source) return null
  const file = decodeURIComponent(new URL(source).pathname.split('/').pop())
  const info = await getJson(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=500&titles=${encodeURIComponent(`File:${file}`)}`,
  )
  const page = info && Object.values(info.query?.pages ?? {})[0]
  return commonsPhoto(page?.imageinfo?.[0])
}

const cache = new Map() // name → { at, info }

export async function speciesInfo(name) {
  const key = name.toLowerCase()
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.info

  const taxon = await iNatTaxon(name)
  const photo = pickINatPhoto(taxon) ?? (await wikipediaPhoto(name))
  const info = { observations: taxon?.observations_count ?? 0, photo }
  cache.set(key, { at: Date.now(), info })
  return info
}
