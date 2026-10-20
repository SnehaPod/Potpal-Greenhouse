// Plant names in Indian languages: Hindi, Marathi, Tamil, Malayalam.
//
//   localNames(supabase, { species, commonName })
//     → { names: { hi, mr, ta, ml }, source: 'potpal' | 'wikidata' | null }
//
// 1. Potpal's own list (the species_names table), matched by scientific name,
//    other scientific names, or English common name.
// 2. Otherwise Wikidata, the free knowledge base behind Wikipedia. We only
//    keep a name if it's actually written in that language's script, and we
//    never fall back to the genus (that gave wrong answers, like "banyan" for
//    a rubber plant).
// 3. Otherwise nothing. Better no name than a wrong one.

export const LANGUAGES = ['hi', 'mr', 'ta', 'ml']

// Unicode ranges for each language's script
const SCRIPTS = {
  hi: /[ऀ-ॿ]/, // Devanagari
  mr: /[ऀ-ॿ]/, // Devanagari
  ta: /[஀-௿]/, // Tamil
  ml: /[ഀ-ൿ]/, // Malayalam
}

/** "Spathiphyllum  Wallisii " → "spathiphyllum wallisii" */
export const normalize = (text) => (text ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Keep only names written in the right script, e.g. drop "Aloe Verra" listed as Tamil */
export function keepRealNames(candidates) {
  const names = {}
  for (const lang of LANGUAGES) {
    const name = candidates[lang]?.trim()
    if (name && SCRIPTS[lang].test(name)) names[lang] = name
  }
  return names
}

/** Find a plant in Potpal's list by scientific name, other names, or English name */
export function findCurated(rows, { species, commonName }) {
  const keys = [normalize(species), normalize(commonName)].filter(Boolean)
  // Scientific name first (most precise), then any alias
  return (
    rows.find((row) => row.species === keys[0]) ??
    rows.find((row) => keys.some((key) => row.species === key || row.aliases.includes(key))) ??
    null
  )
}

// ─── Caches ───────────────────────────────────────────────────────────────────
// The list is small and rarely changes; Wikidata answers barely change at all.
const LIST_CACHE_MS = 10 * 60 * 1000
const WIKIDATA_CACHE_MS = 24 * 60 * 60 * 1000
let list = { at: 0, rows: [] }
const wikidataCache = new Map() // species → { at, names }

/** Potpal's species_names list (cached). Also used by lib/careFallback.js. */
export async function curatedRows(supabase) {
  if (Date.now() - list.at < LIST_CACHE_MS) return list.rows
  const { data, error } = await supabase.from('species_names').select('species, aliases, hi, mr, ta, ml')
  if (error) throw error
  list = { at: Date.now(), rows: data }
  return data
}

// ─── Wikidata ─────────────────────────────────────────────────────────────────

/** Labels for the taxon with this exact scientific name. Never throws. */
async function wikidataNames(species) {
  const cached = wikidataCache.get(species)
  if (cached && Date.now() - cached.at < WIKIDATA_CACHE_MS) return cached.names

  // "Which items have this scientific name, and what are they called in hi/mr/ta/ml?"
  const query = `SELECT ?lang ?label WHERE {
    ?item wdt:P225 ${JSON.stringify(species)} ; rdfs:label ?label .
    BIND(LANG(?label) AS ?lang) FILTER(?lang IN ("hi", "mr", "ta", "ml"))
  }`

  let names = {}
  try {
    const response = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
      // Wikimedia asks every app to say who it is
      headers: { 'User-Agent': 'Potpal/0.1 (plant care app)', Accept: 'application/sparql-results+json' },
      signal: AbortSignal.timeout(6000), // don't keep the user waiting
    })
    if (response.ok) {
      const { results } = await response.json()
      // A species can have duplicate Wikidata items; take the first good name per language
      const candidates = {}
      for (const row of results.bindings) candidates[row.lang.value] ??= row.label.value
      names = keepRealNames(candidates)
    }
  } catch (e) {
    console.error('Wikidata name lookup failed:', e.message)
    return {} // don't cache failures; try again next time
  }

  wikidataCache.set(species, { at: Date.now(), names })
  return names
}

// ─── The one function routes use ──────────────────────────────────────────────

export async function localNames(supabase, { species, commonName }) {
  const row = findCurated(await curatedRows(supabase), { species, commonName })
  if (row) return { names: keepRealNames(row), source: 'potpal' }

  // Wikidata needs the exact scientific name, with its capital letter
  const names = species ? await wikidataNames(species.trim()) : {}
  return Object.keys(names).length ? { names, source: 'wikidata' } : { names: {}, source: null }
}
