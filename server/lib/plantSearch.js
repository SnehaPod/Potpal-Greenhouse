// "Add a plant by name": find a species from what the user types, fix small
// spelling mistakes, and say when a photo would work better.
//
//   searchPlants(q, { catalog, nameRows })  → { results, nudge }
//
// Two sources, checked together:
//   1. Potpal's own lists: the Discover catalogue (plant_catalog, with care
//      details and photos) and the names list (species_names: other scientific
//      names, English nicknames, and names in Hindi, Marathi, Tamil, Malayalam).
//      Small typos are forgiven here (up to 2 wrong letters).
//   2. GBIF (https://www.gbif.org), the free, keyless list of every named
//      species. Its "match" corrects scientific names ("Monstera delicioza" →
//      Monstera deliciosa) and follows old names to current ones
//      (Sansevieria trifasciata → Dracaena trifasciata); its common-name search
//      finds "snake plant" → Dracaena trifasciata.
// Only the typed text is sent to GBIF. If GBIF is down, Potpal's lists still answer.
//
// Each result: { name, commonName, kind, inCatalog, imageUrl, alsoKnownAs, wasName, confidence }
//   kind: 'exact'    the name as typed
//         'fuzzy'    a spelling correction ("Did you mean…?")
//         'common'   found by a common or local name
//         'partial'  the typed text is the start of (or inside) its name
//         'group'    a catalogue plant within a group the user typed ("fern", "Ficus")

import { normalize } from './names.js'

const GBIF = 'https://api.gbif.org/v1'
const BACKBONE = 'd7dddbf4-2cf0-4f39-9b2a-bb099caae36c' // GBIF's main species list
const MAX_RESULTS = 6
export const WEAK_MATCH = 85 // GBIF confidence below this: suggest a photo too

// ─── Spelling ─────────────────────────────────────────────────────────────────

/** How many single-letter edits turn a into b (Levenshtein distance) */
export function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length]
}

/** Typos we forgive: 1 in short names, 2 in longer ones, none in very short ones */
const typoAllowance = (q) => (q.length < 4 ? 0 : q.length < 8 ? 1 : 2)

/** "monstera deliciosa" → "Monstera deliciosa" */
const scientificCase = (name) => name.charAt(0).toUpperCase() + name.slice(1)

// ─── 1. Potpal's own lists ────────────────────────────────────────────────────

/**
 * Everything we know a plant by, one entry per species.
 * @param catalog   plant_catalog rows (scientific_name, common_name, image_url)
 * @param nameRows  species_names rows (species, aliases, hi, mr, ta, ml)
 */
export function knownPlants(catalog, nameRows) {
  const plants = new Map() // normalized scientific name → entry
  for (const row of catalog) {
    plants.set(normalize(row.scientific_name), {
      name: row.scientific_name,
      commonName: row.common_name,
      imageUrl: row.image_url ?? null,
      inCatalog: true,
      keys: [normalize(row.scientific_name), normalize(row.common_name)],
    })
  }
  for (const row of nameRows) {
    const entry = plants.get(row.species) ?? {
      name: scientificCase(row.species),
      commonName: row.aliases?.[0] ? scientificCase(row.aliases[0]) : null,
      imageUrl: null,
      inCatalog: false,
      keys: [row.species],
    }
    entry.keys.push(...(row.aliases ?? []).map(normalize), ...['hi', 'mr', 'ta', 'ml'].map((l) => normalize(row[l])).filter(Boolean))
    plants.set(row.species, entry)
  }
  return [...plants.values()]
}

/** How well one typed query matches one key. Higher is better; 0 is no match. */
function keyScore(q, key) {
  if (!key) return 0
  if (key === q) return 100
  if (q.length >= 3 && key.startsWith(q)) return 85
  if (q.length >= 3 && key.split(' ').includes(q)) return 75 // "fern" in "boston fern"
  const allowed = typoAllowance(q)
  if (allowed && Math.abs(key.length - q.length) <= allowed && editDistance(q, key) <= allowed) return 70
  if (q.length >= 4 && key.includes(q)) return 60
  return 0
}

