// Two kinds of "back" for the arrow in the top-left of a screen.
//
//   goBack(router, fallback)  plain back: wherever the user just was
//                             (or `fallback` if the page was opened directly)
//   goUp(router, target)      "up" to a screen's parent, e.g. care plan → My plants.
//                             If the parent is the previous screen, just step back,
//                             so the history doesn't grow; otherwise swap this
//                             screen for the parent.
//
// Flows also keep throwaway screens out of the history: the camera is replaced
// by its result, and "Scan again" replaces the result it started from. Together
// this means one tap on the arrow always lands somewhere sensible.

/** The previous screen's path ("/plants/123"), or null if there isn't one */
function previousPath() {
  const back = window.history.state?.back
  return back ? new URL(back, window.location.origin).pathname : null
}

export function goBack(router, fallback = '/') {
  if (window.history.state?.back) router.back()
  else router.replace(fallback)
}

export function goUp(router, target) {
  const targetPath = new URL(target, window.location.origin).pathname
  if (previousPath() === targetPath) router.back()
  else router.replace(target)
}
