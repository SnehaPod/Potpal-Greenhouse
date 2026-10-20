<!--
  Screen 5 · Weekly health check  (route: /plants/:id/health)
  Shows the plant's latest health scan: Plant.id's health assessment of a
  photo, saved by the server as a row in the health_scans table.
  With ?scan=<id> it shows that past scan instead (opened from the journal).
  New scans are taken on the Identify screen in "Health scan" mode.
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { goUp } from '../lib/navigation.js'
import Icon from '../components/Icon.vue'
import AppBar from '../components/AppBar.vue'
import CheckBox from '../components/CheckBox.vue'
import { getPlant, getLatestScan, getScan } from '../lib/api.js'

const props = defineProps({ id: { type: String, required: true } })
const route = useRoute()
const router = useRouter()

const plant = ref(null)
const scan = ref(null) // null = no scan yet
const loading = ref(true)
const error = ref('')

// Which "feel-better" steps the user has ticked off (just on this screen for now)
const done = ref([])

onMounted(async () => {
  try {
    // Load the plant and the scan (a past one from the journal, or the latest) at the same time
    const scanRequest = route.query.scan ? getScan(props.id, route.query.scan) : getLatestScan(props.id)
    const [p, s] = await Promise.all([getPlant(props.id), scanRequest])
    plant.value = p
    scan.value = s
    done.value = (s?.steps ?? []).map(() => false)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

// Where "Scan again" goes: the camera, in health mode, with this plant chosen
const scanLink = computed(() => ({ path: '/identify', query: { mode: 'health', plant: props.id } }))

// The most likely problem (if any), shown on the photo and in the score card
const topIssue = computed(() => scan.value?.issues?.[0])
const otherIssues = computed(() => scan.value?.issues?.slice(1) ?? [])

/** A short label for the score card */
const verdict = computed(() => {
  const score = scan.value.score
  if (score >= 70) return 'Looking leafy!'
  if (score >= 40) return 'Worth a closer look'
  return 'Needs some care'
})

/** "October 12" */
function shortDate(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

// Health checks are weekly, so the next one is 7 days after this scan
const nextCheck = computed(() => shortDate(new Date(scan.value.created_at).getTime() + 7 * 86_400_000))
</script>

<template>
  <section class="screen">
    <!-- Back to wherever the user came from (Home, or the care plan). The camera
         never stays in the history, so this is always one tap. -->
    <AppBar title="Weekly health check" :fallback="`/plants/${id}`" />

    <main class="screen-body">
      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <p v-if="loading" class="muted t13">Loading…</p>

      <!-- No scan yet: invite the first one -->
      <div v-else-if="plant && !scan" class="empty">
        <Icon name="health" :size="32" color="#286344" />
        <p class="d" style="font-size: 20px">No health scan yet</p>
        <p class="t13 lh muted">
          Snap one of {{ plant.nickname }}'s leaves and we'll check for early signs of trouble.
        </p>
        <RouterLink :to="scanLink" replace class="btn-primary" style="margin-top: 8px">
          <Icon name="scan" :size="20" color="white" />Scan {{ plant.nickname }}
        </RouterLink>
      </div>

      <template v-else-if="plant && scan">
        <div class="stack" style="gap: 10px; align-items: flex-start">
          <span class="badge"><Icon name="sparkle" :size="16" />{{ plant.nickname }} · {{ shortDate(scan.created_at) }}</span>
          <h2 class="h-hero">{{ scan.headline }}</h2>
          <p class="lede">{{ scan.summary }}</p>
        </div>

        <div class="photo photo--wide">
          <img
            :src="scan.photo_url || plant.photo_url || '/images/health-leaf.webp'"
            width="364"
            height="236"
            :alt="`The photo of ${plant.nickname} from this health scan`"
          />
          <span v-if="topIssue" class="overlay badge badge--butter" style="right: 14px; bottom: 14px">
            <Icon name="focus" :size="16" />{{ topIssue.name }}
          </span>
        </div>

        <div class="row" style="gap: 16px; padding: 16px; border-radius: var(--r-card); background: var(--mint)">
          <div class="score"><b>{{ scan.score }}</b><span style="font-size: 10px; color: var(--muted)">of 100</span></div>
          <div class="grow stack" style="gap: 7px">
            <h3 class="d" style="font-size: 22px; line-height: 1.15">{{ verdict }}</h3>
            <p class="t13 lh muted">
              {{ topIssue?.description || 'Good leaf colour and structure. No visible signs of trouble.' }}
            </p>
            <p v-if="otherIssues.length" class="t12 lh muted">
              Also possible: {{ otherIssues.map((issue) => issue.name.toLowerCase()).join(', ') }}.
            </p>
          </div>
        </div>

        <section v-if="scan.steps.length" class="stack" style="gap: 12px">
          <div class="row" style="justify-content: space-between">
            <h3 class="d" style="font-size: 22px">Your feel-better plan</h3>
            <span class="badge badge--butter">{{ scan.steps.length }} small step{{ scan.steps.length === 1 ? '' : 's' }}</span>
          </div>
          <div v-for="(step, i) in scan.steps" :key="step.title" class="advice">
            <Icon :name="step.icon" :size="24" color="#286344" />
            <div class="grow">
              <p class="semi t14" style="line-height: 1.3">{{ step.title }}</p>
              <p v-if="step.detail" class="t13 lh muted">{{ step.detail }}</p>
            </div>
            <CheckBox v-model="done[i]" small :label="`Done: ${step.title}`" />
          </div>
        </section>

        <!-- Done: back to the plant. Scan again / the journal *replace* this screen,
             so old results don't pile up behind the back arrow. -->
        <button class="btn-primary" @click="goUp(router, `/plants/${id}`)">
          <Icon name="tick" :size="20" color="white" />Done
        </button>
        <RouterLink :to="scanLink" replace class="btn-secondary">Scan again</RouterLink>
        <RouterLink :to="{ path: `/plants/${id}`, query: { tab: 'journal' } }" replace class="link">
          See {{ plant.nickname }}'s health journal
        </RouterLink>
        <p class="footnote">
          Next check-in: {{ nextCheck }}. AI guidance from Plant.id, not a diagnosis. Watch for new changes.
        </p>
      </template>
    </main>
  </section>
</template>
