<!--
  Screen 7 · Your plant match  (route: /discover/:slug)
  Why a catalogue plant suits the user's space, how to care for it, and where to
  buy one. Real data: GET /api/catalog/:slug. The fit (match %, reasons) is
  worked out from the Discover filters the user picked (src/lib/catalog.js).
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from '../components/Icon.vue'
import AppBar from '../components/AppBar.vue'
import FactTiles from '../components/FactTiles.vue'
import PlantThumb from '../components/PlantThumb.vue'
import LocalNames from '../components/LocalNames.vue'
import PhotoCredit from '../components/PhotoCredit.vue'
import { getCatalogPlant, recordCatalogView } from '../lib/api.js'
import { scorePlant, buildReasons, buildCare } from '../lib/catalog.js'
import { shoppingLinks } from '../lib/shopping.js'
import { discoverFilters } from '../lib/discoverStore.js'
import { loadWishlist, isSaved, toggleSaved } from '../lib/wishlist.js'

const props = defineProps({ slug: { type: String, required: true } })

const plant = ref(null)
const loading = ref(true)
const error = ref('')
const saveError = ref('')

onMounted(async () => {
  try {
    ;[plant.value] = await Promise.all([getCatalogPlant(props.slug), loadWishlist()])
    countVisit()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

/**
 * Tell the server you opened this plant, so Discover can keep suggestions fresh.
 * Only once per plant per session: reloading or going back and forth isn't
 * really "visiting it again". It's a nice-to-have, so any failure is ignored.
 */
function countVisit() {
  const key = `potpal:visited:${props.slug}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    /* storage unavailable (e.g. private mode): count it anyway */
  }
  recordCatalogView(props.slug).catch(() => {})
}

// All derived from the plant + the filters the user chose on Discover
const match = computed(() => scorePlant(plant.value, discoverFilters))
const reasons = computed(() => buildReasons(plant.value, discoverFilters))
const care = computed(() => buildCare(plant.value))
const shops = computed(() => shoppingLinks(plant.value))

// Saved to the wishlist? (Shared with Discover and Saved plants)
const saved = computed(() => isSaved(props.slug))
async function heart() {
  saveError.value = ''
  try {
    await toggleSaved(props.slug)
  } catch (e) {
    saveError.value = e.message
  }
}
</script>

<template>
  <section class="screen">
    <AppBar title="Your plant match" fallback="/discover">
      <button class="icon-btn" aria-label="Save to wishlist" :aria-pressed="saved" @click="heart">
        <Icon name="heart" color="#203C2D" />
      </button>
    </AppBar>

    <main v-if="plant" class="screen-body">
      <!-- The photo, with its credit right under it when it comes from Wikimedia Commons -->
      <div class="stack" style="gap: 6px">
        <div class="photo">
          <div class="thumb thumb--hero">
            <PlantThumb :src="plant.image_url" :alt="plant.common_name" :name="plant.common_name" />
          </div>
          <span class="overlay badge badge--butter" style="left: 14px; top: 14px">
            <Icon name="sparkle" :size="16" />{{ match }}% match for your space
          </span>
        </div>
        <PhotoCredit :plant="plant" />
      </div>

      <div class="stack" style="gap: 9px">
        <h2 class="h-hero">{{ plant.common_name }}</h2>
        <p class="t13 lh muted" style="font-style: italic">{{ plant.scientific_name }}</p>
        <p class="lede">{{ plant.blurb }}</p>
      </div>

      <!-- Its name in Hindi, Marathi, Tamil and Malayalam -->
      <LocalNames :species="plant.scientific_name" :common-name="plant.common_name" />

      <section class="card card--mint" style="gap: 18px">
        <h3 class="d" style="font-size: 23px; line-height: 1.15">Why you two click</h3>
        <div v-for="reason in reasons" :key="reason.title" class="row">
          <Icon :name="reason.icon" :size="24" color="#286344" />
          <div class="grow stack" style="gap: 4px">
            <p class="semi t14" style="line-height: 1.3">{{ reason.title }}</p>
            <p class="t12 lh muted">{{ reason.detail }}</p>
          </div>
          <Icon name="check" :size="18" color="#286344" />
        </div>
      </section>

      <section class="stack" style="gap: 14px">
        <h3 class="d" style="font-size: 23px; line-height: 1.15">A little love looks like…</h3>
        <FactTiles :facts="care" white />
        <div class="row" style="gap: 9px; align-items: flex-start">
          <Icon name="bulb" :size="20" color="#A26830" />
          <p class="grow t13 lh muted">{{ plant.care_tip }}</p>
        </div>
      </section>

      <!-- Where to buy: each link opens that shop's live search for this plant -->
      <section class="card" style="gap: 14px">
        <div class="stack" style="gap: 4px">
          <h3 class="d" style="font-size: 23px; line-height: 1.15">Where to buy</h3>
          <p class="t12 lh muted">Opens a live search on each shop. Prices and stock are theirs, not ours.</p>
        </div>
        <div class="shops">
          <a
            v-for="shop in shops"
            :key="shop.name"
            class="shop-link"
            :href="shop.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="grow semi t14">{{ shop.name }}</span>
            <Icon name="arrow-right" :size="18" color="#286344" />
          </a>
        </div>
      </section>

      <p v-if="saveError" class="notice notice--error" role="alert">{{ saveError }}</p>

      <!-- Not saved yet: one big button. Saved: say so, link to the list, and offer to undo. -->
      <button v-if="!saved" class="btn-primary" @click="heart">
        <Icon name="heart" :size="20" color="white" />
        <span>Save to my plant wishlist</span>
      </button>
      <template v-else>
        <RouterLink to="/wishlist" class="notice row" style="gap: 10px">
          <Icon name="heart" :size="20" color="#286344" />
          <span class="grow semi">Saved to your wishlist</span>
          <span class="green semi t13">See all</span>
        </RouterLink>
        <button class="btn-secondary" @click="heart">Remove from wishlist</button>
      </template>
      <RouterLink to="/identify" class="link" style="font-size: 13px">Already have one? Add to my plants</RouterLink>
    </main>

    <main v-else class="screen-body">
      <p v-if="loading" class="muted t13">Loading…</p>
      <template v-else>
        <p class="lede">{{ error || "We couldn't find that plant." }}</p>
        <RouterLink to="/discover" class="link">Back to Discover</RouterLink>
      </template>
    </main>
  </section>
</template>
