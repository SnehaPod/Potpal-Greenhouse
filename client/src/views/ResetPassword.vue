<!--
  Choose a new password  (route: /reset-password)
  The "Forgot password?" email links here. Supabase reads the one-time token
  from the link and signs the user in, so all we do is save the new password.
  Not in the Figma file, so it reuses the log-in screen's pieces.
-->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth, updatePassword } from '../lib/auth.js'

const router = useRouter()

const password = ref('')
const showPassword = ref(false)
const busy = ref(false)
const error = ref('')

async function save() {
  error.value = ''
  busy.value = true
  try {
    await updatePassword(password.value)
    router.replace('/')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="screen">
    <header class="brandbar">
      <img src="/icons/sprout.svg" width="25" height="25" alt="" />
      <span class="brand">pot pal</span>
    </header>

    <main class="login">
      <div class="login-intro">
        <h1>Pick a new password.</h1>
        <p>Something you'll remember next time you visit your crew.</p>
      </div>

      <!-- The link has expired or was already used: no session to update -->
      <template v-if="!auth.user">
        <p class="notice notice--error" role="alert">
          This reset link has expired or was already used. Ask for a new one from the log-in screen.
        </p>
        <RouterLink to="/sign-in" class="btn-primary btn-primary--login">Back to log in</RouterLink>
      </template>

      <form v-else class="credentials" @submit.prevent="save">
        <label class="outlined">
          <span class="label">New password</span>
          <input
            v-model="password"
            aria-label="New password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="At least 6 characters"
            minlength="6"
            required
          />
          <button
            type="button"
            class="reveal"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <img :src="showPassword ? '/icons/eye.svg' : '/icons/eye-off.svg'" width="20" height="20" alt="" />
          </button>
        </label>
        <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
        <button class="btn-primary btn-primary--login" type="submit" :disabled="busy">
          {{ busy ? 'Saving…' : 'Save new password' }}
        </button>
      </form>
    </main>
  </section>
</template>
