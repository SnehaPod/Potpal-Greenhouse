<!--
  The app shell from the design: full-screen on phones, a centred
  "device" on bigger screens. Each route renders one screen inside it.
-->
<script setup>
import { watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth } from './lib/auth.js'

const router = useRouter()
const route = useRoute()

// If the user signs out (or their session ends), take them to sign-in
watch(
  () => auth.user,
  (user) => {
    if (!user && !route.meta.public) router.replace('/sign-in')
  },
)
</script>

<template>
  <div class="app">
    <!-- Each new screen fades up gently ("page" in main.css → Motion). Keyed by path,
         so going from one plant to another counts as a new screen too. -->
    <RouterView v-slot="{ Component, route: current }">
      <Transition name="page">
        <component :is="Component" :key="current.path" />
      </Transition>
    </RouterView>
  </div>
</template>
