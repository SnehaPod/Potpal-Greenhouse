<!--
  Screen 2 · Identify a plant (camera)
  Shows the live camera. The shutter grabs a frame, and "Upload" picks a photo
  from the phone. Either way the photo goes to our server → Plant.id:
    • Identify mode:    "what plant is this?" → the result screen (/identified)
    • Health scan mode: "how is <plant> doing?" for one of the user's plants
                        → that plant's health check (/plants/:id/health)
  Links can open straight into health mode: /identify?mode=health&plant=<id>

  If the camera isn't available (permission denied, desktop with no camera, or
  a non-https address), we show the design's still photo and the shutter opens
  the file picker instead.
-->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import { identifyPhoto, listPlants, scanHealth } from '../lib/api.js'
import { captureVideoFrame, shrinkFile } from '../lib/image.js'
import { setIdentifyResult } from '../lib/identifyStore.js'
import { goBack } from '../lib/navigation.js'

const route = useRoute()
const router = useRouter()

const video = ref(null) // the <video> element
const fileInput = ref(null) // the hidden <input type="file">
const cameraOn = ref(false)
const flashOn = ref(false)
const mode = ref(route.query.mode === 'health' ? 'health' : 'identify') // 'identify' | 'health'
const showTips = ref(false)
const busy = ref(false)
const error = ref('')

let stream = null // the camera MediaStream, so we can stop it when leaving

// ─── Health scan: which plant? ────────────────────────────────────────────────

const plants = ref([]) // the user's plants, for the "which plant?" picker
const plantId = ref(route.query.plant ?? '') // the plant being scanned
const chosenPlant = computed(() => plants.value.find((p) => p.id === plantId.value))

onMounted(async () => {
  try {
    plants.value = await listPlants()
    // Only choose for the user when it's certain: the link named the plant, or
    // there's just one. Otherwise they tap one, so a scan can't land on the
    // wrong plant by accident.
    if (!chosenPlant.value) plantId.value = plants.value.length === 1 ? plants.value[0].id : ''
    // Chosen from a link, with lots of plants? Scroll its chip into view.
    await nextTick()
    document.querySelector('.plant-choice[aria-checked="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  } catch (e) {
    error.value = e.message
  }
})

// ─── Camera ───────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (!navigator.mediaDevices?.getUserMedia) return
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 } }, // back camera on phones
      audio: false,
    })
    video.value.srcObject = stream
    cameraOn.value = true
  } catch {
    // No camera or permission refused: the still photo + upload still work
    cameraOn.value = false
  }
})

// Always turn the camera off when leaving the screen
onBeforeUnmount(() => stream?.getTracks().forEach((track) => track.stop()))

async function toggleFlash() {
  flashOn.value = !flashOn.value
  const track = stream?.getVideoTracks()[0]
  // "torch" only exists on some phones; elsewhere this quietly does nothing
  try {
    await track?.applyConstraints({ advanced: [{ torch: flashOn.value }] })
  } catch {
    /* not supported */
  }
}

// ─── Taking / choosing a photo ────────────────────────────────────────────────

async function onShutter() {
  if (!cameraOn.value) return fileInput.value.click()
  send(await captureVideoFrame(video.value))
}

async function onFileChosen(event) {
  const file = event.target.files?.[0]
  event.target.value = '' // so choosing the same file again still triggers "change"
  if (!file) return
  send(await shrinkFile(file))
}

// A health scan needs a plant to scan
const canShoot = computed(() => mode.value === 'identify' || !!chosenPlant.value)

/** Send the photo to the server, then show the result.
 *  The result *replaces* the camera in the history, so "back" from the result
 *  goes to wherever the user started (not back into the camera). */
