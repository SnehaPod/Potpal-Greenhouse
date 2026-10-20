// Care facts for plants identified by Pl@ntNet.
//
// Pl@ntNet only tells us *what* the plant is. To fill in light, watering, care
// level and toxicity we look the species up in Potpal's own catalogue (the 20
// Discover plants). If it isn't there, we use general houseplant defaults and
// say so: careSource 'catalog' or 'general'.
//
// Toxicity is never guessed: unknown plants get null, which the app shows as
// "We don't have toxicity info for this one".

import { normalize, findCurated, curatedRows } from './names.js'

// Safe, middle-of-the-road advice for a houseplant we know nothing about
export const GENERAL_CARE = {
  light: 'Bright, indirect',
  waterMinDays: 7,
  waterMaxDays: 10,
  careLevel: 'Easy-going',
  toxicity: null, // unknown, not "safe"
  description: null,
  lightTips: null,
  wateringTips: null,
}

// The catalogue's light words → the labels Plant.id results use
const LIGHT_LABELS = { Low: 'Low light', Medium: 'Medium light', 'Bright, indirect': 'Bright, indirect' }

/** Care fields from one catalogue row */
function careFromCatalog(row) {
  return {
    light: LIGHT_LABELS[row.light] ?? row.light,
    waterMinDays: row.water_min_days,
    waterMaxDays: row.water_max_days,
    careLevel: row.care_level,
    // Same wording the app's pet-safety check understands (see isPetSafe in client/src/lib/plants.js)
    toxicity: row.pet_safe ? 'Non-toxic to cats and dogs.' : 'Toxic to cats and dogs if chewed.',
    description: row.blurb,
    lightTips: null,
    wateringTips: row.care_tip,
  }
}

/**
 * Find a suggestion's catalogue plant: by scientific name, then through the
 * names list's other scientific names and English names (e.g. Pl@ntNet's
 * "Calathea orbifolia" is the catalogue's "Goeppertia orbifolia").
 */
export function findCatalogPlant(catalog, nameRows, { name, commonName }) {
  const byName = catalog.find((row) => normalize(row.scientific_name) === normalize(name))
  if (byName) return byName
  const alias = findCurated(nameRows, { species: name, commonName })
  return alias ? catalog.find((row) => normalize(row.scientific_name) === alias.species) ?? null : null
}

/** Add care fields (and careSource) to Pl@ntNet suggestions. Pure, for the tests. */
export function addCare(suggestions, catalog, nameRows) {
  return suggestions.map((s) => {
    const row = findCatalogPlant(catalog, nameRows, s)
    return row ? { ...s, ...careFromCatalog(row), careSource: 'catalog' } : { ...s, ...GENERAL_CARE, careSource: 'general' }
  })
}

// The catalogue is small and rarely changes, so keep it for 10 minutes
let catalogCache = { at: 0, rows: [] }

/** The route-facing version: loads the catalogue and names list, then adds care */
export async function addCareFromDatabase(supabase, suggestions) {
  if (Date.now() - catalogCache.at > 10 * 60 * 1000) {
    const { data, error } = await supabase
      .from('plant_catalog')
      .select('scientific_name, common_name, light, water_min_days, water_max_days, care_level, pet_safe, blurb, care_tip')
    if (error) throw error
    catalogCache = { at: Date.now(), rows: data }
  }
  return addCare(suggestions, catalogCache.rows, await curatedRows(supabase))
}
