<!--
  Screen 3 · Plant identified
  Shows Plant.id's best match for the photo, with quick care facts.
  The user gives it a nickname and a room, then adds it to their plants.
  "See other matches" steps through Plant.id's other suggestions.
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import AppBar from '../components/AppBar.vue'
import FactTiles from '../components/FactTiles.vue'
import LocalNames from '../components/LocalNames.vue'
import PlantThumb from '../components/PlantThumb.vue'
import PhotoCredit from '../components/PhotoCredit.vue'
import { identifyStore } from '../lib/identifyStore.js'
import { addPlant, listPlants } from '../lib/api.js'
import { isPetSafe, ROOMS } from '../lib/plants.js'
import { pickNickname } from '../lib/nicknames.js'

const router = useRouter()

// A cute starter nickname (~100 to choose from; see lib/nicknames.js). Users can change it, of course.
const nickname = ref(pickNickname())
const nicknameEdited = ref(false) // once the user types, never swap their name out
const room = ref(ROOMS[0])
const saving = ref(false)
const error = ref('')

onMounted(async () => {
  // Opened directly or after a refresh, so there's no result to show: back to the camera
  if (!identifyStore.suggestions.length) return router.replace('/identify')

  // Skip names already in the crew, so the new plant doesn't share one.
  // (A nice-to-have: if this fails, the first guess simply stays.)
  try {
    const taken = (await listPlants()).map((p) => p.nickname)
    if (!nicknameEdited.value && taken.some((n) => n.toLowerCase() === nickname.value.toLowerCase())) {
      nickname.value = pickNickname(taken)
    }
  } catch {
    /* keep the first guess */
  }
})

const match = computed(() => identifyStore.suggestions[identifyStore.index])
const total = computed(() => identifyStore.suggestions.length)
const percent = computed(() => Math.round((match.value?.probability ?? 0) * 100))
const displayName = computed(() => match.value?.commonName || match.value?.name)
const petSafe = computed(() => isPetSafe(match.value?.toxicity))
// Added by typing its name (no photo of their own): shows the catalogue's photo or a placeholder
const byName = computed(() => identifyStore.source === 'search')

const facts = computed(() => [
  { icon: 'sun', value: match.value.light, label: 'Light' },
  { icon: 'drop', value: `Every ${match.value.waterMinDays}–${match.value.waterMaxDays} days`, label: 'Water' },
  { icon: 'sprout', value: match.value.careLevel, label: 'Care level' },
])

function nextMatch() {
  identifyStore.index = (identifyStore.index + 1) % total.value
}

async function share() {
  const text = `Meet my ${displayName.value} (${match.value.name}), identified with Potpal 🌿`
  if (navigator.share) navigator.share({ title: 'Potpal', text }).catch(() => {})
  else navigator.clipboard?.writeText(text)
}

