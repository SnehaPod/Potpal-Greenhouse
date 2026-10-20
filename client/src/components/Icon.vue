<!--
  <Icon name="drop" />  draws one of the design's line icons.
  The colour comes from the CSS `color` of the parent (or the `color` prop),
  so the same icon works on light and dark screens.
-->
<script setup>
import { computed } from 'vue'
import icons from './icons.js'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: null }, // defaults to the icon's natural size
  color: { type: String, default: 'currentColor' },
})

const icon = computed(() => icons[props.name])
// viewBox is "0 0 W H"; use W as the default size so strokes look exactly like the design
const naturalSize = computed(() => Number(icon.value?.viewBox.split(' ')[2] ?? 24))
</script>

<template>
  <svg
    v-if="icon"
    :width="size ?? naturalSize"
    :height="size ?? naturalSize"
    :viewBox="icon.viewBox"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      v-for="(d, i) in icon.paths"
      :key="i"
      :d="d"
      :stroke="color"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
