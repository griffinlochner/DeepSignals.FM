import assert from 'node:assert/strict'
import {
  parseSpaceUnicornNowPlaying,
  parseSpaceUnicornTelemetry,
} from '../src/app/useSpaceUnicornNowPlaying'

const autoDJ = {
  title: 'AutoDJ Artist - AutoDJ Track',
  server_name: 'Space Unicorn Radio',
  server_description: 'Space Unicorn Radio from the Ministry of Trance 2',
  genre: 'Trance & PsyTrance',
  listenurl: 'http://spaceunicorn.radio:8000/autodj',
  listeners: 0,
  bitrate: 192,
}
const liveDJ = {
  ...autoDJ,
  title: 'Live Artist - Live Track',
  server_name: 'DJ Ravie Live Manchester UK',
  genre: 'Trance',
  listenurl: 'http://spaceunicorn.radio:8000/live',
  bitrate: 256,
}
const stream = {
  listenurl: 'http://spaceunicorn.radio:8000/stream',
  listeners: 0,
}
const payload = (source: unknown) => ({ icestats: { source } })

// Keep the inactive mount's metadata present, as it is in the real status feed.
for (const [autoListeners, liveListeners, expectedSource, expectedListeners] of [
  [12, 0, autoDJ, 12],
  [0, 15, liveDJ, 15],
  [8, 0, autoDJ, 8],
] as const) {
  const sources = [
    { ...autoDJ, listeners: autoListeners },
    { ...liveDJ, listeners: liveListeners },
    stream,
  ]
  for (const ordered of [sources, [...sources].reverse()]) {
    const raw = payload(ordered)
    assert.equal(parseSpaceUnicornNowPlaying(raw)?.title, expectedSource.title)
    assert.deepEqual(parseSpaceUnicornTelemetry(raw), {
      listeners: expectedListeners,
      bitrateKbps: expectedSource.bitrate,
    })
  }
}

for (const listeners of [0, '0', 7, '7']) {
  const raw = payload({ ...autoDJ, listeners })
  assert.equal(parseSpaceUnicornNowPlaying(raw)?.title, autoDJ.title)
  assert.equal(parseSpaceUnicornTelemetry(raw)?.listeners, Number(listeners))
}

for (const listeners of [undefined, null, '', ' ', 'invalid', -1, NaN, Infinity, {}, false]) {
  const raw = payload([{ ...autoDJ, listeners }, stream])
  assert.equal(parseSpaceUnicornNowPlaying(raw)?.title, autoDJ.title)
  assert.deepEqual(parseSpaceUnicornTelemetry(raw), {
    listeners: null,
    bitrateKbps: 192,
  })
}

assert.deepEqual(
  parseSpaceUnicornTelemetry(payload({
    ...liveDJ,
    listeners: '15',
    bitrate: undefined,
    audio_info: 'samplerate=44100;bitrate=256',
  })),
  { listeners: 15, bitrateKbps: 256 },
)

for (const raw of [null, {}, payload(null), payload([]), payload([null, {}, stream])]) {
  assert.equal(parseSpaceUnicornNowPlaying(raw), null)
  assert.equal(parseSpaceUnicornTelemetry(raw), null)
}

console.log('Space Unicorn source selection and listener checks passed')
