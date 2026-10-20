<!--
  Bottom navigation bar (My plants · Identify · Discover).
  RouterLink adds the "active" state for us; we turn it into aria-current
  so the design's CSS highlights the current tab.
-->
<script setup>
import { useRoute } from 'vue-router'
import Icon from './Icon.vue'

const route = useRoute()

const tabs = [
  { to: '/', label: 'My plants', icon: 'sprout' },
  { to: '/identify', label: 'Identify', icon: 'scan' },
  { to: '/discover', label: 'Discover', icon: 'compass' },
]

// "/" should only match exactly; "/discover" also covers "/discover/calathea"
function isActive(to) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <nav class="navbar" aria-label="Main">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="nav-dest"
      :aria-current="isActive(tab.to) ? 'page' : null"
    >
      <span class="ind"><Icon :name="tab.icon" /></span>
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>
