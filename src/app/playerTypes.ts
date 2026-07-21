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
  bass: number
  mids: number
  highs: number
  smoothedEnergy: number
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

export type TrackInfo = {
  title: string
  artist: string
}

export type PlaybackState = 'stopped' | 'playing' | 'loading'
