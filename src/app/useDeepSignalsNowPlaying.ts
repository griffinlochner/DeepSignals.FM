import { createAzuraCastNowPlayingConfig } from './azuraCastNowPlaying'
import { useExternalNowPlaying } from './useExternalNowPlaying'

const azuraCastConfig = createAzuraCastNowPlayingConfig('deepsignals-psytrance', {
  nowPlayingUrl: 'https://a6.asurahosting.com/api/nowplaying/764',
  streamUrl: 'https://a6.asurahosting.com:7530/radio.mp3',
})

const psykoTrancePlaylist = 'Psyko-Trance Records'
const elvispekerLink = { url: 'https://open.spotify.com/artist/3I7Knrh3dU2J2HM2dbef4u', label: 'Elvispeker on Spotify' }
const trisceleLink = { url: 'https://open.spotify.com/artist/4SKBU6Dzedns3sfF71cKRh', label: 'Triscele on Spotify' }
const psykoTranceTracks = new Map([
  ['elvispeker', new Map([
    ['mr. magoo', { url: 'https://open.spotify.com/artist/6Zt1hjGPfXY6FSWYXXdZhL', label: 'Elvispeker on Spotify' }],
    ['desert impulse', elvispekerLink],
    ['dunes and peyote', elvispekerLink],
  ])],
  ['ferno style', new Map([
    ['techno (triscele rmx)', trisceleLink],
  ])],
])
const psykoTranceArtists = new Map([
  ['alchemyth', { url: 'https://open.spotify.com/artist/0a0snzS1l2QyQN9C3Wd35H', label: 'AlcheMyth on Spotify' }],
  ['spiralmynd', { url: 'https://open.spotify.com/artist/21cvbCw9LymPBJtwdzYvgW', label: 'Spiralmynd on Spotify' }],
  ['triscele', trisceleLink],
  ['uranio', { url: 'https://open.spotify.com/artist/4qA9tVEROncwP1NU1Zj8ns', label: 'Uranio on Spotify' }],
  ['space fly', { url: 'https://open.spotify.com/artist/1VaLGarluNO8D8oBcTkdZ2', label: 'Space Fly on Spotify' }],
])

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
    const artist = snapshot.metadata.artist?.trim().toLowerCase() ?? ''
    const title = snapshot.metadata.title.trim().toLowerCase()
    const sourceLink = playlist === 'Mittai Music'
      ? { url: 'https://mittaimusic.bandcamp.com/', label: 'Mittai Music' }
      : playlist === 'Ektoplazm — Psytrance Rotation'
        ? { url: 'https://ektoplazm.com/', label: 'ektoplazm.com' }
        : typeof playlist === 'string' && playlist.trim().toLowerCase() === psykoTrancePlaylist.toLowerCase()
          ? psykoTranceTracks.get(artist)?.get(title) ?? psykoTranceArtists.get(artist)
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
