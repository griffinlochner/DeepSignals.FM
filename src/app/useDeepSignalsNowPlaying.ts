import { createAzuraCastNowPlayingConfig } from './azuraCastNowPlaying'
import { useExternalNowPlaying } from './useExternalNowPlaying'

const DEEPSIGNALS_CONFIG = createAzuraCastNowPlayingConfig('deepsignals-psytrance', {
  nowPlayingUrl: 'https://a6.asurahosting.com/api/nowplaying/764',
  streamUrl: 'https://a6.asurahosting.com:7530/radio.mp3',
})

export function useDeepSignalsNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(import.meta.env.DEV ? selectedSourceId : null, DEEPSIGNALS_CONFIG)
}
