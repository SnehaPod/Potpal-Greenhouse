<!--
  Screen 4 · A plant's care plan  (route: /plants/:id)
  Watering status and "I checked the soil & watered", plus reminder settings.
  Every change is saved straight to the plant's row in Supabase (via the API).
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import AppBar from '../components/AppBar.vue'
import ToggleSwitch from '../components/ToggleSwitch.vue'
import HealthJournal from '../components/HealthJournal.vue'
import LocalNames from '../components/LocalNames.vue'
import { getPlant, updatePlant, waterPlant, unwaterPlant, deletePlant, getForecast } from '../lib/api.js'
import { ALERT_ICONS } from '../lib/weather.js'
import { waterStatus, waterEvery, wateredToday } from '../lib/plants.js'
import { push, refreshPush, enablePush, sendTestPush } from '../lib/push.js'
import PhotoCredit from '../components/PhotoCredit.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const plant = ref(null)
const error = ref('')
const watering = ref(false)
const justWatered = ref(false) // for the tick's little "pop" (main.css → .celebrate)
const showMenu = ref(false)
// 'care' | 'journal'. ?tab=journal opens straight onto the journal (linked from the health check)
const tab = ref(useRoute().query.tab === 'journal' ? 'journal' : 'care')

// This week's weather warnings for this plant (empty if no location is set)
const alerts = ref([])

// Notifications on this phone (see lib/push.js)
const pushBusy = ref(false)
const pushNote = ref('')

onMounted(async () => {
  refreshPush()
  try {
    plant.value = await getPlant(props.id)
  } catch (e) {
    error.value = e.message
  }
  // Nice to have: if the weather can't load, the care plan still works
  try {
    const forecast = await getForecast()
    alerts.value = (forecast.alerts ?? []).filter((a) => a.plantId === props.id)
  } catch {
    alerts.value = []
  }
})

const doneToday = computed(() => wateredToday(plant.value))

// The first sentence of Plant.id's advice, or a sensible default
const wateringAdvice = computed(
  () => plant.value.watering_tips?.match(/[^.!?]+[.!?]/)?.[0] ?? 'Only water when the top 2–3 cm of soil is dry.',
)

/** "I checked the soil & watered", or undo it if it was a mistake */
async function water(undo = false) {
  watering.value = true
  try {
    plant.value = undo ? await unwaterPlant(plant.value.id) : await waterPlant(plant.value.id)
    justWatered.value = !undo
  } catch (e) {
    error.value = e.message
  } finally {
    watering.value = false
  }
}

/** Save one or more settings. Update the screen at once, undo if saving fails. */
async function save(changes) {
  const before = { ...plant.value }
  Object.assign(plant.value, changes)
  try {
    plant.value = await updatePlant(plant.value.id, changes)
  } catch (e) {
    plant.value = before
    error.value = e.message
  }
}

/** Reminders on? Then make sure this phone can actually show them. */
async function toggleReminders(on) {
  await save({ reminders_on: on })
  if (on && push.status === 'off') await turnOnPush()
}

async function turnOnPush() {
  pushBusy.value = true
  pushNote.value = ''
  try {
    await enablePush()
  } catch (e) {
    error.value = e.message
  } finally {
    pushBusy.value = false
  }
}

async function testPushNow() {
  pushBusy.value = true
  pushNote.value = 'Sending…'
  try {
    await sendTestPush()
    pushNote.value = 'Sent! It should arrive in a few seconds.'
  } catch (e) {
    pushNote.value = e.message
  } finally {
    pushBusy.value = false
  }
}

async function remove() {
  showMenu.value = false
  if (!confirm(`Remove ${plant.value.nickname} from your plants?`)) return
  await deletePlant(plant.value.id)
  router.replace('/')
}
</script>

