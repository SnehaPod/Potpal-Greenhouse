-- ════════════════════════════════════════════════════════════════════════════
-- Undo "watered": tapped by mistake? Put the plant back how it was.
--
-- Watering (POST /api/plants/:id/water) saves a snapshot of the three fields it
-- changes. Undo (POST /api/plants/:id/unwater) puts them back and clears the
-- snapshot, so it only works once, and only for the most recent watering.
--   { "last_watered_at": …, "next_water_due_at": …, "water_note": … }
-- The existing RLS policy on plants covers it: you can only undo your own.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plants add column undo_water jsonb;