async function save() {
  if (!nickname.value.trim()) {
    error.value = 'Give your plant a nickname first.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const m = match.value
    const plant = await addPlant({
      nickname: nickname.value,
      room: room.value,
      species: m.name,
      common_name: m.commonName,
      description: m.description,
      photo_url: byName.value ? identifyStore.imageUrl : identifyStore.photoUrl,
      // The species photo's credit travels with the plant (shown on its care plan)
      ...(byName.value ? identifyStore.imageCredit : null),
      confidence: m.probability,
      light: m.light,
      light_tips: m.lightTips,
      water_min_days: m.waterMinDays,
      water_max_days: m.waterMaxDays,
      watering_tips: m.wateringTips,
      care_level: m.careLevel,
      toxicity: m.toxicity,
    })
    // replace(): pressing back from the care plan shouldn't return to this form
    router.replace(`/plants/${plant.id}`)
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section v-if="match" class="screen">
    <AppBar :title="byName ? 'Your plant' : 'Plant identified'" :fallback="byName ? '/identify/search' : '/identify'">
      <button class="icon-btn" aria-label="Share" @click="share"><Icon name="share" color="#203C2D" /></button>
    </AppBar>

    <main class="screen-body">
      <div class="stack" style="gap: 6px">
        <!-- Typed its name: the catalogue's photo (or a placeholder), like Discover's plant pages -->
        <div v-if="byName" class="photo">
          <div class="thumb thumb--hero">
            <PlantThumb :src="identifyStore.imageUrl" :alt="displayName" :name="displayName" />
          </div>
          <span class="overlay badge" style="left: 14px; top: 14px"><Icon name="pencil" :size="16" />Added by name</span>
        </div>
        <PhotoCredit v-if="byName && identifyStore.imageCredit" :plant="identifyStore.imageCredit" />
        <div v-else class="photo photo--wide">
          <img :src="identifyStore.photoUrl" width="364" height="236" alt="Your plant photo" />
          <span class="overlay badge" style="left: 14px; top: 14px"><Icon name="sparkle" :size="16" />{{ percent }}% match</span>
        </div>
        <!-- Pl@ntNet is the backup identifier; say so when it answered -->
        <p v-if="identifyStore.source === 'plantnet'" class="photo-credit">
          Identified with <a href="https://plantnet.org" target="_blank" rel="noopener noreferrer">Pl@ntNet</a>
        </p>
      </div>

      <div class="stack" style="gap: 8px">
        <p class="eyebrow green">
          {{ identifyStore.index === 0 ? 'Hello, new leaf!' : `Another possibility · ${identifyStore.index + 1} of ${total}` }}
        </p>
        <h2 class="h-hero">It's a {{ displayName }}.</h2>
        <p class="t13 muted" style="font-style: italic">
          {{ match.name }}<template v-if="match.otherNames.length"> · {{ match.otherNames.join(', ') }}</template>
        </p>
        <p v-if="match.description" class="lede">{{ match.description }}</p>
      </div>

      <!-- Its name in Hindi, Marathi, Tamil and Malayalam (when we know it) -->
      <LocalNames :species="match.name" :common-name="match.commonName" />

      <!-- Pl@ntNet answers have no care details; for plants outside our catalogue
           the tiles below are general houseplant advice, so be upfront about it -->
      <p v-if="match.careSource === 'general'" class="notice" role="note">
        We don't have care details for this plant yet. These are general houseplant tips.
      </p>

      <FactTiles :facts="facts" />

      <div class="row" style="gap: 10px; align-items: flex-start">
        <Icon name="paw" :size="20" color="#A26830" />
        <p class="grow t13 lh muted">
          <template v-if="petSafe === true">Pet-friendly. {{ match.toxicity }}</template>
          <template v-else-if="petSafe === false">Not pet-safe. {{ match.toxicity }} Keep away from curious paws.</template>
          <template v-else>We don't have toxicity info for this one. Best to keep it away from curious paws.</template>
        </p>
      </div>

      <section class="card" style="gap: 16px">
        <h3 class="d" style="font-size: 21px; line-height: 1.15">Make it part of your crew</h3>
        <label class="field field--outlined">
          <span class="t11 green">Plant nickname</span>
          <span class="val">
            <input v-model="nickname" style="font-size: 16px" autocomplete="off" maxlength="40" @input="nicknameEdited = true" />
            <Icon name="pencil" :size="18" color="#286344" />
          </span>
        </label>
        <label class="field field--filled">
          <span class="t11 lh muted">Where will it live?</span>
          <span class="val">
            <select v-model="room" style="font-size: 14px" aria-label="Room">
              <option v-for="r in ROOMS" :key="r">{{ r }}</option>
            </select>
            <Icon name="chevron-down" :size="20" color="#286344" />
          </span>
        </label>
      </section>

      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>

      <button class="btn-primary" :disabled="saving" @click="save">
        <Icon name="plus" :size="20" color="white" />
        <span>{{ saving ? 'Adding…' : `Add ${nickname.trim() || 'plant'} to my plants` }}</span>
      </button>
      <button v-if="total > 1" class="link" @click="nextMatch">
        {{ identifyStore.index < total - 1 ? 'Not quite right? See other matches' : 'Back to the best match' }}
      </button>
      <!-- replace: the new result takes this one's place, instead of stacking up -->
      <RouterLink to="/identify" replace class="link">Try a different photo</RouterLink>
    </main>
  </section>
</template>
