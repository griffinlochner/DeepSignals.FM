/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/immutability */
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AudioAnalysisGraphDetails,
  AudioAnalysisStatus,
  AudioPlaybackStatus,
  AudioReactiveSnapshot,
} from './playerTypes'

type UseAudioAnalysisArgs = {
  audioElement: HTMLAudioElement | null
  playbackStatus: AudioPlaybackStatus
  isSeeking: boolean
  audioSourceId: string | null
  sourceBpm: number | null
  publishDiagnostics: boolean
}

type BassPulseDebugReadout = {
  fastBass: number
  slowBass: number
  bassDelta: number
  fastEnergy: number
  slowEnergy: number
  energyDelta: number
  combinedCandidate: number
  postThresholdCandidate: number
  threshold: number
  warmupActive: boolean
  warmupRemainingMs: number
  warmupFramesRemaining: number
  cooldownRemainingMs: number
}

type KickPulseDebugReadout = {
  lowBandSpectralFlux: number
  positiveEnergyRise: number
  combinedCandidate: number
  adaptiveBaseline: number
  adaptiveThreshold: number
  postThresholdCandidate: number
  acceptedKickEvent: boolean
  acceptedKickEventCount: number
  warmupActive: boolean
  warmupRemainingMs: number
  warmupFramesRemaining: number
  cooldownRemainingMs: number
}

type UseAudioAnalysisResult = {
  status: AudioAnalysisStatus
  snapshot: AudioReactiveSnapshot
  bassPulseDebug: BassPulseDebugReadout
  kickPulseDebug: KickPulseDebugReadout
  graphDetails: AudioAnalysisGraphDetails
  errorMessage: string | null
  requestInitializationFromUserGesture: () => Promise<void>
  getLatestSnapshot: () => AudioReactiveSnapshot
  analysisCalculationMode: 'requestAnimationFrame'
  diagnosticsPublishHz: number
}

type FrequencyBandRanges = {
  bass: { start: number; end: number }
  kick: { start: number; end: number }
  mids: { start: number; end: number }
  highs: { start: number; end: number }
}

type EnvelopeState = {
  bass: number
  mids: number
  highs: number
  energy: number
  smoothedEnergy: number
  bassPulseFastBass: number
  bassPulseSlowBass: number
  bassPulseFastEnergy: number
  bassPulseSlowEnergy: number
  bassPulse: number
  bassPulseCooldownMs: number
  kickPulseFastCandidate: number
  kickPulseSlowCandidate: number
  kickPulseFastEnergy: number
  kickPulseSlowEnergy: number
  kickPulse: number
  kickPulseCooldownMs: number
  transientFast: number
  transientSlow: number
  transient: number
  transientCooldownMs: number
}
type AnalysisGraph = {
  context: AudioContext
  source: MediaElementAudioSourceNode
  analyser: AnalyserNode
  frequencyData: Float32Array
  timeDomainData: Float32Array
  bandRanges: FrequencyBandRanges
  onContextStateChange: () => void
}

const ANALYSIS_PUBLISH_HZ = 20
const ANALYSIS_PUBLISH_INTERVAL_MS = 1000 / ANALYSIS_PUBLISH_HZ

const ANALYSER_CONFIG = {
  fftSize: 2048,
  smoothingTimeConstant: 0.76,
  minDecibels: -92,
  maxDecibels: -12,
} as const

const BAND_LIMITS_HZ = {
  bassLow: 20,
  bassHigh: 180,
  kickLow: 30,
  kickHigh: 220,
  midsLow: 180,
  midsHigh: 2000,
  highsLow: 2000,
  highsHigh: 10000,
} as const

const ENVELOPE_CONFIG = {
  energyAttack: 0.34,
  energyRelease: 0.08,
  smoothedAttack: 0.2,
  smoothedRelease: 0.04,
  bandAttack: 0.3,
  bandRelease: 0.07,
  transientFastAttack: 0.48,
  transientFastRelease: 0.16,
  transientSlowAttack: 0.08,
  transientSlowRelease: 0.025,
  transientDecay: 0.18,
} as const

const TRANSIENT_CONFIG = {
  threshold: 0.12,
  gain: 3.6,
  cooldownMs: 95,
} as const

const BASS_PULSE_CONFIG = {
  fastBassAttack: 0.5,
  fastBassRelease: 0.16,
  slowBassAttack: 0.05,
  slowBassRelease: 0.018,
  fastEnergyAttack: 0.42,
  fastEnergyRelease: 0.18,
  slowEnergyAttack: 0.07,
  slowEnergyRelease: 0.028,
  bassWeight: 0.82,
  energyWeight: 0.18,
  threshold: 0.015,
  gain: 9.0,
  cooldownMs: 150,
  decay: 0.18,
} as const

const KICK_PULSE_CONFIG = {
  fluxWeight: 0.82,
  energyWeight: 0.18,
  fluxGain: 9.5,
  energyRiseGain: 6.5,
  candidateFloor: 0.018,
  adaptiveBaselineAttack: 0.14,
  adaptiveBaselineRelease: 0.032,
  adaptiveThresholdOffset: 0.045,
  adaptiveThresholdGain: 1.02,
  attack: 0.78,
  release: 0.16,
  cooldownMs: 205,
  fallbackMinimumAcceptedIntervalMs: 300,
  bpmMinimumIntervalRatio: 0.78,
  quietEnergyLevelFloor: 0.22,
  quietEnergyThresholdBoostMax: 0.045,
} as const

const ONSET_WARMUP_DURATION_MS = 480
const ONSET_WARMUP_MIN_FRAMES = 8

const ZERO_SNAPSHOT: AudioReactiveSnapshot = {
  energy: 0,
  smoothedEnergy: 0,
  bass: 0,
  kickPulse: 0,
  kickPulseAcceptedEvent: false,
  kickPulseAcceptedEventCount: 0,
  bassPulse: 0,
  mids: 0,
  highs: 0,
  transient: 0,
  isActive: false,
}

