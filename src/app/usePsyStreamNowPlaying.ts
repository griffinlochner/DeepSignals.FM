import {
  useExternalNowPlaying,
  type ExternalNowPlayingMetadata,
} from './useExternalNowPlaying'

const PSYSTREAM_SOURCE_ID = 'psystream'
const PSYSTREAM_NOW_PLAYING_URL =
  'https://radio.psymusic.co.uk/api/nowplaying_static/psystream.json'
const PSYSTREAM_METADATA_POLL_MS = 12_000

type PsyStreamNowPlayingResponse = {
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

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
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

export function usePsyStreamNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, PSYSTREAM_NOW_PLAYING_CONFIG)
}