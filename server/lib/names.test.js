// Tests for matching plants to names in Indian languages.  Run with:  npm test
// No database or network: the "list" here is a small stand-in for species_names.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalize, keepRealNames, findCurated } from './names.js'

const rows = [
  { species: 'spathiphyllum wallisii', aliases: ['peace lily', 'spathiphyllum'], hi: 'पीस लिली', mr: 'पीस लिली', ta: 'பீஸ் லில்லி', ml: 'പീസ് ലില്ലി' },
  { species: 'dracaena trifasciata', aliases: ['sansevieria trifasciata', 'snake plant'], hi: 'स्नेक प्लांट', mr: null, ta: null, ml: 'സർപ്പപ്പോള' },
]

test('names are compared without caring about case or extra spaces', () => {
  assert.equal(normalize('  Spathiphyllum   Wallisii '), 'spathiphyllum wallisii')
  assert.equal(normalize(null), '')
})

test('finds a plant by its scientific name', () => {
  assert.equal(findCurated(rows, { species: 'Spathiphyllum wallisii' }).hi, 'पीस लिली')
})

test('finds a plant by an older scientific name', () => {
  assert.equal(findCurated(rows, { species: 'Sansevieria trifasciata' }).species, 'dracaena trifasciata')
})

test('finds a different species by its English name (another kind of peace lily)', () => {
  const row = findCurated(rows, { species: 'Spathiphyllum cochlearispathum', commonName: 'Peace Lily' })
  assert.equal(row.species, 'spathiphyllum wallisii')
})

test('returns nothing for a plant we do not know', () => {
  assert.equal(findCurated(rows, { species: 'Coffea arabica', commonName: 'Coffee' }), null)
})

test('only keeps names written in the right script', () => {
  assert.deepEqual(keepRealNames({ hi: 'घृत कुमारी', mr: '', ta: 'Aloe Verra', ml: 'കറ്റാർവാഴ' }), {
    hi: 'घृत कुमारी',
    ml: 'കറ്റാർവാഴ',
  })
  // Tamil text listed as Malayalam is not a Malayalam name
  assert.deepEqual(keepRealNames({ ml: 'துளசி' }), {})
})
