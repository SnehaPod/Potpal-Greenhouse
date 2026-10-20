// Tests for choosing between Plant.id and Pl@ntNet.  Run with:  npm test
// Both services are fakes here, so nothing touches the network or spends credits.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { identify, plantIdEnabled } from './identify.js'

const photo = Buffer.from('a photo of a leaf')
const MONSTERA = { isPlant: true, suggestions: [{ name: 'Monstera deliciosa', probability: 0.97 }] }
const POTHOS = { isPlant: true, suggestions: [{ name: 'Epipremnum aureum', probability: 0.61 }] }

/** A fake service that records how often it was called */
function fake(answer) {
  const fn = async () => {
    fn.calls++
    if (answer instanceof Error) throw answer
    return answer
  }
  fn.calls = 0
  return fn
}
const httpError = (status, message = 'nope') => Object.assign(new Error(message), { status })
const timeoutError = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
const markCare = async (list) => list.map((s) => ({ ...s, careSource: 'general' }))

/** An in-memory stand-in for the Supabase cache */
function memoryCache() {
  const store = new Map()
  return { store, get: async (h) => store.get(h) ?? null, set: async (h, r) => void store.set(h, r) }
}

test('Plant.id answers: use it, and never call Pl@ntNet', async () => {
  const plantId = fake(MONSTERA), plantNet = fake(POTHOS)
  const result = await identify(photo, 'image/jpeg', { enabled: true, plantId, plantNet, enrichCare: markCare })
  assert.equal(result.source, 'plantid')
  assert.equal(result.suggestions[0].name, 'Monstera deliciosa')
  assert.equal(plantNet.calls, 0)
})

test('Plant.id out of credits (503): fall back to Pl@ntNet, with care filled in', async () => {
  const plantId = fake(httpError(503, 'Plant.id credits have run out')), plantNet = fake(POTHOS)
  const result = await identify(photo, 'image/jpeg', { enabled: true, plantId, plantNet, enrichCare: markCare })
  assert.equal(result.source, 'plantnet')
  assert.equal(result.suggestions[0].name, 'Epipremnum aureum')
  assert.equal(result.suggestions[0].careSource, 'general') // enrichCare ran
})

test('Plant.id too slow: fall back to Pl@ntNet', async () => {
  const plantId = fake(timeoutError()), plantNet = fake(POTHOS)
  const result = await identify(photo, 'image/jpeg', { enabled: true, plantId, plantNet, enrichCare: markCare })
  assert.equal(result.source, 'plantnet')
})

test('a missing or rejected Plant.id key still falls back (and is logged)', async () => {
  const plantId = fake(httpError(500, 'PLANT_ID_API_KEY is not set')), plantNet = fake(POTHOS)
  const result = await identify(photo, 'image/jpeg', { enabled: true, plantId, plantNet, enrichCare: markCare })
  assert.equal(result.source, 'plantnet')
})

test('"That is not a plant" is a real answer: no fallback', async () => {
  const plantId = fake({ isPlant: false, suggestions: [] }), plantNet = fake(POTHOS)
  const result = await identify(photo, 'image/jpeg', { enabled: true, plantId, plantNet, enrichCare: markCare })
  assert.equal(result.isPlant, false)
  assert.equal(result.source, 'plantid')
  assert.equal(plantNet.calls, 0)
})

test('both services down: a friendly "busy" error', async () => {
  const plantId = fake(httpError(503)), plantNet = fake(timeoutError())
  await assert.rejects(
    identify(photo, 'image/jpeg', { enabled: true, plantId, plantNet, enrichCare: markCare }),
    (e) => e.status === 503 && /busy right now/.test(e.message),
  )
})

test('a Pl@ntNet setup problem is reported as is, so it can be fixed', async () => {
  const plantId = fake(httpError(503)), plantNet = fake(httpError(500, 'PLANTNET_API_KEY is not set.'))
  await assert.rejects(
    identify(photo, 'image/jpeg', { enabled: true, plantId, plantNet, enrichCare: markCare }),
    (e) => e.status === 500 && /PLANTNET_API_KEY/.test(e.message),
  )
})

test('switch off: Plant.id is never called, even when Pl@ntNet fails', async () => {
  const plantId = fake(MONSTERA)
  const ok = await identify(photo, 'image/jpeg', { enabled: false, plantId, plantNet: fake(POTHOS), enrichCare: markCare })
  assert.equal(ok.source, 'plantnet')
  await assert.rejects(identify(photo, 'image/jpeg', { enabled: false, plantId, plantNet: fake(httpError(503)), enrichCare: markCare }))
  assert.equal(plantId.calls, 0)
})

test('the same photo twice: the second answer comes from the cache, with no API call', async () => {
  const cache = memoryCache(), plantId = fake(MONSTERA), plantNet = fake(POTHOS)
  const deps = { enabled: true, plantId, plantNet, enrichCare: markCare, cache }
  const first = await identify(photo, 'image/jpeg', deps)
  const second = await identify(photo, 'image/jpeg', deps)
  assert.equal(first.cached, false)
  assert.equal(second.cached, true)
  assert.equal(second.suggestions[0].name, 'Monstera deliciosa')
  assert.equal(plantId.calls, 1)
  // A different photo is a different fingerprint, so it isn't served from the cache
  await identify(Buffer.from('another photo'), 'image/jpeg', deps)
  assert.equal(plantId.calls, 2)
})

test('a test-mode (Pl@ntNet) answer is not reused once Plant.id is switched on', async () => {
  const cache = memoryCache(), plantId = fake(MONSTERA)
  await identify(photo, 'image/jpeg', { enabled: false, plantId, plantNet: fake(POTHOS), enrichCare: markCare, cache })
  const live = await identify(photo, 'image/jpeg', { enabled: true, plantId, plantNet: fake(POTHOS), enrichCare: markCare, cache })
  assert.equal(live.source, 'plantid')
  assert.equal(plantId.calls, 1)
})

test('a broken cache never blocks an answer', async () => {
  const cache = { get: async () => null, set: async () => { throw new Error('database is down') } }
  const result = await identify(photo, 'image/jpeg', { enabled: true, plantId: fake(MONSTERA), plantNet: fake(POTHOS), enrichCare: markCare, cache })
  assert.equal(result.source, 'plantid')
})

test('PLANT_ID_ENABLED: on unless it says "false"', () => {
  const before = process.env.PLANT_ID_ENABLED
  for (const [value, expected] of [[undefined, true], ['true', true], ['false', false], [' FALSE ', false], ['', true]]) {
    if (value === undefined) delete process.env.PLANT_ID_ENABLED
    else process.env.PLANT_ID_ENABLED = value
    assert.equal(plantIdEnabled(), expected, `PLANT_ID_ENABLED=${JSON.stringify(value)}`)
  }
  if (before === undefined) delete process.env.PLANT_ID_ENABLED
  else process.env.PLANT_ID_ENABLED = before
})
