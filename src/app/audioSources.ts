import { publicAssetUrl } from './publicAssetUrl'
import type { AudioSource } from './playerTypes'

export const DEMO_MODULATION_MANIPULATION_AUDIO_SOURCE: AudioSource = {
  id: 'demo-modulation-manipulation',
  kind: 'demo-track',
  displayName: 'DeepSignals Demo Signal — Modulation Manipulation',
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

export const DEMO_MODULAR_DIMENSIONS_AUDIO_SOURCE: AudioSource = {
  id: 'demo-modular-dimensions',
  kind: 'demo-track',
  displayName: 'DeepSignals Demo — Modular Dimensions',
  title: 'Modular Dimensions',
  artist: 'Zzbing',
  release: 'MoDem Festival Vol. 5',
  audioUrl: publicAssetUrl('/audio/demo/zzbing-modular-dimensions.mp3'),
  sourceUrl: 'https://ektoplazm.com/style/darkpsy/page/3',
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution: 'Zzbing — Modular Dimensions, from MoDem Festival Vol. 5.',
  isSeekable: true,
}

export const DEMO_PSYCHEDELIC_EXPERIENCE_AUDIO_SOURCE: AudioSource = {
  id: 'demo-psychedelic-experience',
  kind: 'demo-track',
  displayName: 'DeepSignals Demo — Psychedelic Experience',
  title: 'Psychedelic Experience',
  artist: 'Illustrator',
  release: 'MoDem Festival Vol. 5',
  audioUrl: publicAssetUrl('/audio/demo/illustrator-psychedelic-experience.mp3'),
  sourceUrl: 'https://ektoplazm.com/style/darkpsy/page/3',
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution: 'Illustrator — Psychedelic Experience, from MoDem Festival Vol. 5.',
  isSeekable: true,
}

export const DEMO_FRAGMENTS_OF_REALITY_AUDIO_SOURCE: AudioSource = {
  id: 'demo-fragments-of-reality',
  kind: 'demo-track',
  displayName: 'DeepSignals Demo — Fragments of Reality',
  title: 'Fragments of Reality',
  artist: 'Biomekanik',
  release: 'Cinematech',
  label: 'CyberBay Records',
  bpm: 165,
  audioUrl: publicAssetUrl('/audio/demo/biomekanik-fragments-of-reality.mp3'),
  sourceUrl: 'https://ektoplazm.com/style/darkpsy/page/4',
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution:
    'Biomekanik — Fragments of Reality, from Cinematech, released by CyberBay Records.',
  isSeekable: true,
}

export const STATION_IDENT_AUDIO_ASSET = {
  id: 'deepsignals-fm-ident',
  kind: 'station-ident',
  title: 'DeepSignals FM Ident',
  audioUrl: publicAssetUrl('/audio/idents/deepsignals-fm-ident.mp3'),
  purpose: 'station-ident',
} as const

export const AUDIO_SOURCES: AudioSource[] = [
  DEMO_MODULATION_MANIPULATION_AUDIO_SOURCE,
  DEMO_MODULAR_DIMENSIONS_AUDIO_SOURCE,
  DEMO_PSYCHEDELIC_EXPERIENCE_AUDIO_SOURCE,
  DEMO_FRAGMENTS_OF_REALITY_AUDIO_SOURCE,
]
