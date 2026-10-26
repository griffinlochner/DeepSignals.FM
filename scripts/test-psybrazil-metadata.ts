import assert from 'node:assert/strict'
import {
  createPsyBrazilNowPlayingParser,
  parsePsyBrazilNowPlaying,
} from '../src/app/usePsyBrazilNowPlaying'
import {
  getPsyBrazilArtworkUrl,
  PSYBRAZIL_STATION_IDS,
} from '../src/app/psybrazilArtwork'

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
assert.equal(
  parsePsyBrazilNowPlaying(JSON.stringify({ now_playing: 'Unknown' }))
    ?.rawNowPlaying,
  undefined,
)

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
assert.equal(trackApiPsyBr?.rawNowPlaying, 'Erebus_-_Return_Of_The_Vindaloo')

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

// api/track.php shape, as served for the progressive mount.
const progressiveUrl = 'https://psybrazil.com.br/api/track.php?station=progressive'
const trackApiProgressive = createPsyBrazilNowPlayingParser(progressiveUrl)(
  JSON.stringify({
    success: true,
    station: 'progressive',
    status: 'online',
    now_playing: 'Karmon - Bluesky (ZAC & Padox Remix)',
    next_track: 'SET BASSIK - PSYBRAZIL',
  }),
)

assert.equal(trackApiProgressive?.artist, 'Karmon')
assert.equal(trackApiProgressive?.title, 'Bluesky (ZAC & Padox Remix)')
assert.equal(trackApiProgressive?.sourceUrl, progressiveUrl)

// api/track.php shape, as served for the lofi mount.
const lofiUrl = 'https://psybrazil.com.br/api/track.php?station=lofi'
const trackApiLoFi = createPsyBrazilNowPlayingParser(lofiUrl)(
  JSON.stringify({
    success: true,
    station: 'lofi',
    status: 'online',
    now_playing: 'Khetzal - Litora Praesidium',
    next_track: 'Nexus A - V.S.W.',
  }),
)

assert.equal(trackApiLoFi?.artist, 'Khetzal')
assert.equal(trackApiLoFi?.title, 'Litora Praesidium')
assert.equal(trackApiLoFi?.sourceUrl, lofiUrl)

// api/track.php shape, as served for the lowbpm mount.
const lowBpmUrl = 'https://psybrazil.com.br/api/track.php?station=lowbpm'
const trackApiLowBpm = createPsyBrazilNowPlayingParser(lowBpmUrl)(
  JSON.stringify({
    success: true,
    station: 'lowbpm',
    status: 'online',
    now_playing: 'Etnica - Fluorophilia',
    next_track: 'Los_Cuates_de_Sinaloa_Negro_Y_Azul_The_Ballad_of_Heisenberg_',
  }),
)

assert.equal(trackApiLowBpm?.artist, 'Etnica')
assert.equal(trackApiLowBpm?.title, 'Fluorophilia')
assert.equal(trackApiLowBpm?.sourceUrl, lowBpmUrl)

// The electro mount serves the underscore form rather than the dash form.
const electroUrl = 'https://psybrazil.com.br/api/track.php?station=electro'
const trackApiElectro = createPsyBrazilNowPlayingParser(electroUrl)(
  JSON.stringify({
    success: true,
    station: 'electro',
    status: 'online',
    now_playing: 'lish_-_feel_good-g-psy-converted',
    next_track: 'APHE - Figure 5 (Groovearth Remix)-converted',
  }),
)

assert.equal(trackApiElectro?.artist, 'lish')
assert.equal(trackApiElectro?.title, 'feel good-g-psy-converted')
assert.equal(trackApiElectro?.sourceUrl, electroUrl)

assert.deepEqual(PSYBRAZIL_STATION_IDS, {
  psybrazil: 'psybr',
  'psybrazil-dumangue': 'dumangue',
  'psybrazil-progressive': 'progressive',
  'psybrazil-lofi': 'lofi',
  'psybrazil-lowbpm': 'lowbpm',
  'psybrazil-electro': 'electro',
})

