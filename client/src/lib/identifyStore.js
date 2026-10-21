// Holds the latest Plant.id result while the user moves from the camera
// screen (/identify) to the result screen (/identified).
// A plain reactive object is all we need here, so there's no Pinia/Vuex.

import { reactive } from 'vue'

export const identifyStore = reactive({
  photoUrl: null, // the saved photo in Supabase Storage
  suggestions: [], // ranked best match first
  index: 0, // which suggestion we're showing ("See other matches" bumps this)
  source: 'plantid', // who identified it: 'plantid', 'plantnet' (the backup), or 'search' (typed its name)
  imageUrl: null, // added by name: the catalogue's photo of the species, if it has one
})

export function setIdentifyResult({ photoUrl, suggestions, source, imageUrl = null }) {
  identifyStore.photoUrl = photoUrl
  identifyStore.imageUrl = imageUrl
  identifyStore.suggestions = suggestions
  identifyStore.index = 0
  identifyStore.source = source ?? 'plantid'
}
