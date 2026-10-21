// Holds the latest Plant.id result while the user moves from the camera
// screen (/identify) to the result screen (/identified).
// A plain reactive object is all we need here, so there's no Pinia/Vuex.

import { reactive } from 'vue'

export const identifyStore = reactive({
  photoUrl: null, // the saved photo in Supabase Storage
  suggestions: [], // ranked best match first
  index: 0, // which suggestion we're showing ("See other matches" bumps this)
  source: 'plantid', // who identified it: 'plantid', 'plantnet' (the backup), or 'search' (typed its name)
  imageUrl: null, // added by name: a photo of the species (catalogue, iNaturalist or Commons), if there is one
  imageCredit: null, // and its credit: { image_author, image_licence, image_licence_url, image_source_url, image_via }
})

export function setIdentifyResult({ photoUrl, suggestions, source, imageUrl = null, imageCredit = null }) {
  identifyStore.photoUrl = photoUrl
  identifyStore.imageUrl = imageUrl
  identifyStore.imageCredit = imageCredit
  identifyStore.suggestions = suggestions
  identifyStore.index = 0
  identifyStore.source = source ?? 'plantid'
}