// The complete network is returned for every request, with psybr last, not first.
const networkStations = Object.fromEntries(
  ['dumangue', 'electro', 'progressive', 'planb', 'lofi', 'whapade', 'lowbpm', 'psybr']
    .map((id) => [id, {
      id,
      status: 'online',
      now_playing: `${id}_Artist_-_${id}_Track`,
      next_song: 'Next Artist - Do Not Display',
      stream: { mount: id, current: `${id} Artist - Stream Track` },
    }]),
)

for (const stationId of Object.values(PSYBRAZIL_STATION_IDS)) {
  const url = `https://psybrazil.com.br/api/track.php?station=${stationId}`
  const parse = createPsyBrazilNowPlayingParser(url)
  const entry = networkStations[stationId]
  const wrap = (station: unknown) => ({
    ok: true,
    now_playing: 'Wrong Artist - Network Root',
    stations: { ...networkStations, [stationId]: station },
  })
  const result = parse(JSON.stringify(wrap(entry)))
  assert.equal(result?.artist, `${stationId} Artist`)
  assert.equal(result?.title, `${stationId} Track`)
  assert.equal(result?.sourceUrl, url)
  assert.equal(result?.rawNowPlaying, entry.now_playing)
  assert.equal(
    parse(wrap({ ...entry, now_playing: '', stream: entry.stream }))?.title,
    'Stream Track',
  )
  assert.equal(
    parse(JSON.stringify({ station: stationId, ...entry }))?.title,
    `${stationId} Track`,
  )

  const otherStations = { ...networkStations }
  delete otherStations[stationId]
  assert.equal(parse({ ok: true, stations: otherStations }), null)
  for (const invalid of [
    null,
    [],
    { ...entry, id: 'other' },
    { ...entry, station: 'other' },
    { ...entry, status: 'offline' },
    { ...entry, success: false },
    { ...entry, stream: { ...entry.stream, mount: 'other' } },
    { id: stationId, status: 'online', next_song: 'Not Current' },
    { id: stationId, now_playing: 'Unknown' },
  ]) {
    assert.equal(parse(wrap(invalid)), null)
  }
  assert.equal(parse({ ...wrap(entry), ok: false }), null)
  assert.equal(parse({ ...wrap(entry), success: false }), null)
  assert.equal(parse({ stations: null, now_playing: 'Wrong - Root' }), null)
  assert.equal(parse({ ...entry, station: 'other' }), null)
}

for (const invalid of ['null', '[]', '42', '{"stations":', '{"now_playing":']) {
  assert.equal(parsePsyBrazilNowPlaying(invalid), null)
}

for (const [signalId, stationId] of Object.entries(PSYBRAZIL_STATION_IDS)) {
  const artworkUrl = getPsyBrazilArtworkUrl(
    signalId,
    'Eartheogen - Energy Rebounds & Beyond',
  )
  assert.ok(artworkUrl)
  const parsedUrl = new URL(artworkUrl)
  assert.equal(parsedUrl.origin + parsedUrl.pathname, 'https://psybrazil.com.br/api/artwork.php')
  assert.equal(parsedUrl.searchParams.get('song'), 'Eartheogen - Energy Rebounds & Beyond')
  assert.equal(parsedUrl.searchParams.get('station'), stationId)
}

assert.notEqual(
  getPsyBrazilArtworkUrl('psybrazil', 'First Artist - First Track'),
  getPsyBrazilArtworkUrl('psybrazil', 'Second Artist - Second Track'),
)
assert.notEqual(
  getPsyBrazilArtworkUrl('psybrazil', 'Artist - Track'),
  getPsyBrazilArtworkUrl('psybrazil-electro', 'Artist - Track'),
)
assert.equal(getPsyBrazilArtworkUrl('psybrazil', ''), null)
assert.equal(getPsyBrazilArtworkUrl('space-unicorn-radio', 'Artist - Track'), null)

console.log('PsyBrazil now-playing metadata parsing checks passed.')
