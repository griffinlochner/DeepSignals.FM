import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AudioReactiveSnapshot, ReactiveBehaviorId } from '../../app/playerTypes'

type SignalState =
  | 'Signal Off'
  | 'Connecting'
  | 'On Air'
  | 'Buffering'
  | 'Reconnecting'
  | 'Manual Reconnect Required'
  | 'Stream Unavailable'

type TrackMetadata = {
  status: 'idle' | 'discovering' | 'available' | 'unavailable'
  artist: string | null
  title: string | null
  sourceEndpoint: string | null
  message: string
}

type MetadataProbeResult = {
  endpoint: string
  ok: boolean
  detail: string
}

type ReconnectDiagnostics = {
  reconnectAttemptCount: number
  currentRetryDelayMs: number | null
  lastReconnectReason: string | null
  lastEvent: string | null
  lastEventTimestamp: number | null
  browserOnline: boolean
  stoppedByUser: boolean
}

export type AnalyzerStage = 'raw' | 'normalization' | 'smoothing' | 'playback-state' | 'validation'

export type AnalyzerMetricSample = {
  timestampMs: number
  timeDomainRms: number
  timeDomainPeak: number
  bassEnergy: number
  midrangeEnergy: number
  trebleEnergy: number
  nonZeroFftBinRatio: number
  nonZeroFftBinPercent: number
  rawDepthInput: number
  normalizedDepth: number
  finalSmoothedDepth: number
  rollingDepthMin: number
  rollingDepthMax: number
  normalizationRange: number
  quietGateActive: boolean
  frameDeltaMs: number
  hasNanOrInfinity: boolean
  hasNegativeRange: boolean
  hasLargeFrameGap: boolean
  audioReadyState: number
  audioNetworkState: number
  audioContextState: AudioContextState | 'not-created' | 'closed'
  audioCurrentTime: number
  reconnectAttemptCount: number
}

export type AnalyzerSpikeEvent = {
  id: string
  timestampMs: number
  stage: AnalyzerStage
  reason:
    | 'raw audio spike'
    | 'normalization amplification'
    | 'near-zero denominator'
    | 'one-frame discontinuity'
    | 'quiet-gate transition'
    | 'playback-state transition'
    | 'invalid numeric value'
    | 'large frame-time gap'
  snapshot: {
    timeDomainRms: number
    bassEnergy: number
    normalizedDepth: number
    finalSmoothedDepth: number
    frameDeltaMs: number
    audioCurrentTime: number
  }
}

export type AnalyzerDiagnostics = {
  latest: AnalyzerMetricSample
  rollingSamples: AnalyzerMetricSample[]
  spikes: AnalyzerSpikeEvent[]
}

type DevMemorySnapshot = {
  supported: boolean
  usedJsHeapSize: number
  totalJsHeapSize: number
  jsHeapSizeLimit: number
  deltaSincePlaybackStart: number
  peakUsedJsHeapSize: number
}

type DevRuntimeCounters = {
  animationFramesProcessed: number
  diagnosticUiPublications: number
  rollingSampleCount: number
  spikeEventCount: number
  activeRafChains: number
  activeTimers: number
  audioElements: number
  audioContexts: number
  sourceNodes: number
  analyzers: number
  rendererInstances: number
  sceneInstances: number
}

export type DevSignalSourceId =
  | 'psyradio-progressive'
  | 'psyndora-psytrance'
  | 'psyndora-alternate'
  | 'psystream'
  | 'custom-dev-url'

export type DevSignalSourceOption = {
  id: DevSignalSourceId
  label: string
  stationName: string
  streamUrl: string
  stationWebsite: string
  sourceAttribution: string
}

type DevSignalSourceConfiguration = {
  id: DevSignalSourceId
  stationName: string
  streamUrl: string
  stationWebsite: string
  sourceAttribution: string
}

type ComparisonReadout = {
  selectedStation: string
  streamUrl: string
  playbackStatus: SignalState
  analyzerAssessment: string
  liveRms: number
  averageFrequencyEnergy: number
  audioContextState: AudioContextState | 'not-created' | 'closed'
  elapsedCurrentTime: number
  reconnectAttempts: number
}

type AudioResourceDiagnostics = {
  audioElementsCreated: number
  audioContextsCreated: number
  sourceNodesCreated: number
  analyzersCreated: number
  analysisLoopsStarted: number
  isAnalysisLoopRunning: boolean
}

type UseExternalRadioControllerResult = {
  streamUrl: string
  stationName: string
  stationWebsite: string
  stationAttribution: string
  signalState: SignalState
  isPlaying: boolean
  canStart: boolean
  canStop: boolean
  canReconnect: boolean
  volume: number
  setVolume: (value: number) => void
  selectedBehavior: ReactiveBehaviorId
  setSelectedBehavior: (value: ReactiveBehaviorId) => void
  motionEnabled: boolean
  setMotionEnabled: (value: boolean) => void
  visualFeedOpen: boolean
  setVisualFeedOpen: (value: boolean) => void
  selectedThemeId: string
  setSelectedThemeId: (value: string) => void
  signalSources: DevSignalSourceOption[]
  selectedSignalSourceId: DevSignalSourceId
  customStreamUrlInput: string
  setCustomStreamUrlInput: (value: string) => void
  selectSignalSource: (id: DevSignalSourceId) => Promise<void>
  applyCustomSignalSource: () => Promise<void>
  startSignal: () => Promise<void>
  stopSignal: () => Promise<void>
  reconnectSignal: () => Promise<void>
  getLatestAudioSnapshot: () => AudioReactiveSnapshot
  metadata: TrackMetadata
  metadataProbeResults: MetadataProbeResult[]
  reconnectDiagnostics: ReconnectDiagnostics
  analyzerDiagnostics: AnalyzerDiagnostics
  comparisonReadout: ComparisonReadout
  resourceDiagnostics: AudioResourceDiagnostics
  memoryDiagnostics: DevMemorySnapshot
  runtimeCounters: DevRuntimeCounters
  errorMessage: string | null
}

const DEV_SIGNAL_SOURCES: DevSignalSourceOption[] = [
  {
    id: 'psyradio-progressive',
    label: 'PsyRadio Progressive (External DEV Signal)',
    stationName: 'PsyRadio Progressive',
    streamUrl: 'http://65.109.32.21:8010/stream',
    stationWebsite: 'http://psyradio.fm',
    sourceAttribution: 'External development signal',
  },
  {
    id: 'psyndora-psytrance',
    label: 'Psyndora Psytrance (External DEV Signal)',
    stationName: 'Psyndora Psytrance',
    streamUrl: 'https://cast.magicstreams.gr:9111/stream',
    stationWebsite: 'https://cast.magicstreams.gr',
    sourceAttribution: 'External development signal',
  },
  {
    id: 'psyndora-alternate',
    label: 'Psyndora Alternate (External DEV Signal)',
    stationName: 'Psyndora Alternate',
    streamUrl: 'https://cast.magicstreams.gr/sc/psyndora/stream',
    stationWebsite: 'https://cast.magicstreams.gr',
    sourceAttribution: 'External development signal',
  },
  {
    id: 'psystream',
    label: 'PsyStream (External DEV Signal)',
    stationName: 'PsyStream',
    streamUrl: 'https://radio.psymusic.co.uk/listen/psystream/hifi.mp3',
    stationWebsite: 'https://radio.psymusic.co.uk',
    sourceAttribution: 'External development signal',
  },
  {
    id: 'custom-dev-url',
    label: 'Custom DEV URL',
    stationName: 'Custom DEV Signal',
    streamUrl: '',
    stationWebsite: '',
    sourceAttribution: 'External development signal',
  },
]

