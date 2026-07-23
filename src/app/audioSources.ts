import { publicAssetUrl } from './publicAssetUrl'
import type { AudioSource } from './playerTypes'

export function formatAudioSourceLabel(source: Pick<AudioSource, 'artist' | 'title' | 'displayName'>) {
  if (source.artist && source.title) {
    return `${source.artist} — ${source.title}`
  }

  if (source.title) {
    return source.title
  }

  return source.displayName
}

export const DEMO_MODULATION_MANIPULATION_AUDIO_SOURCE: AudioSource = {
  id: 'demo-modulation-manipulation',
  kind: 'demo-track',
  displayName: formatAudioSourceLabel({
    artist: 'Dohm & Schizoid Bears',
    title: 'Modulation Manipulation',
    displayName: 'Modulation Manipulation',
  }),
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
  displayName: formatAudioSourceLabel({
    artist: 'Zzbing',
    title: 'Modular Dimensions',
    displayName: 'Modular Dimensions',
  }),
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
  displayName: formatAudioSourceLabel({
    artist: 'Illustrator',
    title: 'Psychedelic Experience',
    displayName: 'Psychedelic Experience',
  }),
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
  displayName: formatAudioSourceLabel({
    artist: 'Biomekanik',
    title: 'Fragments of Reality',
    displayName: 'Fragments of Reality',
  }),
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

export const GLOBULAR_FOR_THE_TIME_BEING_AUDIO_SOURCE: AudioSource = {
  id: 'globular-for-the-time-being',
  kind: 'demo-track',
  displayName: formatAudioSourceLabel({
    artist: 'Globular',
    title: 'For The Time Being',
    displayName: 'For The Time Being',
  }),
  title: 'For The Time Being',
  artist: 'Globular',
  release: 'Entangled Everything',
  bpm: 65,
  audioUrl: publicAssetUrl('/audio/demo/globular-for-the-time-being.mp3'),
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution: 'Globular — For The Time Being, from Entangled Everything.',
  isSeekable: true,
}

export const GLOBULAR_THE_CHALICE_AUDIO_SOURCE: AudioSource = {
  id: 'globular-the-chalice',
  kind: 'demo-track',
  displayName: formatAudioSourceLabel({
    artist: 'Globular',
    title: 'The Chalice',
    displayName: 'The Chalice',
  }),
  title: 'The Chalice',
  artist: 'Globular',
  release: 'Entangled Everything',
  bpm: 95,
  audioUrl: publicAssetUrl('/audio/demo/globular-the-chalice.mp3'),
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution: 'Globular — The Chalice, from Entangled Everything.',
  isSeekable: true,
}

export const GLOBULAR_KALEIDOSCOPE_TRIBE_AUDIO_SOURCE: AudioSource = {
  id: 'globular-kaleidoscope-tribe',
  kind: 'demo-track',
  displayName: formatAudioSourceLabel({
    artist: 'Globular',
    title: 'Kaleidoscope Tribe',
    displayName: 'Kaleidoscope Tribe',
  }),
  title: 'Kaleidoscope Tribe',
  artist: 'Globular',
  release: 'Entangled Everything',
  bpm: 74,
  audioUrl: publicAssetUrl('/audio/demo/globular-kaleidoscope-tribe.mp3'),
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution: 'Globular — Kaleidoscope Tribe, from Entangled Everything.',
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
  GLOBULAR_FOR_THE_TIME_BEING_AUDIO_SOURCE,
  GLOBULAR_THE_CHALICE_AUDIO_SOURCE,
  GLOBULAR_KALEIDOSCOPE_TRIBE_AUDIO_SOURCE,
]
