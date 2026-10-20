<!--
  Health score over time: one green line, 0–100, oldest scan on the left.
  Plain SVG, no chart library. Following the dataviz rules:
    • one series, so no legend (the card title says what it is)
    • 2px line, 8px dots with a white ring, a faint area wash
    • hairline grid at 0 / 50 / 100, quiet axis text
    • only the latest score is labelled; hover (or arrow keys) shows any point
  The scan list under the chart lists every score too, so nothing hides behind hover.
-->
<script setup>
import { ref, computed } from 'vue'
import { shortDate } from '../lib/health.js'

const props = defineProps({
  scans: { type: Array, required: true }, // [{ score, created_at }] oldest first
})

// Drawing area inside the SVG (viewBox units; the SVG scales to the card width)
const W = 320
const H = 150
const PAD = { top: 22, right: 18, bottom: 26, left: 30 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

// x: one even step per check-in. (Spacing by real date piles up scans taken on
// the same day; every date is still in the tooltip and the list below.)
// y: the score.
function x(i) {
  return PAD.left + (i / Math.max(1, props.scans.length - 1)) * plotW
}
const y = (score) => PAD.top + (1 - score / 100) * plotH

const points = computed(() => props.scans.map((s, i) => ({ x: x(i), y: y(s.score), scan: s })))
const linePath = computed(() => points.value.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '))
const areaPath = computed(() => {
  const pts = points.value
  if (!pts.length) return ''
  const base = y(0)
  return `${linePath.value} L${pts.at(-1).x},${base} L${pts[0].x},${base} Z`
})
const last = computed(() => points.value.at(-1))

// ─── Hover / keyboard ─────────────────────────────────────────────────────────
const svg = ref(null)
const active = ref(null) // index of the point being inspected, or null

function onPointerMove(event) {
  // Convert the pointer to viewBox units, then snap to the nearest scan by x
  const box = svg.value.getBoundingClientRect()
  const px = ((event.clientX - box.left) / box.width) * W
  let nearest = 0
  points.value.forEach((p, i) => {
    if (Math.abs(p.x - px) < Math.abs(points.value[nearest].x - px)) nearest = i
  })
  active.value = nearest
}

function onKey(event) {
  const n = points.value.length
  if (event.key === 'ArrowRight') active.value = Math.min(n - 1, (active.value ?? -1) + 1)
  else if (event.key === 'ArrowLeft') active.value = Math.max(0, (active.value ?? n) - 1)
  else return
  event.preventDefault()
}

const activePoint = computed(() => (active.value === null ? null : points.value[active.value]))
// Tooltip position as a % of the chart box, kept inside the edges
const tipLeft = computed(() => `${Math.min(80, Math.max(20, (activePoint.value?.x / W) * 100))}%`)

// A text summary for screen readers
const summary = computed(
  () => `Health score over time: ${props.scans.map((s) => `${s.score} on ${shortDate(s.created_at)}`).join(', ')}.`,
)
</script>

<template>
  <div class="score-chart">
    <svg
      ref="svg"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="summary"
      tabindex="0"
      @pointermove="onPointerMove"
      @pointerleave="active = null"
      @keydown="onKey"
      @blur="active = null"
    >
      <!-- Hairline grid + y ticks -->
      <g v-for="tick in [0, 50, 100]" :key="tick">
        <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(tick)" :y2="y(tick)" class="grid" />
        <text :x="PAD.left - 8" :y="y(tick) + 4" text-anchor="end" class="axis">{{ tick }}</text>
      </g>

      <!-- First and last dates only; the list below has every date -->
      <text :x="points[0].x" :y="H - 6" text-anchor="start" class="axis">{{ shortDate(scans[0].created_at) }}</text>
      <text v-if="scans.length > 1" :x="last.x" :y="H - 6" text-anchor="end" class="axis">
        {{ shortDate(scans.at(-1).created_at) }}
      </text>

      <!-- Area wash, line, crosshair, dots -->
      <path :d="areaPath" class="area" />
      <path :d="linePath" class="line" />
      <line v-if="activePoint" :x1="activePoint.x" :x2="activePoint.x" :y1="PAD.top" :y2="y(0)" class="crosshair" />
      <circle
        v-for="(p, i) in points"
        :key="p.scan.id ?? i"
        :cx="p.x"
        :cy="p.y"
        :r="active === i ? 5.5 : 4"
        class="dot"
      />

      <!-- Direct label: the latest score only -->
      <text :x="last.x" :y="last.y - 10" text-anchor="end" class="end-label">{{ last.scan.score }}</text>
    </svg>

    <!-- Tooltip: value first, date second -->
    <div v-if="activePoint" class="chart-tip" :style="{ left: tipLeft }" aria-hidden="true">
      <b>{{ activePoint.scan.score }}</b>
      <span>{{ shortDate(activePoint.scan.created_at) }}</span>
    </div>
  </div>
</template>
