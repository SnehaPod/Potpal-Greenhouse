// Notifications on this phone (the signed-in user's own subscriptions).
//
//   GET    /api/push/key             the public key the app subscribes with
//   POST   /api/push/subscriptions   save this phone: { subscription, timeZone }
//   DELETE /api/push/subscriptions   forget this phone: { endpoint }
//   POST   /api/push/test            send "Test from Potpal" to my phones
//
// Runs as the signed-in user, so RLS keeps everyone to their own phones.
// The scheduled reminders themselves are sent by routes/cron.js.

import { Router } from 'express'
import { pushConfigured, vapidPublicKey, sendPush } from '../lib/push.js'

const router = Router()

const notReady = (res) => res.status(503).json({ error: "Notifications aren't set up on the server yet." })

/** "Asia/Kolkata" if it's a real time zone, otherwise "UTC" */
function validTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

router.get('/key', (_req, res) => {
  if (!pushConfigured) return notReady(res)
  res.json({ key: vapidPublicKey() })
})

router.post('/subscriptions', async (req, res) => {
  const { subscription, timeZone } = req.body ?? {}
  const { endpoint, keys } = subscription ?? {}
  if (!endpoint?.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "That doesn't look like a notification subscription." })
  }

  const { error } = await req.supabase.from('push_subscriptions').upsert(
    {
      user_id: req.user.id, // RLS also checks this matches the signed-in user
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      time_zone: validTimeZone(timeZone), // so "09:00" means 9am where this phone is
    },
    { onConflict: 'user_id,endpoint' }, // the same phone again: just refresh it
  )
  if (error) throw error
  res.status(204).end()
})

router.delete('/subscriptions', async (req, res) => {
  const endpoint = req.body?.endpoint
  if (!endpoint) return res.status(400).json({ error: 'Which phone? (missing endpoint)' })
  const { error } = await req.supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
  res.status(204).end()
})

router.post('/test', async (req, res) => {
  if (!pushConfigured) return notReady(res)
  const { data: phones, error } = await req.supabase.from('push_subscriptions').select('endpoint, p256dh, auth')
  if (error) throw error
  if (!phones.length) return res.status(400).json({ error: 'Turn on notifications on this phone first.' })

  const message = {
    title: 'Test from Potpal 🌱',
    body: "Notifications work! We'll nudge you when your plants are thirsty.",
    url: '/',
    tag: 'test',
  }
  const outcomes = await Promise.all(
    phones.map((p) => sendPush({ endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } }, message)),
  )

  // Forget phones that have unsubscribed
  const gone = phones.filter((_, i) => outcomes[i] === 'gone').map((p) => p.endpoint)
  if (gone.length) await req.supabase.from('push_subscriptions').delete().in('endpoint', gone)

  const sent = outcomes.filter((o) => o === 'sent').length
  if (!sent) return res.status(502).json({ error: "We couldn't reach your phone. Try turning notifications off and on again." })
  res.json({ sent })
})

export default router
