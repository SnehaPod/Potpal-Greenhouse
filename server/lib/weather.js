// Local weather for a place: the next 7 days, simplified for our rules.
//
//   getWeek(lat, lon) → { source, days: [{ date, max, min, sunshineHours, daylightHours }] }
//
// Two free sources, neither needs an API key:
//   1. Open-Meteo (https://open-meteo.com): exact sunshine and daylight hours.
//   2. MET Norway (https://api.met.no), when Open-Meteo says no. Open-Meteo's
//      free limit is per IP address, and shared hosting (like Render's free
//      plan) shares one IP between many apps, so the limit can run out before
//      we've asked for anything. MET gives temperatures and cloud cover; we work
//      out daylight from the date and latitude, and estimate sunshine from the
//      clouds. Good enough for "hot", "cold" and "dark" weeks.
//
// City search runs in the app itself (client/src/lib/api.js), from the phone's
// own IP, for the same reason.
//
// We only ever send rounded coordinates (about 1 km), never a precise position.

import { FIXTURES } from './weatherFixtures.js'

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'
const MET_NORWAY_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/complete'
// MET Norway asks every app to say who it is
const USER_AGENT = 'Potpal/1.0 (+https://potpal-greenhouse.onrender.com)'

const CACHE_MS = 3 * 60 * 60 * 1000 // weather doesn't change much in 3 hours
const cache = new Map() // "51.51,-0.13" → { at, week }

// After Open-Meteo refuses us, use MET Norway for an hour before trying again
const OPEN_METEO_PAUSE_MS = 60 * 60 * 1000
let openMeteoPausedUntil = 0

/** Round to 2 decimals (~1 km): what we store and what we send out */
export const round2 = (n) => Math.round(Number(n) * 100) / 100
const round1 = (n) => Math.round(n * 10) / 10
const average = (numbers) => numbers.reduce((sum, n) => sum + n, 0) / numbers.length

/** The next 7 days of weather for a place, simplified for our rules. */
export async function getWeek(latitude, longitude) {
  // Local testing: WEATHER_FIXTURE=hot|cold|dark|calm swaps in a made-up week
  const fixture = process.env.WEATHER_FIXTURE
  if (fixture && FIXTURES[fixture]) return FIXTURES[fixture]

  const lat = round2(latitude)
  const lon = round2(longitude)
  const key = `${lat},${lon}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.week

  let week = null
  if (Date.now() >= openMeteoPausedUntil) {
    try {
      week = await fromOpenMeteo(lat, lon)
    } catch (error) {
      console.warn(`Open-Meteo unavailable (${error.message}). Using MET Norway for the next hour.`)
      openMeteoPausedUntil = Date.now() + OPEN_METEO_PAUSE_MS
    }
  }
  if (!week) {
    try {
      week = await fromMetNorway(lat, lon)
    } catch (error) {
      console.error('MET Norway unavailable too:', error.message)
      throw weatherError()
    }
  }

  cache.set(key, { at: Date.now(), week })
  return week
}

// ─── Open-Meteo ───────────────────────────────────────────────────────────────

async function fromOpenMeteo(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: 'temperature_2m_max,temperature_2m_min,sunshine_duration,daylight_duration',
    timezone: 'auto', // dates in the place's own time zone
    forecast_days: '7',
  })
  const response = await fetch(`${OPEN_METEO_URL}?${params}`)
  // e.g. "429 Daily API request limit exceeded"
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 120)}`)
  const { daily } = await response.json()

  return {
    source: 'Open-Meteo',
    days: daily.time.map((date, i) => ({
      date, // "2026-10-19"
      max: Math.round(daily.temperature_2m_max[i]),
      min: Math.round(daily.temperature_2m_min[i]),
      // Open-Meteo gives seconds; hours are easier to talk about
      sunshineHours: round1(daily.sunshine_duration[i] / 3600),
      daylightHours: round1(daily.daylight_duration[i] / 3600),
    })),
  }
}

// ─── MET Norway (backup) ──────────────────────────────────────────────────────

async function fromMetNorway(lat, lon) {
  const response = await fetch(`${MET_NORWAY_URL}?lat=${lat}&lon=${lon}`, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(String(response.status))
  return weekFromMetNorway(await response.json(), lat, lon)
}

/**
 * MET Norway's forecast (hourly for ~2 days, then every 6 hours) → our 7 days.
 * Exported for the tests in weather.test.js.
 */
export function weekFromMetNorway(json, latitude, longitude) {
  // MET's times are UTC. Shifting by the longitude (15° = 1 hour) puts each
  // reading on the place's own calendar day: close enough for daily highs and lows.
  const offsetMs = Math.round(longitude / 15) * 60 * 60 * 1000

  const byDay = new Map() // "2026-10-21" → { temps: [...], clouds: [...] }
  for (const { time, data } of json?.properties?.timeseries ?? []) {
    const local = new Date(Date.parse(time) + offsetMs)
    const date = local.toISOString().slice(0, 10)
    const hour = local.getUTCHours()
    if (!byDay.has(date)) byDay.set(date, { temps: [], clouds: [] })
    const day = byDay.get(date)

    const now = data?.instant?.details ?? {}
    const sixHours = data?.next_6_hours?.details ?? {}
    for (const t of [now.air_temperature, sixHours.air_temperature_max, sixHours.air_temperature_min]) {
      if (typeof t === 'number') day.temps.push(t)
    }
    // Cloud cover in the middle of the day decides how sunny it feels
    if (typeof now.cloud_area_fraction === 'number' && hour >= 8 && hour < 17) day.clouds.push(now.cloud_area_fraction)
  }

  return {
    source: 'MET Norway',
    days: [...byDay]
      .filter(([, day]) => day.temps.length)
      .slice(0, 7)
      .map(([date, day]) => {
        const daylight = daylightHours(latitude, date)
        const cloud = day.clouds.length ? average(day.clouds) : 50 // no daytime reading: assume half cloudy
        return {
          date,
          max: Math.round(Math.max(...day.temps)),
          min: Math.round(Math.min(...day.temps)),
          sunshineHours: round1(daylight * (1 - cloud / 100)),
          daylightHours: round1(daylight),
        }
      }),
  }
}

/**
 * Hours from sunrise to sunset, worked out from the latitude and the date
 * (the standard "sunrise equation"). 12 at the equator; 0 in a polar night.
 */
export function daylightHours(latitude, date) {
  const noon = new Date(`${date}T12:00:00Z`)
  const dayOfYear = Math.round((noon - Date.UTC(noon.getUTCFullYear(), 0, 0)) / 86_400_000)
  const toRad = Math.PI / 180
  // How far north or south of the equator the sun is today, in degrees
  const declination = 23.44 * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365)
  const x = -Math.tan(latitude * toRad) * Math.tan(declination * toRad)
  if (x >= 1) return 0 // the sun doesn't rise
  if (x <= -1) return 24 // the sun doesn't set
  return (2 * Math.acos(x)) / toRad / 15 // 15° of the sun's path = 1 hour
}

function weatherError() {
  const error = new Error("We couldn't reach the weather service. Please try again in a bit.")
  error.status = 503
  return error
}
