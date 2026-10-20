// Tests for reading Pl@ntNet's reply and filling in care facts.  Run with:  npm test
// The sample reply follows Pl@ntNet's documented format (v2 /identify).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { simplify } from './plantnet.js'
import { addCare, GENERAL_CARE } from './careFallback.js'

const SAMPLE_REPLY = {
  bestMatch: 'Goeppertia orbifolia (Linden) Borchs. & S.Suárez',
  results: [
    {
      score: 0.7124,
      species: {
        scientificNameWithoutAuthor: 'Goeppertia orbifolia',
        scientificName: 'Goeppertia orbifolia (Linden) Borchs. & S.Suárez',
        commonNames: ['round-leaf calathea', 'prayer plant', 'peacock plant'],
        genus: { scientificNameWithoutAuthor: 'Goeppertia' },
      },
    },
    { score: 0.081, species: { scientificNameWithoutAuthor: 'Coffea arabica', commonNames: ['Arabica coffee'] } },
  ],
}

test('reads species names and scores from a Pl@ntNet reply', () => {
  const { isPlant, suggestions } = simplify(SAMPLE_REPLY)
  assert.equal(isPlant, true)
  assert.equal(suggestions.length, 2)
  assert.deepEqual(suggestions[0], {
    name: 'Goeppertia orbifolia',
    commonName: 'Round-leaf calathea',
    otherNames: ['Prayer plant', 'Peacock plant'],
    probability: 0.7124,
    similarImage: null,
  })
})

test('no results, or only very low scores, means "couldn\'t identify"', () => {
  assert.deepEqual(simplify({ results: [] }), { isPlant: false, suggestions: [] })
  assert.deepEqual(simplify({ results: [{ score: 0.01, species: { scientificNameWithoutAuthor: 'Rosa' } }] }), {
    isPlant: false,
    suggestions: [],
  })
  assert.deepEqual(simplify(null), { isPlant: false, suggestions: [] })
})

// A tiny stand-in for the catalogue and the names list
const catalog = [
  {
    scientific_name: 'Goeppertia orbifolia', common_name: 'Calathea orbifolia', light: 'Bright, indirect',
    water_min_days: 5, water_max_days: 7, care_level: 'A little attentive', pet_safe: true,
    blurb: 'Soft stripes…', care_tip: 'Keep lightly moist with filtered water.',
  },
  {
    scientific_name: 'Dracaena trifasciata', common_name: 'Snake plant', light: 'Low',
    water_min_days: 14, water_max_days: 21, care_level: 'Easy-going', pet_safe: false, blurb: '…', care_tip: '…',
  },
]
const nameRows = [{ species: 'dracaena trifasciata', aliases: ['sansevieria trifasciata', 'snake plant'] }]

test('a catalogue plant gets its own care facts', () => {
  const [s] = addCare(simplify(SAMPLE_REPLY).suggestions, catalog, nameRows)
  assert.equal(s.careSource, 'catalog')
  assert.equal(s.waterMinDays, 5)
  assert.equal(s.careLevel, 'A little attentive')
  assert.equal(s.toxicity, 'Non-toxic to cats and dogs.')
  assert.equal(s.light, 'Bright, indirect')
})

test('an older scientific name still finds the catalogue plant', () => {
  const [s] = addCare([{ name: 'Sansevieria trifasciata', commonName: null }], catalog, nameRows)
  assert.equal(s.careSource, 'catalog')
  assert.equal(s.light, 'Low light') // the catalogue's "Low", in the app's wording
  assert.match(s.toxicity, /^Toxic/)
})

test('an unknown plant gets general tips, and toxicity stays unknown', () => {
  const [, coffee] = addCare(simplify(SAMPLE_REPLY).suggestions, catalog, nameRows)
  assert.equal(coffee.careSource, 'general')
  assert.equal(coffee.light, GENERAL_CARE.light)
  assert.equal(coffee.waterMinDays, 7)
  assert.equal(coffee.toxicity, null) // never "safe" by default
})
