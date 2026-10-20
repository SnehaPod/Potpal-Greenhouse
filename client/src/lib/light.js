// "Measure my light": how bright is a spot, and which way does its window face?
// Pure helpers for components/LightMeter.vue (tested in light.test.js).
//
// How the light is measured: a photo from the phone's camera records the
// exposure the camera chose (shutter time, aperture and ISO). Together they say
// how bright the scene was, the same way a photographer's light meter works:
//   EV100 = log2(N² / t) − log2(ISO / 100)      (N = f-number, t = seconds)
//   lux   ≈ 2.5 × 2^EV100                       (the usual light-meter calibration)
// It's an estimate, good enough to tell low, medium and bright light apart,
// not a lab reading. The photo never leaves the phone.

import { LIGHT_LEVELS } from './catalog.js'

const [LOW, MEDIUM, BRIGHT] = LIGHT_LEVELS // 'Low', 'Medium', 'Bright, indirect'

// Where one light level ends and the next begins, in lux. Easy to tune here.
export const LUX = {
  medium: 2_500, //     below this: low light (a dim corner, a north room)
  bright: 10_000, //    above this: bright, indirect (near a good window)
  directSun: 30_000, // above this: sun shining straight on the spot
}

/** Lux from a photo's exposure, or null if any of the numbers is missing */
export function luxFromExposure({ exposureTime, fNumber, iso }) {
  if (!(exposureTime > 0 && fNumber > 0 && iso > 0)) return null
  const ev100 = Math.log2((fNumber * fNumber) / exposureTime) - Math.log2(iso / 100)
  return 2.5 * 2 ** ev100
}

/**
 * Which Discover light chip fits this much light.
 * @returns { chip, label, note }  chip is one of LIGHT_LEVELS
 */
export function lightLevel(lux) {
  if (lux >= LUX.directSun) {
    return {
      chip: BRIGHT,
      label: 'very bright light',
      note: "That's direct sun. Pick sun-lovers, or move the plant a little away from the glass.",
    }
  }
  if (lux >= LUX.bright) return { chip: BRIGHT, label: 'bright, indirect light', note: null }
  if (lux >= LUX.medium) return { chip: MEDIUM, label: 'medium light', note: null }
  return { chip: LOW, label: 'low light', note: null }
}

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']

/** 0–360° (0 = north, 90 = east) → "north", "south-east", … */
export function compassPoint(heading) {
  const degrees = ((heading % 360) + 360) % 360
  return POINTS[Math.round(degrees / 45) % 8]
}

/**
 * What the window's direction means for light, if we know the direction.
 * The sun sits towards the equator: south of you in the northern hemisphere,
 * north of you in the southern. Near the equator it's high overhead all year.
 * @param heading   compass heading the phone pointed at (or null)
 * @param latitude  from the saved weather location (or null)
 * @returns { facing: 'south-facing window', note } or null
 */
export function windowNote(heading, latitude) {
  if (heading == null || Number.isNaN(heading)) return null
  const point = compassPoint(heading)
  const facing = `${point}-facing window`
  if (latitude == null) return { facing, note: null }

  if (Math.abs(latitude) < 23.5) {
    return { facing, note: 'Near the equator the sun is high, so how close the plant sits to the glass matters more than the direction.' }
  }
  const sunSide = latitude >= 0 ? 'south' : 'north'
  const shadeSide = latitude >= 0 ? 'north' : 'south'
  if (point.includes(sunSide)) return { facing, note: 'It gets the most sun of any direction: bright for much of the day.' }
  if (point.includes(shadeSide)) return { facing, note: 'Gentle, steady light that never gets harsh: lovely for shade-lovers.' }
  if (point === 'east') return { facing, note: 'Soft morning sun, then gentler light for the rest of the day.' }
  return { facing, note: 'Afternoon sun, which can be hot in summer.' } // west
}

/**
 * A word of warning if the photo isn't a fair reading: not taken today, or
 * taken early or late, when the light is much weaker than at midday.
 * @param takenAt  when the photo was taken (from the photo), or null
 * @returns a sentence, or null
 */
export function readingCaveat(takenAt, now = new Date()) {
  if (!(takenAt instanceof Date) || Number.isNaN(takenAt.getTime())) return null
  if (takenAt.toDateString() !== now.toDateString()) {
    return "This photo wasn't taken today. For a fair reading, take a new one."
  }
  const hour = takenAt.getHours()
  if (hour < 10 || hour >= 16) {
    const time = takenAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `Taken at ${time}, and light changes a lot through the day. Try again around midday for a fairer reading.`
  }
  return null
}