const DEFAULT_SIGNAL_SOURCE_ID: DevSignalSourceId = 'psyradio-progressive'
const DEFAULT_SIGNAL_SOURCE = DEV_SIGNAL_SOURCES.find((source) => source.id === DEFAULT_SIGNAL_SOURCE_ID) as DevSignalSourceOption
const METADATA_POLL_MS = 15000
const WAITING_GRACE_MS = 5000
const STABLE_PLAYBACK_RESET_MS = 12000
const RECONNECT_DELAYS_MS = [2000, 5000, 10000, 20000, 30000]
const DIAGNOSTICS_PUBLISH_INTERVAL_MS = 350
const MEMORY_SAMPLE_INTERVAL_MS = 2000
const DIAGNOSTICS_SPIKE_COOLDOWN_MS = 650
const ROLLING_SAMPLE_CAP = 120
const SPIKE_EVENT_CAP = 24
const NORMALIZATION_NEAR_ZERO_RANGE = 0.01
const LARGE_FRAME_GAP_MS = 120
const QUIET_GATE_ENTER_RMS = 0.024
const QUIET_GATE_EXIT_RMS = 0.034
const QUIET_GATE_ENTER_BASS = 0.048
const QUIET_GATE_EXIT_BASS = 0.074
const STABILIZED_NEUTRAL_DEPTH = 0.26
const STABILIZED_MIN_NORMALIZATION_RANGE = 0.1
const BOUNDS_FOLLOW_UP_PER_SECOND = 0.55
const BOUNDS_FOLLOW_DOWN_PER_SECOND = 0.18
const STABILIZED_ATTACK_PER_SECOND = 2.2
const STABILIZED_RELEASE_PER_SECOND = 0.95
const STABILIZED_MAX_RISE_PER_SECOND = 0.82
const STABILIZED_MAX_FALL_PER_SECOND = 0.36
const QUIET_DECAY_PER_SECOND = 0.72
const GUARD_DECAY_PER_SECOND = 0.88
const RANGE_FALLBACK_DECAY_PER_SECOND = 0.42
const TRANSITION_GUARD_MS = 900
const SPIKE_REJECTION_DELTA = 0.2
const SPIKE_REJECTION_FRAMES = 3

const METADATA_ENDPOINTS = [
  '/status-json.xsl',
  '/7.html',
  '/currentsong?sid=1',
  '/currentmetadata?sid=1',
]

const ZERO_SNAPSHOT: AudioReactiveSnapshot = {
  energy: 0,
  smoothedEnergy: 0,
  bass: 0,
  kickPulse: 0,
  kickPulseAcceptedEvent: false,
  kickPulseAcceptedEventCount: 0,
  kickPulseAcceptedEventSequence: 0,
  bassPulse: 0,
  mids: 0,
  highs: 0,
  transient: 0,
  isActive: false,
}

const ZERO_ANALYZER_SAMPLE: AnalyzerMetricSample = {
  timestampMs: 0,
  timeDomainRms: 0,
  timeDomainPeak: 0,
  bassEnergy: 0,
  midrangeEnergy: 0,
  trebleEnergy: 0,
  nonZeroFftBinRatio: 0,
  nonZeroFftBinPercent: 0,
  rawDepthInput: 0,
  normalizedDepth: 0,
  finalSmoothedDepth: 0,
  rollingDepthMin: 0,
  rollingDepthMax: 0,
  normalizationRange: 0,
  quietGateActive: false,
  frameDeltaMs: 0,
  hasNanOrInfinity: false,
  hasNegativeRange: false,
  hasLargeFrameGap: false,
  audioReadyState: 0,
  audioNetworkState: 0,
  audioContextState: 'not-created',
  audioCurrentTime: 0,
  reconnectAttemptCount: 0,
}

const ZERO_MEMORY_DIAGNOSTICS: DevMemorySnapshot = {
  supported: false,
  usedJsHeapSize: 0,
  totalJsHeapSize: 0,
  jsHeapSizeLimit: 0,
  deltaSincePlaybackStart: 0,
  peakUsedJsHeapSize: 0,
}

const ZERO_RUNTIME_COUNTERS: DevRuntimeCounters = {
  animationFramesProcessed: 0,
  diagnosticUiPublications: 0,
  rollingSampleCount: 0,
  spikeEventCount: 0,
  activeRafChains: 0,
  activeTimers: 0,
  audioElements: 1,
  audioContexts: 0,
  sourceNodes: 0,
  analyzers: 0,
  rendererInstances: 0,
  sceneInstances: 0,
}

function finiteOrZero(value: number) {
  return Number.isFinite(value) ? value : 0
}

function clampFinite01(value: number) {
  return clamp01(finiteOrZero(value))
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.max(min, Math.min(max, value))
}

