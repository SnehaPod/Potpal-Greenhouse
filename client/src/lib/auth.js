// Tiny auth store: the current Supabase session, shared by every component.
//
//   import { auth, signIn, signUp, signOut } from '@/lib/auth.js'
//   auth.user        → the signed-in user, or null
//   auth.firstName   → for "Hey Jamie, let's grow."

import { reactive, computed } from 'vue'
import { supabase } from './supabase.js'
import { disablePush } from './push.js'

export const auth = reactive({
  session: null,
  ready: false, // becomes true once we've checked for a saved session
  oauthError: '', // set if the user came back from Google without signing in
  user: computed(() => auth.session?.user ?? null),
  firstName: computed(() => {
    const meta = auth.session?.user?.user_metadata ?? {}
    // Email sign-ups save first_name; Google gives us full_name ("Jamie Rivera")
    const name =
      meta.first_name || meta.full_name?.split(' ')[0] || auth.session?.user?.email?.split('@')[0] || 'friend'
    return name.charAt(0).toUpperCase() + name.slice(1)
  }),
})

/** Load any saved session and keep `auth.session` in sync from now on. */
export async function initAuth() {
  // Coming back from Google after "Cancel" (or another problem), Supabase adds
  // ?error_description=… or #error_description=… to the URL. Keep it to show on the log-in screen.
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
  if (params.get('error_description')) {
    auth.oauthError = `Google sign-in didn't finish: ${params.get('error_description')}`
    history.replaceState(null, '', window.location.pathname) // tidy the address bar
  }

  const { data } = await supabase.auth.getSession()
  auth.session = data.session
  auth.ready = true
  supabase.auth.onAuthStateChange((_event, session) => {
    auth.session = session
  })
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(email, password, firstName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Saved on the user so we can greet them by name (no profiles table needed)
    options: { data: { first_name: firstName } },
  })
  if (error) throw error
  // If the project requires email confirmation there's no session yet
  return { needsConfirmation: !data.session }
}

export async function signOut() {
  // Stop this phone's notifications first, so the next person to sign in here doesn't get them
  await disablePush().catch(() => {})
  await supabase.auth.signOut()
}

/**
 * "Continue with Google". The browser leaves for Google and comes back to the
 * app signed in. Google must be switched on in Supabase first (see README), so
 * we ask Supabase's public settings endpoint before sending anyone away.
 */
export async function signInWithGoogle() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).then((r) => r.json())
  if (!settings.external?.google) {
    throw new Error("Google sign-in isn't set up yet. Please use your email and password for now.")
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    // Trailing "/" so it matches the "…:5173/**" entries in supabase/config.toml
    options: { redirectTo: `${window.location.origin}/` },
  })
  if (error) throw error
}

/** "Forgot password?": email a link that opens /reset-password */
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

/** Set a new password (the reset link has already signed the user in) */
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}
