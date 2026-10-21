-- ════════════════════════════════════════════════════════════════════════════
-- Photo credits on a user's plant.
--
-- A plant added by name (no photo of its own) gets a free photo of its species
-- from iNaturalist or Wikimedia Commons. Their licences ask for a credit
-- wherever the photo is shown, so we keep it with the plant. Same columns as
-- plant_catalog (migration 007), so the app's PhotoCredit component works for both.
-- Photos people take themselves have none of these, and show no credit.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plants
  add column image_author      text, -- e.g. "Sue Carnahan"
  add column image_licence     text, -- e.g. "CC BY 4.0"
  add column image_licence_url text,
  add column image_source_url  text, -- the photo's own page
  add column image_via         text; -- "iNaturalist" or "Wikimedia Commons"
