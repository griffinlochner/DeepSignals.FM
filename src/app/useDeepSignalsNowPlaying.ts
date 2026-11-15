import { createAzuraCastNowPlayingConfig } from './azuraCastNowPlaying'
import { useExternalNowPlaying } from './useExternalNowPlaying'

const azuraCastConfig = createAzuraCastNowPlayingConfig('deepsignals-psytrance', {
  nowPlayingUrl: 'https://a6.asurahosting.com/api/nowplaying/764',
  streamUrl: 'https://a6.asurahosting.com:7530/radio.mp3',
})

export const DEEPSIGNALS_NOW_PLAYING_CONFIG = {
  ...azuraCastConfig,
  parse(value: unknown) {
    const snapshot = azuraCastConfig.parse(value)
    if (!snapshot?.metadata) return snapshot

    const nowPlaying = value !== null && typeof value === 'object' && 'now_playing' in value
      ? value.now_playing
      : null
    const playlist = nowPlaying !== null && typeof nowPlaying === 'object' && 'playlist' in nowPlaying
      ? nowPlaying.playlist
      : undefined
    const sourceLink = playlist === 'Mittai Music'
      ? { url: 'https://mittaimusic.bandcamp.com/', label: 'Mittai Music' }
      : playlist === 'Ektoplazm — Psytrance Rotation'
        ? { url: 'https://ektoplazm.com/', label: 'ektoplazm.com' }
        : undefined
    if (!sourceLink) return snapshot

    return {
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        sourceLink,
        changeKey: JSON.stringify([snapshot.metadata.changeKey, sourceLink]),
      },
      changeKey: JSON.stringify([snapshot.changeKey, sourceLink]),
    }
  },
  pollMs: 10_000,
  refreshOnVisible: true,
  // AzuraCast sends max-age=15; bypass the HTTP cache so 10s polls see fresh data.
  cache: 'no-store',
} satisfies ReturnType<typeof createAzuraCastNowPlayingConfig>

export function useDeepSignalsNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, DEEPSIGNALS_NOW_PLAYING_CONFIG)
}
