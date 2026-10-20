---
name: vue-animations
description: How to add animation and motion to Potpal Greenhouse (Vue 3 + Vite, plain CSS). Use when adding or changing transitions, enter/exit effects, list reordering, hover/press feedback, page transitions or any motion in client/src. Covers Vue's built-in <Transition> and <TransitionGroup>, Potpal's motion tokens in main.css, reduced-motion rules, and when (rarely) to reach for motion-v.
---

# Animations in Potpal Greenhouse (Vue 3)

Potpal is Vue 3 with plain CSS (`client/src/assets/main.css`). **Never use
React animation libraries** (`framer-motion`, `motion/react`, JSX examples):
they don't work in Vue. Reach for these, in this order:

1. **CSS transitions** for state changes on one element (hover, pressed, selected).
2. **`<Transition>`** for one thing appearing or disappearing (`v-if` / `v-show`).
3. **`<TransitionGroup>`** for lists: items entering, leaving and *moving*
   when the order changes (Vue does the FLIP maths via `move-class`).
4. **`motion-v`** (Motion for Vue, motion.dev/docs/vue) only for springs, drag
   gestures or shared-element morphs that CSS can't do. Ask before adding it:
   it's a new dependency, and the app has none for animation today.

## Potpal's motion tokens (in `:root`, main.css)

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.23, 1, .32, 1)` | things arriving or responding (most motion) |
| `--ease-in-out` | `cubic-bezier(.645, .045, .355, 1)` | things moving across the screen |
| `--ease-spring` | `cubic-bezier(.34, 1.56, .64, 1)` | small celebratory pops only (a tick, a badge) |
| `--dur-quick` | `120ms` | presses, colour changes |
| `--dur-enter` | `240ms` | things appearing, lists reordering |
| `--dur-exit` | `160ms` | things leaving (exits are ~2/3 of enters) |

Use the tokens, not raw numbers, so the app's feel stays consistent.

## Rules

- **Only animate `transform` and `opacity`** (plus `background-color` /
  `border-color` for small controls). Never `height`, `width`, `top`, `left`:
  they're janky on phones.
- **Keep it short:** 120–300 ms. Nothing should make the user wait.
- **Exits are faster than entrances**, and many things need no exit at all.
- **Small distances:** enter from 6–12 px away, not from off-screen.
- **Meaningful, not decorative:** motion should explain a change (this moved,
  this is new, that worked). Skip motion on screens people use every few
  seconds, like the camera viewfinder.
- **Respect reduced motion.** main.css has a `prefers-reduced-motion` block that
  switches transitions and animations off. Anything new must still make sense
  with no motion (state must never depend on an animation finishing).
- **Test at 360×733** (the Samsung S23 in the app) and check nothing scrolls
  or jumps because of an animation.

## Patterns (copy these)

### Appear / disappear

```vue
<Transition name="rise">
  <p v-if="result" class="notice">Saved!</p>
</Transition>
```

```css
.rise-enter-active { transition: opacity var(--dur-enter) var(--ease-out), transform var(--dur-enter) var(--ease-out); }
.rise-leave-active { transition: opacity var(--dur-exit) ease-in; }
.rise-enter-from { opacity: 0; transform: translateY(8px); }
.rise-leave-to { opacity: 0; }
```

### Lists that reorder (e.g. Discover matches)

```vue
<TransitionGroup name="list" tag="div" class="stack">
  <RouterLink v-for="plant in plants" :key="plant.slug" ...>...</RouterLink>
</TransitionGroup>
```

```css
.list-move { transition: transform var(--dur-enter) var(--ease-in-out); }
.list-enter-active { transition: opacity var(--dur-enter) var(--ease-out), transform var(--dur-enter) var(--ease-out); }
.list-enter-from { opacity: 0; transform: translateY(8px); }
.list-leave-active { display: none; } /* leaving items just go: no jump while others move */
```

Every item needs a stable `:key` (an id or slug, never the index).

### Screen changes

`App.vue` wraps `<RouterView>` in `<Transition name="page">` with **enter only**
(no leave classes), so the old screen goes at once and the new one fades up.
Don't add `mode="out-in"`: it doubles the wait.

### Press feedback and small celebrations

- Buttons: `transform: scale(.97)` on `:active`, `--dur-quick`.
- A success tick: a one-off `@keyframes pop` (scale .6 → 1.12 → 1) with
  `--ease-spring`, triggered by a class that appears with the new state.

## Where motion already lives

- `App.vue`: page enter (`page-*`)
- `main.css`, "Motion" section: tokens, `rise-*`, `list-*`, `pop`, press feedback,
  and the reduced-motion block
- `Home.vue`: today's rituals (`list-*`, tick `pop`)
- `Discover.vue`: matches re-ranking (`list-*`)
- `LightMeter.vue`: reading appearing (`rise-*`)
