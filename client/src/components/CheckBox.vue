<!--
  Round-cornered checkbox from the design. Use with v-model:
    <CheckBox v-model="done" label="Mark Miso watered" />
-->
<script setup>
import Icon from './Icon.vue'

const checked = defineModel({ type: Boolean, default: false })
defineProps({
  label: { type: String, required: true }, // read out by screen readers
  small: { type: Boolean, default: false },
})
</script>

<template>
  <button
    class="check"
    :class="{ 'check--sm': small }"
    role="checkbox"
    :aria-checked="checked"
    :aria-label="label"
    @click="checked = !checked"
  >
    <Icon name="check" color="white" :size="16" />
  </button>
</template>
