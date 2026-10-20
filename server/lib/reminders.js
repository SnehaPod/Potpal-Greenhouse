// Who gets a notification right now? The rules for push notifications.
//
// Every 15 minutes the reminder job (routes/cron.js) gets one "job" per user
// from the database (push_jobs in migration 010):
//   { user_id, time_zone, subscriptions, plants, place, weather_pushes }
// and asks these functions what, if anything, to send. They're pure (no
// database, no network), so they're easy to read and to test.
//
//   localNow(timeZone, now)          → { date: '2026-10-21', minutes: 545 }  (09:05)
//   wateringPush(job, now)           → one "time to water" notification, or null
//   weatherPush(job, week, now)      → one hot / cold weather warning, or null

import { joinNames, buildAlerts, groupAlerts } from './forecast.js'

export const PUSH_RULES = {
  weatherFrom: 8 * 60, //            weather warnings from 08:00 local time, never at night
  weatherRepeatDays: 3, //           the same kind of weather at most once every 3 days (enforced in SQL)
  weatherKinds: ['heat', 'cold'], // a "darker week" stays in the app, not on the lock screen
}

/** The date and time of day where the user is (falls back to UTC if the zone is unknown) */
export function localNow(timeZone, now = new Date()) {
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
  } catch {
    return localNow('UTC', now) // e.g. a time zone name this server doesn't know
  }
  const get = (type) => parts.find((p) => p.type === type).value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

/** "09:30:00" → 570 */
const toMinutes = (time) => {
  const [hours, minutes] = String(time || '09:00').split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Plants to remind about now, combined into one notification.
 * A plant is included when its reminders are on, it's due today (or overdue)
 * where the user lives, its reminder time has passed, and it hasn't had a
 * reminder yet today. "Has passed" rather than "is exactly now", so a late or
 * missed run sends late instead of not at all.
 * @returns { title, body, url, tag, plantIds, on } or null
 */
export function wateringPush(job, now = new Date()) {
  const { date, minutes } = localNow(job.time_zone, now)

  const due = (job.plants ?? []).filter(
    (plant) =>
      plant.reminders_on &&
      plant.last_reminded_on !== date &&
      localNow(job.time_zone, new Date(plant.next_water_due_at)).date <= date &&
      toMinutes(plant.reminder_time) <= minutes,
  )
  if (!due.length) return null

  const one = due.length === 1
  return {
    title: `Time to water ${joinNames(due.map((p) => p.nickname))} 💧`,
    body: one
      ? 'Check the soil first: water if the top few centimetres feel dry.'
      : 'Check each one’s soil first: water if the top few centimetres feel dry.',
    url: one ? `/plants/${due[0].id}` : '/', // one plant opens its care plan
    tag: 'watering', // a newer watering reminder replaces an older one
    plantIds: due.map((p) => p.id),
    on: date, // saved as last_reminded_on
  }
}

/**
 * A hot-days or cold-nights warning for the coming week, if there's a new one.
 * Uses the same rules and wording as the "This week" card (forecast.js).
 * @param week  getWeek() for the user's place
 * @returns { title, body, url, tag, kinds } or null
 */
export function weatherPush(job, week, now = new Date()) {
  if (!job.place || !week) return null // no saved place, or warnings switched off
  if (localNow(job.time_zone, now).minutes < PUSH_RULES.weatherFrom) return null

  const recent = new Set((job.weather_pushes ?? []).map((w) => w.kind))
  const groups = groupAlerts(buildAlerts(job.plants ?? [], week)).filter(
    (group) => PUSH_RULES.weatherKinds.includes(group.kind) && !recent.has(group.kind),
  )
  if (!groups.length) return null

  // Usually one kind. A week with both gets one notification naming both.
  const both = groups.length > 1
  return {
    title: both ? 'Hot days and cold nights ahead' : groups[0].title,
    body: both ? groups.map((g) => `${g.title}.`).join(' ') + ' Open Potpal for what to do.' : groups[0].detail,
    url: '/',
    tag: 'weather',
    kinds: groups.map((g) => g.kind),
  }
}
