import type { AudioSource } from './playerTypes'

export type TrackSignalMetadataOrigin = 'embedded' | 'configured'

export type TrackSignalMetadata = {
  sourceUrl: string
  title: string
  artist?: string
  album?: string
  year?: string
  genre?: string
  license?: string
  label?: string
  releaseUrl?: string
  artworkUrl?: string
  artworkMimeType?: string
  origin: TrackSignalMetadataOrigin
}

export function createConfiguredTrackSignalMetadata(source: AudioSource): TrackSignalMetadata {
  return {
    sourceUrl: source.audioUrl,
    title: source.title,
    artist: source.artist,
    artworkUrl: source.artworkUrl,
    origin: 'configured',
  }
}
