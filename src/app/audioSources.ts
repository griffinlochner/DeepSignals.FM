import { publicAssetUrl } from './publicAssetUrl'
import type { AudioSource } from './playerTypes'
import { EXTERNAL_SIGNAL_DEFINITIONS, type ExternalSignalDefinition } from './externalSignals'

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

function createLiveStreamAudioSource(definition: ExternalSignalDefinition): AudioSource {
  return {
    id: definition.id,
    kind: 'live-stream',
    displayName: definition.stationName,
    title: definition.stationName,
    audioUrl: definition.streamUrl,
    sourceUrl: definition.stationWebsite,
    attribution: definition.sourceAttribution,
    isSeekable: false,
    artworkUrl: definition.artworkUrl,
  }
}

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

export const DEMO_AUDIO_SOURCES: AudioSource[] = [
  DEMO_PSYCHEDELIC_EXPERIENCE_AUDIO_SOURCE,
  GLOBULAR_FOR_THE_TIME_BEING_AUDIO_SOURCE,
]

export const PUBLIC_EXTERNAL_AUDIO_SOURCES: AudioSource[] =
  EXTERNAL_SIGNAL_DEFINITIONS.filter(
    (definition) => definition.publicPlayerCompatible,
  ).map(createLiveStreamAudioSource)

export const AUDIO_SOURCES: AudioSource[] = [
  ...DEMO_AUDIO_SOURCES,
  ...PUBLIC_EXTERNAL_AUDIO_SOURCES,
]
