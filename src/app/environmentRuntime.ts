import type { AudioReactiveSnapshot } from './playerTypes'

export type EnvironmentRuntimeInput = {
  isPlaying: boolean
  motionEnabled: boolean
  chromaEnabled: boolean
  volume: number
  audioSnapshot: AudioReactiveSnapshot
}

export type EnvironmentRuntime = {
  isPlaying: boolean
  motionEnabled: boolean
  chromaEnabled: boolean
  effectiveMotion: boolean
  volume: number
  audioSnapshot: AudioReactiveSnapshot
}

export function deriveEnvironmentRuntime(
  input: EnvironmentRuntimeInput,
): EnvironmentRuntime {
  return {
    isPlaying: input.isPlaying,
    motionEnabled: input.motionEnabled,
    chromaEnabled: input.chromaEnabled,
    effectiveMotion: input.isPlaying && input.motionEnabled,
    volume: input.volume,
    audioSnapshot: input.audioSnapshot,
  }
}
