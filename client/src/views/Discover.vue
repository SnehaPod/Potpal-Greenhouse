<!--
  Screen 6 · Discover your plant match
  The user describes their space; we suggest plants that fit it. Real data:
  GET /api/catalog, ordered by rankForYou() in src/lib/catalog.js, which keeps
  the list fresh:
    • plants already in the wishlist step aside (see Saved plants)
    • plants you've opened a lot sink; never-opened ones show "New to you"
    • close matches take turns at the top, day by day
  The "% match" is always the real fit. The "where to buy" links live on the detail screen.
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from '../components/Icon.vue'
import ToggleSwitch from '../components/ToggleSwitch.vue'
import BottomNav from '../components/BottomNav.vue'
import PlantThumb from '../components/PlantThumb.vue'
import LightMeter from '../components/LightMeter.vue'
import { listCatalog, getCatalogViews } from '../lib/api.js'
import { LIGHT_LEVELS, rankForYou } from '../lib/catalog.js'
import { discoverFilters } from '../lib/discoverStore.js'
import { ROOMS } from '../lib/plants.js'
import { auth } from '../lib/auth.js'
import { wishlist, loadWishlist, isSaved, toggleSaved } from '../lib/wishlist.js'

const catalog = ref([])
const views = ref({}) // how often you've opened each plant
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    // The catalogue, your visits, and what's already saved
    const [plants, seen] = await Promise.all([listCatalog(), getCatalogViews().catch(() => ({})), loadWishlist()])
    catalog.value = plants
    views.value = seen
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

// The suggestions, freshest good fit first (saved plants are left out)
const matches = computed(() =>
  rankForYou(catalog.value, {
    filters: discoverFilters,
    savedSlugs: wishlist.slugs, // reactive: hearting a plant moves it out at once
    views: views.value,
    userId: auth.user?.id,
  }),
)
const best = computed(() => matches.value[0])
const others = computed(() => matches.value.slice(1, 6)) // keep the list tidy

// Saved plants that fit the current filters (they're one tap away in Saved plants)
const savedHere = computed(
  () => catalog.value.filter((p) => wishlist.slugs.has(p.slug) && (!discoverFilters.petSafeOnly || p.pet_safe)).length,
)

