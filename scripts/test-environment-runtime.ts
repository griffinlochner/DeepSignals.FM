import assert from 'node:assert/strict'
import { deriveEnvironmentRuntime } from '../src/app/environmentRuntime'
import type { AudioReactiveSnapshot } from '../src/app/playerTypes'

const audioSnapshot: AudioReactiveSnapshot = {
  energy: 0.81,
  smoothedEnergy: 0.74,
  bass: 0.62,
  kickPulse: 0.51,
  kickPulseAcceptedEvent: true,
  kickPulseAcceptedEventCount: 4,
  kickPulseAcceptedEventSequence: 7,
  bassPulse: 0.43,
  mids: 0.38,
  highs: 0.29,
  transient: 0.17,
  isActive: true,
}

function derive(overrides: Partial<Parameters<typeof deriveEnvironmentRuntime>[0]> = {}) {
  return deriveEnvironmentRuntime({
    isPlaying: true,
    motionEnabled: true,
    chromaEnabled: true,
    volume: 0.65,
    audioSnapshot,
    ...overrides,
  })
}

assert.equal(derive({ isPlaying: false, motionEnabled: true }).effectiveMotion, false)
assert.equal(derive({ isPlaying: false, motionEnabled: false }).effectiveMotion, false)
assert.equal(derive({ isPlaying: true, motionEnabled: false }).effectiveMotion, false)
assert.equal(derive({ isPlaying: true, motionEnabled: true }).effectiveMotion, true)

assert.equal(derive({ chromaEnabled: false, motionEnabled: true }).chromaEnabled, false)
assert.equal(derive({ chromaEnabled: true, motionEnabled: false }).chromaEnabled, true)
assert.deepEqual(derive().audioSnapshot, audioSnapshot)
assert.strictEqual(derive().audioSnapshot, audioSnapshot)
assert.equal(derive({ volume: 0 }).volume, 0)
assert.equal(derive({ volume: 1 }).volume, 1)

console.log('Environment runtime helper checks passed.')
