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

type DemoTrackSourceDefinition = {
  id: string
  artist: string
  title: string
  release: string
  audioPath: string
  sourceUrl?: string
  label?: string
  bpm?: number
  license: string
  attribution: string
}

function createDemoTrackAudioSource(definition: DemoTrackSourceDefinition): AudioSource {
  return {
    id: definition.id,
    kind: 'demo-track',
    displayName: formatAudioSourceLabel({
      artist: definition.artist,
      title: definition.title,
      displayName: definition.title,
    }),
    title: definition.title,
    artist: definition.artist,
    release: definition.release,
    label: definition.label,
    bpm: definition.bpm,
    audioUrl: publicAssetUrl(definition.audioPath),
    sourceUrl: definition.sourceUrl,
    license: definition.license,
    attribution: definition.attribution,
    isSeekable: true,
  }
}

export const DEMO_MODULATION_MANIPULATION_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'demo-modulation-manipulation',
  artist: 'Dohm & Schizoid Bears',
  title: 'Modulation Manipulation',
  release: 'Under The Moss Vol. 4',
  label: 'Forest Freaks',
  bpm: 150,
  audioPath: '/audio/demo/dohm-schizoid-bears-modulation-manipulation.mp3',
  sourceUrl: 'https://ektoplazm.com/label/forest-freaks',
  license: 'Creative Commons license for noncommercial usage; exact variant not yet confirmed.',
  attribution:
    'Dohm & Schizoid Bears — Modulation Manipulation, from Under The Moss Vol. 4, released by Forest Freaks.',
})

export const DEMO_MODULAR_DIMENSIONS_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'demo-modular-dimensions',
  artist: 'Zzbing',
  title: 'Modular Dimensions',
  release: 'MoDem Festival Vol. 5',
  audioPath: '/audio/demo/zzbing-modular-dimensions.mp3',
  sourceUrl: 'https://ektoplazm.com/style/darkpsy/page/3',
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution: 'Zzbing — Modular Dimensions, from MoDem Festival Vol. 5.',
})

export const DEMO_PSYCHEDELIC_EXPERIENCE_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'demo-psychedelic-experience',
  artist: 'Illustrator',
  title: 'Psychedelic Experience',
  release: 'MoDem Festival Vol. 5',
  audioPath: '/audio/demo/illustrator-psychedelic-experience.mp3',
  sourceUrl: 'https://ektoplazm.com/style/darkpsy/page/3',
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution: 'Illustrator — Psychedelic Experience, from MoDem Festival Vol. 5.',
})

export const DEMO_FRAGMENTS_OF_REALITY_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'demo-fragments-of-reality',
  artist: 'Biomekanik',
  title: 'Fragments of Reality',
  release: 'Cinematech',
  label: 'CyberBay Records',
  bpm: 165,
  audioPath: '/audio/demo/biomekanik-fragments-of-reality.mp3',
  sourceUrl: 'https://ektoplazm.com/style/darkpsy/page/4',
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution:
    'Biomekanik — Fragments of Reality, from Cinematech, released by CyberBay Records.',
})

export const GLOBULAR_FOR_THE_TIME_BEING_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'globular-for-the-time-being',
  artist: 'Globular',
  title: 'For The Time Being',
  release: 'Entangled Everything',
  bpm: 65,
  audioPath: '/audio/demo/globular-for-the-time-being.mp3',
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution: 'Globular — For The Time Being, from Entangled Everything.',
})

export const GLOBULAR_THE_CHALICE_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'globular-the-chalice',
  artist: 'Globular',
  title: 'The Chalice',
  release: 'Entangled Everything',
  bpm: 95,
  audioPath: '/audio/demo/globular-the-chalice.mp3',
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution: 'Globular — The Chalice, from Entangled Everything.',
})

export const GLOBULAR_KALEIDOSCOPE_TRIBE_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'globular-kaleidoscope-tribe',
  artist: 'Globular',
  title: 'Kaleidoscope Tribe',
  release: 'Entangled Everything',
  bpm: 74,
  audioPath: '/audio/demo/globular-kaleidoscope-tribe.mp3',
  license: 'Creative Commons license for noncommercial usage; exact variant not specified.',
  attribution: 'Globular — Kaleidoscope Tribe, from Entangled Everything.',
})

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
