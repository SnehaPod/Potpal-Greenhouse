// Tests for picking free species photos.  Run with:  npm test   (from server/)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { authorFrom, pickINatPhoto, commonsPhoto } from './speciesPhotos.js'

const photo = (id, license_code, who = 'Sue Carnahan') => ({
  id,
  license_code,
  attribution: `(c) ${who}, some rights reserved (CC BY), uploaded by ${who}`,
  medium_url: `https://example.org/${id}/medium.jpg`,
})

test('the author, from iNaturalist’s credit line', () => {
  assert.equal(authorFrom('(c) Sue Carnahan, some rights reserved (CC BY), uploaded by Sue'), 'Sue Carnahan')
  assert.equal(authorFrom('(c) 陳育賢, some rights reserved (CC BY-NC)'), '陳育賢')
  assert.equal(authorFrom('no credit here'), null)
})

test('only photos we may reuse: CC0, CC BY, CC BY-SA', () => {
  // The main photo is "all rights reserved", the next "non-commercial": skip both
  const taxon = { default_photo: photo(1, null), taxon_photos: [{ photo: photo(2, 'cc-by-nc') }, { photo: photo(3, 'cc-by-sa') }] }
  const picked = pickINatPhoto(taxon)
  assert.equal(picked.url, 'https://example.org/3/medium.jpg')
  assert.equal(picked.licence, 'CC BY-SA 4.0')
  assert.equal(picked.sourceUrl, 'https://www.inaturalist.org/photos/3')
  assert.equal(picked.via, 'iNaturalist')
  // Nothing reusable: no photo rather than one we can't use
  assert.equal(pickINatPhoto({ default_photo: photo(4, null), taxon_photos: [{ photo: photo(5, 'cc-by-nc') }] }), null)
  assert.equal(pickINatPhoto(null), null)
})

test('Commons credit: author text without the HTML', () => {
  const credit = commonsPhoto({
    thumburl: 'https://upload.wikimedia.org/thumb/500px-x.jpg',
    descriptionurl: 'https://commons.wikimedia.org/wiki/File:x.jpg',
    extmetadata: {
      Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Cataleirxs">Cataleirxs</a>' },
      LicenseShortName: { value: 'CC BY-SA 4.0' },
      LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
    },
  })
  assert.deepEqual([credit.author, credit.licence, credit.via], ['Cataleirxs', 'CC BY-SA 4.0', 'Wikimedia Commons'])
  // No licence stated: don't use it
  assert.equal(commonsPhoto({ thumburl: 'x', extmetadata: {} }), null)
})
