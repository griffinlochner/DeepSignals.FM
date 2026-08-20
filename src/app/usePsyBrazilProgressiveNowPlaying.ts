import { useExternalNowPlaying } from './useExternalNowPlaying'
import {
  PSYBRAZIL_METADATA_POLL_MS,
  createPsyBrazilNowPlayingParser,
} from './usePsyBrazilNowPlaying'

const PSYBRAZIL_PROGRESSIVE_SOURCE_ID = 'psybrazil-progressive'
const PSYBRAZIL_PROGRESSIVE_NOW_PLAYING_URL =
  'https://psybrazil.com.br/api/track.php?station=progressive'

const PSYBRAZIL_PROGRESSIVE_NOW_PLAYING_CONFIG = {
  sourceId: PSYBRAZIL_PROGRESSIVE_SOURCE_ID,
  nowPlayingUrl: PSYBRAZIL_PROGRESSIVE_NOW_PLAYING_URL,
  pollMs: PSYBRAZIL_METADATA_POLL_MS,
  fetchResponseType: 'text' as const,
  parse: createPsyBrazilNowPlayingParser(PSYBRAZIL_PROGRESSIVE_NOW_PLAYING_URL),
}

export function usePsyBrazilProgressiveNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(
    selectedSourceId,
    PSYBRAZIL_PROGRESSIVE_NOW_PLAYING_CONFIG,
  )
}
