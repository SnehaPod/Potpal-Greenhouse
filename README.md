# 🪴 Potpal Greenhouse

This repo (`potpal-greenhouse`) is the Vue + Node version of Potpal.

Snap a leaf, meet your plant, and keep it happy.

Potpal is a mobile-first web app (you can install it as a PWA) that identifies
house plants from a photo using the **[Plant.id](https://plant.id) API by
Kindwise**. You save each plant to your "leafy crew", and Potpal tracks when it
needs water.

| Part | Tech | Folder |
|---|---|---|
| Frontend | Vue 3 + Vite + Vue Router | `client/` |
| Backend | Node.js + Express | `server/` |
| Database, sign-in, photo storage | Supabase (Postgres + Auth + Storage) | `supabase/` |
| Plant identification + health scans | Plant.id v3 (Kindwise) | `server/lib/plantId.js` |

## How it fits together

```
 Phone / browser                      Node server                       Outside services
┌──────────────────┐   photo + JWT   ┌─────────────────────┐  photo   ┌────────────────┐
│  Vue app         │ ──────────────▶ │ POST /api/identify  │ ───────▶ │ Plant.id API   │
│  (client/)       │ ◀────────────── │                     │ ◀─────── │ (secret key)   │
│                  │  suggestions    │                     │          └────────────────┘
│  signs in with   │                 │ /api/plants (CRUD)  │  as the  ┌────────────────┐
│  Supabase Auth   │ ──────────────▶ │                     │ ───────▶ │ Supabase       │
└──────────────────┘   JSON + JWT    └─────────────────────┘   user   │ Postgres + RLS │
                                                                     │ Storage bucket │
                                                                     └────────────────┘
```

- **Why put a server in the middle?** The Plant.id API key is secret, so it
  lives only in `server/.env` and never reaches the browser.
- **Who can see what?** The browser signs in with Supabase and sends its access
  token (JWT) to the server. The server talks to Supabase *as that user*, so the
  database's row-level security policies (`supabase/migrations/`) make sure
  each person only sees their own plants. The server never uses the
  all-powerful service-role key.

## Screens

The screens follow the PotPal Figma design.

| Screen | Route | Data |
|---|---|---|
| Log in / create account | `/sign-in` | Supabase Auth (email + password, Google) |
| Choose a new password | `/reset-password` | Supabase Auth (opened from the reset email) |
| My plants | `/` | live |
| Identify (camera + upload) | `/identify` | live: Plant.id |
| Plant identified | `/identified` | live: Plant.id |
| Care plan | `/plants/:id` | live, plus this week's weather warnings |
| Health journal (care plan tab) | `/plants/:id?tab=journal` | live: every scan, trend, chart |
| Identify in "Health scan" mode | `/identify?mode=health&plant=:id` | live: Plant.id |
| Weekly health check | `/plants/:id/health` (`?scan=<id>` for a past one) | live: latest or chosen scan |
| Discover | `/discover` | live: plant catalogue |
| Plant match | `/discover/:slug` | live: catalogue + shopping links |
| Your weather | `/location` | live: Open-Meteo city search (from the phone) |
| Saved plants (wishlist) | `/wishlist` | live: hearted Discover plants |
| Photo credits | `/credits` | live: who took each Commons photo |

**Wishlist.** Tap the heart on a Discover plant, or "Save to my plant wishlist"
on its match screen, to save it to your account (the `wishlist` table). The
heart at the top of Discover shows how many plants you've saved and opens
*Saved plants*. That screen lists them newest first, each with a heart to
remove it and a "Buy" shortcut to Google Shopping. Every heart in the app
shares one store (`client/src/lib/wishlist.js`), so they always agree. A tap
updates the screen straight away and saves in the background; if saving fails,
the heart flips back and an error is shown.

**Health journal.** Each plant's care plan has a *Health journal* tab showing:
- the latest health score, and whether the plant is getting better, getting
  worse or holding steady (a change of 5 points or less counts as steady);
- a score-over-time chart;
- the first and latest photos side by side;
- every check-in, newest first.

The trend logic is in `client/src/lib/health.js`. The chart is plain SVG, in
`client/src/components/ScoreChart.vue`.

**This week (weather-aware warnings).** After you set your city, Home shows the
local 7-day forecast and early warnings for your plants:
- **Hot days**: any day reaches 30°C or more.
- **Cold nights**: any night drops to 5°C or less.
- **A darker week**: under 2 hours of sun a day on average, or under 10 hours
  of daylight.

On Home, plants hit by the same weather share one row ("Hot days ahead for
Miso, Mochi and Olive"), with a chip for each plant. Each plant's care plan
shows its own warning, and each warning says *why*, using the forecast numbers
and the plant's own care data. If a plant's "Let AI adjust the timing" switch is on, marking it watered
moves the next watering 2 days earlier in a hot week, or 2 days later in a dark
one, and the care plan shows a note explaining the change.

The rules are in `server/lib/forecast.js` and the thresholds sit together at
the top of that file. Weather comes from [Open-Meteo](https://open-meteo.com),
which is free and needs no API key. Locations are stored rounded to about 1 km.

Open-Meteo's free limit is per IP address. On shared hosting such as Render's
free plan, many apps share one IP, so the limit can run out before Potpal has
asked for anything. So:
- **Forecasts fall back to [MET Norway](https://api.met.no)**, which is also
  free and keyless. We use its temperatures and cloud cover, work out daylight
  from the date and latitude, and estimate sunshine from the clouds. The card
  credits whichever source was used, and `server/lib/weather.test.js` tests the
  conversion.
- **City search runs on the phone**, calling Open-Meteo's geocoder directly
  from the phone's own IP.

**Names in Indian languages.** The identified result, the care plan and the
Discover detail show the plant's name in Hindi, Marathi, Tamil and Malayalam.
- **Potpal's own list** (`species_names`, seeded in
  `supabase/migrations/005_species_names.sql`) covers about 37 common plants.
  It uses the real local name where one is widely used (तुलसी, जास्वंद,
  செம்பருத்தி), and otherwise the name people actually say, written in that
  script (मनी प्लांट, பீஸ் லில்லி). Plants are matched by scientific name,
  older scientific names, or English name.
- **Wikidata** is the fallback for anything else. A name is only kept if it's
  written in the right script. The app labels these names "from Wikidata",
  because they can be odd: some are just the Latin name spelled out.
- **If neither has a name, nothing is shown.**

**Before launch:** the list's `reviewed` column is `false` on every row, because
the names haven't been checked by native speakers yet.
Plant.id isn't used for these names: it returned none for these languages, and
it allows only 3 languages per call.

**Discover** ranks a catalogue of ~20 common houseplants (the `plant_catalog`
table, seeded in `supabase/migrations/003_plant_catalog.sql`) against the room,
light and pet-safety the user picks. The match %, the "why you two click"
reasons and the care tiles are worked out in `client/src/lib/catalog.js`. The
detail screen's **Where to buy** links open a live search for the plant on
Etsy, Amazon, eBay and Google Shopping (`client/src/lib/shopping.js`) — no API
keys, no stored prices. Edit the catalogue in Supabase Studio, or add a
migration. To buy and sell real stock later, swap those search links for a
shopping API.

**Measure my light.** Not sure how bright a spot is? On Discover, tap **Not
sure? Measure my light**, stand where the plant will go, point the phone at the
window and take a photo. Potpal reads the exposure the camera chose (shutter
time, aperture and ISO, from the photo's details) and estimates the light in
lux, like a photographer's light meter:

- under 2,500 lux → **Low**;
- 2,500–10,000 → **Medium**;
- over 10,000 → **Bright, indirect** (over 30,000, it warns that's direct sun).

It then picks that chip for you. The compass names the window's direction, and
with a saved weather location it says what that means: south-facing gets the
most sun in the northern hemisphere, north-facing in the southern, and near the
equator the direction matters less.

- **Private:** it all happens on the phone, and the photo is never uploaded.
- **Limits:** it's an estimate. Readings are fairest around midday, so it says
  when a photo is from early, late or another day. Screenshots and photos sent
  through chat apps have no exposure details, so it asks for a fresh photo.
  The room can't be recognised from a photo, so you still choose it.
- **Code:** the maths and thresholds are in `client/src/lib/light.js` (tested
  in `light.test.js`), and the card is `client/src/components/LightMeter.vue`.

**How Discover picks.** The order keeps changing with what you do, but the
"% match" shown is always the real fit. `rankForYou()` in
`client/src/lib/catalog.js` starts from that fit, then:

- leaves out plants already in your wishlist ("N plants in your wishlist" links
  to them);
- takes 4 points off per visit to a plant's detail screen in the last 30 days,
  up to 12, so plants you've opened often sink;
- adds 2 to plants you've never opened, and labels them "New to you";
- adds a small daily shuffle (0–3 points), so close matches take turns at the
  top without the list jumping around within a day.

Visits are stored per user in `catalog_views` (migration `009`), at most once
per plant per browser session. After 30 days without a visit the count starts
again. The weights are in `FOR_YOU` at the top of that section.

**Discover photos and credits.** Every catalogue plant has a photo:
- **5 come from the design** and were made for Potpal (Monstera, pothos,
  Calathea, Peperomia, Parlor palm).
- **The other 15 are freely licensed photos from Wikimedia Commons**, picked by
  hand to look potted or indoors. They're stored unedited in
  `client/public/images/catalog/`.

Their licences are CC0, public domain, CC BY or CC BY-SA. CC BY and CC BY-SA
ask for a credit wherever the photo is shown, so the catalogue stores each
photo's author, licence and links (`supabase/migrations/007_catalog_photo_credits.sql`):
- The plant match screen shows the credit under the photo.
- Discover and Saved plants link to a **Photo credits** page (`/credits`),
  because their thumbnails are too small for a credit line.

If you swap a photo, update those four columns too.

## Getting started

You need **Node 20+** and **Docker** (for local Supabase).

```bash
# 1. Install everything (root, client and server)
npm install

# 2. Start Supabase locally and create the tables
npm run db:start      # prints the API URL and anon key; `npx supabase status` shows them again
npm run db:reset      # applies supabase/migrations/

# 3. Add your settings
cp server/.env.example server/.env   # SUPABASE_URL, SUPABASE_ANON_KEY, PLANT_ID_API_KEY
cp client/.env.example client/.env   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# 4. Run the app (server on :3000, client on :5173)
npm run dev
```

Then open <http://localhost:5173>, create an account, and identify a plant.

**Plant.id key:** sign up at <https://admin.kindwise.com>. New accounts come
with free credits. Each identification and each health scan uses one.

**Already ran `db:reset` before?** New migrations can be applied without wiping
your local data: `npx supabase migration up --local`.

**Ports:** this project's local Supabase uses ports **553xx** (API at
`http://127.0.0.1:55321`, Studio at `http://127.0.0.1:55323`), so it can run
next to another Supabase project on the default 543xx ports.

### Local test accounts

The local database already has two accounts that were used to test sign-in
and row-level security. Both use the password `leafy-test-2026`. They exist
only in your local Docker database, and `npm run db:reset` wipes them.

| Email | Has |
|---|---|
| `jamie@potpal.test` | one plant, "Miso" (Monstera), with 6 sample health check-ins so the journal has a trend to show |
| `sam@potpal.test` | no plants. Used to check that Sam can't see Jamie's plants |

### Log in options

- **Forgot password?** Type your email on the log-in screen, then tap
  *Forgot password?*. Supabase emails a link that opens `/reset-password`.
  Locally, no real email is sent: open Mailpit at <http://127.0.0.1:55324> to
  find it.
- **Continue with Google** is off until you set it up. Until then, the button
  shows a friendly "not set up yet" message. To turn it on:
  1. In the [Google Cloud console](https://console.cloud.google.com/), pick
     or create a project, then open **Google Auth Platform**:
     - **Branding**: app name *Potpal*, plus your support and developer email.
     - **Audience**: choose *External*. While it's in *Testing*, only
       the people you add under **Test users** can sign in, so add yourself.
     - **Data access**: no change needed. Supabase only asks for
       `email` and `profile`.
  2. **Clients → Create client**: type *Web application*, name *Potpal (local)*.
     Under **Authorised redirect URIs**, add exactly:
     ```
     http://127.0.0.1:55321/auth/v1/callback
     ```
     (That's local Supabase's address, not the Vue app's. Leave
     *Authorised JavaScript origins* empty.)
  3. Copy `supabase/.env.example` to `supabase/.env` (git-ignored) and paste in
     the client ID and secret:
     ```bash
     SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com
     SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=GOCSPX-…
     ```
  4. Set `enabled = true` under `[auth.external.google]` in
     `supabase/config.toml`, then run `npm run db:stop && npm run db:start`.

  After Google, Supabase sends people back to the Vue app at
  `http://localhost:5173/` (allowed by `additional_redirect_urls` in
  `config.toml`). If they cancel, the log-in screen says why.

  **Going live:** with a hosted Supabase project, add
  `https://<project-ref>.supabase.co/auth/v1/callback` to the same Google
  client. Then paste the ID and secret under *Authentication → Providers →
  Google* in the Supabase dashboard, and add your app's URL to
  *URL Configuration*. To let anyone with a Google account sign in, not just
  your test users, set the Audience to *In production* (publish the app).
- **Terms of Service / Privacy Policy** in the small print become links once
  you set `VITE_TERMS_URL` and `VITE_PRIVACY_URL` in `client/.env`.

### Identification and the Pl@ntNet fallback

`POST /api/identify` tries these in order (`server/lib/identify.js`):
1. **The cache.** If you've identified the exact same photo before, you get the
   saved answer instantly, at no cost. The cache is per user, in the
   `identification_cache` table.
2. **Plant.id.** It gives the best answer, with care details. It gives up after
   8 seconds.
3. **[Pl@ntNet](https://my.plantnet.org).** The free backup (500 IDs a day), used
   when Plant.id can't answer: out of credits, rate-limited, down, too slow, or
   a key problem.
   - It only returns names. Care facts come from the Discover catalogue when the
     species is in it. Otherwise the app uses general houseplant tips and says
     so, and toxicity shows as unknown.
   - The result screen says "Identified with Pl@ntNet".

If Plant.id says "that's not a plant", that's a real answer, and there's no
fallback.

**Test mode: save Plant.id credits.** Set `PLANT_ID_ENABLED=false` in
`server/.env` and restart the server. Then:
- Identification goes straight to Pl@ntNet.
- Health scans are paused with a friendly message, because Pl@ntNet can't
  assess health.
- The server prints `Plant.id is OFF (test mode)` at startup.

Remove the line, or set it to `true`, for live. Your local `server/.env`
currently has test mode **on**.

### Tests and trying the weather rules

```bash
npm test   # the "This week" rules and grouping, plant-name matching, and the Discover order
```

Real weather rarely produces a heatwave when you want to see one. To try the
warnings, run a second API with a made-up week and point a second copy of the
app at it:

```bash
cd server && PORT=3001 WEATHER_FIXTURE=hot node --env-file=.env index.js
```

```bash
cd client && API_TARGET=http://localhost:3001 npx vite --port 5175
```

`WEATHER_FIXTURE` can be `hot`, `cold`, `dark` or `calm`. The made-up weeks are
in `server/lib/weatherFixtures.js`.

### Trying it on your phone

The camera needs a secure address (`https://` or `localhost`). On your phone
over Wi-Fi (`http://<your-computer-ip>:5173`), the live camera won't start,
but **Upload** still works and uses your phone's camera or gallery. To get the
live camera on a phone, deploy the app (see **Deploying** below).

**Android, over a USB cable.** This gets you a full test without deploying.
Turn on USB debugging on the phone, plug it in, then run:

```bash
adb reverse tcp:5173 tcp:5173
```

```bash
adb reverse tcp:55321 tcp:55321
```

Now `http://localhost:5173` in Chrome on the phone reaches the app and Supabase
on your computer, with the live camera, sign-in and "Install app" all working.
Run the two commands again after you unplug the phone.

## Deploying (Supabase cloud + Render) and the Android app

In production, one Render web service runs the Node server, which also serves
the built Vue app from `client/dist`. So the app and the API share one address,
and no CORS setup is needed. The settings are in `render.yaml`.

**1. Supabase cloud.** On supabase.com, create a project:
- name it `potpal-greenhouse`;
- pick the region closest to your users (Mumbai for India);
- save the database password somewhere safe.

Then push the tables, security rules, the photo bucket and the catalogue:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <your-project-ref>
```

```bash
npx supabase db push
```

**2. Render.** On render.com, go to **New → Blueprint** and pick this repo.
Render reads `render.yaml` and asks for the values marked `sync: false`:

| Setting | Where to find it |
|---|---|
| `SUPABASE_URL`, `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY` | the same page → anon / publishable key (**never** the service_role key) |
| `PLANTNET_API_KEY`, `PLANT_ID_API_KEY` | your keys, as in `server/.env` |

`PLANT_ID_ENABLED` starts as `false` (test mode, no Plant.id credits used).
Set it to `true` at launch. Each push to `main` deploys again. On the free plan
the service sleeps after 15 minutes idle, and the next visit takes about
30–60 seconds to wake it.

**3. Sign-in settings in Supabase.**
- Authentication → URL Configuration:
  - Site URL: `https://potpal-greenhouse.onrender.com`
  - Redirect URLs: `https://potpal-greenhouse.onrender.com/**`
- For testing, you can turn off Authentication → Providers → Email →
  **Confirm email**. Supabase's built-in email only sends a few messages an
  hour. Before launch, add a real email provider and turn confirmation back on.
- Google sign-in:
  - in Google Cloud, add `https://<your-project-ref>.supabase.co/auth/v1/callback`
    to the OAuth client's redirect URIs;
  - in Supabase, turn on Providers → Google with the same client ID and secret.

**4. Android app (APK).**
1. On pwabuilder.com, enter the Render URL, then choose **Package for stores →
   Android**.
2. Use the package id `com.radix.potpal`, and let PWABuilder create a signing key.
   **Keep the key and its passwords**: every update must be signed with it.
3. Copy `assetlinks.json` from the download to
   `client/public/.well-known/assetlinks.json` and deploy again. This proves
   the app and the site belong together, so the APK opens without a browser
   address bar.

The APK shows the live site, so new deploys reach it without a new APK. The
PWA parts it relies on:
- `client/public/manifest.webmanifest`, with the PNG icons, including a
  maskable one;
- `client/public/sw.js`, a small service worker that shows
  `offline.html` when there's no connection, and shows notifications.

## Notifications (watering reminders and weather warnings)

Potpal sends two kinds of notification to phones that have said yes:

- **Watering reminders.** At each plant's "Remind me at" time, on the days it's
  due, in the phone's own time zone. A user's thirsty plants share one
  notification ("Time to water Miso and Mochi 💧"). Each plant is reminded at
  most once a day.
- **Weather warnings.** Hot days (30 °C or more) and cold nights (5 °C or less)
  in the week ahead, for people with a saved place. At most once per kind every
  3 days, and never before 08:00. A darker week stays in the app only. There's
  a switch on the Weather screen.

**How it works.**
1. The app asks permission and saves this phone's push "subscription", plus
   its time zone. This happens from the Home card, the care plan, or the
   Weather switch (`client/src/lib/push.js`).
2. Every 15 minutes a Supabase scheduled job (pg_cron, migration `010`) calls
   `POST /api/cron/reminders` with a secret.
3. The server reads who has a phone subscribed through two database functions
   that only answer to that secret (`push_jobs`, `record_push_results`). It
   decides who is due with the rules in `server/lib/reminders.js` (tested in
   `reminders.test.js`), and sends with `web-push`.
4. `client/public/sw.js` shows the notification. Tapping it opens the plant, or
   Home.

No service-role key is involved. The secret lives in Render (`CRON_SECRET`)
and in Supabase Vault (`potpal_cron_secret`), never in git. The PWABuilder APK
already has Android's notification permission, so no new APK is needed.

**One-time setup, per environment.**
1. Inside `server/`, run `npx web-push generate-vapid-keys`, and make a secret
   with `openssl rand -hex 32`.
2. Put `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `CRON_SECRET` in
   `server/.env` (locally) or Render → Environment (live).
3. In the Supabase SQL editor (or with `psql` locally):
   ```sql
   select vault.create_secret('https://potpal-greenhouse.onrender.com', 'potpal_api_url');
   select vault.create_secret('<the CRON_SECRET value>', 'potpal_cron_secret');
   ```
   Locally, the URL is `http://host.docker.internal:3000`, because the
   database runs in Docker.
4. Run `npx supabase db push` (or `migration up --local`) for migration `010`.

**Trying it.**
- Turn notifications on in a care plan, then tap **Send a test**.
- To see what the next run would send without sending it:
  ```bash
  curl -X POST -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/reminders?dryRun=1"
  ```
- The job's history is in `cron.job_run_details`, and its web requests are in
  `net._http_response`.

On the free Render plan, the 15-minute call keeps the server awake. That uses
about 744 of the 750 free hours a month, and means no cold starts.

## Project layout

```
client/src/
  views/          one file per screen
  components/     Icon, AppBar, BottomNav, CheckBox, ToggleSwitch, FactTiles, PlantCard,
                  PlantThumb, HealthJournal + ScoreChart, ThisWeek, LocalNames, PhotoCredit,
                  LightMeter
  lib/
    supabase.js   Supabase client (sign-in only)
    auth.js       current user + signIn / signUp / signOut
    api.js        calls to our server (adds the access token)
    image.js      shrinks photos to ~1024px before upload
    plants.js     helpers like isDueToday(), waterStatus()
    identifyStore.js  passes the Plant.id result from camera → result screen
    catalog.js    Discover matching: score, reasons, care tiles and the "for you" order
    light.js      "Measure my light": lux from a photo's exposure, window direction
    shopping.js   builds the "where to buy" search links
    discoverStore.js  remembers the Discover filters across screens
    wishlist.js   saved plants, shared by every heart in the app
    health.js     health journal: trend (better / worse / steady) and labels
    weather.js    which icon goes with each weather warning
    push.js       notifications on this phone: ask, subscribe, test, unsubscribe
  assets/main.css the design system (colours, type, components)
client/public/
  manifest.webmanifest, icon-*.png   what Android needs to install Potpal
  sw.js, offline.html                service worker: the "You're offline" page
render.yaml           how Render builds and runs the app (see Deploying)
.claude/skills/vue-animations/SKILL.md   how to add motion here (Vue <Transition>, tokens, reduced motion)

server/
  index.js              Express app, routes, error handling; serves client/dist when it's built
  middleware/auth.js    checks the access token and attaches req.user and req.supabase
  lib/plantId.js        Plant.id requests (identify + health) and turning the answers into simple shapes
  lib/photos.js         photo upload middleware + saving to the plant-photos bucket
  lib/supabase.js       Supabase client that acts as the signed-in user
  lib/weather.js        the next 7 days: Open-Meteo, or MET Norway as a backup (cached 3 hours)
  lib/forecast.js       the "This week" rules: warnings + watering adjustment
  lib/reminders.js      who gets a notification right now (watering + hot / cold)
  lib/push.js           sending Web Push notifications (VAPID keys)
  lib/forecast.test.js  tests for those rules (npm test)
  lib/weatherFixtures.js  made-up weeks for the tests and for local trying-out
  lib/names.js          plant names in Indian languages (Potpal's list, then Wikidata)
  lib/names.test.js     tests for name matching
  lib/identify.js       cache → Plant.id → Pl@ntNet, plus the PLANT_ID_ENABLED test switch
  lib/plantnet.js       Pl@ntNet requests (the backup identifier)
  lib/careFallback.js   care facts for Pl@ntNet answers (catalogue, or general tips)
  lib/identify.test.js + plantnet.test.js   tests for the fallback (fakes, no network)
  routes/names.js       GET /api/names
  routes/wishlist.js    /api/wishlist: list, save, remove
  routes/push.js        /api/push: key, save / forget this phone, test
  routes/cron.js        POST /api/cron/reminders (the 15-minute job; secret only)
  routes/identify.js    POST /api/identify
  routes/plants.js      /api/plants CRUD + /water (weather-adjusted if "Let AI adjust" is on)
  routes/health.js      /api/plants/:id/health: list, new scan, /latest, /:scanId
  routes/catalog.js     /api/catalog, /views, /:slug and /:slug/view (Discover plants and visits)
  routes/location.js    /api/location: saved place, city search
  routes/forecast.js    GET /api/forecast

supabase/migrations/001_potpal_schema.sql    plants table, RLS policies, photo bucket
supabase/migrations/002_health_scans.sql     health_scans table + RLS policy
supabase/migrations/003_plant_catalog.sql    plant_catalog table + 20-plant seed
supabase/migrations/004_weather_care.sql     user_settings (location) + plants.water_note
supabase/migrations/005_species_names.sql    species_names: names in hi / mr / ta / ml
supabase/migrations/006_wishlist.sql         wishlist table + RLS policy
supabase/migrations/007_catalog_photo_credits.sql  Commons photos + their credits for 15 plants
supabase/migrations/008_identification_cache.sql   per-user cache of identification answers
```

## API

All endpoints need `Authorization: Bearer <supabase access token>`.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/identify` | `multipart/form-data` with `photo` → `{ photoUrl, suggestions[], source: 'plantid' \| 'plantnet' }` |
| `GET` | `/api/plants` | list my plants |
| `GET` | `/api/plants/:id` | one plant |
| `POST` | `/api/plants` | add a plant |
| `PATCH` | `/api/plants/:id` | change `nickname`, `room`, `reminders_on`, `reminder_time`, `ai_adjust` |
| `POST` | `/api/plants/:id/water` | mark as watered; the next check is due in `water_min_days`, moved ±2 days for this week's weather when `ai_adjust` is on (explained in `water_note`). Saves how it was in `undo_water` |
| `POST` | `/api/plants/:id/unwater` | undo the last watering (within a day), putting the dates and note back; 409 if there's nothing to undo |
| `DELETE` | `/api/plants/:id` | remove a plant |
| `POST` | `/api/plants/:id/health` | `multipart/form-data` with `photo` → runs a Plant.id health assessment, saves the photo and the scan, returns the scan |
| `GET` | `/api/plants/:id/health` | every scan for the plant, oldest first (the health journal) |
| `GET` | `/api/plants/:id/health/latest` | the plant's most recent scan, or `null` |
| `GET` | `/api/plants/:id/health/:scanId` | one past scan |
| `GET` | `/api/catalog` | the Discover plant catalogue |
| `GET` | `/api/catalog/views` | how often I've opened each plant: `{ slug: { count, last_viewed_at } }` |
| `GET` | `/api/catalog/:slug` | one catalogue plant |
| `POST` | `/api/catalog/:slug/view` | count one visit to a plant (204; 404 if no such plant) |
| `GET` | `/api/location` | my saved place, or `null` |
| `PUT` | `/api/location` | save `{ place_name, latitude, longitude }` (rounded to ~1 km) |
| `PATCH` | `/api/location` | `{ weather_alerts_on }`: hot / cold notifications on or off |
| `DELETE` | `/api/location` | forget my place |
| `GET` | `/api/forecast` | `{ place: null }`, or `{ place, days, alerts, groups }` for this week (`alerts` per plant, `groups` per kind of weather) |
| `GET` | `/api/names?species=&common=` | `{ names: { hi, mr, ta, ml }, source: 'potpal' \| 'wikidata' \| null }` |
| `GET` | `/api/wishlist` | my saved plants, newest first (catalogue rows + `saved_at`) |
| `PUT` | `/api/wishlist/:slug` | save a plant (saving twice is fine; unknown plant → 404) |
| `DELETE` | `/api/wishlist/:slug` | remove a saved plant |
| `GET` | `/api/push/key` | the public key phones subscribe with |
| `POST` | `/api/push/subscriptions` | save this phone: `{ subscription, timeZone }` |
| `DELETE` | `/api/push/subscriptions` | forget this phone: `{ endpoint }` |
| `POST` | `/api/push/test` | send "Test from Potpal" to my phones |
| `POST` | `/api/cron/reminders` | send the notifications due now (`Authorization: Bearer <CRON_SECRET>`; `?dryRun=1` to preview) |

A saved scan looks like this (`score` is Plant.id's "is healthy" probability × 100):

```json
{
  "id": "…", "plant_id": "…", "photo_url": "https://…", "created_at": "…",
  "score": 34,
  "headline": "Miso could use some care.",
  "summary": "It looks most like water deficiency. Here's how to help.",
  "issues": [{ "name": "Water deficiency", "probability": 0.41, "description": "…" }],
  "steps": [{ "icon": "drop", "title": "Water the plant thoroughly", "detail": "…" }]
}
```

## Not built yet

- Remembering which feel-better steps were ticked off on a health check.
- Live shopping listings (titles, prices, thumbnails). Discover links to each
  shop's search instead.
- A native app-store build. The app can be wrapped with Capacitor later.
