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
  publishDiagnostics: boolean
}

type UseAudioAnalysisResult = {
  status: AudioAnalysisStatus
  snapshot: AudioReactiveSnapshot
  graphDetails: AudioAnalysisGraphDetails
  errorMessage: string | null
  requestInitializationFromUserGesture: () => Promise<void>
  getLatestSnapshot: () => AudioReactiveSnapshot
  analysisCalculationMode: 'requestAnimationFrame'
  diagnosticsPublishHz: number
}

type FrequencyBandRanges = {
  bass: { start: number; end: number }
  mids: { start: number; end: number }
  highs: { start: number; end: number }
}

type EnvelopeState = {
  bass: number
  mids: number
  highs: number
  energy: number
  smoothedEnergy: number
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

const ZERO_SNAPSHOT: AudioReactiveSnapshot = {
  energy: 0,
  bass: 0,
  mids: 0,
  highs: 0,
  smoothedEnergy: 0,
  transient: 0,
  isActive: false,
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

export function useAudioAnalysis({ audioElement, playbackStatus, publishDiagnostics }: UseAudioAnalysisArgs): UseAudioAnalysisResult {
  const [status, setStatus] = useState<AudioAnalysisStatus>(audioElement ? 'paused' : 'unavailable')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<AudioReactiveSnapshot>(ZERO_SNAPSHOT)
  const [graphDetails, setGraphDetails] = useState<AudioAnalysisGraphDetails>(EMPTY_GRAPH_DETAILS)
  const [documentVisible, setDocumentVisible] = useState(() => getDocumentVisible())

  const graphRef = useRef<AnalysisGraph | null>(null)
  const connectedElementRef = useRef<HTMLAudioElement | null>(null)
  const snapshotRef = useRef<AudioReactiveSnapshot>(ZERO_SNAPSHOT)
  const envelopesRef = useRef<EnvelopeState>(EMPTY_ENVELOPES)
  const analysisRafRef = useRef<number | null>(null)
  const decayRafRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const lastPublishTimeRef = useRef<number>(0)

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
  }, [])

  const stopDecayLoop = useCallback(() => {
    if (decayRafRef.current !== null) {
      window.cancelAnimationFrame(decayRafRef.current)
      decayRafRef.current = null
    }
  }, [])

  const publishSnapshot = useCallback(
    (nextSnapshot: AudioReactiveSnapshot, nowMs: number, force = false) => {
      snapshotRef.current = nextSnapshot

      if (!publishDiagnostics) {
        return
      }

      if (!force && nowMs - lastPublishTimeRef.current < ANALYSIS_PUBLISH_INTERVAL_MS) {
        return
      }

      lastPublishTimeRef.current = nowMs
      setSnapshot(nextSnapshot)
    },
    [publishDiagnostics],
  )

  const zeroSnapshotNow = useCallback(
    (force = false) => {
      const zero = {
        ...ZERO_SNAPSHOT,
        isActive: false,
      }

      envelopesRef.current = EMPTY_ENVELOPES
      publishSnapshot(zero, performance.now(), force)
    },
    [publishSnapshot],
  )

  const teardownGraph = useCallback(
    async (closeContext: boolean) => {
      stopAnalysisLoop()
      stopDecayLoop()

      const graph = graphRef.current
      graphRef.current = null

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
        connectedElementRef.current = audioElement

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

      if (graph.context.state === 'running') {
        setStatus(playbackStatus === 'playing' && documentVisible ? 'running' : 'paused')
      } else if (graph.context.state === 'suspended') {
        setStatus('suspended')
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Audio analysis resume failed.')
    }
  }, [audioElement, documentVisible, playbackStatus, teardownGraph, zeroSnapshotNow])

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

      graph.analyser.getFloatFrequencyData(graph.frequencyData as Float32Array<ArrayBuffer>)
      graph.analyser.getFloatTimeDomainData(graph.timeDomainData as Float32Array<ArrayBuffer>)

      const bassRaw = averageNormalizedBand(
        graph.frequencyData,
        graph.bandRanges.bass,
        graph.analyser.minDecibels,
        graph.analyser.maxDecibels,
      )
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

      const transientFast = applyEnvelope(
        envelopes.transientFast,
        0.68 * bass + 0.32 * energy,
        ENVELOPE_CONFIG.transientFastAttack,
        ENVELOPE_CONFIG.transientFastRelease,
        frameScale,
      )
      const transientSlow = applyEnvelope(
        envelopes.transientSlow,
        0.55 * bass + 0.45 * smoothedEnergy,
        ENVELOPE_CONFIG.transientSlowAttack,
        ENVELOPE_CONFIG.transientSlowRelease,
        frameScale,
      )

      const cooldownNext = Math.max(0, envelopes.transientCooldownMs - deltaMs)
      const transientDelta = transientFast - transientSlow
      const transientCandidate = clamp01((transientDelta - TRANSIENT_CONFIG.threshold) * TRANSIENT_CONFIG.gain)

      let transientValue = applyEnvelope(
        envelopes.transient,
        0,
        ENVELOPE_CONFIG.transientFastAttack,
        ENVELOPE_CONFIG.transientDecay,
        frameScale,
      )
      let transientCooldownMs = cooldownNext

      if (transientCandidate > 0 && cooldownNext <= 0) {
        transientValue = Math.max(transientValue, transientCandidate)
        transientCooldownMs = TRANSIENT_CONFIG.cooldownMs
      }

      const nextSnapshot: AudioReactiveSnapshot = {
        energy: clamp01(energy),
        bass: clamp01(bass),
        mids: clamp01(mids),
        highs: clamp01(highs),
        smoothedEnergy: clamp01(smoothedEnergy),
        transient: clamp01(transientValue),
        isActive: true,
      }

      envelopesRef.current = {
        bass: nextSnapshot.bass,
        mids: nextSnapshot.mids,
        highs: nextSnapshot.highs,
        energy: nextSnapshot.energy,
        smoothedEnergy: nextSnapshot.smoothedEnergy,
        transientFast,
        transientSlow,
        transient: nextSnapshot.transient,
        transientCooldownMs,
      }

      publishSnapshot(nextSnapshot, nowMs)
      analysisRafRef.current = window.requestAnimationFrame(runAnalysisFrame)
    },
    [documentVisible, playbackStatus, publishSnapshot],
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
        bass: Math.max(0, current.bass * (1 - decay)),
        mids: Math.max(0, current.mids * (1 - decay)),
        highs: Math.max(0, current.highs * (1 - decay)),
        smoothedEnergy: Math.max(0, current.smoothedEnergy * (1 - decay * 0.75)),
        transient: Math.max(0, current.transient * (1 - decay * 1.15)),
        isActive: false,
      }

      envelopesRef.current = {
        ...envelopesRef.current,
        bass: nextSnapshot.bass,
        mids: nextSnapshot.mids,
        highs: nextSnapshot.highs,
        energy: nextSnapshot.energy,
        smoothedEnergy: nextSnapshot.smoothedEnergy,
        transient: nextSnapshot.transient,
        transientFast: nextSnapshot.energy,
        transientSlow: nextSnapshot.smoothedEnergy,
        transientCooldownMs: Math.max(0, envelopesRef.current.transientCooldownMs - deltaMs),
      }

      publishSnapshot(nextSnapshot, nowMs)

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
    setStatus('unavailable')
  }, [audioElement, teardownGraph, zeroSnapshotNow])

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
    graphDetails,
    errorMessage,
    requestInitializationFromUserGesture,
    getLatestSnapshot,
    analysisCalculationMode: 'requestAnimationFrame',
    diagnosticsPublishHz: ANALYSIS_PUBLISH_HZ,
  }
}
