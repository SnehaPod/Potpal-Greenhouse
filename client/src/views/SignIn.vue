<!--
  Log in / create account  (route: /sign-in)
  Built from the Figma frame "Android · Log in". The same screen also handles
  sign-up: "Create an account" adds a first-name field and changes the words.

  What each button does:
    Log in / Create account   → Supabase email + password auth
    Forgot password?          → emails a reset link that opens /reset-password
    Continue with Google      → Supabase Google sign-in (switch it on first, see README)
-->
<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth, signIn, signUp, signInWithGoogle, sendPasswordReset } from '../lib/auth.js'

const router = useRouter()
const route = useRoute()

const mode = ref('log-in') // or 'sign-up'
const firstName = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const busy = ref(false)
// Start with any error from a Google sign-in that didn't finish (shown once)
const error = ref(auth.oauthError)
auth.oauthError = ''
const info = ref('')

// Links in the small print. Set these in client/.env once the pages exist.
const termsUrl = import.meta.env.VITE_TERMS_URL
const privacyUrl = import.meta.env.VITE_PRIVACY_URL

const isSignUp = computed(() => mode.value === 'sign-up')

// The words that change between "log in" and "sign up"
const copy = computed(() =>
  isSignUp.value
    ? {
        title: 'Join the crew.',
        lede: 'Create an account to start growing your leafy crew.',
        button: 'Create account',
        prompt: 'Already part of the crew?',
        switchTo: 'Log in',
      }
    : {
        title: 'Welcome back, pal.',
        lede: 'Log in to help your leafy crew thrive.',
        button: 'Log in',
        prompt: 'New to the crew?',
        switchTo: 'Create an account',
      },
)

function toggleMode() {
  mode.value = isSignUp.value ? 'log-in' : 'sign-up'
  error.value = ''
  info.value = ''
}

/** Run an async action with the busy flag and error/info messages handled */
async function run(action) {
  error.value = ''
  info.value = ''
  busy.value = true
  try {
    await action()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

function submit() {
  return run(async () => {
    if (isSignUp.value) {
      const { needsConfirmation } = await signUp(email.value, password.value, firstName.value.trim())
      if (needsConfirmation) {
        info.value = 'Check your inbox to confirm your email, then log in.'
        mode.value = 'log-in'
        return
      }
    } else {
      await signIn(email.value, password.value)
    }
    // Back to wherever they were heading before we asked them to log in
    router.replace(route.query.next || '/')
  })
}

function forgotPassword() {
  return run(async () => {
    if (!email.value.trim()) throw new Error('Type your email address first, then tap "Forgot password?".')
    await sendPasswordReset(email.value.trim())
    info.value = `We've sent a reset link to ${email.value.trim()}. It opens a page where you can pick a new password.`
  })
}

function google() {
  return run(signInWithGoogle)
}
</script>

<template>
  <section class="screen">
    <header class="brandbar">
      <img src="/icons/sprout.svg" width="25" height="25" alt="" />
      <span class="brand">pot pal</span>
    </header>

    <main class="login">
      <div class="login-welcome">
        <div class="login-photos">
          <img src="/images/login-monstera.jpg" alt="A Monstera in a white pot on a wooden shelf" />
          <img src="/images/login-pothos.jpg" alt="A golden pothos trailing from a terracotta pot" />
          <span class="welcome-badge"><img src="/icons/sparkles.svg" width="13" height="13" alt="" />Good to grow.</span>
        </div>
        <div class="login-intro">
          <h1>{{ copy.title }}</h1>
          <p>{{ copy.lede }}</p>
        </div>
      </div>

      <form @submit.prevent="submit">
        <div class="credentials">
          <label v-if="isSignUp" class="outlined">
            <span class="label">First name</span>
            <input v-model="firstName" aria-label="First name" type="text" autocomplete="given-name" placeholder="What should we call you?" required />
          </label>
          <label class="outlined">
            <span class="label">Email address</span>
            <input v-model="email" aria-label="Email address" type="email" autocomplete="email" placeholder="you@example.com" required />
          </label>
          <label class="outlined">
            <span class="label">Password</span>
            <input
              v-model="password"
              aria-label="Password"
              :type="showPassword ? 'text' : 'password'"
              :autocomplete="isSignUp ? 'new-password' : 'current-password'"
              :placeholder="isSignUp ? 'At least 6 characters' : 'Enter your password'"
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
        </div>

        <!-- Sign-up has no "forgot password", but we keep the row so the button doesn't jump -->
        <div class="recovery">
          <button v-if="!isSignUp" type="button" :disabled="busy" @click="forgotPassword">Forgot password?</button>
        </div>

        <p v-if="error" class="notice notice--error" role="alert" style="margin-bottom: 16px">{{ error }}</p>
        <p v-if="info" class="notice" role="status" style="margin-bottom: 16px">{{ info }}</p>

        <button class="btn-primary btn-primary--login" type="submit" :disabled="busy">
          {{ busy ? 'One moment…' : copy.button }}
        </button>
      </form>

      <div class="login-other">
        <p class="or-divider">or continue with</p>
        <button class="btn-provider" type="button" :disabled="busy" @click="google">
          <img src="/icons/google.svg" width="20" height="20" alt="" />Continue with Google
        </button>
      </div>

      <div class="login-footer">
        <p class="switch-mode">
          {{ copy.prompt }} <button type="button" @click="toggleMode">{{ copy.switchTo }}</button>
        </p>
        <p class="legal">
          By continuing, you agree to our
          <a v-if="termsUrl" :href="termsUrl" target="_blank" rel="noopener">Terms of Service</a><span v-else class="green">Terms of Service</span>
          <br />
          and
          <a v-if="privacyUrl" :href="privacyUrl" target="_blank" rel="noopener">Privacy Policy.</a><span v-else class="green">Privacy Policy.</span>
        </p>
      </div>
    </main>
  </section>
</template>
