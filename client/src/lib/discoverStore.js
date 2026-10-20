// Remembers the Discover filters (room, light, pet-safe) so the match detail
// screen can explain the fit using the same choices the user made — even after
// navigating from the list to a plant and back. A plain reactive object is
// enough; it resets when the app reloads.

import { reactive } from 'vue'

export const discoverFilters = reactive({
  room: 'Living room',
  light: 'Bright, indirect',
  petSafeOnly: true,
})
