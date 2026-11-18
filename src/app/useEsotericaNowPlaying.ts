import { createAzuraCastNowPlayingConfig } from './azuraCastNowPlaying'
import { useExternalNowPlaying } from './useExternalNowPlaying'

export const ESOTERICA_NOW_PLAYING_URL = 'https://esoterica.servemp3.com:444/api/nowplaying/psytrance_progressivepsytrance'

const ESOTERICA_CONFIG = createAzuraCastNowPlayingConfig('esoterica-radio-s4', {
  nowPlayingUrl: ESOTERICA_NOW_PLAYING_URL,
  streamUrl: 'https://esoterica.servemp3.com:444/listen/psytrance_progressivepsytrance/radio.mp3',
})

export function useEsotericaNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, ESOTERICA_CONFIG)
}
