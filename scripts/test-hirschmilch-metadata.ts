import assert from 'node:assert/strict'
import {
  HIRSCHMILCH_REST_POLL_MS,
  HirschmilchNowPlayingRuntime,
  parseHirschmilchRest,
  parseHirschmilchTrackUpdate,
} from '../src/app/useHirschmilchNowPlaying'

const update = {
  channel: 'psytrance',
  track: {
    id: 48213,
    duration: 412,
    metaartist: 'Some Artist',
    metatitle: 'Some Title (Original Mix)',
    source: 'playlist',
    badge: 'Live',
    badgeDetail: 'Studio',
    image: '/images/artist/some-artist.webp?v=3',
  },
}

const mapped = parseHirschmilchTrackUpdate(update, 'psytrance')
assert.equal(mapped?.artist, 'Some Artist')
assert.equal(mapped?.title, 'Some Title (Original Mix)')
assert.equal(mapped?.artworkUrl, 'https://hirschmilch.de/images/artist/some-artist.webp?v=3')
assert.equal(mapped?.source, 'playlist')
assert.equal(mapped?.badge, 'Live')
assert.equal(mapped?.badgeDetail, 'Studio')
assert.equal(mapped?.duration, 412)
assert.equal(parseHirschmilchTrackUpdate(update, 'progressive'), null)
assert.equal(
  parseHirschmilchTrackUpdate({ ...update, track: { ...update.track, image: '' } }, 'psytrance')
    ?.artworkUrl,
  undefined,
)

const restMapped = parseHirschmilchRest(
  [{ id: 'progressive', trackId: 22, artist: 'Artist', title: 'Title', source: 'mix' }],
  'progressive',
  null,
)
assert.equal(restMapped?.trackId, '22')
assert.equal(restMapped?.source, 'mix')
assert.equal(
  parseHirschmilchRest(
    [{ id: 'progressive', trackId: 23, artist: '', title: '' }],
    'progressive',
    restMapped,
  ),
  restMapped,
)

type Listener = (...args: unknown[]) => void
const listeners = new Map<string, Set<Listener>>()
const tuneIns: string[] = []
let disconnectCount = 0
const socket = {
  connected: false,
  on(event: string, listener: Listener) {
    const eventListeners = listeners.get(event) ?? new Set<Listener>()
    eventListeners.add(listener)
    listeners.set(event, eventListeners)
  },
  off(event: string, listener: Listener) {
    listeners.get(event)?.delete(listener)
  },
  emit(_event: string, channel: string, acknowledgement: (info: unknown) => void) {
    tuneIns.push(channel)
    acknowledgement({ track: update.track })
  },
  disconnect() {
    disconnectCount += 1
  },
}

const published: Array<ReturnType<typeof parseHirschmilchTrackUpdate>> = []
let restRequests = 0
let intervalDelay = 0
let clearCount = 0
const runtime = new HirschmilchNowPlayingRuntime(
  'psytrance',
  (metadata) => published.push(metadata),
  {
    createSocket: async () => socket,
    fetchJson: async () => {
      restRequests += 1
      return [{ id: 'psytrance', trackId: 99, artist: 'REST Artist', title: 'REST Title' }]
    },
    setInterval: (_callback, delay) => {
      intervalDelay = delay
      return 1
    },
    clearInterval: () => {
      clearCount += 1
    },
  },
)

await runtime.start()
socket.connected = true
listeners.get('connect')?.forEach((listener) => listener())
assert.deepEqual(tuneIns, ['channel:psytrance'])
assert.equal(published.at(-1)?.title, 'Some Title (Original Mix)')

runtime.updateChannel('progressive')
assert.equal(published.at(-2), null)
assert.equal(published.at(-1)?.channelId, 'progressive')
assert.deepEqual(tuneIns, ['channel:psytrance', 'channel:progressive'])

const publishCountBeforeWrongChannelUpdate = published.length
listeners.get('TRACKUPDATE')?.forEach((listener) => listener(update))
assert.equal(published.length, publishCountBeforeWrongChannelUpdate)

socket.connected = false
listeners.get('disconnect')?.forEach((listener) => listener())
await Promise.resolve()
assert.equal(restRequests, 1)
assert.equal(intervalDelay, HIRSCHMILCH_REST_POLL_MS)

socket.connected = true
listeners.get('connect')?.forEach((listener) => listener())
assert.equal(clearCount, 1)
assert.equal(tuneIns.at(-1), 'channel:progressive')

runtime.destroy()
assert.equal(disconnectCount, 1)
assert.equal([...listeners.values()].every((eventListeners) => eventListeners.size === 0), true)

console.log('Hirschmilch metadata and lifecycle checks passed.')