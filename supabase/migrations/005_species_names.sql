-- ════════════════════════════════════════════════════════════════════════════
-- Plant names in Indian languages: Hindi (hi), Marathi (mr), Tamil (ta),
-- Malayalam (ml).
--
-- Open data (Plant.id, Wikidata) has few or unreliable names for houseplants
-- in these languages, so Potpal keeps its own short list. The rules for it:
--   • a real local name where one is widely used (तुलसी, जास्वंद, செம்பருத்தி)
--   • otherwise the name people actually say, written in that script
--     (most houseplants are just called "मनी प्लांट", "पीस लिली" …)
--
-- `aliases` lets a plant be found by its other scientific names and by its
-- English common names, e.g. a Peace Lily that Plant.id names as a different
-- Spathiphyllum. Everything is stored lowercase for matching.
--
-- `reviewed` stays false until a native speaker has checked that row.
-- Species not in this list fall back to Wikidata (server/lib/names.js).
-- ════════════════════════════════════════════════════════════════════════════

create table public.species_names (
  species  text primary key,              -- scientific name, lowercase
  aliases  text[] not null default '{}',  -- other scientific names + English names, lowercase
  hi       text,
  mr       text,
  ta       text,
  ml       text,
  reviewed boolean not null default false
);

alter table public.species_names enable row level security;

-- Shared reference data, like plant_catalog: anyone signed in can read it
create policy "Anyone can read plant names"
  on public.species_names for select
  to authenticated, anon
  using (true);

grant select on public.species_names to authenticated, anon;

