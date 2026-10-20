-- ════════════════════════════════════════════════════════════════════════════
-- Photos for every Discover plant, with credits.
--
-- 15 of the 20 catalogue plants had no photo (the design only came with 5).
-- These are hand-picked, freely licensed photos from Wikimedia Commons:
-- potted or indoor-looking where possible. The files are unedited 960px
-- copies in client/public/images/catalog/.
--
-- CC BY and CC BY-SA licences ask for the author and licence to be credited
-- wherever the photo is shown, so we store both, plus links to the original
-- photo and to the licence. The 5 design photos were made for Potpal and have
-- no credit (these columns stay null).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.plant_catalog
  add column image_author      text, -- e.g. "Mokkie"
  add column image_licence     text, -- e.g. "CC BY-SA 3.0"
  add column image_licence_url text, -- e.g. https://creativecommons.org/licenses/by-sa/3.0
  add column image_source_url  text; -- the photo's page on Wikimedia Commons

-- ─── The chosen photos ────────────────────────────────────────────────────────
update public.plant_catalog set image_url = '/images/catalog/snake-plant.jpg', image_author = 'HAGSEN & Domelo.pl', image_licence = 'CC BY-SA 4.0', image_licence_url = 'https://creativecommons.org/licenses/by-sa/4.0', image_source_url = 'https://commons.wikimedia.org/wiki/File:Hagsen_Delta_200_planter.jpg' where slug = 'snake-plant';
update public.plant_catalog set image_url = '/images/catalog/zz-plant.jpg', image_author = 'Rajasekhar1961', image_licence = 'CC0', image_licence_url = 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', image_source_url = 'https://commons.wikimedia.org/wiki/File:Plants_in_my_Home_garden_2026_August_16.jpg' where slug = 'zz-plant';
update public.plant_catalog set image_url = '/images/catalog/peace-lily.jpg', image_author = 'CesarAlbertoHerrera', image_licence = 'CC0', image_licence_url = 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', image_source_url = 'https://commons.wikimedia.org/wiki/File:Maseta.jpg' where slug = 'peace-lily';
update public.plant_catalog set image_url = '/images/catalog/spider-plant.jpg', image_author = 'Nithyashree Balasupramaniyan', image_licence = 'CC0', image_licence_url = 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', image_source_url = 'https://commons.wikimedia.org/wiki/File:Chlorophytum_comosum_in_a_pot.jpg' where slug = 'spider-plant';
update public.plant_catalog set image_url = '/images/catalog/boston-fern.jpg', image_author = 'Tbatb', image_licence = 'CC BY-SA 4.0', image_licence_url = 'https://creativecommons.org/licenses/by-sa/4.0', image_source_url = 'https://commons.wikimedia.org/wiki/File:The_potted_Nephrolepis_exaltata_01.jpg' where slug = 'boston-fern';
update public.plant_catalog set image_url = '/images/catalog/rubber-plant.jpg', image_author = 'Uliako Auzo Elkartea', image_licence = 'CC BY-SA 4.0', image_licence_url = 'https://creativecommons.org/licenses/by-sa/4.0', image_source_url = 'https://commons.wikimedia.org/wiki/File:Ficus_elastica-Kautxu_landare_01.jpg' where slug = 'rubber-plant';
update public.plant_catalog set image_url = '/images/catalog/fiddle-leaf-fig.jpg', image_author = 'Morrisjm', image_licence = 'CC BY-SA 3.0', image_licence_url = 'http://creativecommons.org/licenses/by-sa/3.0/', image_source_url = 'https://commons.wikimedia.org/wiki/File:Fiddle_Leaf_Fig_in_pot.jpg' where slug = 'fiddle-leaf-fig';
update public.plant_catalog set image_url = '/images/catalog/chinese-money-plant.jpg', image_author = 'LuizCent', image_licence = 'CC BY-SA 4.0', image_licence_url = 'https://creativecommons.org/licenses/by-sa/4.0', image_source_url = 'https://commons.wikimedia.org/wiki/File:Pilea-_miami_jungle.jpg' where slug = 'chinese-money-plant';
update public.plant_catalog set image_url = '/images/catalog/areca-palm.jpg', image_author = 'RJ Raawat', image_licence = 'CC BY-SA 4.0', image_licence_url = 'https://creativecommons.org/licenses/by-sa/4.0', image_source_url = 'https://commons.wikimedia.org/wiki/File:Areca_palm_in_Ceramic_Pot.jpg' where slug = 'areca-palm';
update public.plant_catalog set image_url = '/images/catalog/aloe-vera.jpg', image_author = 'Slyronit', image_licence = 'CC BY-SA 4.0', image_licence_url = 'https://creativecommons.org/licenses/by-sa/4.0', image_source_url = 'https://commons.wikimedia.org/wiki/File:Aloe_Vera_in_a_metal_Pot.jpg' where slug = 'aloe-vera';
update public.plant_catalog set image_url = '/images/catalog/heartleaf-philodendron.jpg', image_author = 'RJ Raawat', image_licence = 'CC BY-SA 4.0', image_licence_url = 'https://creativecommons.org/licenses/by-sa/4.0', image_source_url = 'https://commons.wikimedia.org/wiki/File:Philodendron_Oxycardium_Green_Plant_at_Office_Premises_of_The_Samajh_NGO.jpg' where slug = 'heartleaf-philodendron';
update public.plant_catalog set image_url = '/images/catalog/birds-nest-fern.jpg', image_author = 'Tagesfleiss', image_licence = 'CC BY-SA 3.0', image_licence_url = 'https://creativecommons.org/licenses/by-sa/3.0', image_source_url = 'https://commons.wikimedia.org/wiki/File:Asplenium-Indoor.jpg' where slug = 'birds-nest-fern';
update public.plant_catalog set image_url = '/images/catalog/prayer-plant.jpg', image_author = 'Tangopaso', image_licence = 'Public domain', image_licence_url = null, image_source_url = 'https://commons.wikimedia.org/wiki/File:Maranta_leuconeura_D2501.jpg' where slug = 'prayer-plant';
update public.plant_catalog set image_url = '/images/catalog/english-ivy.jpg', image_author = 'Tekksavvy', image_licence = 'CC BY-SA 3.0', image_licence_url = 'https://creativecommons.org/licenses/by-sa/3.0', image_source_url = 'https://commons.wikimedia.org/wiki/File:English_Ivies.jpg' where slug = 'english-ivy';
update public.plant_catalog set image_url = '/images/catalog/cast-iron-plant.jpg', image_author = 'Nino Barbieri', image_licence = 'CC BY 2.5', image_licence_url = 'https://creativecommons.org/licenses/by/2.5', image_source_url = 'https://commons.wikimedia.org/wiki/File:Aspidistra_elatior_-_01.jpg' where slug = 'cast-iron-plant';
