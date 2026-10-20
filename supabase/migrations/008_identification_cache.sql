-- ════════════════════════════════════════════════════════════════════════════
-- Identification cache: remember what a photo was identified as, so trying
-- the exact same photo again is instant and costs no API credits.
--
-- Keyed by the photo's SHA-256 fingerprint (identical bytes → identical hash).
-- Per user on purpose: a cache shared between users could be filled with wrong
-- answers by anyone holding the app's public anon key.
-- ════════════════════════════════════════════════════════════════════════════

create table public.identification_cache (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  photo_hash text not null,          -- SHA-256 of the photo bytes, as hex
  result     jsonb not null,         -- { isPlant, suggestions: [...] }
  source     text not null check (source in ('plantid', 'plantnet')),
  created_at timestamptz not null default now(),
  primary key (user_id, photo_hash)
);

alter table public.identification_cache enable row level security;

create policy "Users manage their own identification cache"
  on public.identification_cache for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.identification_cache to authenticated;
