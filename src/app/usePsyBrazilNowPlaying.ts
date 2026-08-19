import {
  useExternalNowPlaying,
  type ExternalNowPlayingMetadata,
} from './useExternalNowPlaying'

const PSYBRAZIL_SOURCE_ID = 'psybrazil'
const PSYBRAZIL_NOW_PLAYING_URL =
  'https://blog.psybrazil.com.br/music/songstatus.php?sid=8&nocache=1'
const PSYBRAZIL_METADATA_POLL_MS = 15_000

// This feed reports the station/network label in `artist`, not the musical artist.
const PSYBRAZIL_STATION_LABELS = new Set(['psybrazil', 'psy brazil'])
const PSYBRAZIL_UNDERSCORE_SEPARATOR = '_-_'

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

// The feed encodes spaces as underscores (e.g. "New_Divide_(Kamasutrance_Remix)").
function normalizeText(value: string) {
  return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

// Splits a combined "Artist - Title" style string on common dash separators.
function splitArtistTitle(value: string) {
  for (const separator of [' - ', ' – ', ' — ']) {
    const separatorIndex = value.indexOf(separator)

    if (separatorIndex > 0) {
      const artist = value.slice(0, separatorIndex).trim()
      const title = value.slice(separatorIndex + separator.length).trim()

      if (artist && title) {
        return { artist, title }
      }
    }
  }

  return null
}

function splitCombinedTitle(value: string) {
  const separatorIndex = value.indexOf(PSYBRAZIL_UNDERSCORE_SEPARATOR)

  if (separatorIndex > 0) {
    const artist = normalizeText(value.slice(0, separatorIndex))
    const title = normalizeText(
      value.slice(separatorIndex + PSYBRAZIL_UNDERSCORE_SEPARATOR.length),
    )

    if (artist && title) {
      return { artist, title }
    }
  }

  return splitArtistTitle(normalizeText(value))
}

function musicalArtist(value: string | null) {
  if (!value || PSYBRAZIL_STATION_LABELS.has(value.toLowerCase())) {
    return null
  }

  return normalizeText(value) || null
}

type PsyBrazilNowPlayingRecord = Record<string, unknown>

/**
 * The live endpoint returns JSON where `artist` is the station label and
 * `title` carries "Artist_-_Title" with underscores for spaces. This parser
 * unpacks that shape, still supports a plain text "Artist - Title" response,
 * and returns null (falling back to the station name) only when no title is
 * available, instead of throwing.
 */
export function parsePsyBrazilNowPlaying(raw: unknown): ExternalNowPlayingMetadata | null {
  const rawText = typeof raw === 'string' ? raw.trim() : ''
  let artist: string | null = null
  let title: string | null = null

  if (rawText) {
    try {
      const parsed = JSON.parse(rawText) as PsyBrazilNowPlayingRecord
      const fieldArtist =
        cleanString(parsed.artist) ??
        cleanString(parsed.Artist) ??
        cleanString(parsed.singer)
      const combined =
        cleanString(parsed.title) ??
        cleanString(parsed.Title) ??
        cleanString(parsed.song) ??
        cleanString(parsed.track) ??
        cleanString(parsed.nowplaying) ??
        cleanString(parsed.current)
      const split = combined ? splitCombinedTitle(combined) : null

      artist = split?.artist ?? musicalArtist(fieldArtist)
      title = split?.title ?? (combined ? normalizeText(combined) : null)
    } catch {
      const split = splitCombinedTitle(rawText)
      artist = split?.artist ?? null
      title = split?.title ?? (normalizeText(rawText) || null)
    }
  }

  if (!title) {
    return null
  }

  return {
    sourceUrl: PSYBRAZIL_NOW_PLAYING_URL,
    title,
    artist: artist ?? undefined,
    origin: 'configured',
    changeKey: `${artist ?? ''}:${title}`,
  }
}

const PSYBRAZIL_NOW_PLAYING_CONFIG = {
  sourceId: PSYBRAZIL_SOURCE_ID,
  nowPlayingUrl: PSYBRAZIL_NOW_PLAYING_URL,
  pollMs: PSYBRAZIL_METADATA_POLL_MS,
  fetchResponseType: 'text' as const,
  parse: parsePsyBrazilNowPlaying,
}

export function usePsyBrazilNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, PSYBRAZIL_NOW_PLAYING_CONFIG)
}
