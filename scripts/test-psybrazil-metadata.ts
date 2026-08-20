import assert from 'node:assert/strict'
import {
  createPsyBrazilNowPlayingParser,
  parsePsyBrazilNowPlaying,
} from '../src/app/usePsyBrazilNowPlaying'

const DUMANGUE_URL = 'https://psybrazil.com.br/api/track.php?station=dumangue'

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

// api/track.php shape, as served for the psybr mount (underscore separators).
const trackApiPsyBr = parsePsyBrazilNowPlaying(
  JSON.stringify({
    success: true,
    station: 'psybr',
    status: 'online',
    now_playing: 'Erebus_-_Return_Of_The_Vindaloo',
    next_track: 'Psyfactor_1408',
  }),
)

assert.equal(trackApiPsyBr?.artist, 'Erebus')
assert.equal(trackApiPsyBr?.title, 'Return Of The Vindaloo')

// api/track.php shape, as served for the dumangue mount (dash separator).
const dumangueParse = createPsyBrazilNowPlayingParser(DUMANGUE_URL)
const trackApiDumangue = dumangueParse(
  JSON.stringify({
    success: true,
    station: 'dumangue',
    status: 'online',
    now_playing: 'Chimo Bayo - Asi Me Gusta A Mi (KamaSutrance Rmx)',
    next_track: 'X-Noize - Flying Away (Bizzare Contact Rmx)',
  }),
)

assert.equal(trackApiDumangue?.artist, 'Chimo Bayo')
assert.equal(trackApiDumangue?.title, 'Asi Me Gusta A Mi (KamaSutrance Rmx)')
assert.equal(trackApiDumangue?.sourceUrl, DUMANGUE_URL)

assert.equal(dumangueParse(JSON.stringify({ success: false, status: 'offline' })), null)

console.log('PsyBrazil now-playing metadata parsing checks passed.')
