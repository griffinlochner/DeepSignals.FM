import { useExternalNowPlaying } from './useExternalNowPlaying'
import {
  PSYBRAZIL_METADATA_POLL_MS,
  createPsyBrazilNowPlayingParser,
} from './usePsyBrazilNowPlaying'

const PSYBRAZIL_LOWBPM_SOURCE_ID = 'psybrazil-lowbpm'
const PSYBRAZIL_LOWBPM_NOW_PLAYING_URL =
  'https://psybrazil.com.br/api/track.php?station=lowbpm'

const PSYBRAZIL_LOWBPM_NOW_PLAYING_CONFIG = {
  sourceId: PSYBRAZIL_LOWBPM_SOURCE_ID,
  nowPlayingUrl: PSYBRAZIL_LOWBPM_NOW_PLAYING_URL,
  pollMs: PSYBRAZIL_METADATA_POLL_MS,
  fetchResponseType: 'text' as const,
  parse: createPsyBrazilNowPlayingParser(PSYBRAZIL_LOWBPM_NOW_PLAYING_URL),
}

export function usePsyBrazilLowBpmNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, PSYBRAZIL_LOWBPM_NOW_PLAYING_CONFIG)
}
