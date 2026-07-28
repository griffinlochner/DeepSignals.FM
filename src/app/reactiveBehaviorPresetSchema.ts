import type { AudioReactiveSnapshot } from './playerTypes'

export type TelemetrySignalField =
  | 'energy'
  | 'smoothedEnergy'
  | 'bass'
  | 'kickPulse'
  | 'bassPulse'
  | 'mids'
  | 'highs'
  | 'transient'

export type DepthMode = 'manual' | 'audio-mapped'
export type HueMode = 'off' | 'manual' | 'audio-mapped'
export type SaturationMode = 'off' | 'manual' | 'audio-mapped'

export type ReactiveBehaviorPresetV2 = {
  schemaVersion: 2
  name: string
  depth: {
    mode: DepthMode
    signal: TelemetrySignalField
    min: number
    max: number
    smoothing: number
  }
  hue: {
    mode: HueMode
    signal: TelemetrySignalField
    minDegrees: number
    maxDegrees: number
    smoothing: number
  }
  saturation: {
    mode: SaturationMode
    signal: TelemetrySignalField
    min: number
    max: number
    smoothing: number
  }
}

export const FULLON_BUILT_IN_PRESET: Readonly<ReactiveBehaviorPresetV2> = {
  schemaVersion: 2,
  name: 'FULLON',
  depth: {
    mode: 'audio-mapped',
    signal: 'energy',
    min: 0.1,
    max: 0.9,
    smoothing: 0.5,
  },
  hue: {
    mode: 'audio-mapped',
    signal: 'energy',
    minDegrees: -180,
    maxDegrees: 177,
    smoothing: 0.14,
  },
  saturation: {
    mode: 'audio-mapped',
    signal: 'bass',
    min: 0.15,
    max: 1.85,
    smoothing: 0.5,
  },
}

export function resolveSnapshotSignal(snapshot: AudioReactiveSnapshot, field: TelemetrySignalField) {
  const value = snapshot[field]
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}
