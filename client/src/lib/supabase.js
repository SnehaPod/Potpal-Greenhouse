// Supabase in the browser is used for one thing only: signing in.
// It remembers the session (in localStorage) and refreshes the access token,
// which we then send to our Node server with every API call.
// All plant data goes through the server (see api.js).

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in client/.env (see client/.env.example)')
}

export const supabase = createClient(url, anonKey)
