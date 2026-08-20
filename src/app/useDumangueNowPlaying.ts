import { useExternalNowPlaying } from './useExternalNowPlaying'
import {
  PSYBRAZIL_METADATA_POLL_MS,
  createPsyBrazilNowPlayingParser,
} from './usePsyBrazilNowPlaying'

const DUMANGUE_SOURCE_ID = 'psybrazil-dumangue'
const DUMANGUE_NOW_PLAYING_URL =
  'https://psybrazil.com.br/api/track.php?station=dumangue'

const DUMANGUE_NOW_PLAYING_CONFIG = {
  sourceId: DUMANGUE_SOURCE_ID,
  nowPlayingUrl: DUMANGUE_NOW_PLAYING_URL,
  pollMs: PSYBRAZIL_METADATA_POLL_MS,
  fetchResponseType: 'text' as const,
  parse: createPsyBrazilNowPlayingParser(DUMANGUE_NOW_PLAYING_URL),
}

export function useDumangueNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, DUMANGUE_NOW_PLAYING_CONFIG)
}
