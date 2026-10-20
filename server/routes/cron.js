// POST /api/cron/reminders: send the notifications that are due right now.
//
// Called every 15 minutes by a Supabase scheduled job (pg_cron, migration 010),
// with  Authorization: Bearer <CRON_SECRET>.  Nobody else can call it.
//
// For each user with a phone subscribed:
//   • watering: plants due today, once their reminder time has passed (one notification)
//   • weather:  hot days or cold nights coming up, at most once per kind every 3 days
// The rules live in lib/reminders.js. Afterwards we record what was sent, so it
// isn't sent again, and forget phones that have unsubscribed.
//
// Add ?dryRun=1 to see what *would* be sent, without sending or recording anything.

import { Router } from 'express'
import { supabaseAnon } from '../lib/supabase.js'
import { pushConfigured, sendPush } from '../lib/push.js'
import { wateringPush, weatherPush } from '../lib/reminders.js'
import { getWeek } from '../lib/weather.js'

const router = Router()

router.post('/reminders', async (req, res) => {
  // .trim(): a space or line break pasted into Render's settings shouldn't lock the job out
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Not allowed.' })
  }
  if (!pushConfigured) return res.status(503).json({ error: 'VAPID keys are not set.' })

  const dryRun = req.query.dryRun === '1'
  const supabase = supabaseAnon()
  const now = new Date()

  // Everyone with a phone subscribed, with their plants (secret-locked database function)
  const { data: jobs, error } = await supabase.rpc('push_jobs', { secret })
  if (error) throw error

  const results = { reminded: [], weather: [], gone: [] } // for record_push_results
  const summary = { users: jobs.length, wateringSent: 0, weatherSent: 0, gone: 0, failed: 0 }
  const planned = [] // dry run only

  for (const job of jobs) {
    const watering = wateringPush(job, now)
    // The week's weather, only for people with a saved place (cached per place for 3 hours)
    const week = job.place ? await getWeek(job.place.latitude, job.place.longitude).catch(() => null) : null
    const weather = weatherPush(job, week, now)
    const messages = [watering, weather].filter(Boolean)

    if (dryRun) {
      if (messages.length) planned.push({ user_id: job.user_id, time_zone: job.time_zone, messages })
      continue
    }

    for (const message of messages) {
      const { title, body, url, tag } = message
      const outcomes = await Promise.all(job.subscriptions.map((phone) => sendPush(phone, { title, body, url, tag })))

      job.subscriptions.forEach((phone, i) => outcomes[i] === 'gone' && results.gone.push(phone.endpoint))
      summary.gone += outcomes.filter((o) => o === 'gone').length
      summary.failed += outcomes.filter((o) => o === 'failed').length

      // Only count it as sent if it reached at least one phone; otherwise try again next time
      if (!outcomes.includes('sent')) continue
      if (message === watering) {
        summary.wateringSent++
        for (const plantId of watering.plantIds) results.reminded.push({ plant_id: plantId, on: watering.on })
      } else {
        summary.weatherSent++
        for (const kind of weather.kinds) results.weather.push({ user_id: job.user_id, kind })
      }
    }
  }

  if (dryRun) return res.json({ dryRun: true, users: jobs.length, planned })

  const { error: recordError } = await supabase.rpc('record_push_results', { secret, results })
  if (recordError) throw recordError

  if (summary.wateringSent || summary.weatherSent || summary.gone || summary.failed) {
    console.log('🔔 Reminders:', JSON.stringify(summary))
  }
  res.json(summary)
})

export default router
