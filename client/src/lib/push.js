// Notifications on this phone: watering reminders and hot / cold warnings.
//
//   push.status       'unknown' | 'on' | 'off' | 'blocked' | 'unsupported'  (shared by every screen)
//   refreshPush()     works out the status (and quietly re-saves this phone if it's on)
//   enablePush()      asks permission, subscribes this phone, saves it on the server
//   disablePush()     forgets this phone (on sign-out too)
//   sendTestPush()    "Test from Potpal" to my phones
//
// How it works: the browser (Chrome, inside the Potpal app) gives us a
// "subscription" for this phone. The server keeps it and, every 15 minutes,
// sends whatever is due (server/routes/cron.js). The service worker
// (public/sw.js) shows the notification.

import { reactive } from 'vue'
import { getPushKey, savePushSubscription, deletePushSubscription, testPush } from './api.js'

export const push = reactive({ status: 'unknown' })

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** The service worker, registering it if needed (the built app already does this in main.js) */
async function worker() {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

/** This phone's current subscription, if any (without asking for anything) */
async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration()
  return registration?.pushManager.getSubscription() ?? null
}

/** The phone's time zone, e.g. "Asia/Kolkata", so "09:00" means 9am here */
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export async function refreshPush() {
  if (!pushSupported()) return (push.status = 'unsupported')
  if (Notification.permission === 'denied') return (push.status = 'blocked')

  const subscription = Notification.permission === 'granted' ? await currentSubscription() : null
  push.status = subscription ? 'on' : 'off'
  // Keep the server up to date (e.g. after travelling to another time zone). Nice to have.
  if (subscription) savePushSubscription(subscription.toJSON(), timeZone()).catch(() => {})
  return push.status
}

export async function enablePush() {
  if (!pushSupported()) return (push.status = 'unsupported')

  // Android shows its "Allow Potpal to send you notifications?" prompt here
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return (push.status = permission === 'denied' ? 'blocked' : 'off')

  const registration = await worker()
  const { key } = await getPushKey()
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(key) }))

  await savePushSubscription(subscription.toJSON(), timeZone())
  return (push.status = 'on')
}

export async function disablePush() {
  if (!pushSupported()) return
  const subscription = await currentSubscription()
  if (!subscription) return
  await deletePushSubscription(subscription.endpoint).catch(() => {}) // signed out already? still unsubscribe
  await subscription.unsubscribe()
  push.status = 'off'
}

export const sendTestPush = () => testPush()

/** The server's key comes as URL-safe base64; the browser wants raw bytes */
function base64ToBytes(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}
