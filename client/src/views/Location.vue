<!--
  Your weather  (route: /location)
  Where the user lives, so "This week" can warn about heat, cold and dark days.
  We keep a place name and coordinates rounded to about 1 km, and only use them
  to look up the local forecast. Not in the Figma file, so it reuses the log-in
  screen's outlined field and the app's cards and buttons.
-->
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import AppBar from '../components/AppBar.vue'
import { getLocation, searchPlaces, saveLocation, clearLocation } from '../lib/api.js'

const router = useRouter()

const current = ref(null) // the saved place, if any
const query = ref('')
const results = ref([])
const searching = ref(false)
const busy = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    current.value = await getLocation()
  } catch (e) {
    error.value = e.message
  }
})

// Search as the user types, but wait until they pause for a moment
let timer = null
function onType() {
  clearTimeout(timer)
  results.value = []
  if (query.value.trim().length < 2) return
  timer = setTimeout(search, 350)
}

async function search() {
  searching.value = true
  error.value = ''
  try {
    results.value = await searchPlaces(query.value.trim())
  } catch (e) {
    error.value = e.message
  } finally {
    searching.value = false
  }
}

async function choose(place) {
  await run(() => saveLocation({ place_name: place.name, latitude: place.latitude, longitude: place.longitude }))
}

/** "Use my current location": asks the browser, then saves it (rounded by the server) */
function useCurrentLocation() {
  error.value = ''
  if (!navigator.geolocation) {
    error.value = "Your browser can't share your location. Search for your city instead."
    return
  }
  busy.value = true
  navigator.geolocation.getCurrentPosition(
    ({ coords }) =>
      run(() => saveLocation({ place_name: 'Current location', latitude: coords.latitude, longitude: coords.longitude })),
    () => {
      busy.value = false
      error.value = "We couldn't get your location. Search for your city instead."
    },
    { maximumAge: 60 * 60 * 1000, timeout: 10_000 },
  )
}

async function remove() {
  await run(async () => {
    await clearLocation()
  })
}

/** Save or remove, then head back to My plants to see "This week" */
async function run(action) {
  busy.value = true
  error.value = ''
  try {
    await action()
    router.replace('/')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="screen">
    <AppBar title="Your weather" fallback="/" />

    <main class="screen-body">
      <div class="login-intro">
        <h1>Where do your plants live?</h1>
        <p>We'll check your local forecast each week and warn you about hot, cold or dark days before they reach your crew.</p>
      </div>

      <div v-if="current" class="card card--mint" style="gap: 6px">
        <p class="t12 muted">Using the weather for</p>
        <p class="d" style="font-size: 20px">{{ current.place_name }}</p>
      </div>

      <label class="outlined">
        <span class="label">{{ current ? 'Change your city' : 'Your city' }}</span>
        <input
          v-model="query"
          aria-label="Search for your city"
          type="search"
          placeholder="e.g. London, Mumbai, Austin"
          autocomplete="address-level2"
          @input="onType"
        />
      </label>

      <p v-if="searching" class="muted t13">Searching…</p>
      <div v-if="results.length" class="shops">
        <button v-for="place in results" :key="place.name + place.latitude" class="shop-link" :disabled="busy" @click="choose(place)">
          <Icon name="home" :size="18" color="#286344" />
          <span class="grow semi t14" style="text-align: left">{{ place.name }}</span>
          <Icon name="arrow-right" :size="18" color="#286344" />
        </button>
      </div>
      <p v-else-if="query.trim().length >= 2 && !searching" class="muted t13">No places found. Try a nearby city.</p>

      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>

      <button class="btn-secondary" :disabled="busy" @click="useCurrentLocation">Use my current location</button>
      <button v-if="current" class="link" :disabled="busy" @click="remove">Remove my location</button>

      <p class="footnote">
        We keep your place rounded to about 1 km and only use it to look up the weather. Forecasts by Open-Meteo.
      </p>
    </main>
  </section>
</template>