const ZERO_BASS_PULSE_DEBUG: BassPulseDebugReadout = {
  fastBass: 0,
  slowBass: 0,
  bassDelta: 0,
  fastEnergy: 0,
  slowEnergy: 0,
  energyDelta: 0,
  combinedCandidate: 0,
  postThresholdCandidate: 0,
  threshold: BASS_PULSE_CONFIG.threshold,
  warmupActive: false,
  warmupRemainingMs: 0,
  warmupFramesRemaining: 0,
  cooldownRemainingMs: 0,
}

const ZERO_KICK_PULSE_DEBUG: KickPulseDebugReadout = {
  lowBandSpectralFlux: 0,
  positiveEnergyRise: 0,
  combinedCandidate: 0,
  adaptiveBaseline: 0,
  adaptiveThreshold: 0,
  postThresholdCandidate: 0,
  acceptedKickEvent: false,
  acceptedKickEventCount: 0,
  warmupActive: false,
  warmupRemainingMs: 0,
  warmupFramesRemaining: 0,
  cooldownRemainingMs: 0,
}

const EMPTY_GRAPH_DETAILS: AudioAnalysisGraphDetails = {
  contextState: null,
  sampleRate: null,
  fftSize: null,
  frequencyBinCount: null,
  smoothingTimeConstant: null,
  minDecibels: null,
  maxDecibels: null,
}

const EMPTY_ENVELOPES: EnvelopeState = {
  bass: 0,
  mids: 0,
  highs: 0,
  energy: 0,
  smoothedEnergy: 0,
  bassPulseFastBass: 0,
  bassPulseSlowBass: 0,
  bassPulseFastEnergy: 0,
  bassPulseSlowEnergy: 0,
  bassPulse: 0,
  bassPulseCooldownMs: 0,
  kickPulseFastCandidate: 0,
  kickPulseSlowCandidate: 0,
  kickPulseFastEnergy: 0,
  kickPulseSlowEnergy: 0,
  kickPulse: 0,
  kickPulseCooldownMs: 0,
  transientFast: 0,
  transientSlow: 0,
  transient: 0,
  transientCooldownMs: 0,
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(1, Math.max(0, value))
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(max, Math.max(min, value))
}

function resolveBeatIntervalMs(sourceBpm: number | null) {
  if (!Number.isFinite(sourceBpm) || sourceBpm === null || sourceBpm <= 0) {
    return null
  }

  return 60000 / sourceBpm
}

function resolveKickMinimumAcceptedIntervalMs(sourceBpm: number | null) {
  const beatIntervalMs = resolveBeatIntervalMs(sourceBpm)

  if (!beatIntervalMs) {
    return KICK_PULSE_CONFIG.fallbackMinimumAcceptedIntervalMs
  }

  const scaled = beatIntervalMs * KICK_PULSE_CONFIG.bpmMinimumIntervalRatio
  return clamp(scaled, beatIntervalMs * 0.72, beatIntervalMs * 0.82)
}

function normalizeDb(value: number, minDecibels: number, maxDecibels: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  const range = maxDecibels - minDecibels

  if (!Number.isFinite(range) || range <= 0) {
    return 0
  }

  return clamp01((value - minDecibels) / range)
}

function computeBandRange(
  lowHz: number,
  highHz: number,
  sampleRate: number,
  fftSize: number,
  frequencyBinCount: number,
) {
  const nyquist = sampleRate / 2
  const clampedLow = Math.max(0, Math.min(lowHz, nyquist))
  const clampedHigh = Math.max(clampedLow, Math.min(highHz, nyquist))
  const hzPerBin = sampleRate / fftSize

  const start = Math.max(0, Math.min(frequencyBinCount - 1, Math.floor(clampedLow / hzPerBin)))
  const end = Math.max(start, Math.min(frequencyBinCount - 1, Math.ceil(clampedHigh / hzPerBin)))

  return { start, end }
}

function averageNormalizedBand(
  frequencyData: Float32Array,
  range: { start: number; end: number },
  minDecibels: number,
  maxDecibels: number,
) {
  let sum = 0
  let count = 0

  for (let index = range.start; index <= range.end; index += 1) {
    sum += normalizeDb(frequencyData[index] ?? minDecibels, minDecibels, maxDecibels)
    count += 1
  }

  if (count <= 0) {
    return 0
  }

  const average = sum / count

  // Slightly emphasize stronger musical passages without hard clipping.
  return clamp01(Math.pow(average, 1.18))
}

function calculateRms(timeData: Float32Array) {
  let sumSquares = 0

  for (let index = 0; index < timeData.length; index += 1) {
    const sample = timeData[index] ?? 0
    sumSquares += sample * sample
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, timeData.length))

  // Subtract a tiny noise floor and scale into a usable 0..1 musical envelope range.
  return clamp01((rms - 0.01) / 0.35)
}

function calculatePositiveSpectralFlux(
  currentFrequencyData: Float32Array,
  previousFrequencyData: Float32Array,
  range: { start: number; end: number },
  minDecibels: number,
  maxDecibels: number,
) {
  let sum = 0
  let count = 0

  for (let index = range.start; index <= range.end; index += 1) {
    const current = normalizeDb(currentFrequencyData[index] ?? minDecibels, minDecibels, maxDecibels)
    const previous = normalizeDb(previousFrequencyData[index] ?? minDecibels, minDecibels, maxDecibels)
    sum += Math.max(0, current - previous)
    count += 1
  }

  if (count <= 0) {
    return 0
  }

  return clamp01((sum / count) * 10)
}

function applyEnvelope(current: number, target: number, attack: number, release: number, frameScale: number) {
  const isRising = target > current
  const base = isRising ? attack : release
  const coefficient = 1 - Math.pow(1 - base, frameScale)

  return current + (target - current) * coefficient
}

function snapshotNearZero(snapshot: AudioReactiveSnapshot) {
  return (
    snapshot.energy < 0.002 &&
    snapshot.smoothedEnergy < 0.002 &&
    snapshot.bass < 0.002 &&
    snapshot.kickPulse < 0.002 &&
    snapshot.bassPulse < 0.002 &&
    snapshot.mids < 0.002 &&
    snapshot.highs < 0.002 &&
    snapshot.transient < 0.002
  )
}

function getDocumentVisible() {
  if (typeof document === 'undefined') {
    return true
  }

  return document.visibilityState === 'visible'
}

