// "This week" early warnings: simple, explainable rules that look at the coming
// week's local weather and each plant's own care data.
//
// No AI and no guesswork. Every warning says *why* in terms of the forecast
// numbers and the plant itself, so people can judge it for themselves.
//
//   buildAlerts(plants, week)  → the warnings to show
//   waterShift(plant, week)    → how far to move the next watering, and why
//
// `week` comes from getWeek() in weather.js:
//   { days: [{ date, max, min, sunshineHours, daylightHours }] }

// The thresholds, in one place so they're easy to tune
export const RULES = {
  hotDay: 30, //       °C: a day this hot dries soil fast and can scorch leaves near glass
  coldNight: 5, //     °C: cold enough that windowsills and drafts get risky
  darkSunshine: 2, //  hours of sun a day, on average, below which soil dries slowly
  darkDaylight: 10, // hours of daylight a day, on average (short winter days)
  shiftDays: 2, //     how far we move a watering, earlier or later
  minInterval: 2, //   never suggest watering more often than every 2 days
}

/** "Thursday" from "2026-10-22" (noon, so time zones can't change the day) */
const weekday = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })

const average = (numbers) => numbers.reduce((sum, n) => sum + n, 0) / numbers.length

/** "1 day" / "2 days" */
const days = (n) => `${n} day${n === 1 ? '' : 's'}`

/** What's notable about this week? Shared by both functions below. */
export function readWeek(week) {
  const days = week?.days ?? []
  if (!days.length) return { hot: null, cold: null, dark: null }

  const hottest = days.reduce((a, b) => (b.max > a.max ? b : a))
  const coldest = days.reduce((a, b) => (b.min < a.min ? b : a))
  const sun = average(days.map((d) => d.sunshineHours))
  const daylight = average(days.map((d) => d.daylightHours))

  return {
    hot: hottest.max >= RULES.hotDay ? { temp: hottest.max, day: weekday(hottest.date) } : null,
    cold: coldest.min <= RULES.coldNight ? { temp: coldest.min, day: weekday(coldest.date) } : null,
    dark:
      sun < RULES.darkSunshine || daylight < RULES.darkDaylight
        ? { sun: Math.round(sun * 10) / 10, daylight: Math.round(daylight * 10) / 10 }
        : null,
  }
}

/**
 * The warnings for this week, one per plant per kind of weather.
 * @returns [{ plantId, nickname, kind, title, detail, why, waterShiftDays }]
 */
export function buildAlerts(plants, week) {
  const { hot, cold, dark } = readWeek(week)
  const alerts = []

  for (const plant of plants) {
    const name = plant.nickname
    const light = (plant.light || 'bright, indirect').toLowerCase()

    if (hot) {
      const sunLover = light === 'full sun'
      alerts.push({
        plantId: plant.id,
        nickname: name,
        kind: 'heat',
        title: `Hot days ahead for ${name}`,
        detail: sunLover
          ? 'Check the soil a day or two sooner than usual.'
          : 'Check the soil a day or two sooner, and pull it back from sunny glass.',
        why: `${hot.day} reaches ${hot.temp}°C. Soil dries faster in the heat${
          sunLover ? '' : `, and ${name} prefers ${light} light, so hot glass can scorch its leaves`
        }.`,
        waterShiftDays: -RULES.shiftDays,
      })
    }

    if (cold) {
      alerts.push({
        plantId: plant.id,
        nickname: name,
        kind: 'cold',
        title: `Cold nights ahead for ${name}`,
        detail: 'Keep its leaves off cold windows and away from drafty doors.',
        why: `${cold.day} night drops to ${cold.temp}°C. Most houseplants come from the tropics, and leaves touching cold glass can get damaged.`,
        waterShiftDays: 0,
      })
    }

    // A dark week matters less than a hot one, so skip it if both happen
    if (dark && !hot) {
      alerts.push({
        plantId: plant.id,
        nickname: name,
        kind: 'dark',
        title: `A darker week for ${name}`,
        detail: 'Soil dries slower in low light. Check before watering, and wait if it still feels damp.',
        why: `Only ${dark.sun} hours of sunshine a day this week, with ${dark.daylight} hours of daylight. ${name} will drink less than usual.`,
        waterShiftDays: RULES.shiftDays,
      })
    }
  }

  return alerts
}

// ─── Grouping for the home screen ─────────────────────────────────────────────
// The same weather hits every plant, so the home screen shows one row per kind
// of weather ("Hot days ahead for Miso, Mochi and Olive") instead of one per plant.
// Each plant's care plan still shows its own warning and its own "why".

const GROUP_LABELS = { heat: 'Hot days ahead', cold: 'Cold nights ahead', dark: 'A darker week' }

// Advice worded for several plants at once
const GROUP_DETAILS = {
  heat: 'Check the soil a day or two sooner, and pull sun-shy plants back from sunny glass.',
  cold: 'Keep leaves off cold windows and away from drafty doors.',
  dark: 'Soil dries slower in low light. Check before watering, and wait if it still feels damp.',
}

/** "Miso", "Miso and Mochi", "Miso, Mochi and Olive", "Miso, Mochi and 3 more" */
export function joinNames(names) {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

/**
 * Combine per-plant warnings into one per kind of weather.
 * @returns [{ kind, title, detail, plants: [{ id, nickname }] }]  (in the order the kinds first appear)
 */
export function groupAlerts(alerts) {
  const groups = new Map()
  for (const alert of alerts) {
    if (!groups.has(alert.kind)) groups.set(alert.kind, [])
    groups.get(alert.kind).push(alert)
  }

  return [...groups].map(([kind, list]) => ({
    kind,
    title: `${GROUP_LABELS[kind]} for ${joinNames(list.map((a) => a.nickname))}`,
    // One plant keeps its own advice; several get the advice worded for a group
    detail: list.length === 1 ? list[0].detail : GROUP_DETAILS[kind],
    plants: list.map((a) => ({ id: a.plantId, nickname: a.nickname })),
  }))
}

/**
 * When the user marks a plant as watered (and "Let AI adjust the timing" is on),
 * how many days until the next watering, and why?
 * @returns { intervalDays, note }  note is null when nothing changed
 */
export function waterShift(plant, week) {
  const usual = plant.water_min_days
  const { hot, dark } = readWeek(week)

  if (hot) {
    const intervalDays = Math.max(RULES.minInterval, usual - RULES.shiftDays)
    if (intervalDays === usual) return { intervalDays, note: null }
    return {
      intervalDays,
      note: `Brought forward ${days(usual - intervalDays)}: hot week ahead (${hot.temp}°C on ${hot.day}).`,
    }
  }

  if (dark) {
    const intervalDays = Math.min(plant.water_max_days, usual + RULES.shiftDays)
    if (intervalDays === usual) return { intervalDays, note: null }
    return {
      intervalDays,
      note: `Pushed back ${days(intervalDays - usual)}: darker week ahead (${dark.sun} hours of sun a day).`,
    }
  }

  return { intervalDays: usual, note: null }
}
