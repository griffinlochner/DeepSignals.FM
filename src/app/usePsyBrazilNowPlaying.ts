import {
  useExternalNowPlaying,
  type ExternalNowPlayingMetadata,
} from './useExternalNowPlaying'

const PSYBRAZIL_SOURCE_ID = 'psybrazil'
const PSYBRAZIL_NOW_PLAYING_URL =
  'https://blog.psybrazil.com.br/music/songstatus.php?sid=8&nocache=1'
const PSYBRAZIL_METADATA_POLL_MS = 15_000

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
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

type PsyBrazilNowPlayingRecord = Record<string, unknown>

/**
 * The exact response schema for this endpoint has not been confirmed against
 * a live server from this environment (outbound requests to psybrazil.com.br
 * were unreachable in the dev sandbox used to build this integration).
 * This parser defensively supports a plain "Artist - Title" text response or
 * a JSON object with common artist/title-style field names, and returns null
 * (falling back to the station name) for anything else instead of throwing.
 */
function parsePsyBrazilNowPlaying(raw: unknown): ExternalNowPlayingMetadata | null {
  const rawText = typeof raw === 'string' ? raw.trim() : ''
  let artist: string | null = null
  let title: string | null = null

  if (rawText) {
    try {
      const parsed = JSON.parse(rawText) as PsyBrazilNowPlayingRecord
      artist =
        cleanString(parsed.artist) ??
        cleanString(parsed.Artist) ??
        cleanString(parsed.singer)
      title =
        cleanString(parsed.title) ??
        cleanString(parsed.Title) ??
        cleanString(parsed.song) ??
        cleanString(parsed.track)

      if (!artist && !title) {
        const combined =
          cleanString(parsed.nowplaying) ?? cleanString(parsed.current)
        const split = combined ? splitArtistTitle(combined) : null
        artist = split?.artist ?? null
        title = split?.title ?? null
      }
    } catch {
      const split = splitArtistTitle(rawText)
      artist = split?.artist ?? null
      title = split?.title ?? (rawText || null)
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
