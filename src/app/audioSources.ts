import { publicAssetUrl } from './publicAssetUrl'
import type { AudioSource } from './playerTypes'

const DFECTV_DEMO_RELEASE = 'Artist-permitted demo'
const DFECTV_DEMO_LICENSE = 'Artist-permitted demo track for DeepSignals.'

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

export const DEMO_DFECTV_SPCYHT_NO_NAME_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'demo-dfectv-spcyht-no-name',
  artist: 'Dfectv & Spcyht',
  title: 'No Name',
  release: DFECTV_DEMO_RELEASE,
  audioPath: '/audio/demo/Dfectv & Spcyht - No Name.mp3',
  license: DFECTV_DEMO_LICENSE,
  attribution: 'Dfectv & Spcyht — No Name, used with artist permission.',
})

export const DEMO_DFECTV_THE_MAZE_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'demo-dfectv-the-maze',
  artist: 'Dfectv',
  title: 'The Maze',
  release: DFECTV_DEMO_RELEASE,
  audioPath: '/audio/demo/Dfectv - The Maze.mp3',
  license: DFECTV_DEMO_LICENSE,
  attribution: 'Dfectv — The Maze, used with artist permission.',
})

export const DEMO_DFECTV_STARFIRE_BEYOND_THE_BOUNDRIES_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'demo-dfectv-starfire-beyond-the-boundries',
  artist: 'Dfectv & StarFire',
  title: 'Beyond the Boundries',
  release: DFECTV_DEMO_RELEASE,
  audioPath: '/audio/demo/Dfectv & StarFire - Beyond the Boundries.mp3',
  license: DFECTV_DEMO_LICENSE,
  attribution: 'Dfectv & StarFire — Beyond the Boundries, used with artist permission.',
})

export const DEMO_DFECTV_ITS_A_TRAP_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'demo-dfectv-its-a-trap',
  artist: 'Dfectv',
  title: "It's A Trap",
  release: DFECTV_DEMO_RELEASE,
  audioPath: "/audio/demo/Dfectv - It's A Trap.mp3",
  license: DFECTV_DEMO_LICENSE,
  attribution: "Dfectv — It's A Trap, used with artist permission.",
})

export const DEMO_DFECTV_SIMULATED_ALCHEMY_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'demo-dfectv-simulated-alchemy',
  artist: 'Dfectv',
  title: 'Simulated Alchemy',
  release: DFECTV_DEMO_RELEASE,
  audioPath: '/audio/demo/Dfectv - Simulated Alchemy.mp3',
  license: DFECTV_DEMO_LICENSE,
  attribution: 'Dfectv — Simulated Alchemy, used with artist permission.',
})

export const DEMO_DFECTV_FINGER_FUCKING_THE_FLOOR_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'demo-dfectv-finger-fucking-the-floor',
  artist: 'Dfectv',
  title: 'Finger Fucking The Floor',
  release: DFECTV_DEMO_RELEASE,
  audioPath: '/audio/demo/Dfectv - Finger Fucking The Floor.mp3',
  license: DFECTV_DEMO_LICENSE,
  attribution: 'Dfectv — Finger Fucking The Floor, used with artist permission.',
})

export const DEMO_DFECTV_JUSTINS_GHOST_AUDIO_SOURCE = createDemoTrackAudioSource({
  id: 'demo-dfectv-justins-ghost',
  artist: 'Dfectv',
  title: 'Justins Ghost',
  release: DFECTV_DEMO_RELEASE,
  audioPath: '/audio/demo/Dfectv - Justins Ghost.mp3',
  license: DFECTV_DEMO_LICENSE,
  attribution: 'Dfectv — Justins Ghost, used with artist permission.',
})

export const AUDIO_SOURCES: AudioSource[] = [
  DEMO_MODULATION_MANIPULATION_AUDIO_SOURCE,
  DEMO_MODULAR_DIMENSIONS_AUDIO_SOURCE,
  DEMO_PSYCHEDELIC_EXPERIENCE_AUDIO_SOURCE,
  DEMO_FRAGMENTS_OF_REALITY_AUDIO_SOURCE,
  GLOBULAR_FOR_THE_TIME_BEING_AUDIO_SOURCE,
  GLOBULAR_THE_CHALICE_AUDIO_SOURCE,
  GLOBULAR_KALEIDOSCOPE_TRIBE_AUDIO_SOURCE,
  DEMO_DFECTV_SPCYHT_NO_NAME_AUDIO_SOURCE,
  DEMO_DFECTV_THE_MAZE_AUDIO_SOURCE,
  DEMO_DFECTV_STARFIRE_BEYOND_THE_BOUNDRIES_AUDIO_SOURCE,
  DEMO_DFECTV_ITS_A_TRAP_AUDIO_SOURCE,
  DEMO_DFECTV_SIMULATED_ALCHEMY_AUDIO_SOURCE,
  DEMO_DFECTV_FINGER_FUCKING_THE_FLOOR_AUDIO_SOURCE,
  DEMO_DFECTV_JUSTINS_GHOST_AUDIO_SOURCE,
]
