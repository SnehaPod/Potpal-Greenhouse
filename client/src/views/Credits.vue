<!--
  Photo credits  (route: /credits)
  Every Discover photo that comes from Wikimedia Commons, with its author and
  licence. Linked from Discover and Saved plants, where photos show as small
  thumbnails without room for a credit line.
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import AppBar from '../components/AppBar.vue'
import PlantThumb from '../components/PlantThumb.vue'
import PhotoCredit from '../components/PhotoCredit.vue'
import { listCatalog } from '../lib/api.js'

const catalog = ref([])
const error = ref('')

onMounted(async () => {
  try {
    catalog.value = await listCatalog()
  } catch (e) {
    error.value = e.message
  }
})

const credited = computed(() => catalog.value.filter((p) => p.image_source_url))
</script>

<template>
  <section class="screen">
    <AppBar title="Photo credits" fallback="/discover" />

    <main class="screen-body">
      <p class="lede">
        Many of the plant photos in Discover are shared freely on Wikimedia Commons by the photographers below.
        Thank you! Tap a name to see the original photo, or a licence to read it.
      </p>
      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>

      <div v-for="plant in credited" :key="plant.slug" class="wish">
        <span class="rec-thumb"><PlantThumb :src="plant.image_url" :alt="plant.common_name" :name="plant.common_name" /></span>
        <div class="grow stack" style="gap: 4px">
          <span class="d" style="font-size: 17px; line-height: 1.15">{{ plant.common_name }}</span>
          <PhotoCredit :plant="plant" />
        </div>
      </div>

      <p class="footnote">The other photos were made for Potpal.</p>
    </main>
  </section>
</template>
