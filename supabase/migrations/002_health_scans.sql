-- ════════════════════════════════════════════════════════════════════════════
-- Health scans
--   • health_scans  one row per "weekly health check" photo of a plant
--
-- The Node server sends the photo to Plant.id's health assessment, turns the
-- answer into a friendly summary, and stores it here. The health screen shows
-- the latest row for a plant.
--
-- Same security model as plants: the server talks to Supabase as the signed-in
-- user, so these RLS policies keep everyone inside their own scans.
-- ════════════════════════════════════════════════════════════════════════════

create table public.health_scans (
  id          uuid primary key default gen_random_uuid(),
  -- Deleting a plant deletes its scans too
  plant_id    uuid not null references public.plants(id) on delete cascade,
  -- Defaults to the caller, like plants.user_id
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,

  photo_url   text,                     -- the scanned photo in the plant-photos bucket
  score       integer not null check (score between 0 and 100),  -- 100 = perfectly healthy
  headline    text not null,            -- e.g. "A little TLC, a happy Miso."
  summary     text not null,            -- one or two plain sentences
  -- Possible problems, most likely first:
  --   [{ "name": "Water deficiency", "probability": 0.42, "description": "…" }]
  issues      jsonb not null default '[]'::jsonb,
  -- The "feel-better plan":
  --   [{ "icon": "drop", "title": "Check the soil…", "detail": "…" }]
  steps       jsonb not null default '[]'::jsonb,

  created_at  timestamptz not null default now()
);

-- "Latest scan for this plant" is the query we run most
create index health_scans_plant_created_idx on public.health_scans (plant_id, created_at desc);

alter table public.health_scans enable row level security;

-- Like the plants policy, plus one extra check on new rows: the plant must be
-- yours too, so nobody can attach a scan to someone else's plant.
-- (The plants table's own RLS also applies inside that sub-query.)
create policy "Users manage their own health scans"
  on public.health_scans for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.plants p where p.id = plant_id and p.user_id = auth.uid())
  );

-- RLS decides *which rows*; the role still needs permission to touch the table at all.
grant select, insert, update, delete on public.health_scans to authenticated;
