// Plant.id (by Kindwise) API wrapper.
//
// Docs: https://documenter.getpostman.com/view/24599534/2s93z5A4v2
// Two things we ask Plant.id:
//   identifyPlant()  "what plant is this?"  → a ranked list of species suggestions
//   assessHealth()   "is this plant OK?"    → a health score, likely problems, what to do
// The raw responses are quite detailed, so we turn each one into the small,
// friendly shape the Vue app needs.

const PLANT_ID_URL = 'https://plant.id/api/v3/identification'
const HEALTH_URL = 'https://plant.id/api/v3/health_assessment'

// Extra information we want for each suggestion
const DETAILS = [
  'common_names',
  'description',
  'watering', // { min, max } on a 1 (dry) → 3 (wet) scale
  'best_light_condition',
  'best_watering',
  'toxicity',
].join(',')

/** A plain Error with an HTTP status, so the route can reply properly. */
export class PlantIdError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.status = status
  }
}

/**
 * Ask Plant.id what plant is in the photo.
 * @param {Buffer} imageBuffer  the photo bytes
 * @param {string} mimeType     e.g. "image/jpeg"
 * @returns {Promise<{ isPlant: boolean, suggestions: Array }>}
 */
export async function identifyPlant(imageBuffer, mimeType) {
  const raw = await callPlantId(
    `${PLANT_ID_URL}?details=${DETAILS}&language=en`,
    { images: [toDataUrl(imageBuffer, mimeType)], similar_images: true },
    8000, // after 8 seconds, give up so lib/identify.js can try Pl@ntNet instead
  )
  return simplify(raw)
}

/**
 * Send a photo to Plant.id and return the JSON reply.
 * Shared by identifyPlant() and assessHealth(): both endpoints take the same
 * kind of request and fail in the same ways.
 */
async function callPlantId(url, body, timeoutMs = 20_000) {
  const apiKey = process.env.PLANT_ID_API_KEY
  if (!apiKey) {
    throw new PlantIdError(
      'PLANT_ID_API_KEY is not set. Add your Kindwise key to server/.env (get one at https://admin.kindwise.com).',
      500,
    )
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs), // a hung request shouldn't keep the user waiting
  })

  if (!response.ok) {
    // Turn Plant.id's errors into messages a person can act on
    const detail = await response.text()
    console.error('Plant.id error', response.status, detail)
    if (response.status === 401) throw new PlantIdError('The Plant.id API key was rejected. Check PLANT_ID_API_KEY.', 500)
    if (response.status === 429) throw new PlantIdError('Plant.id credits have run out for now. Please try again later.', 503)
    throw new PlantIdError('Plant.id could not look at that photo. Please try another one.')
  }

  return response.json()
}

/** Plant.id accepts images as base64 data URLs inside a JSON body */
function toDataUrl(imageBuffer, mimeType) {
  return `data:${mimeType};base64,${imageBuffer.toString('base64')}`
}

// ─── Turning the raw response into something friendly ────────────────────────

/** Plant.id's 1–3 watering scale → "every X–Y days" */
const WATERING_DAYS = {
  1: { min: 14, max: 21 }, // likes to dry out (succulents, snake plants)
  2: { min: 7, max: 10 }, // average houseplant
  3: { min: 3, max: 5 }, // likes evenly moist soil (ferns, calatheas)
}

function simplify(raw) {
  const result = raw.result ?? {}
  const isPlant = (result.is_plant?.probability ?? 0) >= 0.5
  const suggestions = (result.classification?.suggestions ?? []).slice(0, 5).map(simplifySuggestion)
  return { isPlant, suggestions }
}

function simplifySuggestion(s) {
  const d = s.details ?? {}

  // Average the min/max watering level and round it to 1, 2 or 3
  const level = d.watering ? Math.round((d.watering.min + d.watering.max) / 2) : 2
  const days = WATERING_DAYS[level] ?? WATERING_DAYS[2]
  const light = shortLight(d.best_light_condition)

  return {
    name: s.name, // scientific name
    commonName: titleCase(d.common_names?.[0]) || null,
    otherNames: (d.common_names ?? []).slice(1, 3).map(titleCase),
    probability: s.probability, // 0–1
    description: firstSentences(d.description?.value, 2),
    light,
    lightTips: d.best_light_condition ?? null,
    wateringTips: d.best_watering ?? null,
    waterMinDays: days.min,
    waterMaxDays: days.max,
    // Thirsty plants and sun-lovers need a bit more attention
    careLevel: level === 3 || light === 'Full sun' ? 'A little attentive' : 'Easy-going',
    toxicity: firstSentences(d.toxicity, 1),
    similarImage: s.similar_images?.[0]?.url ?? null,
  }
}

/** Squash Plant.id's paragraph about light into a short label for the fact tile */
function shortLight(text) {
  const t = (text ?? '').toLowerCase()
  if (t.includes('indirect')) return 'Bright, indirect'
  if (t.includes('full sun') || t.includes('direct sun')) return 'Full sun'
  if (t.includes('low light') || t.includes('shade')) return 'Low light'
  if (t.includes('partial') || t.includes('medium') || t.includes('moderate')) return 'Medium light'
  return 'Bright, indirect' // the safest default for houseplants
}

function firstSentences(text, count) {
  if (!text) return null
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text]
  return sentences.slice(0, count).map((s) => s.trim()).join(' ')
}

function titleCase(name) {
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : name
}