insert into public.species_names (species, aliases, hi, mr, ta, ml) values
  -- ─── The Discover catalogue ───────────────────────────────────────────────
  ('monstera deliciosa', '{swiss cheese plant,monstera}',
   'मॉन्स्टेरा', 'मॉन्स्टेरा', 'மான்ஸ்டெரா', 'മോൺസ്റ്റെറ'),
  ('epipremnum aureum', '{golden pothos,pothos,money plant,devil''s ivy,scindapsus aureus}',
   'मनी प्लांट', 'मनी प्लांट', 'மணி பிளான்ட்', 'മണി പ്ലാന്റ്'),
  ('dracaena trifasciata', '{sansevieria trifasciata,snake plant,mother-in-law''s tongue}',
   'स्नेक प्लांट', 'स्नेक प्लांट', 'ஸ்நேக் பிளான்ட்', 'സർപ്പപ്പോള'),
  ('zamioculcas zamiifolia', '{zz plant,zanzibar gem}',
   'ज़ेड ज़ेड प्लांट', 'झेड झेड प्लांट', 'இசட் இசட் பிளான்ட்', 'സെഡ് സെഡ് പ്ലാന്റ്'),
  ('spathiphyllum wallisii', '{peace lily,spathiphyllum,white sails}',
   'पीस लिली', 'पीस लिली', 'பீஸ் லில்லி', 'പീസ് ലില്ലി'),
  ('chlorophytum comosum', '{spider plant,airplane plant}',
   'स्पाइडर प्लांट', 'स्पायडर प्लांट', 'ஸ்பைடர் பிளான்ட்', 'സ്പൈഡർ പ്ലാന്റ്'),
  ('chamaedorea elegans', '{parlor palm,parlour palm}',
   'पार्लर पाम', 'पार्लर पाम', 'பார்லர் பாம்', 'പാർലർ പാം'),
  ('goeppertia orbifolia', '{calathea orbifolia,calathea}',
   'कैलेथिया', 'कॅलेथिया', 'கலாத்தியா', 'കലാത്തിയ'),
  ('peperomia obtusifolia', '{baby rubber plant,peperomia}',
   'पेपरोमिया', 'पेपेरोमिया', 'பெப்பரோமியா', 'പെപ്പറോമിയ'),
  ('nephrolepis exaltata', '{boston fern,sword fern}',
   'बोस्टन फ़र्न', 'बोस्टन फर्न', 'பாஸ்டன் பெரணி', 'ബോസ്റ്റൺ ഫേൺ'),
  ('ficus elastica', '{rubber plant,rubber fig,rubber tree}',
   'रबर प्लांट', 'रबर प्लांट', 'சீமை ஆல்', 'ശീമയാൽ'),
  ('ficus lyrata', '{fiddle-leaf fig,fiddle leaf fig}',
   'फ़िडल लीफ़ फ़िग', 'फिडल लीफ फिग', 'ஃபிடில் லீஃப் ஃபிக்', 'ഫിഡിൽ ലീഫ് ഫിഗ്'),
  ('pilea peperomioides', '{chinese money plant,pancake plant}',
   'चाइनीज़ मनी प्लांट', 'चायनीज मनी प्लांट', 'சைனீஸ் மணி பிளான்ட்', 'ചൈനീസ് മണി പ്ലാന്റ്'),
  ('dypsis lutescens', '{areca palm,golden cane palm,chrysalidocarpus lutescens}',
   'एरेका पाम', 'अरेका पाम', 'அரேகா பாம்', 'അരേക്ക പാം'),
  ('aloe vera', '{aloe,aloe barbadensis}',
   'घृतकुमारी', 'कोरफड', 'சோற்றுக் கற்றாழை', 'കറ്റാർവാഴ'),
  ('philodendron hederaceum', '{heartleaf philodendron,sweetheart plant}',
   'फ़िलोडेंड्रॉन', 'फिलोडेंड्रॉन', 'ஃபிலோடென்ட்ரான்', 'ഫിലോഡെൻഡ്രോൺ'),
  ('asplenium nidus', '{bird''s nest fern}',
   'बर्ड्स नेस्ट फ़र्न', 'बर्ड्स नेस्ट फर्न', 'பர்ட்ஸ் நெஸ்ட் பெரணி', 'ബേർഡ്സ് നെസ്റ്റ് ഫേൺ'),
  ('maranta leuconeura', '{prayer plant}',
   'प्रेयर प्लांट', 'प्रेयर प्लांट', 'பிரேயர் பிளான்ட்', 'പ്രെയർ പ്ലാന്റ്'),
  ('hedera helix', '{english ivy,ivy,common ivy}',
   'इंग्लिश आइवी', 'इंग्लिश आयव्ही', 'இங்கிலீஷ் ஐவி', 'ഇംഗ്ലീഷ് ഐവി'),
  ('aspidistra elatior', '{cast iron plant}',
   'कास्ट आयरन प्लांट', 'कास्ट आयर्न प्लांट', 'காஸ்ட் அயர்ன் பிளான்ட்', 'കാസ്റ്റ് അയൺ പ്ലാന്റ്'),

  -- ─── Plants already in people's crews ─────────────────────────────────────
  ('coleus scutellarioides', '{coleus,plectranthus scutellarioides,solenostemon scutellarioides,painted nettle}',
   'कोलियस', 'कोलियस', 'கோலியஸ்', 'കോളിയസ്'),
  ('alocasia × mortfontanensis', '{alocasia x mortfontanensis,alocasia amazonica,alocasia × amazonica,african mask plant,alocasia polly}',
   'अफ़्रीकन मास्क प्लांट', 'आफ्रिकन मास्क प्लांट', 'ஆப்பிரிக்கன் மாஸ்க் பிளான்ட்', 'ആഫ്രിക്കൻ മാസ്ക് പ്ലാന്റ്'),

  -- ─── Favourites of Indian homes and balconies ─────────────────────────────
  ('ocimum tenuiflorum', '{tulsi,holy basil,ocimum sanctum}',
   'तुलसी', 'तुळस', 'துளசி', 'തുളസി'),
  ('jasminum sambac', '{arabian jasmine,sambac jasmine,mogra}',
   'मोगरा', 'मोगरा', 'மல்லிகை', 'മുല്ല'),
  ('hibiscus rosa-sinensis', '{hibiscus,chinese hibiscus,shoeblackplant}',
   'गुड़हल', 'जास्वंद', 'செம்பருத்தி', 'ചെമ്പരത്തി'),
  ('tagetes erecta', '{african marigold,mexican marigold,marigold}',
   'गेंदा', 'झेंडू', 'செண்டுமல்லி', 'ചെണ്ടുമല്ലി'),
  ('murraya koenigii', '{curry tree,curry leaf,curry leaves,bergera koenigii}',
   'करी पत्ता', 'कढीपत्ता', 'கறிவேப்பிலை', 'കറിവേപ്പ്'),
  ('codiaeum variegatum', '{croton,garden croton}',
   'क्रोटन', 'क्रोटन', 'குரோட்டன்ஸ்', 'ക്രോട്ടൺ'),
  ('crassula ovata', '{jade plant,money tree,lucky plant}',
   'जेड प्लांट', 'जेड प्लांट', 'ஜேட் பிளான்ட்', 'ജേഡ് പ്ലാന്റ്'),
  ('adenium obesum', '{desert rose,adenium}',
   'एडेनियम', 'ॲडेनियम', 'அடீனியம்', 'അഡീനിയം'),
  ('bougainvillea spectabilis', '{bougainvillea,great bougainvillea,bougainvillea glabra,paper flower}',
   'बोगनविलिया', 'बोगनवेल', 'காகிதப் பூ', 'കടലാസ് പൂവ്'),
  ('catharanthus roseus', '{madagascar periwinkle,periwinkle,vinca rosea,sadabahar}',
   'सदाबहार', 'सदाफुली', 'நித்திய கல்யாணி', 'നിത്യകല്യാണി'),
  ('mentha spicata', '{spearmint,mint,pudina}',
   'पुदीना', 'पुदिना', 'புதினா', 'പുതിന'),
  ('dieffenbachia seguine', '{dieffenbachia,dumb cane}',
   'डाइफ़ेनबेकिया', 'डायफेनबेकिया', 'டைஃபென்பாக்கியா', 'ഡീഫൻബേക്കിയ'),
  ('aglaonema commutatum', '{chinese evergreen,aglaonema}',
   'एग्लोनिमा', 'ॲग्लोनेमा', 'அக்லோனிமா', 'അഗ്ലോനീമ'),
  ('syngonium podophyllum', '{arrowhead plant,arrowhead vine,syngonium}',
   'सिंगोनियम', 'सिंगोनियम', 'சிங்கோனியம்', 'സിങ്കോണിയം'),
  ('dracaena sanderiana', '{lucky bamboo,dracaena braunii}',
   'लकी बैम्बू', 'लकी बांबू', 'லக்கி பேம்பூ', 'ലക്കി ബാംബൂ');
