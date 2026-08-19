import assert from 'node:assert/strict'
import { parsePsyBrazilNowPlaying } from '../src/app/usePsyBrazilNowPlaying'

const liveShape = parsePsyBrazilNowPlaying(
  JSON.stringify({
    ok: true,
    label: 'PsyBrazil',
    artist: 'PsyBrazil',
    title: 'Linkin_Park_-_New_Divide_(Kamasutrance_Remix)',
    full_title: 'PsyBrazil - Linkin_Park_-_New_Divide_(Kamasutrance_Remix)',
  }),
)

assert.equal(liveShape?.artist, 'Linkin Park')
assert.equal(liveShape?.title, 'New Divide (Kamasutrance Remix)')

const unsplittable = parsePsyBrazilNowPlaying(
  JSON.stringify({ artist: 'PsyBrazil', title: 'Ambient_Set__Part_2' }),
)

assert.equal(unsplittable?.artist, undefined)
assert.equal(unsplittable?.title, 'Ambient Set Part 2')

const realArtistField = parsePsyBrazilNowPlaying(
  JSON.stringify({ artist: 'Kamasutrance', title: 'New_Divide' }),
)

assert.equal(realArtistField?.artist, 'Kamasutrance')
assert.equal(realArtistField?.title, 'New Divide')

const plainText = parsePsyBrazilNowPlaying('Linkin Park - New Divide (Kamasutrance Remix)')

assert.equal(plainText?.artist, 'Linkin Park')
assert.equal(plainText?.title, 'New Divide (Kamasutrance Remix)')

assert.equal(parsePsyBrazilNowPlaying(''), null)
assert.equal(parsePsyBrazilNowPlaying(JSON.stringify({ ok: true })), null)

console.log('PsyBrazil now-playing metadata parsing checks passed.')
