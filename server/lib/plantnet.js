// Pl@ntNet API wrapper: Potpal's backup plant identifier.
//
// Pl@ntNet (https://my.plantnet.org) is a purpose-built plant classifier with a
// free plan of 500 identifications a day. Ported from the React Native app's
// supabase/functions/_shared/plantnet.ts.
//
// It only returns species names and scores, none of Plant.id's care details,
// so lib/careFallback.js fills those in afterwards.
//
//   identifyWithPlantNet(buffer, mimeType)  → { isPlant, suggestions: [...] }
//   (the same shape as identifyPlant() in plantId.js, minus the care fields)

const PLANTNET_URL = 'https://my-api.plantnet.org/v2/identify/all'

// Below this score Pl@ntNet is really saying "no idea": treat it as "couldn't identify"
const MIN_SCORE = 0.05

/** An Error with an HTTP status, so the route can reply properly */
export class PlantNetError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.status = status
  }
}

/**
 * Ask Pl@ntNet what plant is in the photo.
 * @param {Buffer} imageBuffer  the photo bytes
 * @param {string} mimeType     e.g. "image/jpeg"
 */
export async function identifyWithPlantNet(imageBuffer, mimeType) {
  const apiKey = process.env.PLANTNET_API_KEY
  if (!apiKey) {
    throw new PlantNetError('PLANTNET_API_KEY is not set. Add your Pl@ntNet key to server/.env (get one at https://my.plantnet.org).', 500)
  }

  // Pl@ntNet wants multipart/form-data: the photo, plus which part of the plant
  // it shows. "auto" lets Pl@ntNet work out leaf / flower / fruit itself.
  const form = new FormData()
  form.append('images', new Blob([imageBuffer], { type: mimeType }), mimeType.includes('png') ? 'plant.png' : 'plant.jpg')
  form.append('organs', 'auto')

  const params = new URLSearchParams({ 'api-key': apiKey, lang: 'en', 'nb-results': '5' })
  const response = await fetch(`${PLANTNET_URL}?${params}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(15_000),
  })

  // 404 is Pl@ntNet's way of saying "no species matched": an answer, not a failure
  if (response.status === 404) return { isPlant: false, suggestions: [] }

  if (!response.ok) {
    console.error('Pl@ntNet error', response.status, await response.text())
    if (response.status === 401 || response.status === 403) {
      throw new PlantNetError('The Pl@ntNet API key was rejected. Check PLANTNET_API_KEY.', 500)
    }
    if (response.status === 429) throw new PlantNetError("Pl@ntNet's daily limit is used up. Please try again tomorrow.", 503)
    throw new PlantNetError('Pl@ntNet could not look at that photo. Please try another one.')
  }

  return simplify(await response.json())
}

/** Turn Pl@ntNet's reply into Potpal's suggestion shape (names and scores only) */
export function simplify(raw) {
  const results = raw?.results ?? []
  if (!results.length || (results[0].score ?? 0) < MIN_SCORE) return { isPlant: false, suggestions: [] }

  const suggestions = results.slice(0, 5).map((r) => {
    const names = (r.species?.commonNames ?? []).map(titleCase)
    return {
      name: r.species?.scientificNameWithoutAuthor ?? 'Unknown plant', // scientific name
      commonName: names[0] ?? null,
      otherNames: names.slice(1, 3),
      probability: r.score ?? 0, // 0–1
      similarImage: null,
    }
  })
  return { isPlant: true, suggestions }
}

function titleCase(name) {
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : name
}
