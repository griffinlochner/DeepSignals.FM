import { useExternalNowPlaying } from './useExternalNowPlaying'
import { createAzuraCastNowPlayingConfig, parseAzuraCastNowPlaying } from './azuraCastNowPlaying'

export const TRIPLAG_NOW_PLAYING_URL = 'https://a3.asurahosting.com/api/nowplaying/triplag'
const TRIPLAG_STREAM_URL = 'https://a3.asurahosting.com/listen/triplag/radio.mp3'

const TRIPLAG_ENDPOINT = {
  nowPlayingUrl: TRIPLAG_NOW_PLAYING_URL,
  streamUrl: TRIPLAG_STREAM_URL,
}

export function parseTriplagNowPlaying(value: unknown) {
  return parseAzuraCastNowPlaying(value, TRIPLAG_ENDPOINT)
}

const TRIPLAG_CONFIG = createAzuraCastNowPlayingConfig('triplag-darkpsy', TRIPLAG_ENDPOINT)

export function useTriplagNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, TRIPLAG_CONFIG)
}