function nowMs() {
  return performance.now()
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

function parseArtistTitle(value: string) {
  const text = value.trim()

  if (!text) {
    return null
  }

  const separators = [' - ', ' – ', ' — ', ' | ']

  for (const separator of separators) {
    const index = text.indexOf(separator)

    if (index > 0 && index < text.length - separator.length) {
      const artist = text.slice(0, index).trim()
      const title = text.slice(index + separator.length).trim()

      if (artist && title) {
        return { artist, title }
      }
    }
  }

  return { artist: 'Unknown Artist', title: text }
}

function parseStatusJsonResponse(raw: string) {
  try {
    const parsed = JSON.parse(raw) as {
      icestats?: {
        source?:
          | { title?: string; server_name?: string }
          | Array<{ title?: string; server_name?: string }>
      }
    }

    const source = Array.isArray(parsed.icestats?.source)
      ? parsed.icestats?.source[0]
      : parsed.icestats?.source

    if (!source) {
      return null
    }

    const parsedTitle = parseArtistTitle(source.title ?? '')
    if (parsedTitle) {
      return parsedTitle
    }

    const fallback = parseArtistTitle(source.server_name ?? '')
    return fallback
  } catch {
    return null
  }
}

function parse7HtmlResponse(raw: string) {
  const text = raw.trim()

  if (!text) {
    return null
  }

  const withoutTags = text.replace(/<[^>]+>/g, '')
  const parts = withoutTags.split(',')

  if (parts.length >= 7) {
    return parseArtistTitle(parts[6] ?? '')
  }

  return parseArtistTitle(withoutTags)
}

function parseCurrentSongResponse(raw: string) {
  return parseArtistTitle(raw)
}

function parseCurrentMetadataResponse(raw: string) {
  const parsedDirect = parseArtistTitle(raw)
  if (parsedDirect) {
    return parsedDirect
  }

  const titleMatch = raw.match(/<title>(.*?)<\/title>/i)
  if (titleMatch?.[1]) {
    return parseArtistTitle(titleMatch[1])
  }

  return null
}

function isAutoplayPolicyError(message: string) {
  const lower = message.toLowerCase()
  return lower.includes('notallowederror') || lower.includes('gesture') || lower.includes('autoplay')
}

function delayForAttempt(attemptIndex: number) {
  const bounded = Math.max(0, Math.min(attemptIndex, RECONNECT_DELAYS_MS.length - 1))
  return RECONNECT_DELAYS_MS[bounded]
}

function createMediaErrorMessage(error: MediaError | null) {
  if (!error) {
    return 'Media error without details.'
  }

  const byCode: Record<number, string> = {
    1: 'MEDIA_ERR_ABORTED',
    2: 'MEDIA_ERR_NETWORK',
    3: 'MEDIA_ERR_DECODE',
    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
  }

  return `${byCode[error.code] ?? `UNKNOWN_${error.code}`}${error.message ? `: ${error.message}` : ''}`
}

function getPerformanceMemory() {
  const perf = performance as Performance & {
    memory?: {
      usedJSHeapSize: number
      totalJSHeapSize: number
      jsHeapSizeLimit: number
    }
  }

  return perf.memory ?? null
}

function readRendererCounters() {
  const counters = (window as Window & {
    __IMAGE_DEPTH_PARITY__?: {
      counters?: {
        rendererInstances?: number
        sceneInstances?: number
      }
    }
  }).__IMAGE_DEPTH_PARITY__?.counters

  return {
    rendererInstances: Number.isFinite(counters?.rendererInstances) ? counters?.rendererInstances ?? 0 : 0,
    sceneInstances: Number.isFinite(counters?.sceneInstances) ? counters?.sceneInstances ?? 0 : 0,
  }
}

function findSignalSourceById(id: DevSignalSourceId) {
  return DEV_SIGNAL_SOURCES.find((source) => source.id === id) ?? DEFAULT_SIGNAL_SOURCE
}

function normalizeCustomStreamUrl(url: string) {
  const trimmed = url.trim()

  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

export function useExternalRadioController(defaultThemeId: string): UseExternalRadioControllerResult {
  const [selectedSignalSourceId, setSelectedSignalSourceId] = useState<DevSignalSourceId>(
    DEFAULT_SIGNAL_SOURCE_ID,
  )
  const [customStreamUrlInput, setCustomStreamUrlInput] = useState('')
  const [activeSignal, setActiveSignal] = useState<DevSignalSourceConfiguration>({
    id: DEFAULT_SIGNAL_SOURCE.id,
    stationName: DEFAULT_SIGNAL_SOURCE.stationName,
    streamUrl: DEFAULT_SIGNAL_SOURCE.streamUrl,
    stationWebsite: DEFAULT_SIGNAL_SOURCE.stationWebsite,
    sourceAttribution: DEFAULT_SIGNAL_SOURCE.sourceAttribution,
  })
  const [signalState, setSignalState] = useState<SignalState>('Signal Off')
  const [selectedBehavior, setSelectedBehavior] = useState<ReactiveBehaviorId>('chill')
  const [motionEnabled, setMotionEnabled] = useState(true)
  const [visualFeedOpen, setVisualFeedOpen] = useState(false)
  const [selectedThemeId, setSelectedThemeId] = useState(defaultThemeId)
  const [volume, setVolumeState] = useState(0.72)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<TrackMetadata>({
    status: 'idle',
    artist: null,
    title: null,
    sourceEndpoint: null,
    message: 'Track metadata unavailable',
  })
  const [metadataProbeResults, setMetadataProbeResults] = useState<MetadataProbeResult[]>([])
  const [reconnectDiagnostics, setReconnectDiagnostics] = useState<ReconnectDiagnostics>({
    reconnectAttemptCount: 0,
    currentRetryDelayMs: null,
    lastReconnectReason: null,
    lastEvent: null,
    lastEventTimestamp: null,
    browserOnline: navigator.onLine,
    stoppedByUser: false,
  })
  const [analyzerDiagnostics, setAnalyzerDiagnostics] = useState<AnalyzerDiagnostics>({
    latest: ZERO_ANALYZER_SAMPLE,
    rollingSamples: [],
    spikes: [],
  })
  const [resourceDiagnostics, setResourceDiagnostics] = useState<AudioResourceDiagnostics>({
    audioElementsCreated: 1,
    audioContextsCreated: 0,
    sourceNodesCreated: 0,
    analyzersCreated: 0,
    analysisLoopsStarted: 0,
    isAnalysisLoopRunning: false,
  })
  const [memoryDiagnostics, setMemoryDiagnostics] = useState<DevMemorySnapshot>(ZERO_MEMORY_DIAGNOSTICS)
  const [runtimeCounters, setRuntimeCounters] = useState<DevRuntimeCounters>(ZERO_RUNTIME_COUNTERS)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const stablePlaybackTimerRef = useRef<number | null>(null)
  const reconnectGraceTimerRef = useRef<number | null>(null)
  const reconnectDelayTimerRef = useRef<number | null>(null)
  const metadataPollTimerRef = useRef<number | null>(null)
  const metadataEndpointRef = useRef<string | null>(null)
  const metadataSessionRef = useRef(0)
  const diagnosticsPublishAtRef = useRef(0)
  const diagnosticsSamplesRef = useRef<AnalyzerMetricSample[]>([])
  const diagnosticsSpikesRef = useRef<AnalyzerSpikeEvent[]>([])
  const lastSpikeAtByReasonRef = useRef<Record<string, number>>({})
  const latestAnalyzerSampleRef = useRef<AnalyzerMetricSample>({ ...ZERO_ANALYZER_SAMPLE })
  const memorySampleAtRef = useRef(0)
  const playbackHeapStartRef = useRef<number | null>(null)
  const playbackHeapPeakRef = useRef(0)
  const activeSignalRef = useRef<DevSignalSourceConfiguration>(activeSignal)
  const signalSwitchInProgressRef = useRef(false)

  const snapshotRef = useRef<AudioReactiveSnapshot>(ZERO_SNAPSHOT)
  const smoothedEnergyRef = useRef(0)
  const kickPulseRef = useRef(0)
  const bassPulseRef = useRef(0)
  const transientRef = useRef(0)
  const lastKickAtRef = useRef(0)
  const kickAcceptedCountRef = useRef(0)
  const kickSequenceRef = useRef(0)
  const previousBassRef = useRef(0)
  const previousFinalDepthRef = useRef(0)
  const previousFrameAtRef = useRef<number | null>(null)
  const previousQuietGateRef = useRef(false)
  const previousReadyStateRef = useRef<number | null>(null)
  const previousNetworkStateRef = useRef<number | null>(null)
  const previousContextStateRef = useRef<string | null>(null)
  const quietGateLatchedRef = useRef(false)
  const stableNormalizedDepthRef = useRef(STABILIZED_NEUTRAL_DEPTH)
  const adaptiveLowerBoundRef = useRef<number | null>(null)
  const adaptiveUpperBoundRef = useRef<number | null>(null)
  const pendingSpikeFrameCountRef = useRef(0)
  const transitionGuardUntilRef = useRef(0)

  const userRequestedPlaybackRef = useRef(false)
  const manualStopRef = useRef(false)
  const reconnectBackoffIndexRef = useRef(0)
  const reconnectInProgressRef = useRef(false)
  const audioEventCleanupRef = useRef<Array<() => void>>([])
  const reconnectAttemptCountRef = useRef(0)
  const frameCountRef = useRef(0)
  const selectedBehaviorRef = useRef<ReactiveBehaviorId>('chill')
  const signalStateRef = useRef<SignalState>('Signal Off')

  const updateReconnectDiagnostics = useCallback((partial: Partial<ReconnectDiagnostics>) => {
    setReconnectDiagnostics((previous) => ({ ...previous, ...partial }))
  }, [])

  useEffect(() => {
    selectedBehaviorRef.current = selectedBehavior
  }, [selectedBehavior])

  useEffect(() => {
    signalStateRef.current = signalState
  }, [signalState])

  const publishRuntimeCounters = useCallback((partial: Partial<DevRuntimeCounters>) => {
    setRuntimeCounters((previous) => ({ ...previous, ...partial }))
  }, [])

  const countActiveTimers = useCallback(() => {
    let activeCount = 0

    if (stablePlaybackTimerRef.current !== null) {
      activeCount += 1
    }

    if (reconnectGraceTimerRef.current !== null) {
      activeCount += 1
    }

    if (reconnectDelayTimerRef.current !== null) {
      activeCount += 1
    }

    if (metadataPollTimerRef.current !== null) {
      activeCount += 1
    }

    return activeCount
  }, [])

  const maybePublishMemoryDiagnostics = useCallback(
    (timestampMs: number) => {
      if (timestampMs - memorySampleAtRef.current < MEMORY_SAMPLE_INTERVAL_MS) {
        return
      }

      memorySampleAtRef.current = timestampMs
      const memory = getPerformanceMemory()

      if (!memory) {
        setMemoryDiagnostics(ZERO_MEMORY_DIAGNOSTICS)
        return
      }

      const used = Number.isFinite(memory.usedJSHeapSize) ? memory.usedJSHeapSize : 0
      const total = Number.isFinite(memory.totalJSHeapSize) ? memory.totalJSHeapSize : 0
      const limit = Number.isFinite(memory.jsHeapSizeLimit) ? memory.jsHeapSizeLimit : 0

      if (playbackHeapStartRef.current === null && signalStateRef.current !== 'Signal Off') {
        playbackHeapStartRef.current = used
      }

      playbackHeapPeakRef.current = Math.max(playbackHeapPeakRef.current, used)
      const heapStart = playbackHeapStartRef.current ?? used

      setMemoryDiagnostics({
        supported: true,
        usedJsHeapSize: used,
        totalJsHeapSize: total,
        jsHeapSizeLimit: limit,
        deltaSincePlaybackStart: used - heapStart,
        peakUsedJsHeapSize: playbackHeapPeakRef.current,
      })
    },
    [],
  )

  const updateActiveSignal = useCallback((nextSignal: DevSignalSourceConfiguration) => {
    activeSignalRef.current = nextSignal
    setActiveSignal(nextSignal)
  }, [])

  const resetMetadataState = useCallback(() => {
    metadataSessionRef.current += 1
    metadataEndpointRef.current = null
    setMetadata({
      status: 'idle',
      artist: null,
      title: null,
      sourceEndpoint: null,
      message: 'Track metadata unavailable',
    })
    setMetadataProbeResults([])
  }, [])

  const resetAnalyzerState = useCallback(() => {
    snapshotRef.current = { ...ZERO_SNAPSHOT }
    smoothedEnergyRef.current = 0
    kickPulseRef.current = 0
    bassPulseRef.current = 0
    transientRef.current = 0
    lastKickAtRef.current = 0
    kickAcceptedCountRef.current = 0
    kickSequenceRef.current = 0
    previousBassRef.current = 0
    previousFinalDepthRef.current = 0
    previousFrameAtRef.current = null
    previousQuietGateRef.current = false
    previousReadyStateRef.current = null
    previousNetworkStateRef.current = null
    quietGateLatchedRef.current = false
    stableNormalizedDepthRef.current = STABILIZED_NEUTRAL_DEPTH
    adaptiveLowerBoundRef.current = null
    adaptiveUpperBoundRef.current = null
    pendingSpikeFrameCountRef.current = 0
    transitionGuardUntilRef.current = 0
    diagnosticsPublishAtRef.current = 0
    diagnosticsSamplesRef.current.length = 0
    diagnosticsSpikesRef.current.length = 0
    lastSpikeAtByReasonRef.current = {}
    latestAnalyzerSampleRef.current = {
      ...ZERO_ANALYZER_SAMPLE,
      reconnectAttemptCount: reconnectAttemptCountRef.current,
    }
    playbackHeapStartRef.current = null
    playbackHeapPeakRef.current = 0
    memorySampleAtRef.current = 0

    const contextState = contextRef.current
      ? contextRef.current.state
      : previousContextStateRef.current === 'closed'
        ? 'closed'
        : 'not-created'

    setAnalyzerDiagnostics({
      latest: {
        ...latestAnalyzerSampleRef.current,
        audioContextState: contextState,
      },
      rollingSamples: [],
      spikes: [],
    })

    publishRuntimeCounters({
      rollingSampleCount: 0,
      spikeEventCount: 0,
      animationFramesProcessed: 0,
      diagnosticUiPublications: 0,
    })
    setMemoryDiagnostics(ZERO_MEMORY_DIAGNOSTICS)
  }, [publishRuntimeCounters])

  const resetReconnectState = useCallback(
    (stoppedByUser: boolean, reason: string | null) => {
      reconnectBackoffIndexRef.current = 0
      reconnectInProgressRef.current = false
      reconnectAttemptCountRef.current = 0
      setReconnectDiagnostics((previous) => ({
        ...previous,
        reconnectAttemptCount: 0,
        currentRetryDelayMs: null,
        lastReconnectReason: reason,
        stoppedByUser,
      }))
    },
    [],
  )

  const applyStreamSourceToAudio = useCallback((audio: HTMLAudioElement, streamUrl: string) => {
    const preservedVolume = audio.volume

    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    audio.crossOrigin = 'anonymous'
    audio.src = streamUrl
    audio.volume = preservedVolume
  }, [])

  useEffect(() => {
    reconnectAttemptCountRef.current = reconnectDiagnostics.reconnectAttemptCount
  }, [reconnectDiagnostics.reconnectAttemptCount])

  const publishDiagnostics = useCallback((sample: AnalyzerMetricSample) => {
    const now = nowMs()

    if (now - diagnosticsPublishAtRef.current < DIAGNOSTICS_PUBLISH_INTERVAL_MS) {
      return
    }

    diagnosticsPublishAtRef.current = now
    const rollingSnapshot = diagnosticsSamplesRef.current.slice()
    const spikeSnapshot = diagnosticsSpikesRef.current.slice()
    const rendererCounters = readRendererCounters()

    setAnalyzerDiagnostics({
      latest: { ...sample },
      rollingSamples: rollingSnapshot,
      spikes: spikeSnapshot,
    })
    maybePublishMemoryDiagnostics(now)
    setRuntimeCounters((previous) => ({
      ...previous,
      animationFramesProcessed: frameCountRef.current,
      diagnosticUiPublications: previous.diagnosticUiPublications + 1,
      rollingSampleCount: rollingSnapshot.length,
      spikeEventCount: spikeSnapshot.length,
      activeRafChains: animationFrameRef.current !== null ? 1 : 0,
      activeTimers: countActiveTimers(),
      audioElements: 1,
      audioContexts: resourceDiagnostics.audioContextsCreated,
      sourceNodes: resourceDiagnostics.sourceNodesCreated,
      analyzers: resourceDiagnostics.analyzersCreated,
      rendererInstances: rendererCounters.rendererInstances,
      sceneInstances: rendererCounters.sceneInstances,
    }))
  }, [countActiveTimers, maybePublishMemoryDiagnostics, resourceDiagnostics.analyzersCreated, resourceDiagnostics.audioContextsCreated, resourceDiagnostics.sourceNodesCreated])

  const createSpike = useCallback(
    (
      sample: AnalyzerMetricSample,
      stage: AnalyzerStage,
      reason: AnalyzerSpikeEvent['reason'],
      force = false,
    ) => {
      const lastByReason = lastSpikeAtByReasonRef.current[reason] ?? 0

      if (!force && sample.timestampMs - lastByReason < DIAGNOSTICS_SPIKE_COOLDOWN_MS) {
        return
      }

      lastSpikeAtByReasonRef.current[reason] = sample.timestampMs

      const spike: AnalyzerSpikeEvent = {
        id: `${Math.round(sample.timestampMs)}-${reason}`,
        timestampMs: sample.timestampMs,
        stage,
        reason,
        snapshot: {
          timeDomainRms: sample.timeDomainRms,
          bassEnergy: sample.bassEnergy,
          normalizedDepth: sample.normalizedDepth,
          finalSmoothedDepth: sample.finalSmoothedDepth,
          frameDeltaMs: sample.frameDeltaMs,
          audioCurrentTime: sample.audioCurrentTime,
        },
      }

      diagnosticsSpikesRef.current.unshift(spike)
      if (diagnosticsSpikesRef.current.length > SPIKE_EVENT_CAP) {
        diagnosticsSpikesRef.current.length = SPIKE_EVENT_CAP
      }

      publishDiagnostics(sample)
    },
    [publishDiagnostics],
  )

  const clearTimer = (timerRef: React.MutableRefObject<number | null>) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const clearMetadataPoll = useCallback(() => {
    if (metadataPollTimerRef.current !== null) {
      window.clearInterval(metadataPollTimerRef.current)
      metadataPollTimerRef.current = null
    }
  }, [])

  const clearReconnectTimers = useCallback(() => {
    clearTimer(reconnectGraceTimerRef)
    clearTimer(reconnectDelayTimerRef)
    clearTimer(stablePlaybackTimerRef)
  }, [])

  const stopAnalysisLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
      setResourceDiagnostics((previous) => ({
        ...previous,
        isAnalysisLoopRunning: false,
      }))
      publishRuntimeCounters({ activeRafChains: 0 })
    }
  }, [publishRuntimeCounters])

  const getLatestAudioSnapshot = useCallback(() => {
    return snapshotRef.current
  }, [])

  const runMetadataFetch = useCallback(async (absoluteEndpoint: string) => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort('timeout'), 3500)

    try {
      const response = await fetch(absoluteEndpoint, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        return {
          ok: false,
          detail: `HTTP ${response.status}`,
          parsed: null as { artist: string; title: string } | null,
        }
      }

      const raw = await response.text()
      let parsed: { artist: string; title: string } | null = null

      if (absoluteEndpoint.endsWith('/status-json.xsl')) {
        parsed = parseStatusJsonResponse(raw)
      } else if (absoluteEndpoint.endsWith('/7.html')) {
        parsed = parse7HtmlResponse(raw)
      } else if (absoluteEndpoint.includes('/currentsong?sid=1')) {
        parsed = parseCurrentSongResponse(raw)
      } else if (absoluteEndpoint.includes('/currentmetadata?sid=1')) {
        parsed = parseCurrentMetadataResponse(raw)
      }

      if (!parsed) {
        return {
          ok: false,
          detail: 'No usable artist/title in response',
          parsed: null,
        }
      }

      return {
        ok: true,
        detail: `${parsed.artist} - ${parsed.title}`,
        parsed,
      }
    } catch (error) {
      return {
        ok: false,
        detail: String(error),
        parsed: null,
      }
    } finally {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  const discoverMetadataEndpoint = useCallback(async (sessionId: number) => {
    const origin = new URL(activeSignalRef.current.streamUrl).origin

    if (sessionId !== metadataSessionRef.current) {
      return
    }

    setMetadata({
      status: 'discovering',
      artist: null,
      title: null,
      sourceEndpoint: null,
      message: 'Discovering track metadata endpoint...',
    })

    const probeResults: MetadataProbeResult[] = []

    for (const endpoint of METADATA_ENDPOINTS) {
      if (sessionId !== metadataSessionRef.current) {
        return
      }

      const absolute = `${origin}${endpoint}`
      const result = await runMetadataFetch(absolute)

      if (sessionId !== metadataSessionRef.current) {
        return
      }

      probeResults.push({
        endpoint: absolute,
        ok: result.ok,
        detail: result.detail,
      })

      if (result.ok && result.parsed) {
        metadataEndpointRef.current = absolute

        if (sessionId !== metadataSessionRef.current) {
          return
        }

        setMetadata({
          status: 'available',
          artist: result.parsed.artist,
          title: result.parsed.title,
          sourceEndpoint: absolute,
          message: `${result.parsed.artist} - ${result.parsed.title}`,
        })

        setMetadataProbeResults(probeResults)
        return
      }
    }

    if (sessionId !== metadataSessionRef.current) {
      return
    }

    metadataEndpointRef.current = null
    setMetadata({
      status: 'unavailable',
      artist: null,
      title: null,
      sourceEndpoint: null,
      message: 'Track metadata unavailable',
    })
    setMetadataProbeResults(probeResults)
  }, [runMetadataFetch])

  const pollCurrentMetadata = useCallback(async (sessionId: number) => {
    if (sessionId !== metadataSessionRef.current) {
      return
    }

    const endpoint = metadataEndpointRef.current

    if (!endpoint) {
      return
    }

    const result = await runMetadataFetch(endpoint)
    if (!result.ok || !result.parsed) {
      return
    }

    if (sessionId !== metadataSessionRef.current) {
      return
    }

    setMetadata({
      status: 'available',
      artist: result.parsed.artist,
      title: result.parsed.title,
      sourceEndpoint: endpoint,
      message: `${result.parsed.artist} - ${result.parsed.title}`,
    })
  }, [runMetadataFetch])

  const ensureMetadataPolling = useCallback(async () => {
    clearMetadataPoll()
    metadataSessionRef.current += 1
    const sessionId = metadataSessionRef.current

    await discoverMetadataEndpoint(sessionId)

    if (sessionId !== metadataSessionRef.current) {
      return
    }

    if (!metadataEndpointRef.current) {
      return
    }

    metadataPollTimerRef.current = window.setInterval(() => {
      void pollCurrentMetadata(sessionId)
    }, METADATA_POLL_MS)
  }, [clearMetadataPoll, discoverMetadataEndpoint, pollCurrentMetadata])

  const resumeStableState = useCallback(() => {
    clearReconnectTimers()
    reconnectBackoffIndexRef.current = 0
    updateReconnectDiagnostics({
      currentRetryDelayMs: null,
      lastReconnectReason: null,
    })

    stablePlaybackTimerRef.current = window.setTimeout(() => {
      reconnectBackoffIndexRef.current = 0
      updateReconnectDiagnostics({ currentRetryDelayMs: null })
    }, STABLE_PLAYBACK_RESET_MS)
  }, [clearReconnectTimers, updateReconnectDiagnostics])

  const attemptPlay = useCallback(async (reason: string) => {
    const audio = audioRef.current

    if (!audio) {
      return false
    }

    try {
      await audio.play()
      setErrorMessage(null)
      reconnectInProgressRef.current = false
      if (reason === 'manual') {
        setSignalState('Connecting')
      }
      return true
    } catch (error) {
      const message = String(error)
      setErrorMessage(message)

      if (isAutoplayPolicyError(message)) {
        setSignalState('Manual Reconnect Required')
      } else {
        setSignalState('Stream Unavailable')
      }

      reconnectInProgressRef.current = false
      return false
    }
  }, [])

  const reconnectNow = useCallback(async (reason: string) => {
    const audio = audioRef.current

    if (!audio || manualStopRef.current || !userRequestedPlaybackRef.current || signalSwitchInProgressRef.current) {
      return
    }

    if (reconnectInProgressRef.current) {
      return
    }

    reconnectInProgressRef.current = true
    setSignalState('Reconnecting')
    updateReconnectDiagnostics({ lastReconnectReason: reason })

    try {
      applyStreamSourceToAudio(audio, activeSignalRef.current.streamUrl)
      await attemptPlay(reason)
    } catch (error) {
      setErrorMessage(String(error))
      setSignalState('Stream Unavailable')
      reconnectInProgressRef.current = false
    }
  }, [applyStreamSourceToAudio, attemptPlay, updateReconnectDiagnostics])

  const scheduleReconnect = useCallback((reason: string) => {
    if (manualStopRef.current || !userRequestedPlaybackRef.current || signalSwitchInProgressRef.current) {
      return
    }

    if (reconnectGraceTimerRef.current !== null || reconnectDelayTimerRef.current !== null) {
      return
    }

    reconnectGraceTimerRef.current = window.setTimeout(() => {
      reconnectGraceTimerRef.current = null

      const delayMs = delayForAttempt(reconnectBackoffIndexRef.current)
      reconnectBackoffIndexRef.current = Math.min(
        reconnectBackoffIndexRef.current + 1,
        RECONNECT_DELAYS_MS.length - 1,
      )

      setReconnectDiagnostics((previous) => ({
        ...previous,
        reconnectAttemptCount: previous.reconnectAttemptCount + 1,
        currentRetryDelayMs: delayMs,
        lastReconnectReason: reason,
      }))

      reconnectDelayTimerRef.current = window.setTimeout(() => {
        reconnectDelayTimerRef.current = null
        void reconnectNow(reason)
      }, delayMs)
    }, WAITING_GRACE_MS)
  }, [reconnectNow])

  const startAnalysisLoop = useCallback(() => {
    const analyser = analyserRef.current
    const timeData = timeDataRef.current
    const frequencyData = frequencyDataRef.current

    if (!analyser || !timeData || !frequencyData) {
      return
    }

    if (animationFrameRef.current !== null) {
      return
    }

    setResourceDiagnostics((previous) => ({
      ...previous,
      analysisLoopsStarted: previous.analysisLoopsStarted + 1,
      isAnalysisLoopRunning: true,
    }))
    publishRuntimeCounters({ activeRafChains: 1 })

    const tick = () => {
      frameCountRef.current += 1
      const frameNow = nowMs()
      const previousFrameAt = previousFrameAtRef.current
      const frameDeltaMs = previousFrameAt === null ? 16.67 : Math.max(0, frameNow - previousFrameAt)
      const frameDeltaSeconds = Math.max(1 / 240, Math.min(0.2, frameDeltaMs / 1000))
      previousFrameAtRef.current = frameNow

      analyser.getByteTimeDomainData(timeData)
      analyser.getByteFrequencyData(frequencyData)

      let sumSquares = 0
      let peak = 0
      for (let index = 0; index < timeData.length; index += 1) {
        const centered = (timeData[index] - 128) / 128
        sumSquares += centered * centered
        peak = Math.max(peak, Math.abs(centered))
      }

      const rms = finiteOrZero(Math.sqrt(sumSquares / timeData.length))
      const energy = clamp01((rms - 0.008) / 0.34)
      smoothedEnergyRef.current = smoothedEnergyRef.current * 0.86 + energy * 0.14

      const bassStart = 1
      const bassEnd = Math.max(bassStart + 1, Math.floor(frequencyData.length * 0.085))
      const midsStart = bassEnd
      const midsEnd = Math.max(midsStart + 1, Math.floor(frequencyData.length * 0.32))
      const highsStart = midsEnd
      const highsEnd = Math.max(highsStart + 1, Math.floor(frequencyData.length * 0.72))

      let bassSum = 0
      for (let i = bassStart; i < bassEnd; i += 1) {
        bassSum += frequencyData[i] / 255
      }

      let midsSum = 0
      for (let i = midsStart; i < midsEnd; i += 1) {
        midsSum += frequencyData[i] / 255
      }

      let highsSum = 0
      for (let i = highsStart; i < highsEnd; i += 1) {
        highsSum += frequencyData[i] / 255
      }

      let nonZeroBinCount = 0
      for (let i = 0; i < frequencyData.length; i += 1) {
        if ((frequencyData[i] ?? 0) > 0) {
          nonZeroBinCount += 1
        }
      }

      const bass = clamp01((bassSum / Math.max(1, bassEnd - bassStart)) * 1.12)
      const mids = clamp01(midsSum / Math.max(1, midsEnd - midsStart))
      const highs = clamp01(highsSum / Math.max(1, highsEnd - highsStart))

      const bassRise = Math.max(0, bass - previousBassRef.current)
      previousBassRef.current = bass

      const now = performance.now()
      const minKickIntervalMs = selectedBehaviorRef.current === 'fullon' ? 180 : 240
      const kickThreshold = selectedBehaviorRef.current === 'fullon' ? 0.06 : 0.075
      const acceptedKick = bassRise > kickThreshold && now - lastKickAtRef.current >= minKickIntervalMs

      if (acceptedKick) {
        lastKickAtRef.current = now
        kickAcceptedCountRef.current += 1
        kickSequenceRef.current += 1
        kickPulseRef.current = 1
      } else {
        kickPulseRef.current *= 0.86
      }

      bassPulseRef.current = bassPulseRef.current * 0.84 + bass * 0.16
      transientRef.current = transientRef.current * 0.8 + Math.max(0, energy - smoothedEnergyRef.current) * 0.2

      const rawDepthInputUnclamped = bass * 0.56 + smoothedEnergyRef.current * 0.26 + kickPulseRef.current * 0.18
      const rawDepthInput = clampFinite01(rawDepthInputUnclamped)

      const contextState = contextRef.current
        ? contextRef.current.state
        : previousContextStateRef.current === 'closed'
          ? 'closed'
          : 'not-created'

      const audio = audioRef.current
      const audioReadyState = audio?.readyState ?? 0
      const audioNetworkState = audio?.networkState ?? 0
      const audioCurrentTime = finiteOrZero(audio?.currentTime ?? 0)

      const readyStateChanged = previousReadyStateRef.current !== null && previousReadyStateRef.current !== audioReadyState
      const networkStateChanged =
        previousNetworkStateRef.current !== null && previousNetworkStateRef.current !== audioNetworkState
      const contextStateChanged =
        previousContextStateRef.current !== null && previousContextStateRef.current !== contextState

      const shouldEnterQuietGate = rms <= QUIET_GATE_ENTER_RMS && bass <= QUIET_GATE_ENTER_BASS
      const shouldExitQuietGate = rms >= QUIET_GATE_EXIT_RMS || bass >= QUIET_GATE_EXIT_BASS
      const wasQuietGateLatched = quietGateLatchedRef.current
      if (quietGateLatchedRef.current) {
        if (shouldExitQuietGate) {
          quietGateLatchedRef.current = false
        }
      } else if (shouldEnterQuietGate) {
        quietGateLatchedRef.current = true
      }
      const quietGateActive = quietGateLatchedRef.current

      if (adaptiveLowerBoundRef.current === null || adaptiveUpperBoundRef.current === null) {
        adaptiveLowerBoundRef.current = rawDepthInput
        adaptiveUpperBoundRef.current = rawDepthInput + STABILIZED_MIN_NORMALIZATION_RANGE
      }

      let adaptiveLower = adaptiveLowerBoundRef.current ?? rawDepthInput
      let adaptiveUpper = adaptiveUpperBoundRef.current ?? rawDepthInput + STABILIZED_MIN_NORMALIZATION_RANGE
      const lowerDelta = rawDepthInput - adaptiveLower
      const upperDelta = rawDepthInput - adaptiveUpper
      const lowerRate = lowerDelta < 0 ? BOUNDS_FOLLOW_UP_PER_SECOND : BOUNDS_FOLLOW_DOWN_PER_SECOND
      const upperRate = upperDelta > 0 ? BOUNDS_FOLLOW_UP_PER_SECOND : BOUNDS_FOLLOW_DOWN_PER_SECOND
      adaptiveLower += clamp(lowerDelta, -lowerRate * frameDeltaSeconds, lowerRate * frameDeltaSeconds)
      adaptiveUpper += clamp(upperDelta, -upperRate * frameDeltaSeconds, upperRate * frameDeltaSeconds)

      if (adaptiveUpper < adaptiveLower) {
        const midpoint = (adaptiveLower + adaptiveUpper) * 0.5
        adaptiveLower = midpoint - STABILIZED_MIN_NORMALIZATION_RANGE * 0.5
        adaptiveUpper = midpoint + STABILIZED_MIN_NORMALIZATION_RANGE * 0.5
      }

      adaptiveLowerBoundRef.current = clampFinite01(adaptiveLower)
      adaptiveUpperBoundRef.current = clampFinite01(adaptiveUpper)

      const rollingMin = Math.min(adaptiveLowerBoundRef.current, adaptiveUpperBoundRef.current)
      const rollingMax = Math.max(adaptiveLowerBoundRef.current, adaptiveUpperBoundRef.current)
      const normalizationRangeRaw = rollingMax - rollingMin
      const hasNegativeRange = normalizationRangeRaw < 0
      const normalizationRange = finiteOrZero(normalizationRangeRaw)
      const nearZeroDenominator = normalizationRange <= NORMALIZATION_NEAR_ZERO_RANGE
      const rangeUnsafe = normalizationRange < STABILIZED_MIN_NORMALIZATION_RANGE
      const normalizedCandidate = rangeUnsafe
        ? stableNormalizedDepthRef.current
        : clampFinite01((rawDepthInput - rollingMin) / normalizationRange)

      if (
        frameDeltaMs > LARGE_FRAME_GAP_MS ||
        readyStateChanged ||
        networkStateChanged ||
        contextStateChanged ||
        signalStateRef.current === 'Buffering' ||
        signalStateRef.current === 'Reconnecting' ||
        signalStateRef.current === 'Connecting' ||
        audioReadyState < 2
      ) {
        transitionGuardUntilRef.current = Math.max(
          transitionGuardUntilRef.current,
          frameNow + TRANSITION_GUARD_MS,
        )
      }

      const transitionGuardActive = frameNow < transitionGuardUntilRef.current
      const previousStableNormalized = stableNormalizedDepthRef.current

      let stabilizedNormalizedTarget = normalizedCandidate
      if (quietGateActive) {
        stabilizedNormalizedTarget = previousStableNormalized +
          (STABILIZED_NEUTRAL_DEPTH - previousStableNormalized) * clampFinite01(QUIET_DECAY_PER_SECOND * frameDeltaSeconds)
      } else if (transitionGuardActive) {
        stabilizedNormalizedTarget = previousStableNormalized +
          (STABILIZED_NEUTRAL_DEPTH - previousStableNormalized) * clampFinite01(GUARD_DECAY_PER_SECOND * frameDeltaSeconds)
      } else if (rangeUnsafe) {
        stabilizedNormalizedTarget = previousStableNormalized +
          (STABILIZED_NEUTRAL_DEPTH - previousStableNormalized) * clampFinite01(RANGE_FALLBACK_DECAY_PER_SECOND * frameDeltaSeconds)
      }

      const normalizedDepth = clampFinite01(stabilizedNormalizedTarget)
      stableNormalizedDepthRef.current = normalizedDepth

      const previousDepth = previousFinalDepthRef.current
      const depthAttackOrRelease = normalizedDepth >= previousDepth
        ? STABILIZED_ATTACK_PER_SECOND
        : STABILIZED_RELEASE_PER_SECOND
      const depthAlpha = 1 - Math.exp(-depthAttackOrRelease * frameDeltaSeconds)
      const smoothedDepthCandidate = previousDepth + (normalizedDepth - previousDepth) * depthAlpha
      const maxDeltaUp = STABILIZED_MAX_RISE_PER_SECOND * frameDeltaSeconds
      const maxDeltaDown = STABILIZED_MAX_FALL_PER_SECOND * frameDeltaSeconds
      let finalSmoothedDepth = previousDepth + clamp(
        smoothedDepthCandidate - previousDepth,
        -maxDeltaDown,
        maxDeltaUp,
      )

      const isLargeUpwardJump = finalSmoothedDepth - previousDepth >= SPIKE_REJECTION_DELTA
      if (isLargeUpwardJump) {
        pendingSpikeFrameCountRef.current += 1
        if (pendingSpikeFrameCountRef.current < SPIKE_REJECTION_FRAMES) {
          finalSmoothedDepth = previousDepth
        }
      } else {
        pendingSpikeFrameCountRef.current = 0
      }

      finalSmoothedDepth = clampFinite01(finalSmoothedDepth)
      previousFinalDepthRef.current = finalSmoothedDepth

      const hasNanOrInfinity = ![
        rms,
        peak,
        bass,
        mids,
        highs,
        rawDepthInput,
        normalizedDepth,
        finalSmoothedDepth,
        normalizationRange,
        frameDeltaMs,
        rollingMin,
        rollingMax,
      ].every((value) => Number.isFinite(value))

      const hasLargeFrameGap = frameDeltaMs > LARGE_FRAME_GAP_MS
      const nonZeroFftBinRatio = clampFinite01(nonZeroBinCount / Math.max(1, frequencyData.length))

      const sample: AnalyzerMetricSample = {
        timestampMs: frameNow,
        timeDomainRms: finiteOrZero(rms),
        timeDomainPeak: finiteOrZero(peak),
        bassEnergy: finiteOrZero(bass),
        midrangeEnergy: finiteOrZero(mids),
        trebleEnergy: finiteOrZero(highs),
        nonZeroFftBinRatio,
        nonZeroFftBinPercent: finiteOrZero(nonZeroFftBinRatio * 100),
        rawDepthInput,
        normalizedDepth,
        finalSmoothedDepth,
        rollingDepthMin: finiteOrZero(rollingMin),
        rollingDepthMax: finiteOrZero(rollingMax),
        normalizationRange: finiteOrZero(normalizationRange),
        quietGateActive,
        frameDeltaMs: finiteOrZero(frameDeltaMs),
        hasNanOrInfinity,
        hasNegativeRange,
        hasLargeFrameGap,
        audioReadyState,
        audioNetworkState,
        audioContextState: contextState,
        audioCurrentTime,
        reconnectAttemptCount: reconnectAttemptCountRef.current,
      }

      latestAnalyzerSampleRef.current = sample
      diagnosticsSamplesRef.current.push(sample)
      if (diagnosticsSamplesRef.current.length > ROLLING_SAMPLE_CAP) {
        diagnosticsSamplesRef.current.shift()
      }

      const quietGateChanged = previousQuietGateRef.current !== quietGateActive || wasQuietGateLatched !== quietGateActive
      const depthJumped = Math.abs(finalSmoothedDepth - previousDepth) >= 0.3
      const depthNearMax = normalizedDepth >= 0.95 || finalSmoothedDepth >= 0.95

      previousReadyStateRef.current = audioReadyState
      previousNetworkStateRef.current = audioNetworkState
      previousContextStateRef.current = contextState
      previousQuietGateRef.current = quietGateActive

      if (depthNearMax) {
        const likelyRawSpike = rawDepthInput > 0.7 && bass > 0.55
        createSpike(
          sample,
          likelyRawSpike ? 'raw' : 'normalization',
          likelyRawSpike ? 'raw audio spike' : 'normalization amplification',
        )
      }

      if (depthJumped) {
        createSpike(sample, 'smoothing', 'one-frame discontinuity')
      }

      if (nearZeroDenominator || hasNegativeRange) {
        createSpike(sample, 'normalization', 'near-zero denominator')
      }

      if (quietGateChanged) {
        createSpike(sample, 'normalization', 'quiet-gate transition', true)
      }

      if (readyStateChanged || networkStateChanged || contextStateChanged) {
        createSpike(sample, 'playback-state', 'playback-state transition', true)
      }

      if (hasNanOrInfinity) {
        createSpike(sample, 'validation', 'invalid numeric value')
      }

      if (hasLargeFrameGap) {
        createSpike(sample, 'validation', 'large frame-time gap')
      }

      publishDiagnostics(sample)

      const snapshot = snapshotRef.current
      snapshot.energy = energy
      snapshot.smoothedEnergy = clamp01(smoothedEnergyRef.current)
      snapshot.bass = bass
      snapshot.kickPulse = clamp01(kickPulseRef.current)
      snapshot.kickPulseAcceptedEvent = acceptedKick
      snapshot.kickPulseAcceptedEventCount = kickAcceptedCountRef.current
      snapshot.kickPulseAcceptedEventSequence = kickSequenceRef.current
      snapshot.bassPulse = clamp01(bassPulseRef.current)
      snapshot.mids = mids
      snapshot.highs = highs
      snapshot.transient = clamp01(transientRef.current * 3.2)
      snapshot.isActive = energy > 0.025
      snapshot.stabilizedDepth = finalSmoothedDepth
      snapshot.stabilizedDepthQuietGateActive = quietGateActive

      animationFrameRef.current = window.requestAnimationFrame(tick)
    }

    animationFrameRef.current = window.requestAnimationFrame(tick)
  }, [createSpike, publishDiagnostics, publishRuntimeCounters])

  const ensureAudioGraph = useCallback(async () => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    if (!contextRef.current) {
      const context = new AudioContext()
      contextRef.current = context
      setResourceDiagnostics((previous) => ({
        ...previous,
        audioContextsCreated: previous.audioContextsCreated + 1,
      }))

      const source = context.createMediaElementSource(audio)
      sourceRef.current = source
      setResourceDiagnostics((previous) => ({
        ...previous,
        sourceNodesCreated: previous.sourceNodesCreated + 1,
      }))

      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.85
      analyserRef.current = analyser
      setResourceDiagnostics((previous) => ({
        ...previous,
        analyzersCreated: previous.analyzersCreated + 1,
      }))

      source.connect(analyser)
      analyser.connect(context.destination)

      timeDataRef.current = new Uint8Array(analyser.fftSize)
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount)
    }

    startAnalysisLoop()

    if (contextRef.current.state !== 'running') {
      await contextRef.current.resume()
    }
  }, [startAnalysisLoop])

  const applyVolume = useCallback((value: number) => {
    const next = clamp01(value)
    setVolumeState(next)

    if (audioRef.current) {
      audioRef.current.volume = next
    }
  }, [])

  const applySignalSource = useCallback(
    async (nextSignal: DevSignalSourceConfiguration, startPlayback: boolean) => {
      const audio = audioRef.current
      const shouldResumePlayback =
        startPlayback || signalState === 'On Air' || signalState === 'Buffering' || signalState === 'Reconnecting'

      signalSwitchInProgressRef.current = true

      manualStopRef.current = true
      userRequestedPlaybackRef.current = false
      updateReconnectDiagnostics({
        stoppedByUser: true,
        lastEvent: 'signal-switch',
        lastEventTimestamp: Date.now(),
      })

      clearReconnectTimers()
      clearMetadataPoll()
      stopAnalysisLoop()
      resetMetadataState()

      if (audio) {
        applyStreamSourceToAudio(audio, nextSignal.streamUrl)
      }

      resetAnalyzerState()
      resetReconnectState(true, null)
      updateActiveSignal(nextSignal)
      setErrorMessage(null)

      if (!shouldResumePlayback) {
        setSignalState('Signal Off')
        signalSwitchInProgressRef.current = false
        return
      }

      manualStopRef.current = false
      userRequestedPlaybackRef.current = true
      resetReconnectState(false, null)
      setSignalState('Connecting')

      await ensureAudioGraph()
      const started = await attemptPlay('switch')
      signalSwitchInProgressRef.current = false

      if (started) {
        void ensureMetadataPolling()
      }
    },
    [
      applyStreamSourceToAudio,
      attemptPlay,
      clearMetadataPoll,
      clearReconnectTimers,
      ensureAudioGraph,
      ensureMetadataPolling,
      resetAnalyzerState,
      resetMetadataState,
      resetReconnectState,
      signalState,
      stopAnalysisLoop,
      updateActiveSignal,
      updateReconnectDiagnostics,
    ],
  )

  const selectSignalSource = useCallback(
    async (id: DevSignalSourceId) => {
      setSelectedSignalSourceId(id)

      if (id === 'custom-dev-url') {
        return
      }

      const source = findSignalSourceById(id)
      const nextSignal: DevSignalSourceConfiguration = {
        id: source.id,
        stationName: source.stationName,
        streamUrl: source.streamUrl,
        stationWebsite: source.stationWebsite,
        sourceAttribution: source.sourceAttribution,
      }

      await applySignalSource(nextSignal, false)
    },
    [applySignalSource],
  )

  const applyCustomSignalSource = useCallback(async () => {
    const normalizedUrl = normalizeCustomStreamUrl(customStreamUrlInput)
    setSelectedSignalSourceId('custom-dev-url')

    if (!normalizedUrl) {
      manualStopRef.current = true
      userRequestedPlaybackRef.current = false
      clearReconnectTimers()
      clearMetadataPoll()
      resetMetadataState()
      resetAnalyzerState()
      resetReconnectState(true, null)
      stopAnalysisLoop()

      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }

      setErrorMessage('Stream Unavailable: enter a valid HTTP(S) custom stream URL.')
      setSignalState('Stream Unavailable')
      return
    }

    const nextSignal: DevSignalSourceConfiguration = {
      id: 'custom-dev-url',
      stationName: 'Custom DEV Signal',
      streamUrl: normalizedUrl,
      stationWebsite: normalizedUrl,
      sourceAttribution: 'External development signal',
    }

    await applySignalSource(nextSignal, false)
  }, [
    applySignalSource,
    clearMetadataPoll,
    clearReconnectTimers,
    customStreamUrlInput,
    resetAnalyzerState,
    resetMetadataState,
    resetReconnectState,
    stopAnalysisLoop,
  ])

  const startSignal = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    manualStopRef.current = false
    userRequestedPlaybackRef.current = true
    updateReconnectDiagnostics({ stoppedByUser: false })
    setSignalState('Connecting')
    setErrorMessage(null)

    applyStreamSourceToAudio(audio, activeSignalRef.current.streamUrl)
    resetReconnectState(false, null)

    await ensureAudioGraph()
    const started = await attemptPlay('start')

    if (started) {
      void ensureMetadataPolling()
    }
  }, [
    applyStreamSourceToAudio,
    attemptPlay,
    ensureAudioGraph,
    ensureMetadataPolling,
    resetReconnectState,
    updateReconnectDiagnostics,
  ])

  const stopSignal = useCallback(async () => {
    manualStopRef.current = true
    userRequestedPlaybackRef.current = false
    updateReconnectDiagnostics({
      stoppedByUser: true,
      currentRetryDelayMs: null,
      lastReconnectReason: null,
    })

    clearReconnectTimers()
    clearMetadataPoll()
    resetMetadataState()
    resetAnalyzerState()
    resetReconnectState(true, null)
    stopAnalysisLoop()

    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }

    setSignalState('Signal Off')
  }, [
    clearMetadataPoll,
    clearReconnectTimers,
    resetAnalyzerState,
    resetMetadataState,
    resetReconnectState,
    stopAnalysisLoop,
    updateReconnectDiagnostics,
  ])

  const reconnectSignal = useCallback(async () => {
    manualStopRef.current = false
    userRequestedPlaybackRef.current = true
    updateReconnectDiagnostics({ stoppedByUser: false })
    await ensureAudioGraph()
    await reconnectNow('manual')
  }, [ensureAudioGraph, reconnectNow, updateReconnectDiagnostics])

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'none'
    audio.autoplay = false
    audio.loop = false
    audio.crossOrigin = 'anonymous'
    audio.src = activeSignalRef.current.streamUrl
    audio.volume = 0.72
    audioRef.current = audio

    const setEvent = (name: string) => {
      updateReconnectDiagnostics({ lastEvent: name, lastEventTimestamp: Date.now() })
    }

    const handleLoadStart = () => {
      setEvent('loadstart')
      if (!manualStopRef.current && userRequestedPlaybackRef.current) {
        setSignalState(reconnectInProgressRef.current ? 'Reconnecting' : 'Connecting')
      }
    }

    const handlePlaying = () => {
      setEvent('playing')
      setSignalState('On Air')
      setErrorMessage(null)
      reconnectInProgressRef.current = false
      resumeStableState()
    }

    const handleWaiting = () => {
      setEvent('waiting')
      if (!manualStopRef.current && userRequestedPlaybackRef.current) {
        setSignalState('Buffering')
        scheduleReconnect('waiting')
      }
    }

    const handleStalled = () => {
      setEvent('stalled')
      if (!manualStopRef.current && userRequestedPlaybackRef.current) {
        setSignalState('Buffering')
        scheduleReconnect('stalled')
      }
    }

    const handleError = () => {
      setEvent('error')
      setErrorMessage(createMediaErrorMessage(audio.error))

      if (!manualStopRef.current && userRequestedPlaybackRef.current) {
        setSignalState('Stream Unavailable')
        scheduleReconnect('error')
      }
    }

    const handlePause = () => {
      setEvent('pause')
      if (!manualStopRef.current && userRequestedPlaybackRef.current) {
        setSignalState('Buffering')
      }
    }

    const handleEnded = () => {
      setEvent('ended')
      if (!manualStopRef.current && userRequestedPlaybackRef.current) {
        setSignalState('Stream Unavailable')
        scheduleReconnect('ended')
      }
    }

    const listeners: Array<[keyof HTMLMediaElementEventMap, EventListener]> = [
      ['loadstart', handleLoadStart],
      ['playing', handlePlaying],
      ['waiting', handleWaiting],
      ['stalled', handleStalled],
      ['error', handleError],
      ['pause', handlePause],
      ['ended', handleEnded],
    ]

    listeners.forEach(([eventName, callback]) => {
      audio.addEventListener(eventName, callback)
      audioEventCleanupRef.current.push(() => {
        audio.removeEventListener(eventName, callback)
      })
    })

    const handleOnline = () => {
      updateReconnectDiagnostics({ browserOnline: true })
      if (!manualStopRef.current && userRequestedPlaybackRef.current) {
        void reconnectNow('online-event')
      }
    }

    const handleOffline = () => {
      updateReconnectDiagnostics({ browserOnline: false })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)

      clearReconnectTimers()
      clearMetadataPoll()
      stopAnalysisLoop()

      audioEventCleanupRef.current.forEach((cleanup) => cleanup())
      audioEventCleanupRef.current = []

      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null

      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect()
        } catch {
          // Node may already be disconnected.
        }
      }

      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect()
        } catch {
          // Node may already be disconnected.
        }
      }

      sourceRef.current = null
      analyserRef.current = null
      timeDataRef.current = null
      frequencyDataRef.current = null

      if (contextRef.current) {
        void contextRef.current.close()
      }
      contextRef.current = null
      previousContextStateRef.current = 'closed'
    }
  }, [clearMetadataPoll, clearReconnectTimers, reconnectNow, resumeStableState, scheduleReconnect, stopAnalysisLoop, updateReconnectDiagnostics])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const canStart = signalState === 'Signal Off' || signalState === 'Stream Unavailable'
  const canStop = signalState !== 'Signal Off'
  const canReconnect = signalState !== 'Signal Off'

  const averageFrequencyEnergy = clampFinite01(
    (analyzerDiagnostics.latest.bassEnergy +
      analyzerDiagnostics.latest.midrangeEnergy +
      analyzerDiagnostics.latest.trebleEnergy) /
      3,
  )

  const analyzerAssessment =
    analyzerDiagnostics.latest.hasNanOrInfinity ||
    analyzerDiagnostics.latest.hasNegativeRange ||
    analyzerDiagnostics.latest.hasLargeFrameGap
      ? 'Validation warning'
      : analyzerDiagnostics.latest.timeDomainRms > 0.02 && analyzerDiagnostics.latest.nonZeroFftBinRatio > 0.1
        ? 'Reactive'
        : signalState === 'Signal Off'
          ? 'Idle'
          : 'Low signal'

  return useMemo(() => {
    return {
      streamUrl: activeSignal.streamUrl,
      stationName: activeSignal.stationName,
      stationWebsite: activeSignal.stationWebsite,
      stationAttribution: activeSignal.sourceAttribution,
      signalState,
      isPlaying: signalState === 'On Air' || signalState === 'Buffering' || signalState === 'Reconnecting',
      canStart,
      canStop,
      canReconnect,
      volume,
      setVolume: applyVolume,
      selectedBehavior,
      setSelectedBehavior,
      motionEnabled,
      setMotionEnabled,
      visualFeedOpen,
      setVisualFeedOpen,
      selectedThemeId,
      setSelectedThemeId,
      signalSources: DEV_SIGNAL_SOURCES,
      selectedSignalSourceId,
      customStreamUrlInput,
      setCustomStreamUrlInput,
      selectSignalSource,
      applyCustomSignalSource,
      startSignal,
      stopSignal,
      reconnectSignal,
      getLatestAudioSnapshot,
      metadata,
      metadataProbeResults,
      reconnectDiagnostics,
      analyzerDiagnostics,
      comparisonReadout: {
        selectedStation: activeSignal.stationName,
        streamUrl: activeSignal.streamUrl,
        playbackStatus: signalState,
        analyzerAssessment,
        liveRms: analyzerDiagnostics.latest.timeDomainRms,
        averageFrequencyEnergy,
        audioContextState: analyzerDiagnostics.latest.audioContextState,
        elapsedCurrentTime: analyzerDiagnostics.latest.audioCurrentTime,
        reconnectAttempts: reconnectDiagnostics.reconnectAttemptCount,
      },
      resourceDiagnostics,
      memoryDiagnostics,
      runtimeCounters,
      errorMessage,
    }
  }, [
    activeSignal,
    analyzerDiagnostics,
    analyzerAssessment,
    applyCustomSignalSource,
    applyVolume,
    averageFrequencyEnergy,
    canReconnect,
    canStart,
    canStop,
    customStreamUrlInput,
    errorMessage,
    getLatestAudioSnapshot,
    metadata,
    metadataProbeResults,
    memoryDiagnostics,
    motionEnabled,
    reconnectDiagnostics,
    reconnectSignal,
    resourceDiagnostics,
    runtimeCounters,
    selectSignalSource,
    selectedSignalSourceId,
    selectedBehavior,
    selectedThemeId,
    setCustomStreamUrlInput,
    signalState,
    startSignal,
    stopSignal,
    visualFeedOpen,
    volume,
  ])
}
