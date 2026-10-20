// Local weather from Open-Meteo (https://open-meteo.com). It's free for
// non-commercial use and needs no API key.
//
//   searchPlaces("london")  → [{ name, latitude, longitude }]   (for the location screen)
//   getWeek(lat, lon)       → { days: [{ date, max, min, sunshineHours, daylightHours }] }
//
// We only ever send rounded coordinates (about 1 km), never a precise position.

import { FIXTURES } from './weatherFixtures.js'

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

const CACHE_MS = 3 * 60 * 60 * 1000 // weather doesn't change much in 3 hours
const cache = new Map() // "51.51,-0.13" → { at, week }

/** Round to 2 decimals (~1 km): what we store and what we send out */
export const round2 = (n) => Math.round(Number(n) * 100) / 100

/** City search for the location screen. Returns up to 5 places. */
export async function searchPlaces(query) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
  const response = await fetch(url)
  if (!response.ok) throw weatherError()
  const { results = [] } = await response.json()
  return results.map((r) => ({
    // "London, England, United Kingdom" (skipping any parts that are missing)
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    latitude: round2(r.latitude),
    longitude: round2(r.longitude),
  }))
}

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

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: 'temperature_2m_max,temperature_2m_min,sunshine_duration,daylight_duration',
    timezone: 'auto', // dates in the place's own time zone
    forecast_days: '7',
  })
  const response = await fetch(`${FORECAST_URL}?${params}`)
  if (!response.ok) throw weatherError()
  const { daily } = await response.json()

  const week = {
    days: daily.time.map((date, i) => ({
      date, // "2026-10-19"
      max: Math.round(daily.temperature_2m_max[i]),
      min: Math.round(daily.temperature_2m_min[i]),
      // Open-Meteo gives seconds; hours are easier to talk about
      sunshineHours: Math.round((daily.sunshine_duration[i] / 3600) * 10) / 10,
      daylightHours: Math.round((daily.daylight_duration[i] / 3600) * 10) / 10,
    })),
  }

  cache.set(key, { at: Date.now(), week })
  return week
}

function weatherError() {
  const error = new Error("We couldn't reach the weather service. Please try again in a bit.")
  error.status = 503
  return error
}