<template>
  <section class="screen" style="position: relative">
    <!-- Titled "My plants", so the arrow always goes up to My plants -->
    <AppBar title="My plants" up="/">
      <button class="icon-btn" aria-label="More options" :aria-expanded="showMenu" @click="showMenu = !showMenu">
        <Icon name="more" color="#203C2D" />
      </button>
    </AppBar>
    <div v-if="showMenu" class="menu">
      <button @click="remove">Remove plant</button>
    </div>

    <main class="screen-body">
      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <p v-if="!plant && !error" class="muted t13">Loading…</p>

      <template v-if="plant">
        <div class="photo photo--banner">
          <img :src="plant.photo_url || '/images/miso-careplan.webp'" width="364" height="204" :alt="`${plant.nickname} the ${plant.common_name || plant.species}`" />
          <span class="overlay badge" style="left: 14px; bottom: 14px"><Icon name="home" :size="16" />{{ plant.room }}</span>
        </div>
        <!-- Added by name with a free species photo: credit its photographer -->
        <PhotoCredit :plant="plant" />

        <div class="row">
          <div class="grow stack" style="gap: 4px">
            <h2 class="d" style="font-size: 34px; line-height: 1.15">{{ plant.nickname }}</h2>
            <p class="t13 lh muted">{{ plant.species }}</p>
          </div>
          <span class="badge"><Icon name="heart-pulse" :size="16" />Growing together</span>
        </div>

        <!-- Its name in Hindi, Marathi, Tamil and Malayalam (when we know it) -->
        <LocalNames :species="plant.species" :common-name="plant.common_name" />

        <div class="tabs" role="tablist">
          <button class="tab" role="tab" :aria-selected="tab === 'care'" @click="tab = 'care'">Care plan</button>
          <button class="tab" role="tab" :aria-selected="tab === 'journal'" @click="tab = 'journal'">Health journal</button>
        </div>

        <!-- Health journal tab: the plant's health over time -->
        <HealthJournal v-if="tab === 'journal'" :plant="plant" />

        <!-- Care plan tab (everything below, up to the footnote) -->
        <template v-else>
        <section class="card" style="gap: 16px">
          <div class="row" style="align-items: flex-start">
            <h3 class="grow d" style="font-size: 22px; line-height: 1.15">Made for {{ plant.nickname }}</h3>
            <Icon name="sparkle" :size="23" color="#286344" />
          </div>
          <p class="t13 lh muted">
            Tuned for {{ (plant.light || 'bright, indirect').toLowerCase() }} light in your {{ plant.room.toLowerCase() }}.
          </p>

          <!-- This week's weather warnings, each with the reason behind it -->
          <div v-for="alert in alerts" :key="alert.kind" class="advice" style="background: var(--butter)">
            <Icon :name="ALERT_ICONS[alert.kind]" :size="24" color="#286344" />
            <div class="grow">
              <p class="semi t14" style="line-height: 1.3">{{ alert.title }}</p>
              <p class="t13 lh">{{ alert.detail }}</p>
              <p class="t12 lh muted">Why: {{ alert.why }}</p>
            </div>
          </div>

          <div class="row">
            <span class="symbol" :class="{ 'symbol--mint': doneToday }">
              <Icon :name="doneToday ? 'tick' : 'drop'" :size="23" color="#286344" />
            </span>
            <div class="grow stack" style="gap: 5px">
              <p class="semi t14">{{ waterStatus(plant) }}</p>
              <p class="t12 lh muted">{{ waterEvery(plant) }}. {{ wateringAdvice }}</p>
              <!-- Set when "Let AI adjust the timing" moved the date for the weather -->
              <p v-if="plant.water_note" class="t12 lh green semi">{{ plant.water_note }}</p>
            </div>
          </div>

          <div class="divider"></div>

          <RouterLink :to="`/plants/${plant.id}/health`" class="row" style="gap: 8px; width: 100%">
            <span class="grow row">
              <Icon name="health" :size="24" color="#286344" />
              <span class="grow stack" style="gap: 4px">
                <span class="semi t14" style="line-height: 1.3">AI health scan · Mondays</span>
                <span class="t12 lh muted">Check in on {{ plant.nickname }}'s leaves.</span>
              </span>
            </span>
            <Icon name="chevron-right" :size="20" color="#286344" />
          </RouterLink>

          <button class="btn-primary" :class="{ celebrate: justWatered && doneToday }" :disabled="watering || doneToday" @click="water()">
            <Icon name="tick" :size="20" color="white" />
            <span>{{ doneToday ? 'Watered today. Nice!' : 'I checked the soil & watered' }}</span>
          </button>
          <!-- Tapped by mistake? Put it back (the server remembers how it was) -->
          <button v-if="doneToday && plant.undo_water" class="link" :disabled="watering" @click="water(true)">
            Undo: I haven't watered {{ plant.nickname }} yet
          </button>
        </section>

        <section class="card card--mint" style="gap: 20px">
          <div class="row">
            <div class="grow stack" style="gap: 5px">
              <h3 class="d" style="font-size: 20px; line-height: 1.15">A gentle watering nudge</h3>
              <p class="t12 lh muted">Push reminders are {{ plant.reminders_on ? 'on' : 'off' }}</p>
            </div>
            <ToggleSwitch
              :model-value="plant.reminders_on"
              label="Push reminders"
              @update:model-value="toggleReminders"
            />
          </div>

          <div class="row" style="justify-content: space-between">
            <label class="semi t13" for="remind-at">Remind me at</label>
            <span class="time-picker">
              <Icon name="clock" :size="18" color="#286344" />
              <input
                id="remind-at"
                type="time"
                :value="plant.reminder_time?.slice(0, 5)"
                :disabled="!plant.reminders_on"
                @change="save({ reminder_time: $event.target.value })"
              />
            </span>
          </div>

          <!-- Can this phone actually show the reminders? -->
          <template v-if="plant.reminders_on">
            <button v-if="push.status === 'off'" class="btn-secondary" :disabled="pushBusy" @click="turnOnPush">
              <Icon name="bell" :size="18" color="#286344" />&nbsp;Turn on notifications on this phone
            </button>
            <p v-else-if="push.status === 'blocked'" class="t12 lh muted">
              Notifications are blocked for Potpal on this phone. To allow them, open your phone's Settings → Apps →
              Potpal → Notifications.
            </p>
            <p v-else-if="push.status === 'unsupported'" class="t12 lh muted">
              This browser can't show notifications. Install the Potpal app to get reminders.
            </p>
            <div v-else-if="push.status === 'on'" class="row" style="justify-content: space-between">
              <p class="t12 lh muted">Notifications are on for this phone.</p>
              <button class="green semi t13" :disabled="pushBusy" @click="testPushNow">Send a test</button>
            </div>
            <p v-if="pushNote" class="t12 lh muted" role="status">{{ pushNote }}</p>
          </template>

          <div class="divider"></div>

          <div class="row">
            <div class="grow stack" style="gap: 4px">
              <p class="semi t13">Let AI adjust the timing</p>
              <p class="t12 lh muted">Adapts as light and seasons change</p>
            </div>
            <ToggleSwitch
              :model-value="plant.ai_adjust"
              label="Let AI adjust the timing"
              @update:model-value="save({ ai_adjust: $event })"
            />
          </div>
        </section>

        <p class="footnote">A schedule is a guide. {{ plant.nickname }}'s soil has the final say.</p>
        </template>
      </template>
    </main>
  </section>
</template>
