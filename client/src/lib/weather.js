// Small shared bits for showing weather warnings (see components/ThisWeek.vue).

/** Which icon goes with each kind of warning from GET /api/forecast */
export const ALERT_ICONS = {
  heat: 'sun',
  cold: 'cloud',
  dark: 'humidity', // the sun-behind-a-cloud icon
}
