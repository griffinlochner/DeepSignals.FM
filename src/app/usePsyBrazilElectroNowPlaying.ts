import { useExternalNowPlaying } from './useExternalNowPlaying'
import {
  PSYBRAZIL_METADATA_POLL_MS,
  createPsyBrazilNowPlayingParser,
} from './usePsyBrazilNowPlaying'

const PSYBRAZIL_ELECTRO_SOURCE_ID = 'psybrazil-electro'
const PSYBRAZIL_ELECTRO_NOW_PLAYING_URL =
  'https://psybrazil.com.br/api/track.php?station=electro'

const PSYBRAZIL_ELECTRO_NOW_PLAYING_CONFIG = {
  sourceId: PSYBRAZIL_ELECTRO_SOURCE_ID,
  nowPlayingUrl: PSYBRAZIL_ELECTRO_NOW_PLAYING_URL,
  pollMs: PSYBRAZIL_METADATA_POLL_MS,
  fetchResponseType: 'text' as const,
  parse: createPsyBrazilNowPlayingParser(PSYBRAZIL_ELECTRO_NOW_PLAYING_URL),
}

export function usePsyBrazilElectroNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, PSYBRAZIL_ELECTRO_NOW_PLAYING_CONFIG)
}