async function heart(slug) {
  try {
    await toggleSaved(slug)
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <section class="screen">
    <header class="appbar appbar--flush">
      <h1 class="title">Discover</h1>
      <!-- Saved plants, with how many there are -->
      <RouterLink to="/wishlist" class="icon-btn heart-count" :aria-label="`Saved plants (${wishlist.slugs.size})`">
        <Icon name="heart" color="#203C2D" />
        <span v-if="wishlist.slugs.size" class="count" aria-hidden="true">{{ wishlist.slugs.size }}</span>
      </RouterLink>
    </header>

    <main class="screen-body">
      <div class="stack" style="gap: 9px">
        <p class="eyebrow green">Find your leafy soulmate</p>
        <h2 class="d" style="font-size: 32px; line-height: 1.15">Right plant. Happy place.</h2>
        <p class="lede">Tell us about your space. We'll do the matching.</p>
      </div>

      <section class="card" style="gap: 18px">
        <label class="row field--filled" style="padding: 10px 12px; cursor: pointer">
          <Icon name="home" :size="22" color="#286344" />
          <span class="grow stack" style="gap: 4px">
            <span class="t11 lh muted">Your room</span>
            <select v-model="discoverFilters.room" style="all: unset; font-weight: 600; font-size: 16px; cursor: pointer" aria-label="Your room">
              <option v-for="r in ROOMS" :key="r">{{ r }}</option>
            </select>
          </span>
          <Icon name="chevron-down" :size="20" color="#286344" />
        </label>

        <div class="stack" style="gap: 10px">
          <p class="semi t12 muted">How much light?</p>
          <div class="chips" role="radiogroup" aria-label="How much light?">
            <button
              v-for="level in LIGHT_LEVELS"
              :key="level"
              class="chip"
              role="radio"
              :aria-checked="discoverFilters.light === level"
              @click="discoverFilters.light = level"
            >
              <Icon name="check" :size="16" color="#286344" />{{ level }}
            </button>
          </div>
          <!-- Or measure it with a photo (sets the chip above) -->
          <LightMeter />
        </div>

        <div class="divider"></div>

        <div class="row" style="gap: 10px">
          <Icon name="paw" :size="22" color="#286344" />
          <p class="grow semi t14">Safe for curious paws</p>
          <ToggleSwitch v-model="discoverFilters.petSafeOnly" label="Safe for curious paws" />
        </div>
      </section>

      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <p v-if="loading" class="muted t13">Finding your matches…</p>

      <!-- Every plant that fits is already saved -->
      <div v-else-if="matches.length === 0 && savedHere" class="empty">
        <Icon name="heart" :size="32" color="#286344" />
        <p class="d" style="font-size: 20px">You've saved every match!</p>
        <p class="t13 lh muted">Try another room or light level for fresh ideas, or see the plants you've saved.</p>
        <RouterLink to="/wishlist" class="btn-primary" style="margin-top: 8px">
          <Icon name="heart" :size="20" color="white" />See saved plants
        </RouterLink>
      </div>

      <div v-else-if="matches.length === 0" class="empty">
        <Icon name="compass" :size="32" color="#286344" />
        <p class="d" style="font-size: 20px">No matches with these filters</p>
        <p class="t13 lh muted">Try turning off "safe for curious paws" to see more plants.</p>
      </div>

      <section v-else class="stack" style="gap: 12px">
        <div class="row" style="justify-content: space-between; white-space: nowrap">
          <h3 class="d" style="font-size: 22px">Your room's dream team</h3>
          <span class="semi t12 muted">{{ matches.length }} matches</span>
        </div>

        <!-- Best match: the big card -->
        <div class="best">
          <div class="photo">
            <div class="thumb thumb--wide">
              <PlantThumb :src="best.image_url" :alt="best.common_name" :name="best.common_name" />
            </div>
            <span class="overlay badge badge--butter" style="left: 10px; top: 10px"><Icon name="sparkle" :size="16" />{{ best.match }}% match</span>
            <button
              class="save-btn"
              :aria-label="`Save ${best.common_name}`"
              :aria-pressed="isSaved(best.slug)"
              @click="heart(best.slug)"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M2.96748 6.38385C2.33689 7.30078 1.99929 8.38741 1.99927 9.50022C1.99927 11.8002 3.49938 13.5003 4.9995 15.0003L10.5079 20.3323C10.697 20.544 10.9289 20.7129 11.1883 20.828C11.4476 20.9432 11.7286 21.0018 12.0123 21C12.2961 20.9982 12.5762 20.936 12.8341 20.8176C13.092 20.6992 13.3218 20.5273 13.5082 20.3133L19.0006 15.0003C20.5007 13.5003 22.0008 11.7902 22.0008 9.50022C22.0061 8.38496 21.6716 7.29454 21.0418 6.37409C20.4121 5.45363 19.5169 4.74679 18.4754 4.34765C17.4339 3.94851 16.2956 3.876 15.2119 4.13977C14.1282 4.40353 13.1506 4.99107 12.4091 5.82418C12.3567 5.88019 12.2933 5.92485 12.223 5.95538C12.1526 5.98591 12.0767 6.00167 12 6.00167C11.9233 6.00167 11.8475 5.98591 11.7771 5.95538C11.7067 5.92485 11.6434 5.88019 11.591 5.82418C10.8472 4.99645 9.86974 4.41381 8.7878 4.15321C7.70586 3.89261 6.57032 3.9663 5.53115 4.36457C4.49198 4.76283 3.59806 5.46692 2.96748 6.38385Z"
                  :fill="isSaved(best.slug) ? 'currentColor' : 'none'"
                  stroke="currentColor"
                  stroke-width="1.8"
                />
              </svg>
            </button>
          </div>
          <RouterLink :to="`/discover/${best.slug}`" class="row" style="gap: 10px; padding: 0 6px 8px; width: 100%">
            <span class="grow stack" style="gap: 5px">
              <span class="d" style="font-size: 23px; line-height: 1.15">
                {{ best.common_name }} <span v-if="best.isNew" class="new-tag">New to you</span>
              </span>
              <span class="t12 lh green">{{ best.tagline }}</span>
            </span>
            <Icon name="arrow-right" :size="24" color="#286344" />
          </RouterLink>
        </div>

        <!-- The rest -->
        <RouterLink v-for="plant in others" :key="plant.slug" :to="`/discover/${plant.slug}`" class="rec">
          <span class="rec-thumb"><PlantThumb :src="plant.image_url" :alt="plant.common_name" :name="plant.common_name" /></span>
          <span class="grow">
            <span class="d" style="font-size: 18px; line-height: 1.15">
              {{ plant.common_name }} <span v-if="plant.isNew" class="new-tag">New to you</span>
            </span>
            <span class="t12 lh muted">{{ plant.tagline }}</span>
            <span class="semi t12 green">{{ plant.match }}% match<template v-if="plant.pet_safe"> · Pet-safe</template></span>
          </span>
          <Icon name="chevron-right" :size="20" color="#286344" />
        </RouterLink>

        <!-- Saved plants aren't suggested again; they're one tap away -->
        <RouterLink v-if="savedHere" to="/wishlist" class="wish-link">
          <Icon name="heart" :size="18" color="#286344" />
          <span class="grow semi t13">{{ savedHere }} {{ savedHere === 1 ? 'plant' : 'plants' }} in your wishlist</span>
          <Icon name="arrow-right" :size="18" color="#286344" />
        </RouterLink>
      </section>

      <!-- Commons photos need a credit; the thumbnails are too small, so they're on their own page -->
      <p class="footnote">
        Some photos are from Wikimedia Commons. <RouterLink to="/credits" class="green semi">Photo credits</RouterLink>
      </p>
    </main>

    <BottomNav />
  </section>
</template>
