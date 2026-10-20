// requireUser: Express middleware that only lets signed-in users through.
//
// The Vue app sends   Authorization: Bearer <supabase access token>
// We ask Supabase who that token belongs to. If it's valid we attach:
//   req.user      the Supabase user ({ id, email, user_metadata, … })
//   req.supabase  a Supabase client acting as that user (RLS applies)

import { supabaseForUser } from '../lib/supabase.js'

export async function requireUser(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

  if (!token) {
    return res.status(401).json({ error: 'Please sign in first.' })
  }

  const supabase = supabaseForUser(token)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data?.user) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }

  req.user = data.user
  req.supabase = supabase
  next()
}
