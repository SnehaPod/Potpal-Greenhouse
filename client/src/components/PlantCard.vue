<!--
  One plant in "Your leafy crew" on the home screen. Tapping it opens the care plan.
-->
<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'
import { isDueToday } from '../lib/plants.js'

const props = defineProps({ plant: { type: Object, required: true } })

const due = computed(() => isDueToday(props.plant))
</script>

<template>
  <RouterLink :to="`/plants/${plant.id}`" class="plant-card">
    <img :src="plant.photo_url || '/images/miso-home.webp'" width="160" height="145" :alt="`${plant.nickname}, a ${plant.common_name || plant.species}`" />
    <span class="details">
      <span class="name">{{ plant.nickname }}</span>
      <span class="t12 lh muted">{{ plant.common_name || plant.species }}</span>
      <span class="status">
        <Icon :name="due ? 'drop' : 'check'" :size="14" />
        {{ due ? 'Water today' : 'Happy & hydrated' }}
      </span>
    </span>
  </RouterLink>
</template>
