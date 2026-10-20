<!--
  Top app bar used on the inner screens: back arrow, title, and an optional
  action button on the right (passed in through the default slot).

  The arrow either goes back to wherever the user just was (default), or, with
  `up`, to the screen's parent (e.g. care plan → My plants). See lib/navigation.js.
-->
<script setup>
import { useRouter } from 'vue-router'
import Icon from './Icon.vue'
import { goBack, goUp } from '../lib/navigation.js'

const props = defineProps({
  title: { type: String, required: true },
  // The parent screen to go "up" to. Leave out for a plain back.
  up: { type: String, default: null },
  // Where a plain back goes when there's no history (e.g. the page was opened directly)
  fallback: { type: String, default: '/' },
})

const router = useRouter()

function onArrow() {
  if (props.up) goUp(router, props.up)
  else goBack(router, props.fallback)
}
</script>

<template>
  <header class="appbar">
    <button class="icon-btn" aria-label="Back" @click="onArrow">
      <Icon name="back" />
    </button>
    <h1 class="title">{{ title }}</h1>
    <slot />
  </header>
</template>
