// Tests for "Measure my light".  Run with:  npm test   (from the project root)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { luxFromExposure, lightLevel, compassPoint, windowNote, readingCaveat, LUX } from './light.js'

test('lux from a photo’s exposure', () => {
  // f/1.8, 1/100 s, ISO 100: EV100 ≈ 8.3 → about 800 lux (a dim indoor spot)
  assert.equal(Math.round(luxFromExposure({ exposureTime: 1 / 100, fNumber: 1.8, iso: 100 })), 810)
  // One stop brighter (half the ISO) doubles it
  const a = luxFromExposure({ exposureTime: 1 / 100, fNumber: 1.8, iso: 100 })
  const b = luxFromExposure({ exposureTime: 1 / 100, fNumber: 1.8, iso: 50 })
  assert.ok(Math.abs(b / a - 2) < 1e-9)
  // Missing numbers: no reading at all, rather than a made-up one
  assert.equal(luxFromExposure({ exposureTime: 1 / 100, fNumber: 1.8 }), null)
  assert.equal(luxFromExposure({}), null)
})

test('light levels match the Discover chips, at the boundaries', () => {
  assert.equal(lightLevel(LUX.medium - 1).chip, 'Low')
  assert.equal(lightLevel(LUX.medium).chip, 'Medium')
  assert.equal(lightLevel(LUX.bright - 1).chip, 'Medium')
  assert.equal(lightLevel(LUX.bright).chip, 'Bright, indirect')
  assert.equal(lightLevel(LUX.bright).note, null)
  const sun = lightLevel(LUX.directSun)
  assert.equal(sun.chip, 'Bright, indirect')
  assert.match(sun.note, /direct sun/)
})

test('compass points', () => {
  assert.equal(compassPoint(0), 'north')
  assert.equal(compassPoint(359), 'north')
  assert.equal(compassPoint(95), 'east')
  assert.equal(compassPoint(180), 'south')
  assert.equal(compassPoint(225), 'south-west')
  assert.equal(compassPoint(-90), 'west')
})

test('window direction, by hemisphere', () => {
  const london = 51.5
  const sydney = -33.9
  assert.equal(windowNote(180, london).facing, 'south-facing window')
  assert.match(windowNote(180, london).note, /most sun/)
  assert.match(windowNote(0, london).note, /Gentle/)
  // Upside down in the southern hemisphere
  assert.match(windowNote(0, sydney).note, /most sun/)
  assert.match(windowNote(90, london).note, /morning/)
  assert.match(windowNote(270, london).note, /Afternoon/)
  // Mumbai is in the tropics: direction matters less
  assert.match(windowNote(180, 19.1).note, /equator/)
  // No saved place: just the direction. No compass: nothing.
  assert.deepEqual(windowNote(135, null), { facing: 'south-east-facing window', note: null })
  assert.equal(windowNote(null, london), null)
})

test('caveats: old photos and early or late readings', () => {
  const now = new Date(2026, 9, 21, 13, 0)
  assert.equal(readingCaveat(new Date(2026, 9, 21, 12, 30), now), null) // midday today: fine
  assert.match(readingCaveat(new Date(2026, 9, 20, 12, 30), now), /wasn't taken today/)
  assert.match(readingCaveat(new Date(2026, 9, 21, 18, 45), now), /around midday/)
  assert.match(readingCaveat(new Date(2026, 9, 21, 8, 0), now), /around midday/)
  assert.equal(readingCaveat(null, now), null) // unknown: say nothing
})
