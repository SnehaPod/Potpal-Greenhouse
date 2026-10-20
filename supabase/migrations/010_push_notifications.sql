-- ════════════════════════════════════════════════════════════════════════════
-- Push notifications: watering reminders and hot / cold weather warnings.
--
--   • push_subscriptions   each phone that said "yes" to notifications
--   • plants.last_reminded_on, user_settings.weather_alerts_on, weather_pushes
--                          what was sent, so nothing repeats
--   • push_jobs / record_push_results
--                          the only way the reminder sender can read across users
--   • a pg_cron job        calls the Node server every 15 minutes
--
-- How the sender stays locked down: the Node server never has a service-role
-- key. Every 15 minutes it calls push_jobs() with a shared secret. That secret
-- lives in Supabase Vault (potpal_cron_secret) and in the server's CRON_SECRET,
-- never in git. A wrong or missing secret gets an error, and nothing else.
--
-- One-time setup (per database), in the SQL editor:
--   select vault.create_secret('https://<your app>', 'potpal_api_url');
--   select vault.create_secret('<same value as CRON_SECRET>', 'potpal_cron_secret');
-- Until both exist, the scheduled job quietly does nothing.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Phones that get notifications ──────────────────────────────────────────
-- A "subscription" is what the browser gives us when the user allows
-- notifications: an address at Google's push service plus two keys we use to
-- encrypt the message. One row per phone (or browser) per user.
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  time_zone   text not null default 'UTC', -- the phone's, e.g. "Asia/Kolkata": "09:00" means 9am there
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ─── What was sent ──────────────────────────────────────────────────────────
-- The local day of the last watering reminder, so each plant gets one a day
alter table public.plants add column last_reminded_on date;

-- Hot / cold warnings can be switched off on the Weather screen
alter table public.user_settings add column weather_alerts_on boolean not null default true;

-- Weather warnings sent, so the same kind isn't repeated within 3 days.
-- Users never read this directly: RLS is on with no policies and no grants.
create table public.weather_pushes (
  user_id  uuid not null references auth.users(id) on delete cascade,
  kind     text not null check (kind in ('heat', 'cold')),
  sent_at  timestamptz not null default now()
);

create index weather_pushes_user_idx on public.weather_pushes (user_id, sent_at);

alter table public.weather_pushes enable row level security;

-- ─── The secret check ───────────────────────────────────────────────────────
-- In a "private" schema, which Supabase's API doesn't expose.
create schema if not exists private;

create or replace function private.check_cron_secret(secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- No Vault secret yet? Then nothing matches, so nobody gets in.
  if secret is null or secret is distinct from (
    select decrypted_secret from vault.decrypted_secrets where name = 'potpal_cron_secret'
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.check_cron_secret(text) from public;

-- ─── What the sender needs to know ──────────────────────────────────────────
-- One entry per user with at least one phone subscribed. The Node server
-- (server/lib/reminders.js) decides who is actually due right now.
--
-- "security definer" runs it as the database owner, so it can read across
-- users. That's exactly why it checks the secret first, and returns only what
-- notifications need.
create or replace function public.push_jobs(secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(secret);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', u.user_id,
      -- The most recently subscribed phone decides the user's time zone
      'time_zone', (
        select s.time_zone from public.push_subscriptions s
        where s.user_id = u.user_id order by s.created_at desc limit 1
      ),
      'subscriptions', (
        select jsonb_agg(jsonb_build_object(
          'endpoint', s.endpoint,
          'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)
        ))
        from public.push_subscriptions s where s.user_id = u.user_id
      ),
      -- Every plant: watering needs the due ones, weather warnings name them all
      'plants', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'nickname', p.nickname,
          'light', p.light,
          'next_water_due_at', p.next_water_due_at,
          'reminders_on', p.reminders_on,
          'reminder_time', p.reminder_time,
          'last_reminded_on', p.last_reminded_on
        ) order by p.created_at)
        from public.plants p where p.user_id = u.user_id
      ), '[]'::jsonb),
      -- Where they live, if they've told us and want weather warnings
      'place', (
        select jsonb_build_object('latitude', us.latitude, 'longitude', us.longitude)
        from public.user_settings us
        where us.user_id = u.user_id and us.weather_alerts_on
      ),
      'weather_pushes', coalesce((
        select jsonb_agg(jsonb_build_object('kind', w.kind, 'sent_at', w.sent_at))
        from public.weather_pushes w
        where w.user_id = u.user_id and w.sent_at > now() - interval '3 days'
      ), '[]'::jsonb)
    ))
    from (select distinct user_id from public.push_subscriptions) u
  ), '[]'::jsonb);
end;
$$;

-- What was sent, so it isn't sent again:
--   { "reminded": [{ "plant_id": "…", "on": "2026-10-21" }],
--     "weather":  [{ "user_id": "…", "kind": "heat" }],
--     "gone":     ["https://fcm.googleapis.com/…"] }   phones that unsubscribed
create or replace function public.record_push_results(secret text, results jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_cron_secret(secret);

  update public.plants p
  set last_reminded_on = (r ->> 'on')::date
  from jsonb_array_elements(coalesce(results -> 'reminded', '[]'::jsonb)) r
  where p.id = (r ->> 'plant_id')::uuid;

  insert into public.weather_pushes (user_id, kind)
  select (w ->> 'user_id')::uuid, w ->> 'kind'
  from jsonb_array_elements(coalesce(results -> 'weather', '[]'::jsonb)) w;

  delete from public.push_subscriptions
  where endpoint in (select jsonb_array_elements_text(coalesce(results -> 'gone', '[]'::jsonb)));
end;
$$;

-- The server calls these without a signed-in user (as "anon"). The secret is the lock.
revoke all on function public.push_jobs(text) from public;
revoke all on function public.record_push_results(text, jsonb) from public;
grant execute on function public.push_jobs(text) to anon;
grant execute on function public.record_push_results(text, jsonb) to anon;

-- ─── Every 15 minutes: "send any reminders that are due" ────────────────────
-- pg_cron runs the schedule; pg_net makes the web request. The address and the
-- secret come from Vault, so neither lives in git. If they're not set up yet,
-- the select finds no rows and nothing is sent.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'potpal-reminders',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := api.decrypted_secret || '/api/cron/reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || secret.decrypted_secret,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000 -- a sleeping Render server takes a while to wake
    )
    from vault.decrypted_secrets api, vault.decrypted_secrets secret
    where api.name = 'potpal_api_url' and secret.name = 'potpal_cron_secret'
  $job$
);
