import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  HIRSCHMILCH_REST_POLL_MS,
  HirschmilchNowPlayingRuntime,
  parseHirschmilchWorkerMetadata,
} from '../src/app/useHirschmilchNowPlaying'

const workerMetadata = {
  channelId: 'psytrance',
  trackId: '48213',
  artist: 'Some Artist',
  title: 'Some Title (Original Mix)',
  source: 'playlist',
  badge: 'Live',
  badgeDetail: 'Studio',
}

const mapped = parseHirschmilchWorkerMetadata(workerMetadata, 'psytrance')
assert.equal(mapped?.artist, 'Some Artist')
assert.equal(mapped?.title, 'Some Title (Original Mix)')
assert.equal(mapped?.artworkUrl, undefined)
assert.equal(mapped?.source, 'playlist')
assert.equal(mapped?.badge, 'Live')
assert.equal(mapped?.badgeDetail, 'Studio')
assert.equal(
  parseHirschmilchWorkerMetadata(workerMetadata, 'progressive'),
  null,
)
const hookSource = readFileSync(
  new URL('../src/app/useHirschmilchNowPlaying.ts', import.meta.url),
  'utf8',
)
assert.equal(hookSource.includes('/channel/ajax/refresh'), false)
assert.equal(hookSource.includes('/socket.chat'), false)
assert.equal(hookSource.includes('socket.io-client'), false)

type TestMetadata = ReturnType<typeof parseHirschmilchWorkerMetadata>
const published: Array<TestMetadata> = []
const channels: string[] = []
let intervalDelay = 0
let clearCount = 0
const runtime = new HirschmilchNowPlayingRuntime(
  'psytrance',
  (metadata) => published.push(metadata),
  {
    fetchJson: async (channel) => {
      channels.push(channel)
      return { ...workerMetadata, channelId: channel }
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

runtime.start()
await new Promise((resolve) => setTimeout(resolve, 0))
assert.deepEqual(channels, ['psytrance'])
assert.equal(published.at(-1)?.title, 'Some Title (Original Mix)')
assert.equal(intervalDelay, HIRSCHMILCH_REST_POLL_MS)

runtime.updateChannel('progressive')
assert.equal(published.at(-1), null)
await new Promise((resolve) => setTimeout(resolve, 0))
assert.equal(published.at(-1)?.channelId, 'progressive')
assert.deepEqual(channels, ['psytrance', 'progressive'])

const blankRuntimeResults: Array<TestMetadata> = []
let blankRuntimeCalls = 0
let blankIntervalCallback: (() => void) | null = null
const blankRuntime = new HirschmilchNowPlayingRuntime(
  'psytrance',
  (metadata) => blankRuntimeResults.push(metadata),
  {
    fetchJson: async (_channel, signal) => {
      blankRuntimeCalls += 1
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      return blankRuntimeCalls === 1
        ? workerMetadata
        : { ...workerMetadata, artist: ' ', title: '' }
    },
    setInterval: (callback) => {
      blankIntervalCallback = callback
      return 2
    },
    clearInterval: () => undefined,
  },
)
blankRuntime.start()
await new Promise((resolve) => setTimeout(resolve, 0))
assert.equal(blankRuntimeResults.at(-1)?.trackId, '48213')
assert.equal(
  parseHirschmilchWorkerMetadata(
    { ...workerMetadata, artist: '', title: '' },
    'psytrance',
  ),
  null,
)
blankIntervalCallback?.()
await new Promise((resolve) => setTimeout(resolve, 0))
assert.equal(blankRuntimeResults.at(-1)?.trackId, '48213')
blankRuntime.destroy()

const errorRuntimeResults: Array<TestMetadata> = []
let errorRuntimeCalls = 0
let errorIntervalCallback: (() => void) | null = null
const errorRuntime = new HirschmilchNowPlayingRuntime(
  'psytrance',
  (metadata) => errorRuntimeResults.push(metadata),
  {
    fetchJson: async () => {
      errorRuntimeCalls += 1
      if (errorRuntimeCalls === 1) return workerMetadata
      throw new Error('Worker unavailable')
    },
    setInterval: (callback) => {
      errorIntervalCallback = callback
      return 3
    },
    clearInterval: () => undefined,
  },
)
errorRuntime.start()
await new Promise((resolve) => setTimeout(resolve, 0))
errorIntervalCallback?.()
await new Promise((resolve) => setTimeout(resolve, 0))
assert.equal(errorRuntimeResults.at(-1)?.trackId, '48213')
errorRuntime.destroy()

let finishOldRequest: ((value: unknown) => void) | null = null
let oldRequestSignal: AbortSignal | null = null
const staleRuntimeResults: Array<TestMetadata> = []
const staleRuntime = new HirschmilchNowPlayingRuntime(
  'psytrance',
  (metadata) => staleRuntimeResults.push(metadata),
  {
    fetchJson: async (channel, signal) => {
      if (channel === 'psytrance') {
        oldRequestSignal = signal
        return new Promise((resolve) => {
          finishOldRequest = resolve
        })
      }
      return { ...workerMetadata, channelId: channel }
    },
    setInterval: () => 4,
    clearInterval: () => undefined,
  },
)
staleRuntime.start()
staleRuntime.updateChannel('progressive')
assert.equal(oldRequestSignal?.aborted, true)
finishOldRequest?.(workerMetadata)
await new Promise((resolve) => setTimeout(resolve, 0))
assert.equal(staleRuntimeResults.at(-1)?.channelId, 'progressive')
assert.equal(staleRuntimeResults.some((metadata) => metadata?.channelId === 'psytrance'), false)
staleRuntime.destroy()

const initialFailureResults: Array<TestMetadata> = []
const initialFailureRuntime = new HirschmilchNowPlayingRuntime(
  'chillout',
  (metadata) => initialFailureResults.push(metadata),
  {
    fetchJson: async () => {
      throw new Error('Worker unavailable')
    },
    setInterval: () => 6,
    clearInterval: () => undefined,
  },
)
initialFailureRuntime.start()
await new Promise((resolve) => setTimeout(resolve, 0))
assert.deepEqual(initialFailureResults, [])
initialFailureRuntime.destroy()

let cleanupSignal: AbortSignal | null = null
const cleanupRuntime = new HirschmilchNowPlayingRuntime(
  'chillout',
  () => undefined,
  {
    fetchJson: async (_channel, signal) => {
      cleanupSignal = signal
      return new Promise(() => undefined)
    },
    setInterval: () => 5,
    clearInterval: () => {
      clearCount += 1
    },
  },
)
cleanupRuntime.start()
cleanupRuntime.destroy()
assert.equal(cleanupSignal?.aborted, true)
assert.equal(clearCount, 1)

console.log('Hirschmilch metadata and lifecycle checks passed.')