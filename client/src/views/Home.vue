<!--
  Screen 1 · My plants
  Greeting, today's watering "rituals", the weekly health-scan prompt,
  and the user's leafy crew (all loaded from the API).
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from '../components/Icon.vue'
import CheckBox from '../components/CheckBox.vue'
import PlantCard from '../components/PlantCard.vue'
import ThisWeek from '../components/ThisWeek.vue'
import BottomNav from '../components/BottomNav.vue'
import { auth, signOut } from '../lib/auth.js'
import { listPlants, waterPlant } from '../lib/api.js'
import { isDueToday, wateredToday, todayLabel } from '../lib/plants.js'

const plants = ref([])
const loading = ref(true)
const error = ref('')
const showMenu = ref(false)

onMounted(async () => {
  try {
    plants.value = await listPlants()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

// Today's rituals = plants that need water today, plus ones already watered today
const rituals = computed(() => plants.value.filter((p) => wateredToday(p) || isDueToday(p)))
const doneCount = computed(() => rituals.value.filter(wateredToday).length)

// The health prompt suggests the first plant in the crew
const firstPlant = computed(() => plants.value[0])

async function markWatered(plant, checked) {
  // Unticking doesn't "un-water" a plant, so only act on a tick
  if (!checked || wateredToday(plant)) return
  try {
    const updated = await waterPlant(plant.id)
    plants.value = plants.value.map((p) => (p.id === updated.id ? updated : p))
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <section class="screen">
    <header class="appbar" style="position: relative">
      <span class="icon-btn" aria-hidden="true"><Icon name="sprout" color="#203C2D" /></span>
      <span class="brand">pot pal</span>
      <button class="avatar" :aria-label="`Account: ${auth.firstName}`" @click="showMenu = !showMenu">
        {{ auth.firstName.charAt(0) }}
      </button>
      <div v-if="showMenu" class="menu">
        <p class="t12 muted" style="padding: 8px 12px">{{ auth.user?.email }}</p>
        <RouterLink to="/location" class="menu-link">Weather location</RouterLink>
        <button @click="signOut">Sign out</button>
      </div>
    </header>

    <main class="screen-body">
      <div class="greeting">
        <p class="eyebrow muted">{{ todayLabel() }}</p>
        <h1 class="h-hero">Hey {{ auth.firstName }}, let's grow.</h1>
        <p class="lede">A little care. A lot of happy leaves.</p>
      </div>

      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>

      <!-- Today's little rituals -->
      <section v-if="rituals.length" class="card" style="gap: 17px" aria-labelledby="rituals-h">
        <div class="row" style="justify-content: space-between">
          <h2 id="rituals-h" class="d" style="font-size: 20px">Today's little rituals</h2>
          <span class="badge badge--butter">{{ doneCount }} of {{ rituals.length }} done</span>
        </div>
        <template v-for="(plant, i) in rituals" :key="plant.id">
          <div v-if="i > 0" class="divider"></div>
          <div class="row task">
            <span class="symbol" :class="{ 'symbol--mint': wateredToday(plant) }">
              <Icon :name="wateredToday(plant) ? 'tick' : 'drop'" :size="23" color="#286344" />
            </span>
            <div class="grow">
              <p class="semi t14">{{ plant.nickname }} · {{ plant.common_name || plant.species }}</p>
              <p class="t12 lh muted">
                {{ wateredToday(plant) ? 'Watered today · looking fresh!' : 'Water today · check soil first' }}
              </p>
            </div>
            <CheckBox
              :model-value="wateredToday(plant)"
              :label="`Mark ${plant.nickname} watered`"
              @update:model-value="markWatered(plant, $event)"
            />
          </div>
        </template>
      </section>

      <!-- This week: local weather + early warnings (once there's a crew to warn about) -->
      <ThisWeek v-if="plants.length" />

      <!-- Weekly health check prompt -->
      <RouterLink v-if="firstPlant" :to="`/plants/${firstPlant.id}/health`" class="health-prompt">
        <Icon name="health" :size="32" color="#286344" />
        <span class="grow stack" style="gap: 5px">
          <span class="d" style="font-size: 19px; line-height: 1.15">A check-in for {{ firstPlant.nickname }}?</span>
          <span class="t13 lh muted">Your weekly AI scan is ready. Catch little changes early.</span>
        </span>
        <Icon name="arrow-right" :size="22" color="#286344" />
      </RouterLink>

      <!-- Your leafy crew -->
      <section class="stack" style="gap: 14px" aria-labelledby="crew-h">
        <div class="row" style="justify-content: space-between">
          <h2 id="crew-h" class="d" style="font-size: 23px">Your leafy crew</h2>
          <RouterLink to="/identify" class="add-plant"><Icon name="plus" :size="20" />Add plant</RouterLink>
        </div>

        <p v-if="loading" class="muted t13">Gathering your plants…</p>

        <div v-else-if="plants.length === 0" class="empty">
          <Icon name="sprout" :size="32" color="#286344" />
          <p class="d" style="font-size: 20px">No plants yet</p>
          <p class="t13 lh muted">Snap a leaf and we'll tell you who it is, and how to keep it happy.</p>
          <RouterLink to="/identify" class="btn-primary" style="margin-top: 8px">
            <Icon name="scan" :size="20" color="white" />Identify my first plant
          </RouterLink>
        </div>

        <div v-else class="plant-cards">
          <PlantCard v-for="plant in plants" :key="plant.id" :plant="plant" />
        </div>
      </section>
    </main>

    <BottomNav />
  </section>
</template>
