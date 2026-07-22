export type SignalSource = {
  id: string
  label: string
}

export type AudioSourceKind = 'demo-track' | 'live-stream'

export type AudioSource = {
  id: string
  kind: AudioSourceKind
  displayName: string
  title: string
  artist?: string
  release?: string
  label?: string
  bpm?: number
  audioUrl: string
  sourceUrl?: string
  license?: string
  attribution?: string
  isSeekable: boolean
  artworkUrl?: string
}

export type AudioPlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export type AudioAnalysisStatus =
  | 'unavailable'
  | 'initializing'
  | 'suspended'
  | 'running'
  | 'paused'
  | 'error'

export type AudioReactiveSnapshot = {
  energy: number
  smoothedEnergy: number
  bass: number
  kickPulse: number
  kickPulseAcceptedEvent: boolean
  kickPulseAcceptedEventCount: number
  bassPulse: number
  mids: number
  highs: number
  transient: number
  isActive: boolean
}

export type AudioAnalysisGraphDetails = {
  contextState: AudioContextState | null
  sampleRate: number | null
  fftSize: number | null
  frequencyBinCount: number | null
  smoothingTimeConstant: number | null
  minDecibels: number | null
  maxDecibels: number | null
}

export type ReactivePreviewTelemetry = {
  selectedReactiveBehavior: 'Chill' | 'Full On'
  reactivePreviewEnabled: boolean
  reactiveIsolationEnabled: boolean
  reactiveTimingAuthorityActive: boolean
  musicAuthorityActive: boolean
  motionGateOpen: boolean
  authoredCyclicBreathingEnabled: boolean
  authoredDepthContribution: number
  authoredAmbientGeometryContribution: number
  depthSustainedContribution: number
  kickDrivenDepthContribution: number
  depthPulseContribution: number
  depthCombinedBeforeClamp: number
  configuredDepthMinimum: number
  configuredDepthMaximum: number
  depthFinalAfterClamp: number
  finalDisplacementScale: number
  kickPulse: number
  kickPulseAcceptedEvent: boolean
  kickPulseAcceptedEventCount: number
  sourceBpm: number | null
  beatIntervalMs: number | null
  acceptedEventMinimumIntervalMs: number
  millisecondsSincePreviousAcceptedEvent: number
  acceptedEventRatePerSecondRecent: number
  smoothedEnergy: number
  sectionIntensity: number
  fullOnPhase: 'low' | 'high' | 'n/a'
  fullOnTargetDepth: number
  fullOnCurrentDepth: number
  millisecondsSinceAcceptedKickEvent: number
  inactivityReturnActive: boolean
  kickBreathEnvelope: number
  fullOnLowTargetDepth: number
  fullOnHighTargetDepth: number
  fullOnAttackDurationMs: number
  fullOnReleaseDurationMs: number
  kickBloomEnvelope: number
  hueEventStride: number
  hueEventStepAppliedDegrees: number
  reactiveHueTargetDegrees: number
  reactiveHueOffsetDegrees: number
  authoredBaseSaturation: number
  authoredPeriodicSaturationContribution: number
  reactiveSaturationMultiplier: number
  finalSaturation: number
  grayscaleFilterActive: boolean
  saturationBloomMultiplier: number
  saturationCap: number
  authoredBaseGlow: number
  reactiveKickBloom: number
  reactiveKickSurfaceGlowBloom: number
  globalGlowMultiplier: number
  saturationMultiplier: number
  globalLightMultiplier: number
  finalGlobalGlowMultiplier: number
  finalSurfaceGlowMultiplier: number
  surfaceGlowMultiplier: number
  authoredHueCycleSuppressed: boolean
  authoredSaturationCycleSuppressed: boolean
  authoredGlobalGlowCycleSuppressed: boolean
  transientAccent: number
  geometryMotionActive: boolean
}

export type ReactiveBehaviorId = 'chill' | 'fullon'

export type TrackInfo = {
  title: string
  artist: string
}

export type PlaybackState = 'stopped' | 'playing' | 'loading'
