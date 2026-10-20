<!--
  The row of three little "fact" tiles (Light · Water · Care level).
  Pass an array like: [{ icon: 'sun', value: 'Bright, indirect', label: 'Light' }, …]
-->
<script setup>
import Icon from './Icon.vue'

defineProps({
  facts: { type: Array, required: true },
  white: { type: Boolean, default: false }, // white tiles (used on the plant match screen)
})
</script>

<template>
  <div class="facts">
    <div v-for="fact in facts" :key="fact.label" class="fact" :class="{ 'fact--white': white }">
      <Icon :name="fact.icon" :size="22" color="#286344" />
      <p class="v">{{ fact.value }}</p>
      <p class="k">{{ fact.label }}</p>
    </div>
  </div>
</template>
