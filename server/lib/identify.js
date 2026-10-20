// "What plant is this?": choosing between Plant.id and Pl@ntNet.
//
//   1. Cache      the same photo from the same user → the saved answer, no API call
//   2. Plant.id   best answer (comes with care details); gives up after 8 seconds
//   3. Pl@ntNet   free backup, used only when Plant.id couldn't answer at all
//                 (out of credits, rate-limited, down, too slow, key problems)
//
// "That's not a plant" from Plant.id is a real answer, so it never falls back.
//
// Test switch: PLANT_ID_ENABLED=false in server/.env skips Plant.id entirely
// (straight to Pl@ntNet), so testing never spends Plant.id credits.
//
// Every dependency is passed in (see routes/identify.js), so the tests can use fakes.

import { createHash } from 'node:crypto'

/** Is Plant.id switched on? (On unless PLANT_ID_ENABLED is "false") */
export const plantIdEnabled = () => String(process.env.PLANT_ID_ENABLED ?? 'true').trim().toLowerCase() !== 'false'

/** The photo's fingerprint: identical bytes → identical hash */
export const photoHash = (buffer) => createHash('sha256').update(buffer).digest('hex')

/** An error the route turns into a friendly reply */
class IdentifyError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

/**
 * @param {Buffer} buffer      the photo
 * @param {string} mimeType
 * @param deps.enabled         is Plant.id switched on?
 * @param deps.plantId         (buffer, mimeType) → { isPlant, suggestions }
 * @param deps.plantNet        (buffer, mimeType) → { isPlant, suggestions }  (names only)
 * @param deps.enrichCare      (suggestions) → suggestions with care fields  (for Pl@ntNet)
 * @param deps.cache           { get(hash), set(hash, result) }  (optional)
 * @returns { isPlant, suggestions, source: 'plantid' | 'plantnet', cached: boolean }
 */
export async function identify(buffer, mimeType, { enabled, plantId, plantNet, enrichCare, cache }) {
  const hash = photoHash(buffer)

  // 1. Seen this exact photo before? (A Pl@ntNet answer from test mode isn't
  //    reused once Plant.id is on, so live users get the richer answer.)
  const saved = await cache?.get(hash)
  if (saved && !(enabled && saved.source === 'plantnet')) return { ...saved, cached: true }

  // 2. Plant.id, unless it's switched off
  let result = null
  if (enabled) {
    try {
      result = { ...(await plantId(buffer, mimeType)), source: 'plantid' }
    } catch (e) {
      // Any failure here means "Plant.id couldn't answer", so try the backup.
      // Key problems are a setup mistake, so say so loudly in the server log.
      const reason = e.name === 'TimeoutError' ? 'timed out' : e.message
      console[e.status === 500 ? 'error' : 'warn'](`Plant.id couldn't answer (${reason}); trying Pl@ntNet`)
    }
  }

  // 3. Pl@ntNet, when Plant.id is off or couldn't answer
  if (!result) {
    try {
      const answer = await plantNet(buffer, mimeType)
      result = { isPlant: answer.isPlant, suggestions: await enrichCare(answer.suggestions), source: 'plantnet' }
    } catch (e) {
      console.error(`Pl@ntNet couldn't answer either (${e.name === 'TimeoutError' ? 'timed out' : e.message})`)
      // A setup problem (missing or rejected key) is worth showing as is; otherwise keep it friendly
      if (e.status === 500) throw new IdentifyError(e.message, 500)
      throw new IdentifyError('Identification is busy right now. Please try again in a little while.', 503)
    }
  }

  // Remember it, so trying the same photo again is instant and free.
  // (Saving is a nice-to-have: a cache problem never blocks the answer.)
  await cache?.set(hash, result).catch((e) => console.error('Could not cache identification:', e.message))
  return { ...result, cached: false }
}

/** The cache, stored per user in Supabase (see migration 008). RLS keeps rows private. */
export function supabaseCache(supabase) {
  return {
    async get(hash) {
      const { data, error } = await supabase
        .from('identification_cache')
        .select('result, source')
        .eq('photo_hash', hash)
        .maybeSingle()
      if (error) throw error
      return data ? { ...data.result, source: data.source } : null
    },
    async set(hash, { isPlant, suggestions, source }) {
      const { error } = await supabase
        .from('identification_cache')
        .upsert({ photo_hash: hash, result: { isPlant, suggestions }, source, created_at: new Date().toISOString() }, { onConflict: 'user_id,photo_hash' })
      if (error) throw error
    },
  }
}
