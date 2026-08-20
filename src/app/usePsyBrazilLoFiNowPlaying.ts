import { useExternalNowPlaying } from './useExternalNowPlaying'
import {
  PSYBRAZIL_METADATA_POLL_MS,
  createPsyBrazilNowPlayingParser,
} from './usePsyBrazilNowPlaying'

const PSYBRAZIL_LOFI_SOURCE_ID = 'psybrazil-lofi'
const PSYBRAZIL_LOFI_NOW_PLAYING_URL =
  'https://psybrazil.com.br/api/track.php?station=lofi'

const PSYBRAZIL_LOFI_NOW_PLAYING_CONFIG = {
  sourceId: PSYBRAZIL_LOFI_SOURCE_ID,
  nowPlayingUrl: PSYBRAZIL_LOFI_NOW_PLAYING_URL,
  pollMs: PSYBRAZIL_METADATA_POLL_MS,
  fetchResponseType: 'text' as const,
  parse: createPsyBrazilNowPlayingParser(PSYBRAZIL_LOFI_NOW_PLAYING_URL),
}

export function usePsyBrazilLoFiNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, PSYBRAZIL_LOFI_NOW_PLAYING_CONFIG)
}
