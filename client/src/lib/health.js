// Helpers for the health journal: is a plant getting better or worse?
// Pure functions over the scans from GET /api/plants/:id/health (oldest first).

// Plant.id scores wobble a little between photos, so small changes don't count
const STEADY_RANGE = 5

/**
 * Compare the latest scan with the one before it.
 * @returns { latest, previous, change, direction } or null with no scans.
 *          direction is 'better' | 'worse' | 'steady' | 'first' (only one scan).
 */
export function trend(scans) {
  if (!scans?.length) return null
  const latest = scans.at(-1)
  const previous = scans.length > 1 ? scans.at(-2) : null
  if (!previous) return { latest, previous, change: 0, direction: 'first' }

  const change = latest.score - previous.score
  const direction = Math.abs(change) <= STEADY_RANGE ? 'steady' : change > 0 ? 'better' : 'worse'
  return { latest, previous, change, direction }
}

/** "Miso is up 24 points since Oct 12." and friends */
export function trendLabel(t, nickname) {
  if (!t) return ''
  const since = shortDate(t.previous?.created_at)
  switch (t.direction) {
    case 'first':
      return `${nickname}'s first check-in. Scan again next week to start a trend.`
    case 'better':
      return `${nickname} is up ${t.change} points since ${since}. Keep it up!`
    case 'worse':
      return `${nickname} is down ${-t.change} points since ${since}. Worth a closer look.`
    default:
      return `${nickname} is holding steady since ${since}.`
  }
}

/** "Oct 12" */
export function shortDate(date) {
  return date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
}

/** The words that go with a score, matching the health check screen */
export function scoreWord(score) {
  if (score >= 70) return 'Looking leafy'
  if (score >= 40) return 'Needs a little TLC'
  return 'Needs some care'
}