async function send(photo) {
  busy.value = true
  error.value = ''
  try {
    if (mode.value === 'health') {
      // The server saves the scan, so the health screen can just load "latest"
      await scanHealth(plantId.value, photo)
      router.replace(`/plants/${plantId.value}/health`)
    } else {
      const result = await identifyPhoto(photo)
      setIdentifyResult(result)
      router.replace('/identified')
    }
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="screen screen--dark" style="position: relative">
    <div class="camera">
      <!-- Live camera, or the design's photo as a stand-in -->
      <video v-show="cameraOn" ref="video" class="feed" autoplay playsinline muted></video>
      <img v-if="!cameraOn" class="feed" src="/images/camera-feed.webp" alt="" aria-hidden="true" />

      <header class="appbar">
        <!-- A real "back" (it used to push a new Home onto the history) -->
        <button class="icon-btn" aria-label="Back" @click="goBack(router, '/')"><Icon name="back" color="white" /></button>
        <h1 class="title">Meet your plant</h1>
        <button class="icon-btn" :aria-label="flashOn ? 'Flash on' : 'Flash off'" :aria-pressed="flashOn" @click="toggleFlash">
          <Icon name="flash-off" color="white" />
        </button>
      </header>

      <div class="modes">
        <div class="segmented" role="group" aria-label="Camera mode">
          <button class="seg-identify" :aria-pressed="mode === 'identify'" @click="mode = 'identify'">
            <Icon name="check" :size="18" color="#286344" />Identify
          </button>
          <button class="seg-health" :aria-pressed="mode === 'health'" @click="mode = 'health'">
            <Icon name="check" :size="18" color="#286344" />Health scan
          </button>
        </div>
      </div>

      <div class="framing">
        <svg class="corners" width="307" height="355" viewBox="0 0 307 355" fill="none" aria-hidden="true">
          <path
            d="M1.5 46.3V20.7C1.5 7.9 7.70408 1.5 20.1122 1.5H51.1327M255.867 1.5H286.888C299.296 1.5 305.5 7.9 305.5 20.7V46.3M305.5 308.7V334.3C305.5 347.1 299.296 353.5 286.888 353.5H255.867M51.1327 353.5H20.1122C7.70408 353.5 1.5 347.1 1.5 334.3V308.7"
            stroke="#FFF0BE"
            stroke-width="3"
            stroke-linecap="round"
          />
        </svg>
        <span class="zoom">1×</span>
        <span class="detect badge">
          <Icon name="check" :size="16" />
          {{ cameraOn ? 'Fill the frame with one leaf' : 'Camera off: upload a photo instead' }}
        </span>
      </div>
    </div>

    <div class="capture">
      <div class="tip">
        <template v-if="error">
          <h2 class="d" style="font-size: 22px">Let's try that again.</h2>
          <p class="t13 lh" style="color: var(--butter)" role="alert">{{ error }}</p>
        </template>
        <template v-else-if="mode === 'health' && plants.length === 0">
          <h2 class="d" style="font-size: 22px">Add a plant first.</h2>
          <p class="t13 lh" style="color: var(--tip)">Health scans are for plants in your crew. Identify one to get started.</p>
        </template>
        <template v-else-if="showTips">
          <h2 class="d" style="font-size: 22px">Tips for a great match</h2>
          <p class="t13 lh" style="color: var(--tip)">
            One leaf, filling most of the frame. Natural light, no flash glare. Hold still for a sharp photo.
          </p>
        </template>
        <template v-else-if="mode === 'health'">
          <h2 class="d" style="font-size: 22px">{{ chosenPlant ? `Scanning ${chosenPlant.nickname}` : 'Which plant is this?' }}</h2>
          <!-- One chip per plant, with its photo, so it's clear which plant the scan is for -->
          <div class="plant-choices" role="radiogroup" aria-label="Plant to scan">
            <button
              v-for="p in plants"
              :key="p.id"
              type="button"
              class="plant-choice"
              role="radio"
              :aria-checked="p.id === plantId"
              @click="plantId = p.id"
            >
              <span class="plant-choice__photo">
                <img v-if="p.photo_url" :src="p.photo_url" alt="" />
                <Icon v-else name="sprout" :size="16" color="#286344" />
              </span>
              {{ p.nickname }}
              <Icon v-if="p.id === plantId" name="check" :size="16" color="#286344" />
            </button>
          </div>
        </template>
        <template v-else>
          <h2 class="d" style="font-size: 24px">A leaf is all we need.</h2>
          <p class="t13 lh" style="color: var(--tip)">Keep one leaf in the frame, in natural light.</p>
        </template>
      </div>

      <div class="shutter-row">
        <button class="cam-action" :disabled="busy || !canShoot" @click="fileInput.click()">
          <Icon name="gallery" :size="26" color="white" />Upload
        </button>
        <button class="shutter" aria-label="Take photo" :disabled="busy || !canShoot" @click="onShutter">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
            <rect x="1.5" y="1.5" width="77" height="77" rx="38.5" stroke="white" stroke-width="3" />
            <circle cx="40" cy="40" r="32" fill="#FFF0BE" />
          </svg>
        </button>
        <button class="cam-action" :aria-pressed="showTips" @click="showTips = !showTips; error = ''">
          <Icon name="help" :size="26" color="white" />Tips
        </button>
      </div>
      <p class="t11 lh" style="color: var(--fine)">Your photos stay yours. Always.</p>

      <input ref="fileInput" class="visually-hidden" type="file" accept="image/*" @change="onFileChosen" />
    </div>

    <!-- Shown while Plant.id is thinking -->
    <div v-if="busy" class="busy" role="status" aria-live="polite">
      <div class="spinner"></div>
      <h2 class="d" style="font-size: 24px">
        {{ mode === 'health' ? `Checking in on ${chosenPlant?.nickname}…` : 'Saying hello to your plant…' }}
      </h2>
      <p class="t13 lh" style="color: var(--tip)">This usually takes a few seconds.</p>
    </div>
  </section>
</template>
