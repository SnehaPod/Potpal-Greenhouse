<!--
  "This week" on My plants: the local forecast and any early warnings for the
  crew (heat, cold, dark days). Data: GET /api/forecast. The rules live on the
  server in lib/forecast.js; each warning explains itself on the plant's care plan.
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from './Icon.vue'
import { getForecast } from '../lib/api.js'
import { ALERT_ICONS } from '../lib/weather.js'

const forecast = ref(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    forecast.value = await getForecast()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

// One row per kind of weather ("Hot days ahead for Miso, Mochi and Olive").
// Each plant's own warning, with its reason, is on its care plan.
const groups = computed(() => forecast.value?.groups ?? [])

/** "Mon" from "2026-10-19" */
const shortDay = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
</script>

<template>
  <!-- Quietly skip while loading, so the home screen doesn't jump around -->
  <template v-if="!loading">
    <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>

    <!-- No location yet: invite them to set one -->
    <RouterLink v-else-if="!forecast?.place" to="/location" class="health-prompt">
      <Icon name="humidity" :size="32" color="#286344" />
      <span class="grow stack" style="gap: 5px">
        <span class="d" style="font-size: 19px; line-height: 1.15">Get early warnings for your weather</span>
        <span class="t13 lh muted">Tell us your city and we'll flag hot, cold or dark weeks before they reach your crew.</span>
      </span>
      <Icon name="arrow-right" :size="22" color="#286344" />
    </RouterLink>

    <section v-else class="card" style="gap: 14px" aria-labelledby="week-h">
      <div class="row" style="justify-content: space-between">
        <div class="stack" style="gap: 3px">
          <h2 id="week-h" class="d" style="font-size: 20px">This week</h2>
          <p class="t12 muted">{{ forecast.place }}</p>
        </div>
        <RouterLink to="/location" class="semi t12 green">Change</RouterLink>
      </div>

      <!-- 7-day strip: weekday and the day's high -->
      <ol class="week-strip" aria-label="Daily high temperatures">
        <li v-for="day in forecast.days" :key="day.date">
          <span class="t11 muted">{{ shortDay(day.date) }}</span>
          <span class="semi t13">{{ day.max }}°</span>
        </li>
      </ol>

      <div class="divider"></div>

      <p v-if="!groups.length" class="t13 lh muted">All calm this week. No weather worries for your crew.</p>

      <template v-for="group in groups" :key="group.kind">
        <!-- Just one plant affected: the whole row opens it -->
        <RouterLink v-if="group.plants.length === 1" :to="`/plants/${group.plants[0].id}`" class="row task">
          <span class="symbol"><Icon :name="ALERT_ICONS[group.kind]" :size="23" color="#286344" /></span>
          <span class="grow stack" style="gap: 4px">
            <span class="semi t14">{{ group.title }}</span>
            <span class="t12 lh muted">{{ group.detail }}</span>
          </span>
          <Icon name="chevron-right" :size="20" color="#286344" />
        </RouterLink>

        <!-- Several plants: one row, with a chip per plant to open its own advice -->
        <div v-else class="row task" style="align-items: flex-start">
          <span class="symbol"><Icon :name="ALERT_ICONS[group.kind]" :size="23" color="#286344" /></span>
          <div class="grow stack" style="gap: 4px">
            <p class="semi t14">{{ group.title }}</p>
            <p class="t12 lh muted">{{ group.detail }}</p>
            <div class="plant-chips">
              <RouterLink v-for="plant in group.plants" :key="plant.id" :to="`/plants/${plant.id}`" class="plant-chip">
                {{ plant.nickname }}
              </RouterLink>
            </div>
          </div>
        </div>
      </template>
    </section>
  </template>
</template>
