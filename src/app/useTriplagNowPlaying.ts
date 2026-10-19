import {
  useExternalNowPlaying,
  type ExternalNowPlayingMetadata,
} from './useExternalNowPlaying'
import type { StationTelemetry } from './useStationTelemetry'

export const TRIPLAG_NOW_PLAYING_URL = 'https://a3.asurahosting.com/api/nowplaying/triplag'
const TRIPLAG_STREAM_URL = 'https://a3.asurahosting.com/listen/triplag/radio.mp3'

type TriplagSnapshot = {
  metadata: ExternalNowPlayingMetadata | null
  telemetry: StationTelemetry | null
  changeKey: string
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function number(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

function artwork(value: unknown): string | undefined {
  const url = text(value)
  if (!url || !URL.canParse(url)) return undefined
  const parsed = new URL(url)
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password
    ? url
    : undefined
}

export function parseTriplagNowPlaying(value: unknown): TriplagSnapshot | null {
  const response = record(value)
  const station = record(response?.station)
  if (!response || !station) return null

  const nowPlaying = record(response.now_playing)
  const song = record(nowPlaying?.song)
  const title = text(song?.title)
  const artist = text(song?.artist)
  const album = text(song?.album)
  const artworkUrl = artwork(song?.art)
  const metadata: ExternalNowPlayingMetadata | null = title && response.is_online !== false
    ? {
      sourceUrl: TRIPLAG_NOW_PLAYING_URL,
      title,
      artist,
      album,
      artworkUrl,
      origin: 'configured',
      changeKey: JSON.stringify([
        text(song?.id), number(nowPlaying?.sh_id), number(nowPlaying?.played_at),
        title, artist, album, artworkUrl,
      ]),
    }
    : null

  const mounts = Array.isArray(station.mounts) ? station.mounts : []
  const mount = mounts.map(record).find((candidate) => candidate?.url === TRIPLAG_STREAM_URL)
  const listeners = number(record(mount?.listeners)?.current)
  const bitrate = number(mount?.bitrate)
  const telemetry = mount && response.is_online !== false
    ? {
      listeners: listeners !== null && Number.isInteger(listeners) && listeners >= 0 ? listeners : null,
      bitrateKbps: bitrate !== null && bitrate > 0 ? bitrate : null,
    }
    : null

  return { metadata, telemetry, changeKey: JSON.stringify([metadata, telemetry]) }
}

const TRIPLAG_CONFIG = {
  sourceId: 'triplag-darkpsy',
  nowPlayingUrl: TRIPLAG_NOW_PLAYING_URL,
  pollMs: 20_000,
  hiddenPollMs: 60_000,
  cache: 'default' as const,
  fetchResponseType: 'json' as const,
  parse(value: unknown) {
    const snapshot = parseTriplagNowPlaying(value)
    if (!snapshot) throw new Error('Invalid Triplag now-playing response')
    return snapshot
  },
}

export function useTriplagNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, TRIPLAG_CONFIG)
}