export function useAudioAnalysis({ audioElement, playbackStatus, isSeeking, audioSourceId, sourceBpm, publishDiagnostics }: UseAudioAnalysisArgs): UseAudioAnalysisResult {
  const [status, setStatus] = useState<AudioAnalysisStatus>(audioElement ? 'paused' : 'unavailable')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<AudioReactiveSnapshot>(ZERO_SNAPSHOT)
  const [bassPulseDebug, setBassPulseDebug] = useState<BassPulseDebugReadout>(ZERO_BASS_PULSE_DEBUG)
  const [kickPulseDebug, setKickPulseDebug] = useState<KickPulseDebugReadout>(ZERO_KICK_PULSE_DEBUG)
  const [graphDetails, setGraphDetails] = useState<AudioAnalysisGraphDetails>(EMPTY_GRAPH_DETAILS)
  const [documentVisible, setDocumentVisible] = useState(() => getDocumentVisible())

  const graphRef = useRef<AnalysisGraph | null>(null)
  const connectedElementRef = useRef<HTMLAudioElement | null>(null)
  const snapshotRef = useRef<AudioReactiveSnapshot>(ZERO_SNAPSHOT)
  const envelopesRef = useRef<EnvelopeState>(EMPTY_ENVELOPES)
  const previousFrequencyDataRef = useRef<Float32Array | null>(null)
  const previousKickPulseCandidateRef = useRef<number>(0)
  const analysisRafRef = useRef<number | null>(null)
  const decayRafRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const lastPublishTimeRef = useRef<number>(0)
  const lastAudioTimeRef = useRef<number | null>(null)
  const bassPulseDebugRef = useRef<BassPulseDebugReadout>(ZERO_BASS_PULSE_DEBUG)
  const kickPulseDebugRef = useRef<KickPulseDebugReadout>(ZERO_KICK_PULSE_DEBUG)
  const previousPlaybackStatusRef = useRef<AudioPlaybackStatus>(playbackStatus)
  const previousIsSeekingRef = useRef<boolean>(isSeeking)
  const onsetWarmupUntilRef = useRef<number>(0)
  const onsetWarmupFrameCountRef = useRef<number>(0)
  const kickPulseEventCountRef = useRef<number>(0)
  const lastAcceptedKickAtMsRef = useRef<number>(-Infinity)

  const shouldAnalyze =
    playbackStatus === 'playing' &&
    documentVisible &&
    status !== 'error' &&
    status !== 'initializing' &&
    graphRef.current !== null &&
    graphRef.current.context.state === 'running'

  const stopAnalysisLoop = useCallback(() => {
    if (analysisRafRef.current !== null) {
      window.cancelAnimationFrame(analysisRafRef.current)
      analysisRafRef.current = null
    }

    lastFrameTimeRef.current = null
    lastAudioTimeRef.current = null
  }, [])

  const stopDecayLoop = useCallback(() => {
    if (decayRafRef.current !== null) {
      window.cancelAnimationFrame(decayRafRef.current)
      decayRafRef.current = null
    }
  }, [])

  const publishSnapshot = useCallback(
    (
      nextSnapshot: AudioReactiveSnapshot,
      nextBassPulseDebug: BassPulseDebugReadout,
      nextKickPulseDebug: KickPulseDebugReadout,
      nowMs: number,
      force = false,
    ) => {
      snapshotRef.current = nextSnapshot
      bassPulseDebugRef.current = nextBassPulseDebug
      kickPulseDebugRef.current = nextKickPulseDebug

      if (!publishDiagnostics) {
        return
      }

      if (!force && nowMs - lastPublishTimeRef.current < ANALYSIS_PUBLISH_INTERVAL_MS) {
        return
      }

      lastPublishTimeRef.current = nowMs
      setSnapshot(nextSnapshot)
      setBassPulseDebug(nextBassPulseDebug)
      setKickPulseDebug(nextKickPulseDebug)
    },
    [publishDiagnostics],
  )

  const activateOnsetWarmup = useCallback(() => {
    onsetWarmupUntilRef.current = performance.now() + ONSET_WARMUP_DURATION_MS
    onsetWarmupFrameCountRef.current = 0
    envelopesRef.current = {
      ...envelopesRef.current,
      bassPulseFastBass: 0,
      bassPulseSlowBass: 0,
      bassPulseFastEnergy: 0,
      bassPulseSlowEnergy: 0,
      bassPulse: 0,
      bassPulseCooldownMs: 0,
      kickPulseFastCandidate: 0,
      kickPulseSlowCandidate: 0,
      kickPulseFastEnergy: 0,
      kickPulseSlowEnergy: 0,
      kickPulse: 0,
      kickPulseCooldownMs: 0,
      transientFast: 0,
      transientSlow: 0,
      transient: 0,
      transientCooldownMs: 0,
    }
  }, [])

  const zeroSnapshotNow = useCallback(
    (force = false) => {
      const zero = {
        ...ZERO_SNAPSHOT,
        isActive: false,
      }

      envelopesRef.current = EMPTY_ENVELOPES
      previousFrequencyDataRef.current = null
      previousKickPulseCandidateRef.current = 0
      kickPulseEventCountRef.current = 0
      lastAcceptedKickAtMsRef.current = -Infinity
      onsetWarmupUntilRef.current = 0
      onsetWarmupFrameCountRef.current = 0
      lastAudioTimeRef.current = null
      bassPulseDebugRef.current = ZERO_BASS_PULSE_DEBUG
      kickPulseDebugRef.current = ZERO_KICK_PULSE_DEBUG
      if (publishDiagnostics) {
        setBassPulseDebug(ZERO_BASS_PULSE_DEBUG)
        setKickPulseDebug(ZERO_KICK_PULSE_DEBUG)
      }
      publishSnapshot(zero, ZERO_BASS_PULSE_DEBUG, ZERO_KICK_PULSE_DEBUG, performance.now(), force)
    },
    [publishDiagnostics, publishSnapshot],
  )

  const teardownGraph = useCallback(
    async (closeContext: boolean) => {
      stopAnalysisLoop()
      stopDecayLoop()

      const graph = graphRef.current
      graphRef.current = null
      previousFrequencyDataRef.current = null
      previousKickPulseCandidateRef.current = 0
      kickPulseEventCountRef.current = 0
      lastAcceptedKickAtMsRef.current = -Infinity

      if (graph) {
        graph.context.removeEventListener('statechange', graph.onContextStateChange)

        try {
          graph.source.disconnect()
        } catch {
          // Ignore disconnect cleanup errors.
        }

        try {
          graph.analyser.disconnect()
        } catch {
          // Ignore disconnect cleanup errors.
        }

        if (closeContext) {
          try {
            await graph.context.close()
          } catch {
            // Ignore context close failures during teardown.
          }
        }
      }

      connectedElementRef.current = null
      setGraphDetails(EMPTY_GRAPH_DETAILS)
    },
    [stopAnalysisLoop, stopDecayLoop],
  )

  const getLatestSnapshot = useCallback(() => snapshotRef.current, [])

  const requestInitializationFromUserGesture = useCallback(async () => {
    if (!audioElement) {
      setStatus('unavailable')
      return
    }

    setErrorMessage(null)

    if (connectedElementRef.current && connectedElementRef.current !== audioElement) {
      await teardownGraph(true)
      zeroSnapshotNow(true)
      activateOnsetWarmup()
    }

    let graph = graphRef.current

    if (!graph) {
      setStatus('initializing')

      try {
        const context = new AudioContext()
        const source = context.createMediaElementSource(audioElement)
        const analyser = context.createAnalyser()

        analyser.fftSize = ANALYSER_CONFIG.fftSize
        analyser.smoothingTimeConstant = ANALYSER_CONFIG.smoothingTimeConstant
        analyser.minDecibels = ANALYSER_CONFIG.minDecibels
        analyser.maxDecibels = ANALYSER_CONFIG.maxDecibels

        source.connect(analyser)
        analyser.connect(context.destination)

        const frequencyBinCount = analyser.frequencyBinCount

        const bandRanges: FrequencyBandRanges = {
          bass: computeBandRange(
            BAND_LIMITS_HZ.bassLow,
            BAND_LIMITS_HZ.bassHigh,
            context.sampleRate,
            analyser.fftSize,
            frequencyBinCount,
          ),
          kick: computeBandRange(
            BAND_LIMITS_HZ.kickLow,
            BAND_LIMITS_HZ.kickHigh,
            context.sampleRate,
            analyser.fftSize,
            frequencyBinCount,
          ),
          mids: computeBandRange(
            BAND_LIMITS_HZ.midsLow,
            BAND_LIMITS_HZ.midsHigh,
            context.sampleRate,
            analyser.fftSize,
            frequencyBinCount,
          ),
          highs: computeBandRange(
            BAND_LIMITS_HZ.highsLow,
            BAND_LIMITS_HZ.highsHigh,
            context.sampleRate,
            analyser.fftSize,
            frequencyBinCount,
          ),
        }

        const onContextStateChange = () => {
          setGraphDetails((current) => ({
            ...current,
            contextState: context.state,
          }))

          if (context.state === 'suspended') {
            setStatus('suspended')
            return
          }

          if (context.state === 'running') {
            setStatus(playbackStatus === 'playing' && getDocumentVisible() ? 'running' : 'paused')
            return
          }

          if (context.state === 'closed') {
            setStatus('unavailable')
          }
        }

        context.addEventListener('statechange', onContextStateChange)

        graph = {
          context,
          source,
          analyser,
          frequencyData: new Float32Array(frequencyBinCount),
          timeDomainData: new Float32Array(analyser.fftSize),
          bandRanges,
          onContextStateChange,
        }

        graphRef.current = graph
        previousFrequencyDataRef.current = new Float32Array(frequencyBinCount)
        connectedElementRef.current = audioElement
        activateOnsetWarmup()

        setGraphDetails({
          contextState: context.state,
          sampleRate: context.sampleRate,
          fftSize: analyser.fftSize,
          frequencyBinCount,
          smoothingTimeConstant: analyser.smoothingTimeConstant,
          minDecibels: analyser.minDecibels,
          maxDecibels: analyser.maxDecibels,
        })
      } catch (error) {
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'Audio analysis initialization failed.')
        return
      }
    }

    if (!graph) {
      setStatus('error')
      setErrorMessage('Audio analysis graph is unavailable.')
      return
    }

    try {
      if (graph.context.state === 'suspended') {
        await graph.context.resume()
      }

      activateOnsetWarmup()

      if (graph.context.state === 'running') {
        setStatus(playbackStatus === 'playing' && documentVisible ? 'running' : 'paused')
      } else if (graph.context.state === 'suspended') {
        setStatus('suspended')
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Audio analysis resume failed.')
    }
  }, [activateOnsetWarmup, audioElement, documentVisible, playbackStatus, teardownGraph, zeroSnapshotNow])

  const runAnalysisFrame = useCallback(
    (nowMs: number) => {
      const graph = graphRef.current

      if (!graph) {
        analysisRafRef.current = null
        return
      }

      if (
        playbackStatus !== 'playing' ||
        !documentVisible ||
        graph.context.state !== 'running'
      ) {
        analysisRafRef.current = null
        return
      }

      const previousFrameTime = lastFrameTimeRef.current ?? nowMs
      const deltaMs = Math.max(8, Math.min(64, nowMs - previousFrameTime))
      const frameScale = Math.max(0.35, Math.min(3.2, deltaMs / 16.67))
      lastFrameTimeRef.current = nowMs

      const activeAudioElement = connectedElementRef.current
      const currentAudioTime = activeAudioElement ? activeAudioElement.currentTime : null

      if (
        currentAudioTime !== null &&
        Number.isFinite(currentAudioTime) &&
        lastAudioTimeRef.current !== null
      ) {
        const expectedDeltaSeconds = deltaMs / 1000
        const actualDeltaSeconds = currentAudioTime - lastAudioTimeRef.current
        const discontinuity = Math.abs(actualDeltaSeconds - expectedDeltaSeconds)

        if (discontinuity > 0.35) {
          activateOnsetWarmup()
        }
      }

      if (currentAudioTime !== null && Number.isFinite(currentAudioTime)) {
        lastAudioTimeRef.current = currentAudioTime
      }

      graph.analyser.getFloatFrequencyData(graph.frequencyData as Float32Array<ArrayBuffer>)
      graph.analyser.getFloatTimeDomainData(graph.timeDomainData as Float32Array<ArrayBuffer>)
      const previousFrequencyData = previousFrequencyDataRef.current

      const bassRaw = averageNormalizedBand(
        graph.frequencyData,
        graph.bandRanges.bass,
        graph.analyser.minDecibels,
        graph.analyser.maxDecibels,
      )
      const kickLowBandFlux = previousFrequencyData
        ? calculatePositiveSpectralFlux(
            graph.frequencyData,
            previousFrequencyData,
            graph.bandRanges.kick,
            graph.analyser.minDecibels,
            graph.analyser.maxDecibels,
          )
        : 0
      const midsRaw = averageNormalizedBand(
        graph.frequencyData,
        graph.bandRanges.mids,
        graph.analyser.minDecibels,
        graph.analyser.maxDecibels,
      )
      const highsRaw = averageNormalizedBand(
        graph.frequencyData,
        graph.bandRanges.highs,
        graph.analyser.minDecibels,
        graph.analyser.maxDecibels,
      )

      const rmsEnergy = calculateRms(graph.timeDomainData)
      const broadBandEnergy = (bassRaw + midsRaw + highsRaw) / 3
      const combinedEnergy = clamp01(rmsEnergy * 0.65 + broadBandEnergy * 0.35)

      const envelopes = envelopesRef.current
      const bass = applyEnvelope(envelopes.bass, bassRaw, ENVELOPE_CONFIG.bandAttack, ENVELOPE_CONFIG.bandRelease, frameScale)
      const mids = applyEnvelope(envelopes.mids, midsRaw, ENVELOPE_CONFIG.bandAttack, ENVELOPE_CONFIG.bandRelease, frameScale)
      const highs = applyEnvelope(envelopes.highs, highsRaw, ENVELOPE_CONFIG.bandAttack, ENVELOPE_CONFIG.bandRelease, frameScale)
      const energy = applyEnvelope(envelopes.energy, combinedEnergy, ENVELOPE_CONFIG.energyAttack, ENVELOPE_CONFIG.energyRelease, frameScale)
      const smoothedEnergy = applyEnvelope(
        envelopes.smoothedEnergy,
        energy,
        ENVELOPE_CONFIG.smoothedAttack,
        ENVELOPE_CONFIG.smoothedRelease,
        frameScale,
      )

      const bassPulseFastBass = applyEnvelope(
        envelopes.bassPulseFastBass,
        bass,
        BASS_PULSE_CONFIG.fastBassAttack,
        BASS_PULSE_CONFIG.fastBassRelease,
        frameScale,
      )
      const bassPulseSlowBass = applyEnvelope(
        envelopes.bassPulseSlowBass,
        bass,
        BASS_PULSE_CONFIG.slowBassAttack,
        BASS_PULSE_CONFIG.slowBassRelease,
        frameScale,
      )
      const bassPulseFastEnergy = applyEnvelope(
        envelopes.bassPulseFastEnergy,
        energy,
        BASS_PULSE_CONFIG.fastEnergyAttack,
        BASS_PULSE_CONFIG.fastEnergyRelease,
        frameScale,
      )
      const bassPulseSlowEnergy = applyEnvelope(
        envelopes.bassPulseSlowEnergy,
        smoothedEnergy,
        BASS_PULSE_CONFIG.slowEnergyAttack,
        BASS_PULSE_CONFIG.slowEnergyRelease,
        frameScale,
      )

      const bassDelta = Math.max(0, bassPulseFastBass - bassPulseSlowBass)
      const energyDelta = Math.max(0, bassPulseFastEnergy - bassPulseSlowEnergy)
      const bassPulseCombined =
        bassDelta * BASS_PULSE_CONFIG.bassWeight +
        energyDelta * BASS_PULSE_CONFIG.energyWeight
      const bassPulseCandidate = clamp01(
        (bassPulseCombined - BASS_PULSE_CONFIG.threshold) * BASS_PULSE_CONFIG.gain,
      )

      const bassPulseCooldownNext = Math.max(0, envelopes.bassPulseCooldownMs - deltaMs)
      const warmupTimeRemainingMs = Math.max(0, onsetWarmupUntilRef.current - nowMs)
      const warmupFramesRemaining = Math.max(0, ONSET_WARMUP_MIN_FRAMES - onsetWarmupFrameCountRef.current)
      const bassPulseWarmupActive = warmupTimeRemainingMs > 0 || warmupFramesRemaining > 0
      if (bassPulseWarmupActive) {
        onsetWarmupFrameCountRef.current += 1
      }
      
      const kickFastEnergy = applyEnvelope(
        envelopes.kickPulseFastEnergy,
        combinedEnergy,
        0.52,
        0.16,
        frameScale,
      )
      const kickSlowEnergy = applyEnvelope(
        envelopes.kickPulseSlowEnergy,
        combinedEnergy,
        0.08,
        0.028,
        frameScale,
      )
      const positiveEnergyRise = Math.max(0, kickFastEnergy - kickSlowEnergy)
      const lowBandFluxScaled = clamp01(kickLowBandFlux * KICK_PULSE_CONFIG.fluxGain)
      const kickCombinedCandidate = clamp01(
        lowBandFluxScaled * KICK_PULSE_CONFIG.fluxWeight + positiveEnergyRise * KICK_PULSE_CONFIG.energyWeight,
      )
      const kickAdaptiveBaseline = applyEnvelope(
        envelopes.kickPulseSlowCandidate,
        kickCombinedCandidate,
        KICK_PULSE_CONFIG.adaptiveBaselineAttack,
        KICK_PULSE_CONFIG.adaptiveBaselineRelease,
        frameScale,
      )
      const kickAdaptiveThreshold = clamp01(
        kickAdaptiveBaseline * KICK_PULSE_CONFIG.adaptiveThresholdGain + KICK_PULSE_CONFIG.adaptiveThresholdOffset,
      )
      const quietEnergySuppression = clamp01(
        (KICK_PULSE_CONFIG.quietEnergyLevelFloor - smoothedEnergy) / KICK_PULSE_CONFIG.quietEnergyLevelFloor,
      )
      const quietThresholdBoost = quietEnergySuppression * KICK_PULSE_CONFIG.quietEnergyThresholdBoostMax
      const kickFinalThreshold = clamp01(kickAdaptiveThreshold + quietThresholdBoost)
      const kickPostThresholdCandidate = clamp01(
        (kickCombinedCandidate - kickFinalThreshold) * KICK_PULSE_CONFIG.energyRiseGain,
      )
      const kickPulseWarmupActive = bassPulseWarmupActive
      const kickCooldownNext = Math.max(0, envelopes.kickPulseCooldownMs - deltaMs)
      const kickMinimumAcceptedIntervalMs = resolveKickMinimumAcceptedIntervalMs(sourceBpm)
      const millisecondsSinceLastAcceptedKick = nowMs - lastAcceptedKickAtMsRef.current
      const kickMinimumIntervalSatisfied = millisecondsSinceLastAcceptedKick >= kickMinimumAcceptedIntervalMs
      const crossedThresholdEdge =
        kickCombinedCandidate > kickFinalThreshold &&
        previousKickPulseCandidateRef.current <= kickFinalThreshold
      const kickAcceptedEvent =
        !kickPulseWarmupActive &&
        crossedThresholdEdge &&
        kickCombinedCandidate > previousKickPulseCandidateRef.current &&
        kickCooldownNext <= 0 &&
        kickMinimumIntervalSatisfied
      const kickPulseOutput = kickPulseWarmupActive
        ? 0
        : applyEnvelope(
            envelopes.kickPulse,
            kickPostThresholdCandidate,
            KICK_PULSE_CONFIG.attack,
            KICK_PULSE_CONFIG.release,
            frameScale,
          )
      const kickPulseValue = kickAcceptedEvent
        ? Math.max(kickPulseOutput, kickPostThresholdCandidate)
        : kickPulseOutput
      const kickPulseCooldownMs = kickAcceptedEvent ? KICK_PULSE_CONFIG.cooldownMs : kickCooldownNext
      const kickPulseEventCount = kickAcceptedEvent ? kickPulseEventCountRef.current + 1 : kickPulseEventCountRef.current
      if (kickAcceptedEvent) {
        kickPulseEventCountRef.current = kickPulseEventCount
        lastAcceptedKickAtMsRef.current = nowMs
      }

      const transientFastTarget = 0.68 * bass + 0.32 * energy
      const transientSlowTarget = 0.55 * bass + 0.45 * smoothedEnergy

      const bassPulseOutput = bassPulseWarmupActive
        ? 0
        : applyEnvelope(
            envelopes.bassPulse,
            bassPulseCandidate,
            BASS_PULSE_CONFIG.fastBassAttack,
            BASS_PULSE_CONFIG.decay,
            frameScale,
          )

      const bassPulseTriggered =
        !bassPulseWarmupActive && bassPulseCandidate > 0 && bassPulseCooldownNext <= 0
      const bassPulseValue = bassPulseTriggered
        ? Math.max(bassPulseOutput, bassPulseCandidate)
        : bassPulseOutput
      const bassPulseCooldownMs = bassPulseTriggered
        ? BASS_PULSE_CONFIG.cooldownMs
        : bassPulseCooldownNext

      const transientFast = applyEnvelope(
        envelopes.transientFast,
        transientFastTarget,
        ENVELOPE_CONFIG.transientFastAttack,
        ENVELOPE_CONFIG.transientFastRelease,
        frameScale,
      )
      const transientSlow = applyEnvelope(
        envelopes.transientSlow,
        transientSlowTarget,
        ENVELOPE_CONFIG.transientSlowAttack,
        ENVELOPE_CONFIG.transientSlowRelease,
        frameScale,
      )

      const cooldownNext = Math.max(0, envelopes.transientCooldownMs - deltaMs)
      const transientDelta = transientFast - transientSlow
      const transientCandidate = clamp01((transientDelta - TRANSIENT_CONFIG.threshold) * TRANSIENT_CONFIG.gain)
      const transientWarmupActive = bassPulseWarmupActive

      let transientValue = applyEnvelope(
        envelopes.transient,
        0,
        ENVELOPE_CONFIG.transientFastAttack,
        ENVELOPE_CONFIG.transientDecay,
        frameScale,
      )
      let transientCooldownMs = cooldownNext

      if (!transientWarmupActive && transientCandidate > 0 && cooldownNext <= 0) {
        transientValue = Math.max(transientValue, transientCandidate)
        transientCooldownMs = TRANSIENT_CONFIG.cooldownMs
      }

      if (transientWarmupActive) {
        transientValue = 0
        transientCooldownMs = 0
      }

      const seededBassPulseFastBass = bassPulseWarmupActive ? bass : bassPulseFastBass
      const seededBassPulseSlowBass = bassPulseWarmupActive ? bass : bassPulseSlowBass
      const seededBassPulseFastEnergy = bassPulseWarmupActive ? energy : bassPulseFastEnergy
      const seededBassPulseSlowEnergy = bassPulseWarmupActive ? energy : bassPulseSlowEnergy
      const seededBassDelta = bassPulseWarmupActive
        ? 0
        : Math.max(0, seededBassPulseFastBass - seededBassPulseSlowBass)
      const seededEnergyDelta = bassPulseWarmupActive
        ? 0
        : Math.max(0, seededBassPulseFastEnergy - seededBassPulseSlowEnergy)
      const seededCombinedCandidate = bassPulseWarmupActive
        ? 0
        : seededBassDelta * BASS_PULSE_CONFIG.bassWeight + seededEnergyDelta * BASS_PULSE_CONFIG.energyWeight
      const seededPostThresholdCandidate = bassPulseWarmupActive
        ? 0
        : clamp01((seededCombinedCandidate - BASS_PULSE_CONFIG.threshold) * BASS_PULSE_CONFIG.gain)
      const seededTransientFast = bassPulseWarmupActive ? transientSlowTarget : transientFast
      const seededTransientSlow = bassPulseWarmupActive ? transientSlowTarget : transientSlow
      const seededKickPulseFastCandidate = kickPulseWarmupActive ? kickCombinedCandidate : kickCombinedCandidate
      const seededKickPulseSlowCandidate = kickPulseWarmupActive ? kickCombinedCandidate : kickCombinedCandidate
      const seededKickPulseFastEnergy = kickPulseWarmupActive ? combinedEnergy : kickFastEnergy
      const seededKickPulseSlowEnergy = kickPulseWarmupActive ? combinedEnergy : kickSlowEnergy

      const nextSnapshot: AudioReactiveSnapshot = {
        energy: clamp01(energy),
        smoothedEnergy: clamp01(smoothedEnergy),
        bass: clamp01(bass),
        kickPulse: clamp01(kickPulseWarmupActive ? 0 : kickPulseValue),
        kickPulseAcceptedEvent: kickAcceptedEvent,
        kickPulseAcceptedEventCount: kickPulseEventCount,
        bassPulse: clamp01(bassPulseWarmupActive ? 0 : bassPulseValue),
        mids: clamp01(mids),
        highs: clamp01(highs),
        transient: clamp01(transientValue),
        isActive: true,
      }

      const nextBassPulseDebug: BassPulseDebugReadout = {
        fastBass: clamp01(seededBassPulseFastBass),
        slowBass: clamp01(seededBassPulseSlowBass),
        bassDelta: clamp01(seededBassDelta),
        fastEnergy: clamp01(seededBassPulseFastEnergy),
        slowEnergy: clamp01(seededBassPulseSlowEnergy),
        energyDelta: clamp01(seededEnergyDelta),
        combinedCandidate: clamp01(seededCombinedCandidate),
        postThresholdCandidate: clamp01(seededPostThresholdCandidate),
        threshold: BASS_PULSE_CONFIG.threshold,
        warmupActive: bassPulseWarmupActive,
        warmupRemainingMs: warmupTimeRemainingMs,
        warmupFramesRemaining: Math.max(0, ONSET_WARMUP_MIN_FRAMES - onsetWarmupFrameCountRef.current),
        cooldownRemainingMs: bassPulseWarmupActive ? 0 : bassPulseCooldownMs,
      }

      const nextKickPulseDebug: KickPulseDebugReadout = {
        lowBandSpectralFlux: kickPulseWarmupActive ? 0 : clamp01(kickLowBandFlux),
        positiveEnergyRise: kickPulseWarmupActive ? 0 : clamp01(positiveEnergyRise),
        combinedCandidate: kickPulseWarmupActive ? 0 : clamp01(kickCombinedCandidate),
        adaptiveBaseline: kickPulseWarmupActive ? 0 : clamp01(kickAdaptiveBaseline),
        adaptiveThreshold: kickPulseWarmupActive ? 0 : clamp01(kickAdaptiveThreshold),
        postThresholdCandidate: kickPulseWarmupActive ? 0 : clamp01(kickPostThresholdCandidate),
        acceptedKickEvent: kickAcceptedEvent,
        acceptedKickEventCount: kickPulseEventCount,
        warmupActive: kickPulseWarmupActive,
        warmupRemainingMs: kickPulseWarmupActive ? warmupTimeRemainingMs : 0,
        warmupFramesRemaining: kickPulseWarmupActive ? Math.max(0, ONSET_WARMUP_MIN_FRAMES - onsetWarmupFrameCountRef.current) : 0,
        cooldownRemainingMs: kickPulseWarmupActive ? 0 : kickPulseCooldownMs,
      }

      envelopesRef.current = {
        bass: nextSnapshot.bass,
        mids: nextSnapshot.mids,
        highs: nextSnapshot.highs,
        energy: nextSnapshot.energy,
        smoothedEnergy: nextSnapshot.smoothedEnergy,
        bassPulseFastBass: seededBassPulseFastBass,
        bassPulseSlowBass: seededBassPulseSlowBass,
        bassPulseFastEnergy: seededBassPulseFastEnergy,
        bassPulseSlowEnergy: seededBassPulseSlowEnergy,
        bassPulse: nextSnapshot.bassPulse,
        bassPulseCooldownMs: bassPulseWarmupActive ? 0 : bassPulseCooldownMs,
        kickPulseFastCandidate: seededKickPulseFastCandidate,
        kickPulseSlowCandidate: seededKickPulseSlowCandidate,
        kickPulseFastEnergy: seededKickPulseFastEnergy,
        kickPulseSlowEnergy: seededKickPulseSlowEnergy,
        kickPulse: nextSnapshot.kickPulse,
        kickPulseCooldownMs: kickPulseWarmupActive ? 0 : kickPulseCooldownMs,
        transientFast: seededTransientFast,
        transientSlow: seededTransientSlow,
        transient: nextSnapshot.transient,
        transientCooldownMs,
      }

      if (!previousFrequencyDataRef.current || previousFrequencyDataRef.current.length !== graph.frequencyData.length) {
        previousFrequencyDataRef.current = new Float32Array(graph.frequencyData.length)
      }
      previousFrequencyDataRef.current.set(graph.frequencyData)
      previousKickPulseCandidateRef.current = kickCombinedCandidate

      publishSnapshot(nextSnapshot, nextBassPulseDebug, nextKickPulseDebug, nowMs)
      analysisRafRef.current = window.requestAnimationFrame(runAnalysisFrame)
    },
    [activateOnsetWarmup, documentVisible, playbackStatus, publishSnapshot, sourceBpm],
  )

  const runDecayFrame = useCallback(
    (nowMs: number) => {
      if (playbackStatus === 'playing' || !documentVisible) {
        decayRafRef.current = null
        return
      }

      const previousFrameTime = lastFrameTimeRef.current ?? nowMs
      const deltaMs = Math.max(8, Math.min(64, nowMs - previousFrameTime))
      const frameScale = Math.max(0.35, Math.min(3.2, deltaMs / 16.67))
      lastFrameTimeRef.current = nowMs

      const decay = 1 - Math.pow(1 - 0.22, frameScale)
      const current = snapshotRef.current

      const nextSnapshot: AudioReactiveSnapshot = {
        energy: Math.max(0, current.energy * (1 - decay)),
        smoothedEnergy: Math.max(0, current.smoothedEnergy * (1 - decay * 0.75)),
        bass: Math.max(0, current.bass * (1 - decay)),
        kickPulse: Math.max(0, current.kickPulse * (1 - decay * 1.1)),
        kickPulseAcceptedEvent: false,
        kickPulseAcceptedEventCount: current.kickPulseAcceptedEventCount,
        bassPulse: Math.max(0, current.bassPulse * (1 - decay * 1.3)),
        mids: Math.max(0, current.mids * (1 - decay)),
        highs: Math.max(0, current.highs * (1 - decay)),
        transient: Math.max(0, current.transient * (1 - decay * 1.15)),
        isActive: false,
      }

      const nextBassPulseDebug: BassPulseDebugReadout = {
        ...bassPulseDebugRef.current,
        warmupActive: false,
      }

      envelopesRef.current = {
        ...envelopesRef.current,
        bass: nextSnapshot.bass,
        mids: nextSnapshot.mids,
        highs: nextSnapshot.highs,
        energy: nextSnapshot.energy,
        smoothedEnergy: nextSnapshot.smoothedEnergy,
        bassPulseFastBass: nextSnapshot.bass,
        bassPulseSlowBass: nextSnapshot.bass,
        bassPulseFastEnergy: nextSnapshot.energy,
        bassPulseSlowEnergy: nextSnapshot.smoothedEnergy,
        bassPulse: nextSnapshot.bassPulse,
        bassPulseCooldownMs: Math.max(0, envelopesRef.current.bassPulseCooldownMs - deltaMs),
        kickPulseFastCandidate: nextSnapshot.kickPulse,
        kickPulseSlowCandidate: nextSnapshot.kickPulse,
        kickPulseFastEnergy: nextSnapshot.energy,
        kickPulseSlowEnergy: nextSnapshot.smoothedEnergy,
        kickPulse: nextSnapshot.kickPulse,
        kickPulseCooldownMs: Math.max(0, envelopesRef.current.kickPulseCooldownMs - deltaMs),
        transient: nextSnapshot.transient,
        transientFast: nextSnapshot.energy,
        transientSlow: nextSnapshot.smoothedEnergy,
        transientCooldownMs: Math.max(0, envelopesRef.current.transientCooldownMs - deltaMs),
      }

      publishSnapshot(nextSnapshot, nextBassPulseDebug, kickPulseDebugRef.current, nowMs)

      if (snapshotNearZero(nextSnapshot)) {
        decayRafRef.current = null
        return
      }

      decayRafRef.current = window.requestAnimationFrame(runDecayFrame)
    },
    [documentVisible, playbackStatus, publishSnapshot],
  )

  useEffect(() => {
    const handleVisibilityChange = () => {
      setDocumentVisible(getDocumentVisible())
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (!audioSourceId) {
      return
    }

    previousFrequencyDataRef.current = null
    previousKickPulseCandidateRef.current = 0
    lastAudioTimeRef.current = null
    zeroSnapshotNow(true)
    activateOnsetWarmup()
  }, [activateOnsetWarmup, audioSourceId, zeroSnapshotNow])

  useEffect(() => {
    if (!audioElement) {
      setStatus('unavailable')
      stopAnalysisLoop()
      stopDecayLoop()
      zeroSnapshotNow(true)
      return
    }

    if (!graphRef.current) {
      setStatus((current) => (current === 'error' ? current : 'paused'))
    }
  }, [audioElement, stopAnalysisLoop, stopDecayLoop, zeroSnapshotNow])

  useEffect(() => {
    const graph = graphRef.current

    if (!graph) {
      return
    }

    if (graph.context.state === 'suspended') {
      setStatus('suspended')
      return
    }

    if (playbackStatus === 'playing' && documentVisible) {
      setStatus('running')
      return
    }

    setStatus('paused')
  }, [documentVisible, playbackStatus])

  useEffect(() => {
    const previousPlaybackStatus = previousPlaybackStatusRef.current

    if (playbackStatus === 'playing' && previousPlaybackStatus !== 'playing') {
      activateOnsetWarmup()
    }

    previousPlaybackStatusRef.current = playbackStatus
  }, [activateOnsetWarmup, playbackStatus])

  useEffect(() => {
    if (isSeeking && !previousIsSeekingRef.current) {
      activateOnsetWarmup()
    }

    previousIsSeekingRef.current = isSeeking
  }, [activateOnsetWarmup, isSeeking])

  useEffect(() => {
    if (shouldAnalyze) {
      stopDecayLoop()

      if (analysisRafRef.current === null) {
        lastFrameTimeRef.current = null
        analysisRafRef.current = window.requestAnimationFrame(runAnalysisFrame)
      }

      return
    }

    stopAnalysisLoop()

    if (documentVisible && !snapshotNearZero(snapshotRef.current) && decayRafRef.current === null) {
      lastFrameTimeRef.current = null
      decayRafRef.current = window.requestAnimationFrame(runDecayFrame)
    }
  }, [documentVisible, runAnalysisFrame, runDecayFrame, shouldAnalyze, stopAnalysisLoop, stopDecayLoop])

  useEffect(() => {
    if (!audioElement) {
      return
    }

    if (!connectedElementRef.current) {
      return
    }

    if (connectedElementRef.current === audioElement) {
      return
    }

    void teardownGraph(true)
    zeroSnapshotNow(true)
    activateOnsetWarmup()
    setStatus('unavailable')
  }, [activateOnsetWarmup, audioElement, teardownGraph, zeroSnapshotNow])

  useEffect(() => {
    return () => {
      stopAnalysisLoop()
      stopDecayLoop()
      void teardownGraph(true)
    }
  }, [stopAnalysisLoop, stopDecayLoop, teardownGraph])

  return {
    status,
    snapshot,
    bassPulseDebug,
    kickPulseDebug,
    graphDetails,
    errorMessage,
    requestInitializationFromUserGesture,
    getLatestSnapshot,
    analysisCalculationMode: 'requestAnimationFrame',
    diagnosticsPublishHz: ANALYSIS_PUBLISH_HZ,
  }
}
