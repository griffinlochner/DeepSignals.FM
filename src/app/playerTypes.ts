export type SignalSource = {
  id: string
  label: string
}

export type AudioSourceKind = 'demo-track' | 'live-stream'

export type AudioSource = {
  id: string
  kind: AudioSourceKind
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

export type TrackInfo = {
  title: string
  artist: string
}

export type PlaybackState = 'stopped' | 'playing' | 'loading'
