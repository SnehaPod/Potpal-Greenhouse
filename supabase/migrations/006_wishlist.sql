-- ════════════════════════════════════════════════════════════════════════════
-- Wishlist: plants from the Discover catalogue that a user wants to buy one day.
-- One row per (user, plant). Hearting a plant adds a row; un-hearting deletes it.
-- ════════════════════════════════════════════════════════════════════════════

create table public.wishlist (
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The catalogue plant. If it's ever removed from the catalogue, it leaves wishlists too.
  catalog_slug text not null references public.plant_catalog(slug) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, catalog_slug) -- can't save the same plant twice
);

alter table public.wishlist enable row level security;

create policy "Users manage their own wishlist"
  on public.wishlist for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, delete on public.wishlist to authenticated;
