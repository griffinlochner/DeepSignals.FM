export type SignalSource = {
  id: string
  label: string
}

export type TrackInfo = {
  title: string
  artist: string
}

export type PlaybackState = 'stopped' | 'playing' | 'loading'
