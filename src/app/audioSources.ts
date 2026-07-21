import { publicAssetUrl } from './publicAssetUrl'
import type { AudioSource } from './playerTypes'

export const DEMO_MODULATION_MANIPULATION_AUDIO_SOURCE: AudioSource = {
  id: 'demo-modulation-manipulation',
  kind: 'demo-track',
  title: 'Modulation Manipulation',
  artist: 'Dohm & Schizoid Bears',
  release: 'Under The Moss Vol. 4',
  label: 'Forest Freaks',
  bpm: 150,
  audioUrl: publicAssetUrl('/audio/demo/dohm-schizoid-bears-modulation-manipulation.mp3'),
  sourceUrl: 'https://ektoplazm.com/label/forest-freaks',
  license: 'Creative Commons license for noncommercial usage; exact variant not yet confirmed.',
  attribution:
    'Dohm & Schizoid Bears — Modulation Manipulation, from Under The Moss Vol. 4, released by Forest Freaks.',
  isSeekable: true,
}

export const STATION_IDENT_AUDIO_ASSET = {
  id: 'deepsignals-fm-ident',
  kind: 'station-ident',
  title: 'DeepSignals FM Ident',
  audioUrl: publicAssetUrl('/audio/idents/deepsignals-fm-ident.mp3'),
  purpose: 'station-ident',
} as const

export const AUDIO_SOURCES: AudioSource[] = [DEMO_MODULATION_MANIPULATION_AUDIO_SOURCE]
