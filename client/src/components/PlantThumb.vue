<!--
  A plant photo that fills its wrapper. Most catalogue plants don't ship with a
  photo (we don't have licensed images for all 20), so when there's no image we
  show a tidy on-brand placeholder instead of a broken picture.
  The caller sets the size and rounding on the wrapping element.
-->
<script setup>
import Icon from './Icon.vue'

defineProps({
  src: { type: String, default: null },
  alt: { type: String, required: true },
  name: { type: String, default: '' }, // shown on the placeholder
})
</script>

<template>
  <img v-if="src" :src="src" :alt="alt" class="plant-thumb" />
  <div v-else class="plant-thumb plant-thumb--empty" role="img" :aria-label="alt">
    <Icon name="sprout" :size="28" color="#286344" />
    <span v-if="name">{{ name }}</span>
  </div>
</template>
