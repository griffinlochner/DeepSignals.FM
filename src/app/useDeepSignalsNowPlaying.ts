import { createAzuraCastNowPlayingConfig } from './azuraCastNowPlaying'
import { useExternalNowPlaying } from './useExternalNowPlaying'

export const DEEPSIGNALS_NOW_PLAYING_CONFIG = {
  ...createAzuraCastNowPlayingConfig('deepsignals-psytrance', {
    nowPlayingUrl: 'https://a6.asurahosting.com/api/nowplaying/764',
    streamUrl: 'https://a6.asurahosting.com:7530/radio.mp3',
  }),
  pollMs: 10_000,
  refreshOnVisible: true,
  // AzuraCast sends max-age=15; bypass the HTTP cache so 10s polls see fresh data.
  cache: 'no-store',
} satisfies ReturnType<typeof createAzuraCastNowPlayingConfig>

export function useDeepSignalsNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, DEEPSIGNALS_NOW_PLAYING_CONFIG)
}
