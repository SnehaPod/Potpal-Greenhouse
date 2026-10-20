// Supabase helpers for the server.
//
// We never use the all-powerful "service role" key here. Instead every request
// gets its own Supabase client that carries the *user's* access token. That way
// Postgres row-level security sees the real user, and the database itself
// guarantees people only touch their own plants.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in server/.env (see server/.env.example)')
}

/**
 * Create a Supabase client that acts as the user who owns `accessToken`.
 */
export function supabaseForUser(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    // The server doesn't keep sessions; the browser does.
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * A client with no user at all. Only the reminder job uses it, to call the two
 * secret-locked functions in migration 010 (push_jobs, record_push_results).
 * As "anon" it can't read any table directly: RLS sees no user.
 */
export function supabaseAnon() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
