import {
  useExternalNowPlaying,
  type ExternalNowPlayingMetadata,
} from './useExternalNowPlaying'
import {
  useStationTelemetry,
  type StationTelemetry,
} from './useStationTelemetry'

const PSYSTREAM_SOURCE_ID = 'psystream'
const PSYSTREAM_NOW_PLAYING_URL =
  'https://radio.psymusic.co.uk/api/nowplaying_static/psystream.json'
const PSYSTREAM_STREAM_URL =
  'https://radio.psymusic.co.uk/listen/psystream/hifi.mp3'
const PSYSTREAM_METADATA_POLL_MS = 12_000
const PSYSTREAM_TELEMETRY_POLL_MS = 45_000

type PsyStreamNowPlayingResponse = {
  station?: {
    mounts?: unknown
  }
  now_playing?: {
    sh_id?: unknown
    played_at?: unknown
    song?: {
      id?: unknown
      artist?: unknown
      title?: unknown
      art?: unknown
    }
  }
}

type PsyStreamMount = {
  url?: unknown
  listeners?: {
    current?: unknown
  }
  bitrate?: unknown
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function parseNonNegativeInteger(value: unknown): number | null {
  const parsed = parseNumber(value)
  return parsed !== null && parsed >= 0 ? Math.trunc(parsed) : null
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = parseNumber(value)
  return parsed !== null && parsed > 0 ? parsed : null
}

export function parsePsyStreamTelemetry(value: unknown): StationTelemetry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const mounts = (value as PsyStreamNowPlayingResponse).station?.mounts

  if (!Array.isArray(mounts)) {
    return null
  }

  const mount = mounts.find((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return false
    }

    return cleanString((candidate as PsyStreamMount).url) === PSYSTREAM_STREAM_URL
  }) as PsyStreamMount | undefined

  if (!mount) {
    return null
  }

  return {
    listeners: parseNonNegativeInteger(mount.listeners?.current),
    bitrateKbps: parsePositiveNumber(mount.bitrate),
  }
}

function parsePsyStreamNowPlaying(value: unknown): ExternalNowPlayingMetadata | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const nowPlaying = (value as PsyStreamNowPlayingResponse).now_playing
  const artist = cleanString(nowPlaying?.song?.artist)
  const title = cleanString(nowPlaying?.song?.title)

  if (!artist || !title) {
    return null
  }

  const songId = cleanString(nowPlaying?.song?.id)
  const shId = nowPlaying?.sh_id
  const playedAt = nowPlaying?.played_at
  const artworkUrl = cleanString(nowPlaying?.song?.art) ?? undefined
  const changeKey = [songId, shId, playedAt, artist, title]
    .filter((part) => part !== null && part !== undefined)
    .join(':')

  return {
    sourceUrl: PSYSTREAM_NOW_PLAYING_URL,
    title,
    artist,
    artworkUrl,
    origin: 'configured',
    changeKey,
  }
}

const PSYSTREAM_NOW_PLAYING_CONFIG = {
  sourceId: PSYSTREAM_SOURCE_ID,
  nowPlayingUrl: PSYSTREAM_NOW_PLAYING_URL,
  pollMs: PSYSTREAM_METADATA_POLL_MS,
  fetchResponseType: 'json' as const,
  parse: parsePsyStreamNowPlaying,
}

const PSYSTREAM_TELEMETRY_CONFIG = {
  sourceId: PSYSTREAM_SOURCE_ID,
  telemetryUrl: PSYSTREAM_NOW_PLAYING_URL,
  pollMs: PSYSTREAM_TELEMETRY_POLL_MS,
  parse: parsePsyStreamTelemetry,
  requestLabel: 'PsyStream',
}

export function usePsyStreamNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, PSYSTREAM_NOW_PLAYING_CONFIG)
}

export function usePsyStreamTelemetry(selectedSourceId: string | null) {
  return useStationTelemetry(selectedSourceId, PSYSTREAM_TELEMETRY_CONFIG)
}