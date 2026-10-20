<!--
  Saved plants  (route: /wishlist)
  Discover plants the user hearted, newest first, each with a quick way to find
  one to buy and a heart to un-save it. Data: GET /api/wishlist.
  Not in the Figma file, so it reuses Discover's list rows and the shop links.
-->
<script setup>
import { ref, onMounted } from 'vue'
import Icon from '../components/Icon.vue'
import AppBar from '../components/AppBar.vue'
import PlantThumb from '../components/PlantThumb.vue'
import { listWishlist } from '../lib/api.js'
import { loadWishlist, toggleSaved } from '../lib/wishlist.js'
import { shoppingLinks } from '../lib/shopping.js'

const plants = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    ;[plants.value] = await Promise.all([listWishlist(), loadWishlist()])
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

/** Un-save a plant: take it off the screen at once, put it back if that fails */
async function remove(plant) {
  const before = plants.value
  plants.value = plants.value.filter((p) => p.slug !== plant.slug)
  error.value = ''
  try {
    await toggleSaved(plant.slug)
  } catch (e) {
    plants.value = before
    error.value = e.message
  }
}

/** "Saved Oct 19" */
const savedOn = (date) => `Saved ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
</script>

<template>
  <section class="screen">
    <AppBar title="Saved plants" fallback="/discover" />

    <main class="screen-body">
      <div class="stack" style="gap: 9px">
        <p class="eyebrow green">Your plant wishlist</p>
        <h2 class="d" style="font-size: 30px; line-height: 1.15">Plants you've got your eye on.</h2>
      </div>

      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <p v-if="loading" class="muted t13">Loading…</p>

      <div v-else-if="!plants.length" class="empty">
        <Icon name="heart" :size="32" color="#286344" />
        <p class="d" style="font-size: 20px">Nothing saved yet</p>
        <p class="t13 lh muted">Tap the heart on any plant in Discover to keep it here for later.</p>
        <RouterLink to="/discover" class="btn-primary" style="margin-top: 8px">
          <Icon name="compass" :size="20" color="white" />Find plants for your space
        </RouterLink>
      </div>

      <template v-else>
        <p class="semi t12 muted">{{ plants.length }} saved</p>
        <article v-for="plant in plants" :key="plant.slug" class="wish">
          <RouterLink :to="`/discover/${plant.slug}`" class="row" style="gap: 12px; min-width: 0; flex: 1">
            <span class="rec-thumb"><PlantThumb :src="plant.image_url" :alt="plant.common_name" :name="plant.common_name" /></span>
            <span class="grow stack" style="gap: 4px">
              <span class="d" style="font-size: 18px; line-height: 1.15">{{ plant.common_name }}</span>
              <span class="t12 lh muted">{{ plant.tagline }}</span>
              <span class="semi t12 green">
                {{ savedOn(plant.saved_at) }}<template v-if="plant.pet_safe"> · Pet-safe</template>
              </span>
            </span>
          </RouterLink>
          <div class="wish-actions">
            <button class="save-btn" style="position: static" :aria-label="`Remove ${plant.common_name} from saved plants`" aria-pressed="true" @click="remove(plant)">
              <Icon name="heart" :size="22" />
            </button>
            <!-- The quickest shop: Google Shopping searches many shops at once -->
            <a :href="shoppingLinks(plant).at(-1).url" target="_blank" rel="noopener noreferrer" class="semi t12 green">Buy</a>
          </div>
        </article>
        <p class="footnote">
          Tap a plant for every shop that sells it, and how to care for it.
          <RouterLink to="/credits" class="green semi">Photo credits</RouterLink>
        </p>
      </template>
    </main>
  </section>
</template>
