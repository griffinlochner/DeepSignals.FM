import type { ExternalSignalId } from './externalSignals'

const PSYBRAZIL_ARTWORK_ENDPOINT =
  'https://psybrazil.com.br/api/artwork.php'

export const PSYBRAZIL_STATION_IDS = {
  psybrazil: 'psybr',
  'psybrazil-dumangue': 'dumangue',
  'psybrazil-progressive': 'progressive',
  'psybrazil-lofi': 'lofi',
  'psybrazil-lowbpm': 'lowbpm',
  'psybrazil-electro': 'electro',
} as const satisfies Partial<Record<ExternalSignalId, string>>

export type PsyBrazilSignalId = keyof typeof PSYBRAZIL_STATION_IDS

export function getPsyBrazilArtworkUrl(
  signalId: string | null,
  nowPlaying: string | null | undefined,
) {
  if (!(signalId && signalId in PSYBRAZIL_STATION_IDS && nowPlaying?.trim())) {
    return null
  }

  const params = new URLSearchParams({
    song: nowPlaying.trim(),
    station: PSYBRAZIL_STATION_IDS[signalId as PsyBrazilSignalId],
  })

  return `${PSYBRAZIL_ARTWORK_ENDPOINT}?${params.toString()}`
}