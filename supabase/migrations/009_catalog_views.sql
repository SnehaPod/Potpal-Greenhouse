-- ════════════════════════════════════════════════════════════════════════════
-- Catalogue visits: how often each user has opened each Discover plant.
--
-- Discover uses this to keep suggestions fresh: plants you've opened a lot
-- sink down the list, and ones you've never opened get a little boost and a
-- "New to you" label (see rankForYou in client/src/lib/catalog.js).
--
-- Only the last 30 days count: a visit after a long gap starts the count again.
-- ════════════════════════════════════════════════════════════════════════════

create table public.catalog_views (
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  catalog_slug   text not null references public.plant_catalog(slug) on delete cascade,
  view_count     integer not null default 1 check (view_count > 0),
  last_viewed_at timestamptz not null default now(),
  primary key (user_id, catalog_slug)
);

alter table public.catalog_views enable row level security;

create policy "Users manage their own catalogue visits"
  on public.catalog_views for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.catalog_views to authenticated;

-- One more visit to a plant. Supabase's API can't say "add 1" directly, so this
-- small function does it in one step. "security invoker" means it runs as the
-- signed-in user, so the RLS policy above still applies.
create or replace function public.record_catalog_view(slug text)
returns void
language sql
security invoker
as $$
  insert into public.catalog_views (catalog_slug) values (slug)
  on conflict (user_id, catalog_slug) do update set
    -- Last visit over 30 days ago? Start counting again.
    view_count = case
      when public.catalog_views.last_viewed_at < now() - interval '30 days' then 1
      else public.catalog_views.view_count + 1
    end,
    last_viewed_at = now();
$$;

grant execute on function public.record_catalog_view(text) to authenticated;
