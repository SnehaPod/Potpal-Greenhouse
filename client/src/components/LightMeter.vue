<!--
  "Not sure? Measure my light" on Discover.
  The user takes a photo of the spot with the phone's own camera. We read the
  exposure the camera chose (from the photo's details, with the small `exifr`
  library), turn it into an estimate of how bright the spot is, and pick the
  matching light chip. While they aim, the compass says which way the window
  faces. Everything happens on the phone: the photo is never uploaded.
  The maths lives in src/lib/light.js.
-->
<script setup>
import { ref, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { luxFromExposure, lightLevel, windowNote, readingCaveat } from '../lib/light.js'
import { discoverFilters } from '../lib/discoverStore.js'
import { getLocation } from '../lib/api.js'

const open = ref(false)
const busy = ref(false)
const error = ref('')
const result = ref(null) // { lux, level, window, caveat }
const fileInput = ref(null)

let heading = null // where the phone points right now (0 = north), if the phone has a compass
let headingAtPhoto = null
let latitude = null // from the saved weather location, for "which side gets the sun"

/** Compass readings. Android: "absolute" alpha, counted anticlockwise from north. iPhone: webkitCompassHeading. */
function onOrientation(event) {
  if (event.webkitCompassHeading != null) heading = event.webkitCompassHeading
  else if (event.absolute && event.alpha != null) heading = (360 - event.alpha) % 360
}

function listen(on) {
  for (const name of ['deviceorientationabsolute', 'deviceorientation']) {
    if (on) window.addEventListener(name, onOrientation)
    else window.removeEventListener(name, onOrientation)
  }
}
onBeforeUnmount(() => listen(false))

async function start() {
  open.value = true
  error.value = ''
  // iPhones ask permission for the compass (it must come from a tap, like this one)
  try {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') await DeviceOrientationEvent.requestPermission()
  } catch {
    /* no compass: we just won't name the window's direction */
  }
  listen(true)
  getLocation()
    .then((place) => (latitude = place ? Number(place.latitude) : null))
    .catch(() => {})
}

function close() {
  open.value = false
  listen(false)
}

function takePhoto() {
  headingAtPhoto = heading // the phone is pointing at the window right now
  fileInput.value.click()
}

async function onPhoto(event) {
  const file = event.target.files?.[0]
  event.target.value = '' // so the same photo can be chosen again
  if (!file) return

  busy.value = true
  error.value = ''
  result.value = null
  try {
    // The photo-details reader loads only now, so Discover stays quick for everyone else
    const { default: exifr } = await import('exifr/dist/lite.esm.mjs')
    // The photo's standard camera details. A photo without them (a screenshot,
    // or one shared through a chat app) can't tell us how bright it was.
    const details = await exifr.parse(file).catch(() => null)
    const iso = Array.isArray(details?.ISO) ? details.ISO[0] : details?.ISO
    const lux = luxFromExposure({ exposureTime: details?.ExposureTime, fNumber: details?.FNumber, iso })
    if (!lux) {
      error.value =
        "This photo doesn't say how bright it was. Take a new one with the camera (screenshots and photos from chats don't work)."
      return
    }

    const level = lightLevel(lux)
    discoverFilters.light = level.chip // the matches below re-rank straight away
    result.value = {
      lux: lux >= 1000 ? Math.round(lux / 100) * 100 : Math.round(lux / 10) * 10, // no false precision
      level,
      window: windowNote(headingAtPhoto, latitude),
      caveat: readingCaveat(details.DateTimeOriginal ?? null),
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="light-meter">
    <button v-if="!open" type="button" class="light-meter__start" @click="start">
      <Icon name="sun" :size="22" color="#286344" />
      <span class="grow stack" style="gap: 2px; text-align: left">
        <span class="semi t13">Not sure? Measure my light</span>
        <span class="t12 lh muted">Take a photo of the spot, and we'll estimate how bright it is.</span>
      </span>
      <Icon name="arrow-right" :size="18" color="#286344" />
    </button>

    <template v-else>
      <p class="semi t13">Measure my light</p>
      <ol class="light-meter__steps t12 lh muted">
        <li>Stand where the plant will go, ideally around midday.</li>
        <li>Point the phone at the window, or the brightest side.</li>
        <li>Take a photo. It stays on your phone.</li>
      </ol>

      <button type="button" class="btn-primary" style="height: 46px" :disabled="busy" @click="takePhoto">
        <Icon name="scan" :size="20" color="white" />
        {{ busy ? 'Reading the light…' : result ? 'Measure again' : 'Take the photo' }}
      </button>

      <Transition name="rise">
        <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      </Transition>

      <Transition name="rise">
      <div v-if="result" :key="result.lux" class="stack" style="gap: 6px" role="status">
        <p class="semi t14">
          About {{ result.lux.toLocaleString() }} lux: {{ result.level.label
          }}<template v-if="result.window">, from a {{ result.window.facing }}</template>.
        </p>
        <p class="t12 lh muted">We've picked “{{ result.level.chip }}” above.</p>
        <p v-if="result.level.note" class="t12 lh muted">{{ result.level.note }}</p>
        <p v-if="result.window?.note" class="t12 lh muted">{{ result.window.note }}</p>
        <p v-if="result.caveat" class="t12 lh" style="color: #a26830">{{ result.caveat }}</p>
      </div>
      </Transition>

      <button type="button" class="link" @click="close">Done</button>
    </template>

    <!-- capture="environment": opens the phone's own camera, whose photos keep the exposure details -->
    <input ref="fileInput" class="visually-hidden" type="file" accept="image/*" capture="environment" @change="onPhoto" />
  </div>
</template>
