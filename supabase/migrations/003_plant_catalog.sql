-- ════════════════════════════════════════════════════════════════════════════
-- Plant catalogue — the plants shown on the Discover tab.
--
-- This is shared, read-only reference data: the same ~20 common houseplants for
-- everyone, with real care numbers. Unlike `plants` (each user's own crew), no
-- one owns these rows, so anyone signed in can read them but no one can change
-- them from the app. Edit them in Supabase Studio, or add a new migration.
-- ════════════════════════════════════════════════════════════════════════════

create table public.plant_catalog (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,          -- used in the URL: /discover/<slug>
  common_name     text not null,
  scientific_name text not null,

  -- Short editorial copy shown on the cards and detail screen
  tagline         text not null,                 -- one green line on the card
  blurb           text not null,                 -- the lead paragraph
  care_tip        text not null,                 -- the "a little love" tip

  -- Care facts (used both to show, and to match against the user's room)
  light           text not null                  -- must be one of the Discover light chips
                    check (light in ('Low', 'Medium', 'Bright, indirect')),
  water_min_days  integer not null,
  water_max_days  integer not null,
  humidity_min    integer not null,
  humidity_max    integer not null,
  care_level      text not null
                    check (care_level in ('Easy-going', 'A little attentive')),
  pet_safe        boolean not null,              -- safe around cats and dogs?
  min_height_cm   integer not null,
  max_height_cm   integer not null,

  image_url       text,                          -- null → the app shows a leafy placeholder
  sort_order      integer not null default 0
);

alter table public.plant_catalog enable row level security;

-- Everyone signed in may read the catalogue; no one may change it from the app.
create policy "Anyone can read the plant catalogue"
  on public.plant_catalog for select
  to authenticated, anon
  using (true);

grant select on public.plant_catalog to authenticated, anon;

-- ─── Seed: 20 common houseplants ──────────────────────────────────────────────
-- Care numbers are typical indoor guidance; the app always reminds people that
-- their plant's soil has the final say. Apostrophes are doubled for SQL.
insert into public.plant_catalog
  (slug, common_name, scientific_name, tagline, blurb, care_tip,
   light, water_min_days, water_max_days, humidity_min, humidity_max,
   care_level, pet_safe, min_height_cm, max_height_cm, image_url, sort_order)
values
  ('monstera-deliciosa', 'Monstera deliciosa', 'Monstera deliciosa',
   'Big, splity leaves with a wild side.',
   'Those iconic split leaves love room to climb, and the plant grows right along with you.',
   'Let the top 2–3 cm of soil dry out, and give it something to climb for bigger leaves.',
   'Bright, indirect', 7, 10, 50, 60, 'Easy-going', false, 100, 300, '/images/monstera-identified.webp', 1),

  ('golden-pothos', 'Golden pothos', 'Epipremnum aureum',
   'The trailing vine that forgives almost anything.',
   'Fast, forgiving and happy to trail from a shelf in almost any light.',
   'Let it dry out between waterings, and trim long vines to keep it bushy.',
   'Low', 7, 14, 40, 50, 'Easy-going', false, 30, 200, '/images/pip-home.webp', 2),

  ('snake-plant', 'Snake plant', 'Dracaena trifasciata',
   'Nearly unkillable architectural spears.',
   'Upright, sculptural and happy to be left alone for weeks at a time.',
   'Water sparingly, only when the soil is fully dry. Overwatering is the one real risk.',
   'Low', 14, 21, 30, 40, 'Easy-going', false, 30, 120, null, 3),

  ('zz-plant', 'ZZ plant', 'Zamioculcas zamiifolia',
   'Glossy, low-light, low-effort.',
   'Waxy green leaves that shrug off low light and the odd missed watering.',
   'Let the soil dry fully. It stores water in its roots, so less is more.',
   'Low', 14, 21, 30, 40, 'Easy-going', false, 45, 90, null, 4),

  ('peace-lily', 'Peace lily', 'Spathiphyllum wallisii',
   'Elegant white blooms in shadier spots.',
   'Glossy leaves and white flowers that are happy out of direct sun.',
   'It droops to tell you it''s thirsty, then perks back up soon after a drink.',
   'Medium', 5, 7, 50, 60, 'A little attentive', false, 40, 100, null, 5),

  ('spider-plant', 'Spider plant', 'Chlorophytum comosum',
   'Arching stripes and baby spiderettes.',
   'An easy classic that sends out little plantlets you can pot up and share.',
   'Let the top of the soil dry between waterings. Brown tips? Try filtered water.',
   'Bright, indirect', 7, 10, 40, 50, 'Easy-going', true, 30, 60, null, 6),

  ('parlor-palm', 'Parlor palm', 'Chamaedorea elegans',
   'A soft, feathery friend for cosy corners.',
   'Delicate fronds that bring a calm, tropical feel to lower-light rooms.',
   'Keep lightly moist and away from cold drafts. Brown tips mean the air is too dry.',
   'Medium', 7, 10, 40, 50, 'Easy-going', true, 60, 120, '/images/parlor-palm.webp', 7),

  ('calathea-orbifolia', 'Calathea orbifolia', 'Goeppertia orbifolia',
   'Big round leaves with silvery stripes.',
   'Soft stripes and a lush, pet-friendly presence for a bright corner.',
   'Keep lightly moist with filtered water and high humidity for happy stripes.',
   'Bright, indirect', 5, 7, 50, 60, 'A little attentive', true, 60, 90, '/images/calathea-match.webp', 8),

  ('peperomia-obtusifolia', 'Peperomia obtusifolia', 'Peperomia obtusifolia',
   'Chunky glossy leaves, shelf-sized.',
   'Compact, glossy and perfectly content on a bright shelf.',
   'Its thick leaves store water, so it would rather be a little dry than too wet.',
   'Bright, indirect', 10, 14, 40, 50, 'Easy-going', true, 25, 30, '/images/peperomia.webp', 9),

  ('boston-fern', 'Boston fern', 'Nephrolepis exaltata',
   'Lush, feathery and pet-safe.',
   'Full, arching fronds that love humidity and steady moisture.',
   'Never let it dry out fully. A pebble tray or bathroom humidity keeps it lush.',
   'Medium', 5, 7, 50, 70, 'A little attentive', true, 30, 90, null, 10),

  ('rubber-plant', 'Rubber plant', 'Ficus elastica',
   'Bold, glossy, deep-green leaves.',
   'Big, shiny leaves that make a strong, easy statement.',
   'Let the top few cm dry out, and wipe the leaves now and then so they can breathe.',
   'Bright, indirect', 7, 10, 40, 50, 'Easy-going', false, 100, 250, null, 11),

  ('fiddle-leaf-fig', 'Fiddle-leaf fig', 'Ficus lyrata',
   'The statement tree with violin leaves.',
   'Dramatic, sculptural leaves that look stunning once it''s settled and happy.',
   'Keep it in one bright spot and water on a steady rhythm. It dislikes change.',
   'Bright, indirect', 7, 10, 40, 60, 'A little attentive', false, 100, 300, null, 12),

  ('chinese-money-plant', 'Chinese money plant', 'Pilea peperomioides',
   'Round coin leaves and easy babies.',
   'Quirky round leaves on a tidy plant that loves to share its pups.',
   'Let the top of the soil dry out, and rotate it so it grows evenly.',
   'Bright, indirect', 7, 10, 40, 50, 'Easy-going', true, 20, 30, null, 13),

  ('areca-palm', 'Areca palm', 'Dypsis lutescens',
   'Feathery fronds, safely for pets.',
   'A tall, feathery palm that softens a bright room, safely around pets.',
   'Keep lightly moist and give it bright light. Brown tips usually mean dry air.',
   'Bright, indirect', 7, 10, 40, 60, 'A little attentive', true, 100, 200, null, 14),

  ('aloe-vera', 'Aloe vera', 'Aloe vera',
   'A sunny-windowsill succulent with a use.',
   'A sculptural succulent that stores soothing gel inside its leaves.',
   'Treat it like a succulent: lots of light, and water only when fully dry.',
   'Bright, indirect', 14, 21, 30, 40, 'Easy-going', false, 30, 60, null, 15),

  ('heartleaf-philodendron', 'Heartleaf philodendron', 'Philodendron hederaceum',
   'A trailing heart-leafed classic.',
   'Soft heart-shaped leaves that trail happily in modest light.',
   'Let the top 2–3 cm dry out. Pinch the tips to keep it full rather than leggy.',
   'Low', 7, 10, 40, 50, 'Easy-going', false, 30, 200, null, 16),

  ('birds-nest-fern', 'Bird''s nest fern', 'Asplenium nidus',
   'Ripply, apple-green and pet-safe.',
   'Wavy, bright-green fronds that unfurl from a central nest.',
   'Water around the edges, not the centre, and keep the air humid.',
   'Medium', 5, 7, 50, 70, 'A little attentive', true, 30, 60, null, 17),

  ('prayer-plant', 'Prayer plant', 'Maranta leuconeura',
   'Patterned leaves that fold up at night.',
   'Striking veined leaves that lift and lower with the light.',
   'Keep lightly moist with filtered water, and give it warmth and humidity.',
   'Medium', 5, 7, 50, 60, 'A little attentive', true, 20, 30, null, 18),

  ('english-ivy', 'English ivy', 'Hedera helix',
   'A classic trailer for cooler spots.',
   'Dainty lobed leaves that trail or climb in bright, cool rooms.',
   'Keep it cool and evenly moist, and watch for dry indoor air.',
   'Bright, indirect', 7, 10, 40, 50, 'Easy-going', false, 30, 200, null, 19),

  ('cast-iron-plant', 'Cast iron plant', 'Aspidistra elatior',
   'Tough, deep-green, low-light hero.',
   'Broad, dark leaves that tolerate shade and neglect with grace.',
   'Let the soil dry between waterings. It grows slowly, so don''t overfeed it.',
   'Low', 10, 14, 40, 50, 'Easy-going', true, 45, 90, null, 20);
