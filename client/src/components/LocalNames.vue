<!--
  A plant's name in Hindi, Marathi, Tamil and Malayalam.
    <LocalNames :species="plant.species" :common-name="plant.common_name" />
  Shows only the languages we have a name for, and nothing at all if we have
  none. Names from Wikidata are labelled as such, since they're less reliable
  than Potpal's own list. Data: GET /api/names (see server/lib/names.js).
-->
<script setup>
import { ref, computed, watch } from 'vue'
import { getLocalNames } from '../lib/api.js'

const props = defineProps({
  species: { type: String, default: '' },
  commonName: { type: String, default: '' },
})

// Each language's name for itself, plus the code the browser uses to pick the right font
const LANGUAGES = [
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
]

const result = ref(null)

// Load again whenever the plant changes (e.g. "See other matches")
watch(
  () => [props.species, props.commonName],
  async () => {
    result.value = null
    try {
      result.value = await getLocalNames(props.species, props.commonName)
    } catch {
      result.value = null // names are a nice extra; never break the screen over them
    }
  },
  { immediate: true },
)

const rows = computed(() => LANGUAGES.filter((lang) => result.value?.names?.[lang.code]))
</script>

<template>
  <section v-if="rows.length" class="local-names" aria-label="Name in Indian languages">
    <div v-for="lang in rows" :key="lang.code" class="local-name">
      <span class="t11 muted">{{ lang.label }} · <span :lang="lang.code">{{ lang.native }}</span></span>
      <span class="semi t14" :lang="lang.code">{{ result.names[lang.code] }}</span>
    </div>
    <p v-if="result.source === 'wikidata'" class="t11 muted local-names__source">Names from Wikidata</p>
  </section>
</template>
