import {
  useExternalNowPlaying,
  type ExternalNowPlayingMetadata,
} from './useExternalNowPlaying'

const SPACE_UNICORN_SOURCE_ID = 'space-unicorn-radio'
const SPACE_UNICORN_NOW_PLAYING_URL = 'https://spaceunicorn.radio/status-json.xsl'
const SPACE_UNICORN_METADATA_POLL_MS = 20_000

type SpaceUnicornSourceEntry = {
  title?: unknown
  server_name?: unknown
  server_description?: unknown
  genre?: unknown
  listeners?: unknown
  bitrate?: unknown
  listenurl?: unknown
  server_type?: unknown
  stream_start?: unknown
  dummy?: unknown
  [key: string]: unknown
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function pickMeaningfulSource(value: unknown): SpaceUnicornSourceEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const root = value as {
    icestats?: {
      source?: unknown
    }
  }

  const rawSources = Array.isArray(root.icestats?.source)
    ? root.icestats.source
    : root.icestats?.source
      ? [root.icestats.source]
      : []

  let bestSource: { source: SpaceUnicornSourceEntry; score: number } | null = null

  for (const candidate of rawSources) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }

    const source = candidate as SpaceUnicornSourceEntry
    const title = cleanString(source.title)
    const serverName = cleanString(source.server_name)
    const serverDescription = cleanString(source.server_description)
    const genre = cleanString(source.genre)
    const listenUrl = cleanString(source.listenurl)

    if (!title && !serverName && !serverDescription && !genre) {
      continue
    }

    const listenersValue =
      typeof source.listeners === 'number'
        ? source.listeners
        : Number(source.listeners)
    const listeners = Number.isFinite(listenersValue) ? listenersValue : 0

    let score = 0

    if (title) {
      score += 100
    }
    if (serverName) {
      score += 30
    }
    if (genre) {
      score += 10
    }
    if (serverDescription) {
      score += 8
    }
    if (listenUrl && /\/(autodj|live|stream)(\/|$)/i.test(listenUrl)) {
      score += 15
    }
    if (Number.isFinite(listenersValue)) {
      score += listeners
    }

    if (!bestSource || score > bestSource.score) {
      bestSource = { source, score }
    }
  }

  return bestSource?.source ?? null
}

function parseSpaceUnicornNowPlaying(value: unknown): ExternalNowPlayingMetadata | null {
  const activeSource = pickMeaningfulSource(value)

  if (!activeSource) {
    return null
  }

  const title =
    cleanString(activeSource.title) ??
    cleanString(activeSource.server_name) ??
    cleanString(activeSource.server_description)

  if (!title) {
    return null
  }

  const genre = cleanString(activeSource.genre) ?? undefined
  const listenUrl = cleanString(activeSource.listenurl) ?? undefined
  const serverName = cleanString(activeSource.server_name) ?? undefined
  const bitrate =
    typeof activeSource.bitrate === 'number'
      ? String(activeSource.bitrate)
      : cleanString(activeSource.bitrate) ?? undefined

  const changeKey = [title, serverName, genre, listenUrl, bitrate]
    .filter((part) => !!part)
    .join(':')

  return {
    sourceUrl: SPACE_UNICORN_NOW_PLAYING_URL,
    title,
    genre,
    origin: 'configured',
    changeKey,
  }
}

const SPACE_UNICORN_NOW_PLAYING_CONFIG = {
  sourceId: SPACE_UNICORN_SOURCE_ID,
  nowPlayingUrl: SPACE_UNICORN_NOW_PLAYING_URL,
  pollMs: SPACE_UNICORN_METADATA_POLL_MS,
  fetchResponseType: 'json' as const,
  parse: parseSpaceUnicornNowPlaying,
}

export function useSpaceUnicornNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, SPACE_UNICORN_NOW_PLAYING_CONFIG)
}
