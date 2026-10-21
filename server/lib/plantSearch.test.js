// Tests for "Add a plant by name".  Run with:  npm test   (from server/)
// GBIF is faked, so these never touch the network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { editDistance, knownPlants, localMatches, fromGbifMatch, fromGbifVernacular, searchPlants } from './plantSearch.js'

const catalog = [
  { scientific_name: 'Monstera deliciosa', common_name: 'Monstera deliciosa', image_url: '/images/monstera.webp' },
  { scientific_name: 'Dracaena trifasciata', common_name: 'Snake plant', image_url: '/images/snake.jpg' },
  { scientific_name: 'Spathiphyllum wallisii', common_name: 'Peace lily', image_url: null },
  { scientific_name: 'Nephrolepis exaltata', common_name: 'Boston fern', image_url: null },
  { scientific_name: 'Ficus elastica', common_name: 'Rubber plant', image_url: null },
]
const nameRows = [
  { species: 'dracaena trifasciata', aliases: ['sansevieria trifasciata', 'snake plant'], hi: 'स्नेक प्लांट', mr: null, ta: null, ml: null },
  { species: 'epipremnum aureum', aliases: ['golden pothos', 'money plant'], hi: 'मनी प्लांट', mr: null, ta: null, ml: null },
]

// A fake GBIF: answers by which kind of call it is
const fakeGbif = ({ match = null, vernacular = { results: [] } } = {}) => async (url) =>
  url.includes('/species/match') ? match : vernacular
const gbifDown = async () => null

test('edit distance counts single-letter changes', () => {
  assert.equal(editDistance('lilly', 'lily'), 1)
  assert.equal(editDistance('delicioza', 'deliciosa'), 1)
  assert.equal(editDistance('same', 'same'), 0)
})

test('our own plants: exact, common, local-language and typo matches', () => {
  const plants = knownPlants(catalog, nameRows)
  assert.equal(localMatches('snake plant', plants)[0].name, 'Dracaena trifasciata')
  assert.equal(localMatches('snake plant', plants)[0].kind, 'common')
  // A Hindi name finds the plant, and says which name matched
  const hindi = localMatches('मनी प्लांट', plants)[0]
  assert.equal(hindi.name, 'Epipremnum aureum')
  assert.equal(hindi.alsoKnownAs, 'मनी प्लांट')
  // One wrong letter: a confident "did you mean"
  const typo = localMatches('peace lilly', plants)[0]
  assert.deepEqual([typo.name, typo.kind, typo.confidence], ['Spathiphyllum wallisii', 'fuzzy', 90])
  // Too short to guess at
  assert.deepEqual(localMatches('a', plants), [])
})

test('GBIF match: typos corrected, old names followed, groups recognised', () => {
  const fuzzy = fromGbifMatch({ kingdom: 'Plantae', matchType: 'FUZZY', rank: 'SPECIES', species: 'Monstera deliciosa', canonicalName: 'Monstera deliciosa', status: 'ACCEPTED', confidence: 96 })
  assert.deepEqual([fuzzy.name, fuzzy.kind, fuzzy.confidence], ['Monstera deliciosa', 'fuzzy', 96])

  const synonym = fromGbifMatch({ kingdom: 'Plantae', matchType: 'EXACT', rank: 'SPECIES', species: 'Dracaena trifasciata', canonicalName: 'Sansevieria trifasciata', status: 'SYNONYM', confidence: 100 })
  assert.deepEqual([synonym.name, synonym.wasName], ['Dracaena trifasciata', 'Sansevieria trifasciata'])

  assert.deepEqual(fromGbifMatch({ kingdom: 'Plantae', matchType: 'HIGHERRANK', rank: 'GENUS', canonicalName: 'Ficus' }), { group: 'Ficus' })
  // "Plantae" itself, or an animal: no answer
  assert.equal(fromGbifMatch({ kingdom: 'Plantae', matchType: 'HIGHERRANK', rank: 'KINGDOM' }), null)
  assert.equal(fromGbifMatch({ kingdom: 'Animalia', matchType: 'EXACT', rank: 'SPECIES', species: 'Felis catus' }), null)
})

test('GBIF common names: whole names only, plants only', () => {
  const json = {
    results: [
      { kingdom: 'Plantae', canonicalName: 'Epipremnum aureum', taxonomicStatus: 'ACCEPTED', vernacularNames: [{ vernacularName: "Golden pothos, Money Plant, Devil's Ivy" }] },
      { kingdom: 'Plantae', canonicalName: 'Polyscias cumingiana', taxonomicStatus: 'ACCEPTED', vernacularNames: [{ vernacularName: 'Money-plant-ish aralia' }] },
      { kingdom: 'Animalia', canonicalName: 'Some moth', taxonomicStatus: 'ACCEPTED', vernacularNames: [{ vernacularName: 'Money plant' }] },
    ],
  }
  const results = fromGbifVernacular(json, 'money plant')
  assert.deepEqual(results.map((r) => [r.name, r.commonName]), [['Epipremnum aureum', 'Money Plant']])
})

test('the whole search: our catalogue first, merged with GBIF, no duplicates', async () => {
  const { results, nudge } = await searchPlants('snake plant', {
    catalog,
    nameRows,
    fetchGbif: fakeGbif({
      vernacular: {
        results: [
          { kingdom: 'Plantae', canonicalName: 'Sansevieria trifasciata', taxonomicStatus: 'SYNONYM', accepted: 'Dracaena trifasciata (Prain) Mabb.', vernacularNames: [{ vernacularName: 'snake plant' }] },
        ],
      },
    }),
  })
  assert.equal(results.length, 1) // the catalogue plant and GBIF's answer are the same species
  assert.equal(results[0].inCatalog, true)
  assert.equal(results[0].wasName, 'Sansevieria trifasciata')
  assert.equal(nudge, false)
})

test('the nudge: nothing found, a group, or a weak spelling guess', async () => {
  assert.equal((await searchPlants('asdfgh', { catalog, nameRows, fetchGbif: fakeGbif() })).nudge, true)

  const ficus = await searchPlants('Ficus', { catalog, nameRows, fetchGbif: fakeGbif({ match: { kingdom: 'Plantae', matchType: 'HIGHERRANK', rank: 'GENUS', canonicalName: 'Ficus' } }) })
  assert.equal(ficus.group, 'Ficus')
  assert.equal(ficus.nudge, true)
  assert.equal(ficus.results[0].name, 'Ficus elastica') // the catalogue's Ficus still shows

  const fern = await searchPlants('fern', { catalog, nameRows, fetchGbif: fakeGbif() })
  assert.equal(fern.results[0].name, 'Nephrolepis exaltata')
  assert.equal(fern.nudge, true)

  const weak = await searchPlants('xylo', {
    catalog,
    nameRows,
    fetchGbif: fakeGbif({ match: { kingdom: 'Plantae', matchType: 'FUZZY', rank: 'SPECIES', species: 'Xylopia aethiopica', canonicalName: 'Xylopia aethiopica', status: 'ACCEPTED', confidence: 70 } }),
  })
  assert.equal(weak.results[0].kind, 'fuzzy')
  assert.equal(weak.nudge, true)
})

test('GBIF down: our own lists still answer', async () => {
  const { results } = await searchPlants('peace lilly', { catalog, nameRows, fetchGbif: gbifDown })
  assert.equal(results[0].name, 'Spathiphyllum wallisii')
})
