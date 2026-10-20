// Little helpers for talking about plants in the UI.

/** Is this plant due (or overdue) for watering today? */
export function isDueToday(plant) {
  if (!plant?.next_water_due_at) return true
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  return new Date(plant.next_water_due_at) <= endOfToday
}

/** Was it watered today? (used to tick off today's rituals) */
export function wateredToday(plant) {
  if (!plant?.last_watered_at) return false
  return new Date(plant.last_watered_at).toDateString() === new Date().toDateString()
}

/** "Every 7–10 days" */
export function waterEvery(plant) {
  return `Every ${plant.water_min_days}–${plant.water_max_days} days`
}

/** "Water · due today" / "Water · in 5 days" / "Water · done for today" */
export function waterStatus(plant) {
  if (wateredToday(plant)) return 'Water · done for today'
  if (isDueToday(plant)) return 'Water · due today'
  const days = Math.ceil((new Date(plant.next_water_due_at) - Date.now()) / 86_400_000)
  return `Water · in ${days} day${days === 1 ? '' : 's'}`
}

/** Plant.id's toxicity text says "toxic" unless the plant is safe */
export function isPetSafe(toxicity) {
  if (!toxicity) return null // unknown
  const t = toxicity.toLowerCase()
  return t.includes('non-toxic') || t.includes('not toxic') || !t.includes('toxic')
}

/** The rooms offered in the design's dropdowns */
export const ROOMS = ['Living room', 'Bedroom', 'Kitchen', 'Office', 'Bathroom']

/** "Monday, October 12" */
export function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
