// Sending push notifications with the standard Web Push protocol.
//
// The phone's browser (Chrome, inside the Potpal app) gives us a "subscription":
// an address at its push service plus two keys. We encrypt each message and
// sign the request with our VAPID keys, so the push service knows it's really
// us. The `web-push` library does all of that.
//
// Settings (server/.env, or Render's Environment):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   generate once with: npx web-push generate-vapid-keys
//   VAPID_SUBJECT                         how push services can contact us (a mailto: or https: address)
//
//   pushConfigured                        false until both keys are set
//   sendPush(subscription, message)       → 'sent' | 'gone' | 'failed'

import webpush from 'web-push'

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'https://potpal-greenhouse.onrender.com'

export const pushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
if (pushConfigured) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

/** The public key the app needs to subscribe (safe to share), or null */
export const vapidPublicKey = () => VAPID_PUBLIC_KEY ?? null

/**
 * Send one notification to one phone.
 * @param subscription  { endpoint, keys: { p256dh, auth } }
 * @param message       { title, body, url, tag }  (shown by client/public/sw.js)
 * @returns 'sent', 'gone' (the phone unsubscribed: forget it) or 'failed' (try again later)
 */
export async function sendPush(subscription, message) {
  try {
    // TTL: if the phone is off, the push service keeps it for up to 12 hours
    await webpush.sendNotification(subscription, JSON.stringify(message), { TTL: 12 * 60 * 60 })
    return 'sent'
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) return 'gone'
    console.error('Push failed:', error.statusCode ?? '', error.body || error.message)
    return 'failed'
  }
}
