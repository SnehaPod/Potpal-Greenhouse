<!--
  The "Health journal" tab on a plant's care plan: how the plant has been doing
  across all its health scans, not just the latest one.
    • trend: the latest score and whether it's better / worse / steady
    • a score-over-time chart (2+ scans)
    • "Then and now": first and latest photos side by side (2+ scans)
    • every scan, newest first; tap one to open it
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import Icon from './Icon.vue'
import ScoreChart from './ScoreChart.vue'
import { listScans } from '../lib/api.js'
import { trend, trendLabel, shortDate, scoreWord } from '../lib/health.js'

const props = defineProps({ plant: { type: Object, required: true } })

const scans = ref([]) // oldest first
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    scans.value = await listScans(props.plant.id)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const t = computed(() => trend(scans.value))
const first = computed(() => scans.value[0])
const newestFirst = computed(() => [...scans.value].reverse())

// Where "Scan now" goes: the camera in health mode, with this plant chosen
const scanLink = computed(() => ({ path: '/identify', query: { mode: 'health', plant: props.plant.id } }))

// The little trend badge: words + an arrow, so it never relies on colour alone
const TREND_BADGES = {
  better: { text: 'Getting better', rotate: -45 },
  worse: { text: 'Needs attention', rotate: 45 },
  steady: { text: 'Holding steady', rotate: 0 },
}
const badge = computed(() => TREND_BADGES[t.value?.direction])
</script>

<template>
  <div class="stack" style="gap: 16px" role="tabpanel" aria-label="Health journal">
    <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
    <p v-if="loading" class="muted t13">Opening the journal…</p>

    <!-- No scans yet -->
    <div v-else-if="!scans.length" class="empty">
      <Icon name="health" :size="32" color="#286344" />
      <p class="d" style="font-size: 20px">No check-ins yet</p>
      <p class="t13 lh muted">
        Scan one of {{ plant.nickname }}'s leaves each week and we'll chart how it's doing over time.
      </p>
      <RouterLink :to="scanLink" class="btn-primary" style="margin-top: 8px">
        <Icon name="scan" :size="20" color="white" />Scan {{ plant.nickname }}
      </RouterLink>
    </div>

    <template v-else>
      <!-- Trend header -->
      <div class="row" style="gap: 16px; padding: 16px; border-radius: var(--r-card); background: var(--mint)">
        <div class="score"><b>{{ t.latest.score }}</b><span style="font-size: 10px; color: var(--muted)">of 100</span></div>
        <div class="grow stack" style="gap: 7px; align-items: flex-start">
          <span v-if="badge" class="badge">
            <span :style="{ display: 'inline-flex', transform: `rotate(${badge.rotate}deg)` }">
              <Icon name="arrow-right" :size="16" />
            </span>
            {{ badge.text }}
          </span>
          <p class="t13 lh muted">{{ trendLabel(t, plant.nickname) }}</p>
        </div>
      </div>

      <!-- Score over time -->
      <section v-if="scans.length > 1" class="card" style="gap: 10px">
        <div class="stack" style="gap: 3px">
          <h3 class="d" style="font-size: 20px; line-height: 1.15">Health score</h3>
          <p class="t12 lh muted">{{ scans.length }} check-ins since {{ shortDate(first.created_at) }}</p>
        </div>
        <ScoreChart :scans="scans" />
      </section>

      <!-- Then and now -->
      <section v-if="scans.length > 1" class="stack" style="gap: 12px">
        <h3 class="d" style="font-size: 20px">Then and now</h3>
        <div class="then-now">
          <figure v-for="scan in [first, t.latest]" :key="scan.id">
            <img
              :src="scan.photo_url || plant.photo_url || '/images/health-leaf.webp'"
              :alt="`${plant.nickname} on ${shortDate(scan.created_at)}`"
            />
            <figcaption>
              <span class="semi t13">{{ shortDate(scan.created_at) }}</span>
              <span class="t12 muted">{{ scan.score }} · {{ scoreWord(scan.score) }}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <!-- Every check-in, newest first -->
      <section class="stack" style="gap: 10px">
        <h3 class="d" style="font-size: 20px">Every check-in</h3>
        <RouterLink
          v-for="scan in newestFirst"
          :key="scan.id"
          :to="{ path: `/plants/${plant.id}/health`, query: { scan: scan.id } }"
          class="scan-row"
        >
          <span class="scan-score">{{ scan.score }}</span>
          <span class="grow stack" style="gap: 3px">
            <span class="semi t14">{{ scan.headline }}</span>
            <span class="t12 lh muted">
              {{ shortDate(scan.created_at) }}<template v-if="scan.issues?.length"> · {{ scan.issues[0].name }}</template>
            </span>
          </span>
          <Icon name="chevron-right" :size="20" color="#286344" />
        </RouterLink>
      </section>

      <RouterLink :to="scanLink" class="btn-secondary">Scan {{ plant.nickname }} now</RouterLink>
    </template>
  </div>
</template>
