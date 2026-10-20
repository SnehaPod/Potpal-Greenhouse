// Tests for the MET Norway backup in weather.js.  Run with:  npm test   (from server/)
// No network: they use small made-up forecasts in MET Norway's format.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daylightHours, weekFromMetNorway } from './weather.js'

test('daylight hours from latitude and date', () => {
  assert.ok(Math.abs(daylightHours(0, '2026-03-20') - 12) < 0.2) // equator: about 12 hours, all year
  assert.ok(Math.abs(daylightHours(51.5, '2026-10-21') - 10) < 0.4) // London in late October
  assert.ok(daylightHours(51.5, '2026-06-21') > 16) // London midsummer
  assert.equal(daylightHours(69.6, '2026-12-21'), 0) // Tromsø: polar night
  assert.equal(daylightHours(69.6, '2026-06-21'), 24) // ...and midnight sun
})

/** One MET Norway reading */
const reading = (time, temp, cloud, sixHours) => ({
  time,
  data: {
    instant: { details: { air_temperature: temp, cloud_area_fraction: cloud } },
    ...(sixHours && { next_6_hours: { details: sixHours } }),
  },
})

test('MET Norway: daily highs and lows on the place’s own calendar day', () => {
  // Mumbai (longitude 72.9 → about 5 hours ahead of UTC)
  const json = {
    properties: {
      timeseries: [
        reading('2026-10-21T04:00:00Z', 30, 10), //   09:00 local, 21st
        reading('2026-10-21T08:00:00Z', 34.4, 20), // 13:00 local, 21st
        reading('2026-10-21T20:00:00Z', 26, 0), //    01:00 local, the 22nd already
        reading('2026-10-22T06:00:00Z', 31, 90, { air_temperature_max: 35.6, air_temperature_min: 29 }),
      ],
    },
  }
  const week = weekFromMetNorway(json, 19.08, 72.88)
  assert.equal(week.source, 'MET Norway')
  assert.deepEqual(
    week.days.map((d) => [d.date, d.max, d.min]),
    [
      ['2026-10-21', 34, 30],
      ['2026-10-22', 36, 26], // the 6-hour maximum counts too
    ],
  )
})

test('MET Norway: sunshine estimated from daytime cloud, never more than daylight', () => {
  const clear = weekFromMetNorway({ properties: { timeseries: [reading('2026-10-21T10:00:00Z', 20, 0)] } }, 0, 0)
  const grey = weekFromMetNorway({ properties: { timeseries: [reading('2026-10-21T12:00:00Z', 20, 100)] } }, 0, 0)
  assert.equal(clear.days[0].sunshineHours, clear.days[0].daylightHours)
  assert.equal(grey.days[0].sunshineHours, 0)
})

test('MET Norway: at most 7 days, and nothing breaks on an empty answer', () => {
  const timeseries = Array.from({ length: 10 }, (_, i) => reading(`2026-10-${String(21 + i).padStart(2, '0')}T12:00:00Z`, 20, 50))
  assert.equal(weekFromMetNorway({ properties: { timeseries } }, 51.5, -0.1).days.length, 7)
  assert.deepEqual(weekFromMetNorway({}, 51.5, -0.1).days, [])
})
