import { publicAssetUrl } from './publicAssetUrl'

export type ExternalSignalId =
  | 'psyradio-progressive'
  | 'psyradio-chillout'
  | 'psyndora-psytrance'
  | 'psyndora-chillout'
  | 'psystream'

export type ExternalSignalDefinition = {
  id: ExternalSignalId
  stationName: string
  streamUrl: string
  stationWebsite: string
  sourceAttribution: string
  publicPlayerCompatible: boolean
  artworkUrl?: string
}

export const EXTERNAL_SIGNAL_DEFINITIONS: ExternalSignalDefinition[] = [
  {
    id: 'psyradio-progressive',
    stationName: 'PsyRadio Progressive',
    streamUrl: 'http://65.109.32.21:8010/stream',
    stationWebsite: 'http://psyradio.fm',
    sourceAttribution: 'External development signal',
    publicPlayerCompatible: false,
  },
  {
    id: 'psyradio-chillout',
    stationName: 'PsyRadio Chillout',
    streamUrl: 'http://65.109.32.21:8020/stream',
    stationWebsite: 'http://psyradio.fm',
    sourceAttribution: 'External development signal',
    publicPlayerCompatible: false,
  },
  {
    id: 'psyndora-psytrance',
    stationName: 'Psyndora Psytrance',
    streamUrl: 'https://cast.magicstreams.gr/sc/psyndora/stream',
    stationWebsite: 'https://www.psyndora.com/trance.html',
    sourceAttribution: 'External signal from Psyndora',
    publicPlayerCompatible: true,
    artworkUrl: publicAssetUrl('/images/stations/psyndora-logo.png'),
  },
  {
    id: 'psyndora-chillout',
    stationName: 'Psyndora Chillout',
    streamUrl: 'https://cast.magicstreams.gr/sc/psychill/stream',
    stationWebsite: 'https://www.psyndora.com/chill.html',
    sourceAttribution: 'External signal from Psyndora',
    publicPlayerCompatible: true,
    artworkUrl: publicAssetUrl('/images/stations/psyndora-logo.png'),
  },
  {
    id: 'psystream',
    stationName: 'PsyStream',
    streamUrl: 'https://radio.psymusic.co.uk/listen/psystream/hifi.mp3',
    stationWebsite: 'https://radio.psymusic.co.uk',
    sourceAttribution: 'External development signal',
    publicPlayerCompatible: false,
  },
]

export function getExternalSignalDefinition(id: ExternalSignalId) {
  return EXTERNAL_SIGNAL_DEFINITIONS.find((definition) => definition.id === id)
}