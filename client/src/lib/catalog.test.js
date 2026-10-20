// Tests for the Discover "for you" ordering.  Run with:  npm test  (from the project root)
// catalog.js has no Vue code in it, so these run in plain Node.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankForYou, recentVisits, dailyShuffle, scorePlant, FOR_YOU } from './catalog.js'

const filters = { light: 'Bright, indirect', room: 'Living room', petSafeOnly: false }
const today = new Date('2026-10-19T12:00:00')
const daysAgo = (n) => new Date(today - n * 86_400_000).toISOString()

// Three plants that fit the same space equally well, plus one that fits worse
const plant = (slug, extra = {}) => ({ slug, light: 'Bright, indirect', pet_safe: true, care_level: 'Easy-going', humidity_min: 40, ...extra })
const plants = [plant('calathea'), plant('pilea'), plant('areca'), plant('snake', { light: 'Low', pet_safe: false })]
const order = (list) => list.map((p) => p.slug)

test('saved plants step aside (they live in Saved plants)', () => {
  const result = rankForYou(plants, { filters, savedSlugs: new Set(['calathea']), today })
  assert.ok(!order(result).includes('calathea'))
  assert.equal(result.length, 3)
})

test('the pet-safe filter still applies', () => {
  const result = rankForYou(plants, { filters: { ...filters, petSafeOnly: true }, today })
  assert.ok(!order(result).includes('snake'))
})

test('a plant visited 3 times sinks below fresh ones with the same fit', () => {
  const views = { calathea: { count: 3, last_viewed_at: daysAgo(1) } }
  const result = rankForYou(plants, { filters, views, userId: 'jamie', today })
  const sameFit = order(result).filter((s) => s !== 'snake')
  assert.equal(sameFit.at(-1), 'calathea') // last among the equally good fits, whatever the shuffle
})

test('the visit penalty is capped, so a much better fit still wins', () => {
  const views = { calathea: { count: 50, last_viewed_at: daysAgo(1) } }
  const [calathea] = rankForYou(plants, { filters, views, today }).filter((p) => p.slug === 'calathea')
  const fit = scorePlant(plants[0], filters)
  assert.ok(calathea.rank >= fit - FOR_YOU.maxVisitPenalty) // never more than 12 points off
  assert.ok(calathea.rank > rankForYou(plants, { filters, today }).find((p) => p.slug === 'snake').rank)
})

test('visits older than 30 days no longer count', () => {
  assert.equal(recentVisits({ count: 5, last_viewed_at: daysAgo(10) }, today), 5)
  assert.equal(recentVisits({ count: 5, last_viewed_at: daysAgo(31) }, today), 0)
  assert.equal(recentVisits(undefined, today), 0)
})

test('never-opened plants are marked new and get a small nudge', () => {
  const views = { pilea: { count: 1, last_viewed_at: daysAgo(2) } }
  const result = rankForYou(plants, { filters, views, today })
  assert.equal(result.find((p) => p.slug === 'calathea').isNew, true)
  assert.equal(result.find((p) => p.slug === 'pilea').isNew, false)
})

test('the match % shown is always the real fit, whatever the ranking', () => {
  const views = { calathea: { count: 9, last_viewed_at: daysAgo(1) } }
  for (const p of rankForYou(plants, { filters, views, today })) {
    assert.equal(p.match, scorePlant(plants.find((x) => x.slug === p.slug), filters))
  }
})

test('the daily shuffle: the same all day, different on other days', () => {
  assert.equal(dailyShuffle('jamie', '2026-10-19', 'pilea'), dailyShuffle('jamie', '2026-10-19', 'pilea'))
  const s = dailyShuffle('jamie', '2026-10-19', 'pilea')
  assert.ok(s >= 0 && s <= FOR_YOU.shuffleMax)

  // Same day, any time → same order
  const morning = order(rankForYou(plants, { filters, userId: 'jamie', today: new Date('2026-10-19T08:00:00') }))
  const evening = order(rankForYou(plants, { filters, userId: 'jamie', today: new Date('2026-10-19T21:00:00') }))
  assert.deepEqual(morning, evening)

  // Across a couple of weeks, the three equal fits take turns at the top
  const leaders = new Set()
  for (let d = 1; d <= 14; d++) {
    const day = new Date(`2026-11-${String(d).padStart(2, '0')}T12:00:00`)
    leaders.add(rankForYou(plants, { filters, userId: 'jamie', today: day })[0].slug)
  }
  assert.ok(leaders.size >= 2, `only ${[...leaders]} ever led`)
})
