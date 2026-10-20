<!--
  "Photo: Mokkie, CC BY-SA 3.0, via Wikimedia Commons"
  Free Commons photos ask for this credit wherever they're shown (CC BY and
  CC BY-SA licences). Renders nothing for Potpal's own design photos.
    <PhotoCredit :plant="catalogPlant" />
-->
<script setup>
defineProps({ plant: { type: Object, required: true } })
</script>

<template>
  <p v-if="plant.image_source_url" class="photo-credit">
    Photo:
    <a :href="plant.image_source_url" target="_blank" rel="noopener noreferrer">{{ plant.image_author || 'unknown author' }}</a>,
    <a v-if="plant.image_licence_url" :href="plant.image_licence_url" target="_blank" rel="noopener noreferrer">{{ plant.image_licence }}</a>
    <span v-else>{{ plant.image_licence }}</span>,
    via Wikimedia Commons
  </p>
</template>