// ─── Health assessment ───────────────────────────────────────────────────────

/**
 * Ask Plant.id how healthy the plant in the photo looks.
 * @param {Buffer} imageBuffer  the photo bytes
 * @param {string} mimeType     e.g. "image/jpeg"
 * @param {string} plantName    the plant's nickname, used in the friendly text
 * @returns {Promise<{ isPlant, score, headline, summary, issues, steps }>}
 */
export async function assessHealth(imageBuffer, mimeType, plantName) {
  // local_name    the problem's name in our language ("water deficiency")
  // description   a paragraph about it
  // treatment     { biological: [...], chemical: [...], prevention: [...] }
  const raw = await callPlantId(`${HEALTH_URL}?details=local_name,description,treatment&language=en`, {
    images: [toDataUrl(imageBuffer, mimeType)],
  })
  return simplifyHealth(raw, plantName)
}

// Plant.id always suggests a few possible problems, even for healthy plants.
// We only mention the ones it gives at least this much weight to (0–1).
const ISSUE_MIN_PROBABILITY = 0.1

function simplifyHealth(raw, plantName) {
  const result = raw.result ?? {}
  const isPlant = (result.is_plant?.probability ?? 1) >= 0.5

  // "How likely is it that this plant is healthy?" (0–1) becomes our 0–100 score
  const score = Math.round((result.is_healthy?.probability ?? 0) * 100)
  const healthy = result.is_healthy?.binary ?? score >= 50

  // The likely problems, most likely first (Plant.id already sorts them)
  const suggestions = (result.disease?.suggestions ?? [])
    .filter((s) => s.probability >= ISSUE_MIN_PROBABILITY)
    .slice(0, 3)

  const issues = suggestions.map((s) => ({
    name: titleCase(s.details?.local_name || s.name),
    probability: s.probability,
    description: firstSentences(s.details?.description, 1),
  }))

  return {
    isPlant,
    score,
    headline: healthHeadline(score, plantName),
    summary: healthSummary(healthy, issues, plantName),
    // A healthy plant doesn't need a treatment plan, just the usual good habits
    issues: healthy ? [] : issues,
    steps: healthy ? HEALTHY_STEPS : feelBetterSteps(suggestions),
  }
}

/** A short, upbeat headline for the score */
function healthHeadline(score, name) {
  if (score >= 70) return `${name} is looking leafy!`
  if (score >= 40) return `A little TLC, a happy ${name}.`
  return `${name} could use some care.`
}

function healthSummary(healthy, issues, name) {
  if (healthy) return `No clear signs of trouble. Keep doing what you're doing.`
  if (issues.length === 0) return `${name} doesn't look quite right, but nothing stood out. Try a closer photo of one leaf.`
  return `It looks most like ${issues[0].name.toLowerCase()}. Here's how to help.`
}

/**
 * Turn Plant.id's treatment advice into up to 3 friendly steps.
 * We prefer "biological" (gentle, at-home) fixes, then "prevention" tips.
 * "Chemical" treatments (sprays, fungicides) are left out on purpose: they're
 * rarely the right first move for a houseplant.
 */
function feelBetterSteps(suggestions) {
  // One list of tips per possible problem. Each tip remembers which problem
  // it's for, so a one-sentence tip can still say why it matters.
  const lists = suggestions.map((s) => {
    const treatment = s.details?.treatment ?? {}
    const problem = (s.details?.local_name || s.name).toLowerCase()
    return [...(treatment.biological ?? []), ...(treatment.prevention ?? [])].map((text) => ({ text, problem }))
  })

  // Take each problem's first tip, then each one's second tip, and so on,
  // so the plan helps with more than just the most likely problem
  const tips = []
  for (let i = 0; lists.some((list) => i < list.length); i++) {
    for (const list of lists) if (list[i]) tips.push(list[i])
  }

  // Different problems often share tips, so drop repeats, then keep the first 3
  const unique = tips.filter((tip, i) => tips.findIndex((other) => other.text === tip.text) === i)
  return unique.slice(0, 3).map(splitTip)
}

/**
 * "Do this. Because of that." → { icon, title: "Do this", detail: "Because of that." }
 * A one-sentence tip gets "Helps with <problem>." as its detail instead.
 */
function splitTip({ text, problem }) {
  const [first, ...rest] = text.match(/[^.!?]+[.!?]*/g) ?? [text]
  return {
    icon: tipIcon(text),
    title: first.trim().replace(/\.$/, ''),
    detail: rest.join(' ').trim() || `Helps with ${problem}.`,
  }
}

/** Pick one of our icons (client/src/components/icons.js) that fits the tip */
function tipIcon(tip) {
  const t = tip.toLowerCase()
  if (t.includes('humid') || t.includes('mist')) return 'humidity'
  if (t.includes('repot') || t.includes('replant') || t.includes('fertiliz') || t.includes('compost')) return 'sprout'
  if (t.includes('water') || t.includes('soil') || t.includes('drain')) return 'drop'
  if (t.includes('light') || t.includes('sun') || t.includes('shade')) return 'sun'
  return 'care'
}

// Shown when the plant looks healthy
const HEALTHY_STEPS = [
  { icon: 'drop', title: 'Keep checking the soil before watering', detail: 'Water only when the top 2–3 cm feels dry.' },
  { icon: 'sun', title: 'Keep the light steady', detail: 'Big moves between bright and dim spots can stress a plant.' },
]
