// Tests for the push notification rules.  Run with:  npm test   (from server/)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localNow, wateringPush, weatherPush } from './reminders.js'
import { FIXTURES } from './weatherFixtures.js'

// 03:30 UTC on 21 Oct = 09:00 in India (UTC+5:30) = 04:30 in London (UTC+1, summer time)
const NOW = new Date('2026-10-21T03:30:00Z')

const plant = (changes = {}) => ({
  id: 'p1',
  nickname: 'Miso',
  light: 'Bright, indirect',
  next_water_due_at: '2026-10-20T10:00:00Z', // yesterday: overdue
  reminders_on: true,
  reminder_time: '09:00:00',
  last_reminded_on: null,
  ...changes,
})

const job = (changes = {}) => ({
  user_id: 'u1',
  time_zone: 'Asia/Kolkata',
  subscriptions: [],
  plants: [plant()],
  place: null,
  weather_pushes: [],
  ...changes,
})

test('localNow: the date and time where the user is', () => {
  assert.deepEqual(localNow('Asia/Kolkata', NOW), { date: '2026-10-21', minutes: 9 * 60 })
  assert.deepEqual(localNow('Europe/London', NOW), { date: '2026-10-21', minutes: 4 * 60 + 30 })
  // Still the 20th in Los Angeles
  assert.equal(localNow('America/Los_Angeles', NOW).date, '2026-10-20')
  // An unknown zone falls back to UTC instead of crashing the job
  assert.deepEqual(localNow('Not/AZone', NOW), { date: '2026-10-21', minutes: 3 * 60 + 30 })
})

test('watering: reminds at the chosen time, in the user’s own time zone', () => {
  const push = wateringPush(job(), NOW)
  assert.equal(push.title, 'Time to water Miso 💧')
  assert.equal(push.url, '/plants/p1')
  assert.deepEqual(push.plantIds, ['p1'])
  assert.equal(push.on, '2026-10-21')

  // Same moment, but it's only 04:30 in London: not yet
  assert.equal(wateringPush(job({ time_zone: 'Europe/London' }), NOW), null)
})

test('watering: not before the reminder time, then late rather than never', () => {
  assert.equal(wateringPush(job({ plants: [plant({ reminder_time: '09:15:00' })] }), NOW), null)
  // The 09:00 run was missed: the 10:30 run still sends it
  const later = new Date('2026-10-21T05:00:00Z') // 10:30 in India
  assert.ok(wateringPush(job(), later))
})

test('watering: once a day, only when due, only when switched on', () => {
  assert.equal(wateringPush(job({ plants: [plant({ last_reminded_on: '2026-10-21' })] }), NOW), null)
  // Reminded yesterday, still overdue today: remind again
  assert.ok(wateringPush(job({ plants: [plant({ last_reminded_on: '2026-10-20' })] }), NOW))
  // Due tomorrow (in India): nothing today
  assert.equal(wateringPush(job({ plants: [plant({ next_water_due_at: '2026-10-21T19:00:00Z' })] }), NOW), null)
  // Due later today counts as due today
  assert.ok(wateringPush(job({ plants: [plant({ next_water_due_at: '2026-10-21T15:00:00Z' })] }), NOW))
  assert.equal(wateringPush(job({ plants: [plant({ reminders_on: false })] }), NOW), null)
})

test('watering: several thirsty plants share one notification', () => {
  const plants = [plant(), plant({ id: 'p2', nickname: 'Mochi' }), plant({ id: 'p3', nickname: 'Olive', reminders_on: false })]
  const push = wateringPush(job({ plants }), NOW)
  assert.equal(push.title, 'Time to water Miso and Mochi 💧')
  assert.equal(push.url, '/') // several plants: open Home
  assert.deepEqual(push.plantIds, ['p1', 'p2'])
})

const place = { latitude: 19.08, longitude: 72.88 }

test('weather: a hot week sends one grouped warning, from 08:00', () => {
  const plants = [plant(), plant({ id: 'p2', nickname: 'Mochi' })]
  const push = weatherPush(job({ plants, place }), FIXTURES.hot, NOW)
  assert.equal(push.title, 'Hot days ahead for Miso and Mochi')
  assert.deepEqual(push.kinds, ['heat'])

  const early = new Date('2026-10-21T02:00:00Z') // 07:30 in India
  assert.equal(weatherPush(job({ plants, place }), FIXTURES.hot, early), null)
})

test('weather: cold nights too, but never a darker week or a calm one', () => {
  assert.deepEqual(weatherPush(job({ place }), FIXTURES.cold, NOW).kinds, ['cold'])
  assert.equal(weatherPush(job({ place }), FIXTURES.dark, NOW), null)
  assert.equal(weatherPush(job({ place }), FIXTURES.calm, NOW), null)
})

test('weather: not repeated within 3 days, and only with a saved place', () => {
  const sentRecently = [{ kind: 'heat', sent_at: '2026-10-20T03:30:00Z' }]
  assert.equal(weatherPush(job({ place, weather_pushes: sentRecently }), FIXTURES.hot, NOW), null)
  // A different kind of weather still gets through
  assert.ok(weatherPush(job({ place, weather_pushes: sentRecently }), FIXTURES.cold, NOW))
  // No place saved (or weather warnings switched off): nothing
  assert.equal(weatherPush(job(), FIXTURES.hot, NOW), null)
})
