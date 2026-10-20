<!--
  Material-style on/off switch from the design. Use with v-model:
    <ToggleSwitch v-model="remindersOn" label="Push reminders" />
-->
<script setup>
import Icon from './Icon.vue'

const on = defineModel({ type: Boolean, default: false })
defineProps({ label: { type: String, required: true } })
</script>

<template>
  <button class="switch" role="switch" :aria-checked="on" :aria-label="label" @click="on = !on">
    <span class="thumb"><Icon name="check" :size="16" color="#286344" /></span>
  </button>
</template>
