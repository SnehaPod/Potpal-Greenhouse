-- ════════════════════════════════════════════════════════════════════════════
-- Weather-aware care ("This week" early warnings)
--   • user_settings     where the user lives, so we can read their local weather
--   • plants.water_note why the next watering date was moved (if it was)
--
-- Privacy: we only keep a place name and coordinates rounded to 2 decimals
-- (about 1 km), never a precise GPS fix. Users can remove it at any time.
-- ════════════════════════════════════════════════════════════════════════════

create table public.user_settings (
  -- One row per user. Defaults to the caller, so the app never sends a user id.
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  place_name  text not null,                -- e.g. "London, England" or "Current location"
  latitude    numeric(6, 2) not null check (latitude between -90 and 90),
  longitude   numeric(6, 2) not null check (longitude between -180 and 180),
  updated_at  timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users manage their own settings"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.user_settings to authenticated;

-- A short, human explanation shown under the watering status, e.g.
-- "Brought forward 2 days: hot week ahead (34°C on Thursday)."
alter table public.plants add column water_note text;
