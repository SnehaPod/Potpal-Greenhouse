// Every screen in the design is a route. Most routes need a signed-in user;
// the guard at the bottom sends everyone else to /sign-in.

import { createRouter, createWebHistory } from 'vue-router'
import { auth } from './lib/auth.js'

import SignIn from './views/SignIn.vue'
import Home from './views/Home.vue'
import Identify from './views/Identify.vue'
import Identified from './views/Identified.vue'
import CarePlan from './views/CarePlan.vue'
import Health from './views/Health.vue'
import Discover from './views/Discover.vue'
import Match from './views/Match.vue'
import ResetPassword from './views/ResetPassword.vue'
import Location from './views/Location.vue'
import Wishlist from './views/Wishlist.vue'
import Credits from './views/Credits.vue'

const routes = [
  { path: '/sign-in', component: SignIn, meta: { public: true, title: 'Log in' } },
  // Public: the emailed reset link signs the user in as the page loads
  { path: '/reset-password', component: ResetPassword, meta: { public: true, title: 'New password' } },
  { path: '/', component: Home, meta: { title: 'My plants' } },
  { path: '/identify', component: Identify, meta: { title: 'Meet your plant' } },
  { path: '/identified', component: Identified, meta: { title: 'Plant identified' } },
  { path: '/plants/:id', component: CarePlan, props: true, meta: { title: 'Care plan' } },
  { path: '/plants/:id/health', component: Health, props: true, meta: { title: 'Weekly health check' } },
  { path: '/discover', component: Discover, meta: { title: 'Discover' } },
  { path: '/discover/:slug', component: Match, props: true, meta: { title: 'Your plant match' } },
  { path: '/location', component: Location, meta: { title: 'Your weather' } },
  { path: '/wishlist', component: Wishlist, meta: { title: 'Saved plants' } },
  { path: '/credits', component: Credits, meta: { title: 'Photo credits' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  // A failed Google sign-in comes back as "/?error=…". auth.js has already
  // saved the message, so drop the leftovers from the address.
  if (to.query.error || to.query.error_description) return { path: to.path }

  const signedIn = !!auth.user
  if (!to.meta.public && !signedIn) return { path: '/sign-in', query: { next: to.fullPath } }
  if (to.path === '/sign-in' && signedIn) return '/'
})

router.afterEach((to) => {
  document.title = `Potpal · ${to.meta.title ?? ''}`
})
