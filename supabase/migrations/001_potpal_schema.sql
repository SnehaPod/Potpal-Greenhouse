-- ════════════════════════════════════════════════════════════════════════════
-- Potpal schema
--   • plants        one row per plant a user has added to their "leafy crew"
--   • plant-photos  storage bucket for the photos users take in Identify
--
-- Security model: the Node server talks to Supabase *as the signed-in user*
-- (it forwards the user's JWT), so these row-level security (RLS) policies are
-- what stop one user from seeing or changing another user's plants.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Plants ───────────────────────────────────────────────────────────────────
create table public.plants (
  id                uuid primary key default gen_random_uuid(),
  -- Defaults to the caller, so inserts don't have to send it (and can't fake it: see policy below)
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- What the user calls it and where it lives
  nickname          text not null,
  room              text not null default 'Living room',

  -- What Plant.id told us about it
  species           text not null,          -- scientific name, e.g. "Monstera deliciosa"
  common_name       text,                   -- e.g. "Swiss cheese plant"
  description       text,
  photo_url         text,
  confidence        numeric,                -- 0–1 match probability from Plant.id
  light             text,                   -- e.g. "Bright, indirect"
  water_min_days    integer not null default 7,
  water_max_days    integer not null default 10,
  care_level        text,                   -- "Easy-going" / "A little attentive"
  toxicity          text,                   -- free text from Plant.id, null if unknown
  light_tips        text,                   -- Plant.id's longer advice, shown on the care plan
  watering_tips     text,

  -- Care tracking
  last_watered_at   timestamptz,
  next_water_due_at timestamptz not null default now(),  -- new plants: "Water today"

  -- Reminder settings from the care plan screen
  reminders_on      boolean not null default true,
  reminder_time     time not null default '09:00',
  ai_adjust         boolean not null default true,

  created_at        timestamptz not null default now()
);

create index plants_user_id_idx on public.plants (user_id);

alter table public.plants enable row level security;

-- One policy covers select / insert / update / delete:
--   using       → which existing rows you can see or change
--   with check  → what new/updated rows are allowed to look like
create policy "Users manage their own plants"
  on public.plants for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS decides *which rows*; the role still needs permission to touch the table at all.
grant select, insert, update, delete on public.plants to authenticated;

-- ─── Photo storage ────────────────────────────────────────────────────────────
-- Public bucket: photo URLs work in a plain <img> tag. File names are random
-- UUIDs, so they can't be guessed. Files are stored as "<user id>/<uuid>.jpg".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plant-photos', 'plant-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users upload photos to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete their own photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
