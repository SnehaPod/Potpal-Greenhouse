// Tests for the "This week" rules.  Run with:  npm test   (from server/)
// They use the made-up weeks in weatherFixtures.js, so they never touch the network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAlerts, waterShift, groupAlerts, joinNames } from './forecast.js'
import { FIXTURES } from './weatherFixtures.js'

const miso = { id: 'p1', nickname: 'Miso', light: 'Bright, indirect', water_min_days: 7, water_max_days: 10 }
const aloe = { id: 'p2', nickname: 'Spike', light: 'Full sun', water_min_days: 14, water_max_days: 21 }
const thirsty = { id: 'p3', nickname: 'Fern', light: 'Medium light', water_min_days: 3, water_max_days: 4 }

test('a calm week: no warnings and no watering changes', () => {
  assert.deepEqual(buildAlerts([miso, aloe], FIXTURES.calm), [])
  assert.deepEqual(waterShift(miso, FIXTURES.calm), { intervalDays: 7, note: null })
})

test('a hot week: one heat warning per plant, explained with the forecast', () => {
  const alerts = buildAlerts([miso, aloe], FIXTURES.hot)
  assert.equal(alerts.length, 2)
  assert.ok(alerts.every((a) => a.kind === 'heat' && a.waterShiftDays === -2))

  const [forMiso, forAloe] = alerts
  assert.match(forMiso.why, /reaches 34°C/) // the hottest day, not the first warm one
  assert.match(forMiso.detail, /pull it back from sunny glass/)
  assert.doesNotMatch(forAloe.detail, /glass/) // sun-lovers don't need moving
})

test('a hot week brings watering forward, but never below every 2 days', () => {
  const forMiso = waterShift(miso, FIXTURES.hot)
  assert.equal(forMiso.intervalDays, 5)
  assert.match(forMiso.note, /^Brought forward 2 days: hot week ahead \(34°C on \w+day\)\.$/)

  const forFern = waterShift(thirsty, FIXTURES.hot)
  assert.equal(forFern.intervalDays, 2) // 3 - 2 = 1, held at the 2-day minimum
  assert.match(forFern.note, /Brought forward 1 day:/)
})

test('a cold week: a draft warning, and watering is left alone', () => {
  const alerts = buildAlerts([miso], FIXTURES.cold)
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].kind, 'cold')
  assert.match(alerts[0].why, /drops to -1°C/)
  assert.equal(alerts[0].waterShiftDays, 0)
  assert.deepEqual(waterShift(miso, FIXTURES.cold), { intervalDays: 7, note: null })
})

test('a dark week pushes watering back, capped at the plant\'s longest gap', () => {
  const alerts = buildAlerts([miso], FIXTURES.dark)
  assert.equal(alerts[0].kind, 'dark')
  assert.match(alerts[0].why, /0\.8 hours of sunshine a day/)

  assert.equal(waterShift(miso, FIXTURES.dark).intervalDays, 9) // 7 + 2
  assert.equal(waterShift(thirsty, FIXTURES.dark).intervalDays, 4) // 3 + 2, capped at 4
})

test('no weather at all: nothing to say', () => {
  assert.deepEqual(buildAlerts([miso], { days: [] }), [])
  assert.deepEqual(waterShift(miso, { days: [] }), { intervalDays: 7, note: null })
})

test('names read naturally in a sentence', () => {
  assert.equal(joinNames(['Miso']), 'Miso')
  assert.equal(joinNames(['Miso', 'Mochi']), 'Miso and Mochi')
  assert.equal(joinNames(['Miso', 'Mochi', 'Olive']), 'Miso, Mochi and Olive')
  assert.equal(joinNames(['Miso', 'Mochi', 'Olive', 'Pip', 'Fern']), 'Miso, Mochi and 3 more')
})

test('the home screen gets one row per kind of weather, not one per plant', () => {
  const groups = groupAlerts(buildAlerts([miso, aloe, thirsty], FIXTURES.hot))
  assert.equal(groups.length, 1)
  assert.equal(groups[0].kind, 'heat')
  assert.equal(groups[0].title, 'Hot days ahead for Miso, Spike and Fern')
  assert.match(groups[0].detail, /sun-shy plants/) // advice worded for several plants
  assert.deepEqual(groups[0].plants.map((p) => p.id), ['p1', 'p2', 'p3'])
})

test('a single plant keeps its own advice', () => {
  const [group] = groupAlerts(buildAlerts([miso], FIXTURES.cold))
  assert.equal(group.title, 'Cold nights ahead for Miso')
  assert.match(group.detail, /Keep its leaves off cold windows/)
})
