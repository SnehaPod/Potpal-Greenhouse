<!--
  Add a plant by name  (route: /identify/search)
  For people who already know their plant, or would rather not take a photo.
  They type a common, scientific or local-language name; the server searches
  Potpal's own plant lists and GBIF, fixes small spelling mistakes ("Did you
  mean…?") and says when a photo would work better (server/lib/plantSearch.js).
  Picking a result opens the usual "Plant identified" screen to name and add it.
  Built only from the app's existing pieces: the outlined field from "Your
  weather", the plant rows from Discover, the mint prompt from Home.
-->
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import AppBar from '../components/AppBar.vue'
import PlantThumb from '../components/PlantThumb.vue'
import { searchSpecies, speciesDetails } from '../lib/api.js'
import { setIdentifyResult } from '../lib/identifyStore.js'

const router = useRouter()

const query = ref('')
const results = ref([])
const nudge = ref(false)
const group = ref(null) // e.g. "Ficus" when the name covers many plants
const searched = ref('') // the text the results are for
const searching = ref(false)
const opening = ref('') // the result being opened
const error = ref('')
let fruitless = 0 // different names tried in a row without picking anything
let lastTried = ''

// Search as the user types, once they pause
let timer = null
function onType() {
  clearTimeout(timer)
  error.value = ''
  if (query.value.trim().length < 2) {
    results.value = []
    searched.value = ''
    return
  }
  timer = setTimeout(search, 350)
}

async function search() {
  const q = query.value.trim()
  searching.value = true
  try {
    const answer = await searchSpecies(q)
    if (q !== query.value.trim()) return // they kept typing; a newer search is on its way
    results.value = answer.results
    group.value = answer.group
    searched.value = q
    // Typing more of the same word isn't a new attempt; trying a different name is
    const lower = q.toLowerCase()
    if (!lower.startsWith(lastTried) && !lastTried.startsWith(lower)) fruitless++
    lastTried = lower
    // Three searches without a pick: a photo is probably the easier way
    nudge.value = answer.nudge || fruitless >= 3
  } catch (e) {
    error.value = e.message
  } finally {
    searching.value = false
  }
}

// The top result is a spelling correction? Say so, like a search engine would
const didYouMean = computed(() => results.value[0]?.kind === 'fuzzy')

/** The green line under each result: why it's here */
function why(result) {
  if (result.wasName) return `Once called ${result.wasName}`
  if (result.alsoKnownAs) return `Also called ${result.alsoKnownAs}`
  if (result.inCatalog) return 'In our care guide'
  if (['common', 'partial', 'group'].includes(result.kind)) return 'Name match'
  if (result.kind === 'fuzzy') return 'Closest spelling'
  return 'Scientific name'
}

/** The big name: its common name if it has a different one */
const title = (r) => (r.commonName && r.commonName.toLowerCase() !== r.name.toLowerCase() ? r.commonName : r.name)

/** Picked one: fetch its care details, then the usual "name it and add it" screen */
async function choose(result) {
  opening.value = result.name
  error.value = ''
  try {
    const suggestion = await speciesDetails(result.name, result.commonName)
    const credit = result.photo // who took the species photo, for the credit line
    setIdentifyResult({
      photoUrl: null, // no photo of their own: the result screen shows the species photo, or a placeholder
      imageUrl: result.imageUrl,
      imageCredit: credit && {
        image_author: credit.author,
        image_licence: credit.licence,
        image_licence_url: credit.licenceUrl,
        image_source_url: credit.sourceUrl,
        image_via: credit.via,
      },
      suggestions: [{ ...suggestion, commonName: result.commonName ?? suggestion.commonName }],
      source: 'search',
    })
    router.push('/identified')
  } catch (e) {
    error.value = e.message
  } finally {
    opening.value = ''
  }
}
</script>

<template>
  <section class="screen">
    <AppBar title="Add by name" fallback="/identify" />

    <main class="screen-body">
      <div class="stack" style="gap: 9px">
        <p class="eyebrow green">Know your plant?</p>
        <h2 class="d" style="font-size: 30px; line-height: 1.15">What's your plant called?</h2>
        <p class="lede">A common name, a scientific name, or its name in Hindi, Marathi, Tamil or Malayalam.</p>
      </div>

      <label class="outlined">
        <span class="label">Plant name</span>
        <input
          v-model="query"
          aria-label="Plant name"
          type="search"
          placeholder="e.g. snake plant, Monstera, मनी प्लांट"
          autocomplete="off"
          enterkeyhint="search"
          @input="onType"
          @keydown.enter="search"
        />
      </label>

      <p v-if="searching" class="muted t13">Searching…</p>
      <Transition name="rise">
        <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      </Transition>

      <!-- Nothing at all: a photo is the way -->
      <Transition name="rise">
        <div v-if="searched && !searching && !results.length" class="empty">
          <Icon name="sprout" :size="32" color="#286344" />
          <p class="d" style="font-size: 20px">We couldn't find “{{ searched }}”</p>
          <p class="t13 lh muted">Check the spelling, or let a photo do the work: one clear leaf is all we need.</p>
          <RouterLink to="/identify" replace class="btn-primary" style="margin-top: 8px">
            <Icon name="scan" :size="20" color="white" />Take a photo instead
          </RouterLink>
        </div>
      </Transition>

      <template v-if="results.length">
        <p class="semi t12 muted">
          <template v-if="group">“{{ group }}” covers lots of plants. These are a few:</template>
          <template v-else>{{ results.length }} {{ results.length === 1 ? 'match' : 'matches' }}</template>
        </p>

        <TransitionGroup name="list" tag="div" class="stack" style="gap: 12px">
          <button
            v-for="(result, i) in results"
            :key="result.name"
            type="button"
            class="rec"
            style="text-align: left"
            :disabled="!!opening"
            @click="choose(result)"
          >
            <span class="rec-thumb"><PlantThumb :src="result.imageUrl" :alt="title(result)" :name="title(result)" /></span>
            <span class="grow">
              <span v-if="i === 0 && didYouMean" class="new-tag" style="margin: 0 0 2px; align-self: flex-start">Did you mean…?</span>
              <span class="d" style="font-size: 18px; line-height: 1.15">{{ title(result) }}</span>
              <span v-if="title(result) !== result.name" class="t12 lh muted" style="font-style: italic">{{ result.name }}</span>
              <span class="semi t12 green">{{ opening === result.name ? 'Opening…' : why(result) }}</span>
            </span>
            <Icon name="chevron-right" :size="20" color="#286344" />
          </button>
        </TransitionGroup>
      </template>

      <!-- Unsure matches, a whole group, or a few searches without luck: suggest a photo -->
      <Transition name="rise">
        <RouterLink v-if="nudge && results.length" to="/identify" replace class="health-prompt">
          <Icon name="scan" :size="32" color="#286344" />
          <span class="grow stack" style="gap: 5px">
            <span class="d" style="font-size: 19px; line-height: 1.15">Not sure of the name?</span>
            <span class="t13 lh muted">One clear photo of a leaf will tell us exactly. Use a photo instead.</span>
          </span>
          <Icon name="arrow-right" :size="22" color="#286344" />
        </RouterLink>
      </Transition>

      <p class="footnote">
        Names from Potpal's plant guide and GBIF. Photos from iNaturalist and Wikimedia Commons, credited when you pick one.
      </p>
    </main>
  </section>
</template>
