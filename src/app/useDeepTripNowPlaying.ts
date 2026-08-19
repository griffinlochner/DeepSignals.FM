import {
  useExternalNowPlaying,
  type ExternalNowPlayingMetadata,
} from './useExternalNowPlaying'

const DEEP_TRIP_SOURCE_ID = 'deep-trip-radio'
const DEEP_TRIP_NOW_PLAYING_URL = 'https://stream.deeptripradio.net/api/now'
const DEEP_TRIP_COVER_URL = 'https://stream.deeptripradio.net/api/cover'
const DEEP_TRIP_METADATA_POLL_MS = 5_000

type DeepTripNowPlayingResponse = {
  artist?: unknown
  title?: unknown
  album?: unknown
  year?: unknown
  genre?: unknown
  license?: unknown
  label?: unknown
  url?: unknown
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseDeepTripNowPlaying(value: unknown): ExternalNowPlayingMetadata | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const response = value as DeepTripNowPlayingResponse
  const artist = cleanString(response.artist)
  const title = cleanString(response.title)

  if (!title) {
    return null
  }

  const album = cleanString(response.album)
  const year = cleanString(response.year)
  const genre = cleanString(response.genre)
  const license = cleanString(response.license)
  const label = cleanString(response.label)
  const releaseUrl = cleanString(response.url)
  const changeKey = [artist, title, album, year, releaseUrl]
    .filter((part) => part !== null)
    .join(':')

  return {
    sourceUrl: DEEP_TRIP_NOW_PLAYING_URL,
    title,
    artist: artist ?? undefined,
    album: album ?? undefined,
    year: year ?? undefined,
    genre: genre ?? undefined,
    license: license ?? undefined,
    label: label ?? undefined,
    releaseUrl: releaseUrl ?? undefined,
    artworkUrl: `${DEEP_TRIP_COVER_URL}?v=${encodeURIComponent(changeKey)}`,
    origin: 'configured',
    changeKey,
  }
}

const DEEP_TRIP_NOW_PLAYING_CONFIG = {
  sourceId: DEEP_TRIP_SOURCE_ID,
  nowPlayingUrl: DEEP_TRIP_NOW_PLAYING_URL,
  pollMs: DEEP_TRIP_METADATA_POLL_MS,
  fetchResponseType: 'json' as const,
  parse: parseDeepTripNowPlaying,
}

export function useDeepTripNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, DEEP_TRIP_NOW_PLAYING_CONFIG)
}