/** Potpal's own matches for a query, best first */
export function localMatches(query, plants) {
  const q = normalize(query)
  if (q.length < 2) return []
  return plants
    .map((plant) => {
      let best = { score: 0, key: null }
      for (const key of plant.keys) {
        const score = keyScore(q, key)
        if (score > best.score) best = { score, key }
      }
      if (!best.score) return null
      const viaScientific = best.key === normalize(plant.name)
      const viaCommon = best.key === normalize(plant.commonName)
      const kind =
        best.score === 100 ? (viaScientific ? 'exact' : 'common')
        : best.score === 75 ? 'group'
        : best.score === 70 ? 'fuzzy'
        : 'partial'
      return {
        name: plant.name,
        commonName: plant.commonName,
        imageUrl: plant.imageUrl,
        inCatalog: plant.inCatalog,
        kind,
        // Matched an alias ("money plant", "स्नेक प्लांट")? Say so, so the result makes sense.
        alsoKnownAs: viaScientific || viaCommon || kind === 'partial' ? null : best.key,
        wasName: null,
        // A typo fixed in one of our own plants is a confident correction: 1 letter off → 90, 2 → 80
        confidence: kind === 'fuzzy' ? 100 - 10 * editDistance(q, best.key) : best.score,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence || Number(b.inCatalog) - Number(a.inCatalog))
}

// ─── 2. GBIF ──────────────────────────────────────────────────────────────────

/** First two words of a scientific name, without the author: "Dracaena trifasciata (Prain) Mabb." → "Dracaena trifasciata" */
const speciesOnly = (name) => (name ?? '').split(' ').slice(0, 2).join(' ')

/**
 * GBIF's "match" answer → one result, or { group } for a genus, or null.
 * Synonyms are followed to the current name, and the old name is kept to show.
 */
export function fromGbifMatch(json) {
  if (!json || json.kingdom !== 'Plantae' || json.matchType === 'NONE') return null
  if (json.rank === 'GENUS') return { group: json.canonicalName }
  if (!json.species || json.matchType === 'HIGHERRANK') return null
  const synonym = json.status === 'SYNONYM'
  return {
    name: json.species, // the current species name
    commonName: null,
    imageUrl: null,
    inCatalog: false,
    kind: json.matchType === 'FUZZY' ? 'fuzzy' : 'exact',
    alsoKnownAs: null,
    wasName: synonym ? json.canonicalName : null, // "Sansevieria trifasciata, now Dracaena trifasciata"
    confidence: json.confidence ?? 0,
  }
}

/** GBIF's common-name search → results whose common name really matches what was typed */
export function fromGbifVernacular(json, query) {
  const q = normalize(query)
  const results = []
  for (const row of json?.results ?? []) {
    if (row.kingdom !== 'Plantae') continue
    // Some sources list several names in one string: "Pothos, Money Plant, Devil's Ivy"
    const names = (row.vernacularNames ?? []).flatMap((v) => v.vernacularName.split(',')).map((n) => n.trim())
    // The whole name, or its first words ("snake plant" in "snake plant variegated"),
    // not just any name that happens to start with the same letters ("fern-leaf aralia")
    const hit = names.find((n) => normalize(n) === q) ?? names.find((n) => normalize(n).startsWith(`${q} `))
    if (!hit) continue
    const synonym = row.taxonomicStatus === 'SYNONYM' && row.accepted && speciesOnly(row.accepted) !== row.canonicalName
    results.push({
      name: synonym ? speciesOnly(row.accepted) : row.canonicalName,
      commonName: scientificCase(hit),
      imageUrl: null,
      inCatalog: false,
      kind: 'common',
      alsoKnownAs: null,
      wasName: synonym ? row.canonicalName : null,
      confidence: normalize(hit) === q ? 90 : 80,
    })
  }
  return results
}

/** Catalogue first, then by how good the match is; one result per species */
export function mergeResults(...lists) {
  const seen = new Map()
  for (const result of lists.flat()) {
    const key = normalize(result.name)
    const existing = seen.get(key)
    if (!existing) seen.set(key, result)
    // Keep the richer one (catalogue, photo, common name), and the most useful labels
    else
      seen.set(key, {
        ...result,
        ...existing,
        commonName: existing.commonName ?? result.commonName,
        wasName: existing.wasName ?? result.wasName,
        kind: existing.kind === 'exact' || result.kind === 'exact' ? 'exact' : existing.kind,
        confidence: Math.max(existing.confidence, result.confidence),
      })
  }
  return [...seen.values()]
    // Don't say "also known as" the same old name we already show as "now called"
    .map((r) => (r.alsoKnownAs && normalize(r.alsoKnownAs) === normalize(r.wasName) ? { ...r, alsoKnownAs: null } : r))
    .sort((a, b) => Number(b.inCatalog) - Number(a.inCatalog) || b.confidence - a.confidence)
    .slice(0, MAX_RESULTS)
}

/**
 * Should we suggest a photo? When nothing was found, when the best guess is a
 * weak spelling correction, or when the name only reaches a group ("fern").
 */
export function needsNudge(results, { group }) {
  if (!results.length || group) return true
  const best = results[0]
  return best.kind === 'fuzzy' && best.confidence < WEAK_MATCH
}

// ─── Fetching from GBIF (cached for a day; never throws) ──────────────────────

const CACHE_MS = 24 * 60 * 60 * 1000
const cache = new Map() // url → { at, json }

async function gbif(url) {
  const cached = cache.get(url)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.json
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error(String(response.status))
    const json = await response.json()
    cache.set(url, { at: Date.now(), json })
    return json
  } catch (e) {
    console.warn('GBIF name search unavailable:', e.message)
    return null // Potpal's own lists still answer
  }
}

/**
 * The whole search.
 * @param deps.catalog, deps.nameRows   Potpal's lists
 * @param deps.fetchGbif                (url) → json or null (the tests pass a fake)
 * @returns { results, nudge, group }   group: e.g. "Ficus" when the name is a whole group
 */
export async function searchPlants(query, { catalog, nameRows, fetchGbif = gbif }) {
  const q = normalize(query)
  if (q.length < 2) return { results: [], nudge: false, group: null }

  const local = localMatches(q, knownPlants(catalog, nameRows))
  const [matchJson, vernacularJson] = await Promise.all([
    fetchGbif(`${GBIF}/species/match?kingdom=Plantae&name=${encodeURIComponent(scientificCase(q))}`),
    fetchGbif(
      `${GBIF}/species/search?qField=VERNACULAR&rank=SPECIES&limit=20&datasetKey=${BACKBONE}&q=${encodeURIComponent(q)}`,
    ),
  ])

  const matched = fromGbifMatch(matchJson)
  const group = matched?.group ?? null
  const fromGbif = [...(matched && !matched.group ? [matched] : []), ...fromGbifVernacular(vernacularJson, q)]

  // A group ("Ficus"): show the catalogue's plants in it
  const inGroup = group
    ? knownPlants(catalog, [])
        .filter((p) => normalize(p.name).startsWith(`${normalize(group)} `))
        .map((p) => ({ ...p, keys: undefined, kind: 'group', alsoKnownAs: null, wasName: null, confidence: 75 }))
    : []

  const results = mergeResults(local, inGroup, fromGbif).map(({ keys, ...result }) => result)
  // A group, by GBIF ("Ficus") or by our best answer being "a plant with this word in its name" ("fern")
  const groupish = group ?? (results[0]?.kind === 'group' ? q : null)
  return { results, nudge: needsNudge(results, { group: groupish }), group: groupish }
}
