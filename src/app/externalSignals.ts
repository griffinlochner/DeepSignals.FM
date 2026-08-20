import { publicAssetUrl } from './publicAssetUrl'

export type ExternalSignalId =
  | 'psyradio-progressive'
  | 'psyradio-chillout'
  | 'psyndora-psytrance'
  | 'psyndora-chillout'
  | 'psystream'
  | 'dmt-fm'
  | 'psybrazil'
  | 'psybrazil-dumangue'
  | 'psybrazil-progressive'
  | 'psybrazil-lofi'
  | 'psybrazil-lowbpm'
  | 'psybrazil-electro'
  | 'hirschmilch-psytrance'
  | 'hirschmilch-chillout'
  | 'hirschmilch-progressive'
  | 'space-unicorn-radio'
  | 'deep-trip-radio'

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
    stationWebsite: 'https://radio.psymusic.co.uk/public/psystream',
    sourceAttribution: 'External development signal',
    publicPlayerCompatible: true,
  },
  {
    id: 'dmt-fm',
    stationName: 'DMT-FM',
    streamUrl: 'https://dc1.serverse.com/proxy/ywycfrxn/live',
    stationWebsite: 'https://dmt-fm.com/',
    sourceAttribution: 'External development signal',
    publicPlayerCompatible: true,
    artworkUrl: publicAssetUrl('/images/stations/dmt-fm-logo.webp'),
  },
  {
    id: 'psybrazil',
    stationName: 'PsyBrazil',
    streamUrl: 'https://radio.psybrazil.com.br/psybr',
    stationWebsite: 'https://psybrazil.com.br/',
    sourceAttribution: 'External signal from PsyBrazil',
    publicPlayerCompatible: true,
    artworkUrl: publicAssetUrl('/images/stations/psybr.jpg'),
  },
  {
    id: 'psybrazil-dumangue',
    stationName: 'Dumangue',
    streamUrl: 'https://radio.psybrazil.com.br/dumangue',
    stationWebsite: 'https://psybrazil.com.br/',
    sourceAttribution: 'External signal from PsyBrazil',
    publicPlayerCompatible: true,
    artworkUrl: publicAssetUrl('/images/stations/psybrazil-dumangue.jpg'),
  },
  {
    id: 'psybrazil-progressive',
    stationName: 'Progressive',
    streamUrl: 'https://radio.psybrazil.com.br/progressive',
    stationWebsite: 'https://psybrazil.com.br/',
    sourceAttribution: 'External signal from PsyBrazil',
    publicPlayerCompatible: true,
    artworkUrl: publicAssetUrl('/images/stations/psybrazil-progressive.jpg'),
  },
  {
    id: 'psybrazil-lofi',
    stationName: 'LoFi',
    streamUrl: 'https://radio.psybrazil.com.br/lofi',
    stationWebsite: 'https://psybrazil.com.br/',
    sourceAttribution: 'External signal from PsyBrazil',
    publicPlayerCompatible: true,
    artworkUrl: publicAssetUrl('/images/stations/psybrazil-lofi.jpg'),
  },
  {
    id: 'psybrazil-lowbpm',
    stationName: 'LowBPM',
    streamUrl: 'https://radio.psybrazil.com.br/lowbpm',
    stationWebsite: 'https://psybrazil.com.br/',
    sourceAttribution: 'External signal from PsyBrazil',
    publicPlayerCompatible: true,
    artworkUrl: publicAssetUrl('/images/stations/psybrazil-lowbpm.jpg'),
  },
  {
    id: 'psybrazil-electro',
    stationName: 'Electro',
    streamUrl: 'https://radio.psybrazil.com.br/electro',
    stationWebsite: 'https://psybrazil.com.br/',
    sourceAttribution: 'External signal from PsyBrazil',
    publicPlayerCompatible: true,
    artworkUrl: publicAssetUrl('/images/stations/psybrazil-electro.jpg'),
  },
  {
    id: 'deep-trip-radio',
    stationName: 'Deep Trip Radio',
    streamUrl: 'https://stream.deeptripradio.net/live',
    stationWebsite: 'https://deeptripradio.net/',
    sourceAttribution: 'External signal from Deep Trip Radio',
    publicPlayerCompatible: true,
  },
  {
    id: 'hirschmilch-psytrance',
    stationName: 'Hirschmilch Psytrance',
    streamUrl: 'https://xfer.hirschmilch.de:8001/psytrance.mp3',
    stationWebsite: 'https://hirschmilch.de/channel/psytrance',
    sourceAttribution: 'External signal from Hirschmilch Radio',
    publicPlayerCompatible: false,
  },
  {
    id: 'hirschmilch-chillout',
    stationName: 'Hirschmilch Chillout',
    streamUrl: 'https://hirschmilch.de:7000/chillout.mp3',
    stationWebsite: 'https://hirschmilch.de/channel/chillout',
    sourceAttribution: 'External signal from Hirschmilch Radio',
    publicPlayerCompatible: false,
  },
  {
    id: 'hirschmilch-progressive',
    stationName: 'Hirschmilch Progressive',
    streamUrl: 'https://xfer.hirschmilch.de:8001/progressive.mp3',
    stationWebsite: 'https://hirschmilch.de/channel/progressive',
    sourceAttribution: 'External signal from Hirschmilch Radio',
    publicPlayerCompatible: false,
  },
  {
    id: 'space-unicorn-radio',
    stationName: 'Space Unicorn Radio',
    streamUrl: 'https://spaceunicorn.radio/stream',
    stationWebsite: 'https://spaceunicorn.radio/',
    sourceAttribution: 'External signal from Space Unicorn Radio',
    publicPlayerCompatible: false,
  },
]

export function getExternalSignalDefinition(id: ExternalSignalId) {
  return EXTERNAL_SIGNAL_DEFINITIONS.find((definition) => definition.id === id)
}