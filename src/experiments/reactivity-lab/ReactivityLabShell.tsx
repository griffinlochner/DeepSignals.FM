import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEMO_AUDIO_SOURCES, formatAudioSourceLabel } from '../../app/audioSources'
import type { ExternalSignalId } from '../../app/externalSignals'
import type {
  AudioAnalysisGraphDetails,
  AudioAnalysisStatus,
  AudioReactiveSnapshot,
  ReactivePreviewTelemetry,
  AudioSource,
} from '../../app/playerTypes'
import { useAudioAnalysis } from '../../app/useAudioAnalysis'
import { usePersistentAudioController } from '../../app/usePersistentAudioController'
import AudioAnalysisDiagnostics from '../../components/AudioAnalysisDiagnostics'
import PanelChevronIcon from '../../components/PanelChevronIcon'
import SignalSourceSelector from '../../components/SignalSourceSelector'
import VolumeControl from '../../components/VolumeControl'
import { useExternalRadioController } from '../radio-player/useExternalRadioController'
import { defaultThemeId } from '../../themes/themeRegistry'
import { imageDepthEnvironmentCatalog } from '../../themes/image-depth/environmentCatalog'
import {
  ImageDepthThemeScene,
  type ImageDepthSceneColorDiagnostics,
  type ImageDepthSceneDevCounters,
} from '../../themes/image-depth/ImageDepthThemeScene'
import {
  clampUnit,
  mapSignalTarget,
  resolveShortestHueDeltaDegrees,
  stepSmoothedValue,
  wrapSignedDegrees,
} from '../../app/reactiveBehaviorMapping'
import {
  FULLON_BUILT_IN_PRESET,
  resolveSnapshotSignal,
} from '../../app/reactiveBehaviorPresetSchema'
import {
  DEPTH_CONTROL_LIMITS,
  HUE_CONTROL_LIMITS,
  SATURATION_CONTROL_LIMITS,
  type DepthMode,
  type HueMode,
  type SaturationMode,
  parseBehaviorPresetJson,
  readStoredBehaviorPresets,
  REACTIVITY_LAB_BEHAVIOR_PRESETS_STORAGE_KEY,
  type ReactivityLabBehaviorPreset,
  serializeBehaviorPreset,
  type TelemetrySignalField,
  writeStoredBehaviorPresets,
} from './behaviorPresets'
import './reactivityLab.css'

type SourceType = 'local-mp3' | 'external-radio'
type LabRadioPresetId = ExternalSignalId

type MeterDebugReadout = {
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

type KickDebugReadout = {
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

type SharedResourceDiagnostics = {
  audioElements: number
  audioContexts: number
  mediaElementSourceNodes: number
  analyzers: number
  gainNodes: number
  activeAnalysisLoops: number
  sourceType: SourceType
}

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

const ZERO_BASS_PULSE_DEBUG: MeterDebugReadout = {
  fastBass: 0,
  slowBass: 0,
  bassDelta: 0,
  fastEnergy: 0,
  slowEnergy: 0,
  energyDelta: 0,
  combinedCandidate: 0,
  postThresholdCandidate: 0,
  threshold: 0,
  warmupActive: false,
  warmupRemainingMs: 0,
  warmupFramesRemaining: 0,
  cooldownRemainingMs: 0,
}

const ZERO_KICK_PULSE_DEBUG: KickDebugReadout = {
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

const RADIO_PRESET_OPTIONS: Array<{ id: LabRadioPresetId; label: string }> = [
  { id: 'psyradio-progressive', label: 'PsyRadio Progressive' },
  { id: 'psyradio-chillout', label: 'PsyRadio Chillout' },
  { id: 'psyndora-psytrance', label: 'Psyndora Psytrance' },
  { id: 'psyndora-chillout', label: 'Psyndora Chillout' },
  { id: 'psystream', label: 'PsyStream' },
]

const MP3_SIGNAL_OPTIONS = DEMO_AUDIO_SOURCES.map((source) => ({
  id: source.id,
  label: formatAudioSourceLabel(source),
}))

const DEFAULT_MANUAL_DEPTH = 0.5
const DEFAULT_MINIMUM_DEPTH = 0.1
const DEFAULT_MAXIMUM_DEPTH = 0.9
const DEFAULT_RESPONSE_SMOOTHING = 0.14
const STOP_SETTLE_DEPTH = 0.5
const DEFAULT_MANUAL_HUE_SHIFT_DEGREES = 0
const DEFAULT_MINIMUM_HUE_SHIFT_DEGREES = -30
const DEFAULT_MAXIMUM_HUE_SHIFT_DEGREES = 30
const DEFAULT_HUE_RESPONSE_SMOOTHING = 0.12
const STOP_SETTLE_HUE_SHIFT_DEGREES = 0
const DEFAULT_MANUAL_SATURATION = 1
const DEFAULT_MINIMUM_SATURATION = 0.85
const DEFAULT_MAXIMUM_SATURATION = 1.15
const DEFAULT_SATURATION_RESPONSE_SMOOTHING = 0.05
const STOP_SETTLE_SATURATION = 1

const TELEMETRY_SIGNAL_OPTIONS: Array<{ id: TelemetrySignalField; label: string }> = [
  { id: 'energy', label: 'Energy' },
  { id: 'smoothedEnergy', label: 'Smoothed Energy' },
  { id: 'bass', label: 'Bass' },
  { id: 'kickPulse', label: 'Kick Pulse' },
  { id: 'bassPulse', label: 'Bass Pulse' },
  { id: 'mids', label: 'Mids' },
  { id: 'highs', label: 'Highs' },
  { id: 'transient', label: 'Transient' },
]

const INITIAL_SCENE_DEV_COUNTERS: ImageDepthSceneDevCounters = {
  sceneComponentMountCount: 0,
  sceneComponentUnmountCount: 0,
  rendererCreationCount: 0,
  textureLoadCount: 0,
  materialGeometryInitializationCount: 0,
  environmentChangeCount: 0,
  depthUpdateCount: 0,
}

const INITIAL_SCENE_COLOR_DIAGNOSTICS: ImageDepthSceneColorDiagnostics = {
  colorTextureUrl: '',
  depthTextureUrl: '',
  finalFilterString: 'grayscale(0.000) hue-rotate(0.000deg) saturate(1.000) brightness(1.000) contrast(1.000)',
  finalHueDegrees: 0,
  finalSaturationMultiplier: 1,
  finalGrayscaleAmount: 0,
  finalBrightnessMultiplier: 1,
  finalContrastMultiplier: 1,
  playbackVisualState: 'stopped-color-preserved',
}

function mapRadioSignalStateToAnalysisStatus(signalState: string): AudioAnalysisStatus {
  if (signalState === 'On Air' || signalState === 'Buffering' || signalState === 'Reconnecting') {
    return 'running'
  }

  if (signalState === 'Connecting') {
    return 'initializing'
  }

  if (signalState === 'Stream Unavailable' || signalState === 'Manual Reconnect Required') {
    return 'error'
  }

  return 'paused'
}

function mapContextState(value: string): AudioContextState | null {
  if (value === 'running' || value === 'suspended' || value === 'closed') {
    return value
  }

  return null
}

function resolveMp3ResourceDiagnostics(status: AudioAnalysisStatus, graphDetails: AudioAnalysisGraphDetails): SharedResourceDiagnostics {
  const hasGraph = graphDetails.contextState !== null

  return {
    audioElements: 1,
    audioContexts: hasGraph ? 1 : 0,
    mediaElementSourceNodes: hasGraph ? 1 : 0,
    analyzers: hasGraph ? 1 : 0,
    gainNodes: hasGraph ? 1 : 0,
    activeAnalysisLoops: status === 'running' ? 1 : 0,
    sourceType: 'local-mp3',
  }
}

function formatDbRange(minDecibels: number | null, maxDecibels: number | null) {
  if (minDecibels === null || maxDecibels === null) {
    return 'n/a'
  }

  return `${minDecibels} to ${maxDecibels} dB`
}

function clampToDepthRange(value: number, minimumDepth: number, maximumDepth: number) {
  return Math.min(maximumDepth, Math.max(minimumDepth, Number.isFinite(value) ? value : minimumDepth))
}

function normalizeValueWithinRange(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  const span = maximum - minimum

  if (!Number.isFinite(span) || Math.abs(span) < 0.000001) {
    return 0
  }

  return clampUnit((value - minimum) / span)
}

function ReactivityLabShell() {
  const [sourceType, setSourceType] = useState<SourceType>('local-mp3')
  const [selectedMp3SourceId, setSelectedMp3SourceId] = useState(DEMO_AUDIO_SOURCES[0]?.id ?? '')
  const [selectedRadioPresetId, setSelectedRadioPresetId] = useState<LabRadioPresetId>('psyradio-progressive')
  const [mp3ListenerVolume, setMp3ListenerVolume] = useState(0.72)
  const [selectedImageDepthEnvironmentId, setSelectedImageDepthEnvironmentId] = useState(
    imageDepthEnvironmentCatalog[0]?.id ?? '',
  )
  const [manualDepthOverride, setManualDepthOverride] = useState(DEFAULT_MANUAL_DEPTH)
  const [depthMode, setDepthMode] = useState<DepthMode>('manual')
  const [depthSignalField, setDepthSignalField] = useState<TelemetrySignalField>('bass')
  const [minimumDepth, setMinimumDepth] = useState(DEFAULT_MINIMUM_DEPTH)
  const [maximumDepth, setMaximumDepth] = useState(DEFAULT_MAXIMUM_DEPTH)
  const [responseSmoothing, setResponseSmoothing] = useState(DEFAULT_RESPONSE_SMOOTHING)
  const [mappedDepthOverride, setMappedDepthOverride] = useState(DEFAULT_MANUAL_DEPTH)
  const [hueMode, setHueMode] = useState<HueMode>('off')
  const [hueSignalField, setHueSignalField] = useState<TelemetrySignalField>('mids')
  const [minimumHueShiftDegrees, setMinimumHueShiftDegrees] = useState(DEFAULT_MINIMUM_HUE_SHIFT_DEGREES)
  const [maximumHueShiftDegrees, setMaximumHueShiftDegrees] = useState(DEFAULT_MAXIMUM_HUE_SHIFT_DEGREES)
  const [hueResponseSmoothing, setHueResponseSmoothing] = useState(DEFAULT_HUE_RESPONSE_SMOOTHING)
  const [manualHueShiftDegrees, setManualHueShiftDegrees] = useState(DEFAULT_MANUAL_HUE_SHIFT_DEGREES)
  const [mappedHueShiftDegrees, setMappedHueShiftDegrees] = useState(DEFAULT_MANUAL_HUE_SHIFT_DEGREES)
  const [saturationMode, setSaturationMode] = useState<SaturationMode>('off')
  const [saturationSignalField, setSaturationSignalField] = useState<TelemetrySignalField>('smoothedEnergy')
  const [minimumSaturation, setMinimumSaturation] = useState(DEFAULT_MINIMUM_SATURATION)
  const [maximumSaturation, setMaximumSaturation] = useState(DEFAULT_MAXIMUM_SATURATION)
  const [saturationResponseSmoothing, setSaturationResponseSmoothing] = useState(DEFAULT_SATURATION_RESPONSE_SMOOTHING)
  const [manualSaturation, setManualSaturation] = useState(DEFAULT_MANUAL_SATURATION)
  const [mappedSaturation, setMappedSaturation] = useState(DEFAULT_MANUAL_SATURATION)
  const [depthPreviewEnabled, setDepthPreviewEnabled] = useState(true)
  const [huePreviewEnabled, setHuePreviewEnabled] = useState(true)
  const [saturationPreviewEnabled, setSaturationPreviewEnabled] = useState(false)
  const [presetNameInput, setPresetNameInput] = useState('')
  const [savedBehaviorPresets, setSavedBehaviorPresets] = useState<ReactivityLabBehaviorPreset[]>(() =>
    readStoredBehaviorPresets(),
  )
  const [selectedBehaviorPresetName, setSelectedBehaviorPresetName] = useState(() => {
    const presets = readStoredBehaviorPresets()
    return presets[0]?.name ?? ''
  })
  const [importPresetJsonText, setImportPresetJsonText] = useState('')
  const [presetInlineError, setPresetInlineError] = useState<string | null>(null)
  const [presetInlineStatus, setPresetInlineStatus] = useState<string | null>(null)
  const [renderedDepth, setRenderedDepth] = useState(DEFAULT_MANUAL_DEPTH)
  const [renderedHueShiftDegrees, setRenderedHueShiftDegrees] = useState(DEFAULT_MANUAL_HUE_SHIFT_DEGREES)
  const [renderedSaturation, setRenderedSaturation] = useState(DEFAULT_MANUAL_SATURATION)
  const [sceneDevCounters, setSceneDevCounters] = useState<ImageDepthSceneDevCounters>(
    INITIAL_SCENE_DEV_COUNTERS,
  )
  const [sceneColorDiagnostics, setSceneColorDiagnostics] = useState<ImageDepthSceneColorDiagnostics>(
    INITIAL_SCENE_COLOR_DIAGNOSTICS,
  )
  const [radioSnapshot, setRadioSnapshot] = useState<AudioReactiveSnapshot>(ZERO_SNAPSHOT)
  const [lastStartFailure, setLastStartFailure] = useState<string | null>(null)

  const previousSourceTypeRef = useRef<SourceType>('local-mp3')
  const mappedDepthTargetRef = useRef(DEFAULT_MANUAL_DEPTH)
  const mappedDepthCurrentRef = useRef(DEFAULT_MANUAL_DEPTH)
  const mappedDepthRafRef = useRef<number | null>(null)
  const mappedHueTargetRef = useRef(DEFAULT_MANUAL_HUE_SHIFT_DEGREES)
  const mappedHueCurrentRef = useRef(DEFAULT_MANUAL_HUE_SHIFT_DEGREES)
  const mappedHueRafRef = useRef<number | null>(null)
  const mappedSaturationTargetRef = useRef(DEFAULT_MANUAL_SATURATION)
  const mappedSaturationCurrentRef = useRef(DEFAULT_MANUAL_SATURATION)
  const mappedSaturationRafRef = useRef<number | null>(null)
  const audioController = usePersistentAudioController(1, selectedMp3SourceId)
  const radioController = useExternalRadioController(defaultThemeId, {
    audioOutputMode: 'post-analyzer-gain',
  })
  const {
    signalState: radioSignalState,
    volume: radioVolume,
    errorMessage: radioErrorMessage,
    analyzerDiagnostics: radioAnalyzerDiagnostics,
    resourceDiagnostics: radioResourceDiagnostics,
    reconnectDiagnostics,
    stationName,
    selectSignalSource,
    startSignal,
    stopSignal,
    setVolume: setRadioVolume,
    getLatestAudioSnapshot,
  } = radioController

  const mp3Analysis = useAudioAnalysis({
    audioElement: audioController.audioElement,
    playbackStatus: audioController.playbackStatus,
    isSeeking: audioController.isSeeking,
    audioSourceId: selectedMp3SourceId,
    sourceBpm: audioController.audioSource.bpm ?? null,
    publishDiagnostics: true,
    listenerVolume: mp3ListenerVolume,
    routeAudioThroughPostAnalyzerGain: true,
  })

  useEffect(() => {
    if (audioController.volume !== 1) {
      audioController.setVolume(1)
    }
  }, [audioController])

  const applyRadioPreset = async (presetId: LabRadioPresetId) => {
    await selectSignalSource(presetId)
  }

  useEffect(() => {
    if (sourceType !== 'external-radio' || radioSignalState === 'Signal Off') {
      return
    }

    const publish = () => {
      setRadioSnapshot({ ...getLatestAudioSnapshot() })
    }

    publish()
    const interval = window.setInterval(publish, 50)

    return () => {
      window.clearInterval(interval)
    }
  }, [getLatestAudioSnapshot, radioSignalState, sourceType])

  useEffect(() => {
    const previousSourceType = previousSourceTypeRef.current

    if (previousSourceType === sourceType) {
      return
    }

    if (sourceType === 'local-mp3') {
      void stopSignal()
    } else {
      audioController.pause()
    }

    previousSourceTypeRef.current = sourceType
  }, [audioController, sourceType, stopSignal])

  const telemetrySnapshot = sourceType === 'local-mp3' ? mp3Analysis.snapshot : radioSnapshot

  const telemetryStatus = sourceType === 'local-mp3'
    ? mp3Analysis.status
    : mapRadioSignalStateToAnalysisStatus(radioSignalState)

  const telemetryGraphDetails = sourceType === 'local-mp3'
    ? mp3Analysis.graphDetails
    : {
        contextState: mapContextState(radioController.analyzerDiagnostics.latest.audioContextState),
        sampleRate: null,
        fftSize: null,
        frequencyBinCount: null,
        smoothingTimeConstant: null,
        minDecibels: null,
        maxDecibels: null,
      }

  const telemetryErrorMessage = sourceType === 'local-mp3'
    ? (mp3Analysis.errorMessage ?? audioController.errorMessage)
    : radioErrorMessage

  const telemetrySourceBpm = sourceType === 'local-mp3' ? (audioController.audioSource.bpm ?? null) : null

  const telemetryResourceDiagnostics = useMemo(() => {
    if (sourceType === 'local-mp3') {
      return resolveMp3ResourceDiagnostics(mp3Analysis.status, mp3Analysis.graphDetails)
    }

    return {
      audioElements: radioResourceDiagnostics.audioElementsCreated,
      audioContexts: radioResourceDiagnostics.audioContextsCreated,
      mediaElementSourceNodes: radioResourceDiagnostics.sourceNodesCreated,
      analyzers: radioResourceDiagnostics.analyzersCreated,
      gainNodes: radioResourceDiagnostics.gainNodesCreated,
      activeAnalysisLoops: radioResourceDiagnostics.isAnalysisLoopRunning ? 1 : 0,
      sourceType: 'external-radio',
    }
  }, [mp3Analysis.graphDetails, mp3Analysis.status, radioResourceDiagnostics, sourceType])

  const radioGraphDetailsSummary = sourceType === 'external-radio' ? radioAnalyzerDiagnostics.latest : null

  const selectedRadioLabel =
    RADIO_PRESET_OPTIONS.find((option) => option.id === selectedRadioPresetId)?.label ?? 'n/a'

  const selectedMp3 = useMemo<AudioSource | null>(() => {
    return DEMO_AUDIO_SOURCES.find((source) => source.id === selectedMp3SourceId) ?? null
  }, [selectedMp3SourceId])

  const selectedImageDepthEnvironment = useMemo(() => {
    return (
      imageDepthEnvironmentCatalog.find((environment) => environment.id === selectedImageDepthEnvironmentId) ??
      imageDepthEnvironmentCatalog[0]
    )
  }, [selectedImageDepthEnvironmentId])

  const previewScenePreset = selectedImageDepthEnvironment?.productionScenePreset ?? null

  const isMp3Playing = audioController.playbackStatus === 'playing'

  const isRadioPlaying =
    radioController.signalState === 'On Air' ||
    radioSignalState === 'Buffering' ||
    radioSignalState === 'Reconnecting' ||
    radioSignalState === 'Connecting'

  const isCurrentSourcePlaying = sourceType === 'local-mp3' ? isMp3Playing : isRadioPlaying
  const isAudioStopped = sourceType === 'local-mp3'
    ? audioController.playbackStatus !== 'playing'
    : radioSignalState === 'Signal Off'

  const selectedDepthSignalValue = resolveSnapshotSignal(telemetrySnapshot, depthSignalField)
  const selectedHueSignalValue = resolveSnapshotSignal(telemetrySnapshot, hueSignalField)
  const selectedSaturationSignalValue = resolveSnapshotSignal(telemetrySnapshot, saturationSignalField)

  const mappedTargetDepth = clampToDepthRange(
    mapSignalTarget(selectedDepthSignalValue, minimumDepth, maximumDepth),
    minimumDepth,
    maximumDepth,
  )

  const mappedTargetHueShiftDegrees = mapSignalTarget(
    selectedHueSignalValue,
    minimumHueShiftDegrees,
    maximumHueShiftDegrees,
  )
  const mappedTargetSaturation = mapSignalTarget(selectedSaturationSignalValue, minimumSaturation, maximumSaturation)

  const depthMappingActive = depthPreviewEnabled && depthMode === 'audio-mapped'
  const hueMappingActive = huePreviewEnabled && hueMode === 'audio-mapped'
  const saturationMappingActive = saturationPreviewEnabled && saturationMode === 'audio-mapped'

  const targetDepthForDisplay = depthMappingActive
    ? (isAudioStopped ? STOP_SETTLE_DEPTH : mappedTargetDepth)
    : depthPreviewEnabled
      ? manualDepthOverride
      : STOP_SETTLE_DEPTH

  const targetHueShiftForDisplay = hueMappingActive
    ? (isAudioStopped ? STOP_SETTLE_HUE_SHIFT_DEGREES : mappedTargetHueShiftDegrees)
    : !huePreviewEnabled
      ? STOP_SETTLE_HUE_SHIFT_DEGREES
      : hueMode === 'manual'
        ? manualHueShiftDegrees
        : STOP_SETTLE_HUE_SHIFT_DEGREES

  const targetSaturationForDisplay = saturationMappingActive
    ? (isAudioStopped ? STOP_SETTLE_SATURATION : mappedTargetSaturation)
    : !saturationPreviewEnabled
      ? STOP_SETTLE_SATURATION
      : saturationMode === 'manual'
        ? manualSaturation
        : STOP_SETTLE_SATURATION

  const liveDepthOverride = !depthPreviewEnabled
    ? STOP_SETTLE_DEPTH
    : depthMode === 'audio-mapped'
      ? mappedDepthOverride
      : manualDepthOverride

  const liveHueShiftOverrideDegrees = !huePreviewEnabled
    ? STOP_SETTLE_HUE_SHIFT_DEGREES
    : hueMode === 'off'
      ? STOP_SETTLE_HUE_SHIFT_DEGREES
      : hueMode === 'audio-mapped'
        ? mappedHueShiftDegrees
        : manualHueShiftDegrees

  const liveSaturationOverride = !saturationPreviewEnabled
    ? STOP_SETTLE_SATURATION
    : saturationMode === 'off'
      ? STOP_SETTLE_SATURATION
      : saturationMode === 'audio-mapped'
        ? mappedSaturation
        : manualSaturation

  useEffect(() => {
    if (!depthMappingActive) {
      return
    }

    mappedDepthTargetRef.current = isAudioStopped ? STOP_SETTLE_DEPTH : mappedTargetDepth
  }, [depthMappingActive, isAudioStopped, mappedTargetDepth])

  useEffect(() => {
    if (!depthMappingActive) {
      if (mappedDepthRafRef.current !== null) {
        window.cancelAnimationFrame(mappedDepthRafRef.current)
        mappedDepthRafRef.current = null
      }

      return
    }

    mappedDepthCurrentRef.current = manualDepthOverride

    const tick = () => {
      const targetDepth = mappedDepthTargetRef.current
      const currentDepth = mappedDepthCurrentRef.current
      let nextDepth = stepSmoothedValue(currentDepth, targetDepth, responseSmoothing)

      if (Math.abs(targetDepth - nextDepth) < 0.0005) {
        nextDepth = targetDepth
      }

      if (nextDepth !== currentDepth) {
        mappedDepthCurrentRef.current = nextDepth
        setMappedDepthOverride(nextDepth)
      }

      mappedDepthRafRef.current = window.requestAnimationFrame(tick)
    }

    mappedDepthRafRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (mappedDepthRafRef.current !== null) {
        window.cancelAnimationFrame(mappedDepthRafRef.current)
        mappedDepthRafRef.current = null
      }
    }
  }, [depthMappingActive, manualDepthOverride, responseSmoothing])

  useEffect(() => {
    if (!hueMappingActive) {
      return
    }

    mappedHueTargetRef.current = isAudioStopped ? STOP_SETTLE_HUE_SHIFT_DEGREES : mappedTargetHueShiftDegrees
  }, [hueMappingActive, isAudioStopped, mappedTargetHueShiftDegrees])

  useEffect(() => {
    if (!hueMappingActive) {
      if (mappedHueRafRef.current !== null) {
        window.cancelAnimationFrame(mappedHueRafRef.current)
        mappedHueRafRef.current = null
      }

      return
    }

    mappedHueCurrentRef.current = manualHueShiftDegrees

    const tick = () => {
      const targetHue = mappedHueTargetRef.current
      const currentHue = mappedHueCurrentRef.current
      const shortestDelta = resolveShortestHueDeltaDegrees(currentHue, targetHue)
      let nextHue = wrapSignedDegrees(stepSmoothedValue(currentHue, currentHue + shortestDelta, hueResponseSmoothing))

      if (Math.abs(shortestDelta) < 0.05) {
        nextHue = wrapSignedDegrees(targetHue)
      }

      if (nextHue !== currentHue) {
        mappedHueCurrentRef.current = nextHue
        setMappedHueShiftDegrees(nextHue)
      }

      mappedHueRafRef.current = window.requestAnimationFrame(tick)
    }

    mappedHueRafRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (mappedHueRafRef.current !== null) {
        window.cancelAnimationFrame(mappedHueRafRef.current)
        mappedHueRafRef.current = null
      }
    }
  }, [hueMappingActive, manualHueShiftDegrees, hueResponseSmoothing])

  useEffect(() => {
    if (!saturationMappingActive) {
      return
    }

    mappedSaturationTargetRef.current = isAudioStopped ? STOP_SETTLE_SATURATION : mappedTargetSaturation
  }, [isAudioStopped, mappedTargetSaturation, saturationMappingActive])

  useEffect(() => {
    if (!saturationMappingActive) {
      if (mappedSaturationRafRef.current !== null) {
        window.cancelAnimationFrame(mappedSaturationRafRef.current)
        mappedSaturationRafRef.current = null
      }

      return
    }

    mappedSaturationCurrentRef.current = manualSaturation

    const tick = () => {
      const targetSaturation = mappedSaturationTargetRef.current
      const currentSaturation = mappedSaturationCurrentRef.current
      let nextSaturation = stepSmoothedValue(currentSaturation, targetSaturation, saturationResponseSmoothing)

      if (Math.abs(targetSaturation - nextSaturation) < 0.0005) {
        nextSaturation = targetSaturation
      }

      nextSaturation = Math.max(0, nextSaturation)

      if (nextSaturation !== currentSaturation) {
        mappedSaturationCurrentRef.current = nextSaturation
        setMappedSaturation(nextSaturation)
      }

      mappedSaturationRafRef.current = window.requestAnimationFrame(tick)
    }

    mappedSaturationRafRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (mappedSaturationRafRef.current !== null) {
        window.cancelAnimationFrame(mappedSaturationRafRef.current)
        mappedSaturationRafRef.current = null
      }
    }
  }, [manualSaturation, saturationMappingActive, saturationResponseSmoothing])

  const applyBehaviorPreset = useCallback((preset: ReactivityLabBehaviorPreset) => {
    setDepthMode(preset.depth.mode)
    setDepthSignalField(preset.depth.signal)
    setMinimumDepth(preset.depth.min)
    setMaximumDepth(preset.depth.max)
    setResponseSmoothing(preset.depth.smoothing)

    setHueMode(preset.hue.mode)
    setHueSignalField(preset.hue.signal)
    setMinimumHueShiftDegrees(preset.hue.minDegrees)
    setMaximumHueShiftDegrees(preset.hue.maxDegrees)
    setHueResponseSmoothing(preset.hue.smoothing)

    setSaturationMode(preset.saturation.mode)
    setSaturationSignalField(preset.saturation.signal)
    setMinimumSaturation(preset.saturation.min)
    setMaximumSaturation(preset.saturation.max)
    setSaturationResponseSmoothing(preset.saturation.smoothing)
  }, [])

  const currentBehaviorPreset = useMemo<ReactivityLabBehaviorPreset>(() => {
    const normalizedName = presetNameInput.trim().length > 0 ? presetNameInput.trim() : 'Untitled Behavior Preset'

    return {
      schemaVersion: 2,
      name: normalizedName,
      depth: {
        mode: depthMode,
        signal: depthSignalField,
        min: minimumDepth,
        max: maximumDepth,
        smoothing: responseSmoothing,
      },
      hue: {
        mode: hueMode,
        signal: hueSignalField,
        minDegrees: minimumHueShiftDegrees,
        maxDegrees: maximumHueShiftDegrees,
        smoothing: hueResponseSmoothing,
      },
      saturation: {
        mode: saturationMode,
        signal: saturationSignalField,
        min: minimumSaturation,
        max: maximumSaturation,
        smoothing: saturationResponseSmoothing,
      },
    }
  }, [
    depthMode,
    depthSignalField,
    minimumDepth,
    maximumDepth,
    responseSmoothing,
    hueMode,
    hueSignalField,
    minimumHueShiftDegrees,
    maximumHueShiftDegrees,
    hueResponseSmoothing,
    saturationMode,
    saturationSignalField,
    minimumSaturation,
    maximumSaturation,
    saturationResponseSmoothing,
    presetNameInput,
  ])

  const persistBehaviorPresets = (nextPresets: ReactivityLabBehaviorPreset[]) => {
    writeStoredBehaviorPresets(nextPresets)
    setSavedBehaviorPresets(nextPresets)
  }

  const handleSaveCurrentPreset = () => {
    const trimmedName = presetNameInput.trim()

    if (!trimmedName) {
      setPresetInlineError('Preset name is required before saving.')
      setPresetInlineStatus(null)
      return
    }

    const presetToSave: ReactivityLabBehaviorPreset = {
      ...currentBehaviorPreset,
      name: trimmedName,
    }

    const existingIndex = savedBehaviorPresets.findIndex((preset) => preset.name === trimmedName)
    const nextPresets = [...savedBehaviorPresets]
    if (existingIndex >= 0) {
      nextPresets.splice(existingIndex, 1, presetToSave)
    } else {
      nextPresets.push(presetToSave)
    }

    persistBehaviorPresets(nextPresets)
    setSelectedBehaviorPresetName(trimmedName)
    setPresetInlineError(null)
    setPresetInlineStatus(`Saved preset "${trimmedName}" to ${REACTIVITY_LAB_BEHAVIOR_PRESETS_STORAGE_KEY}.`)
  }

  const handleLoadSelectedPreset = () => {
    const preset = savedBehaviorPresets.find((candidate) => candidate.name === selectedBehaviorPresetName)

    if (!preset) {
      setPresetInlineError('Select a saved preset to load.')
      setPresetInlineStatus(null)
      return
    }

    applyBehaviorPreset(preset)
    setPresetNameInput(preset.name)
    setPresetInlineError(null)
    setPresetInlineStatus(`Loaded preset "${preset.name}".`)
  }

  const handleLoadBuiltInFullOnPreset = () => {
    applyBehaviorPreset(FULLON_BUILT_IN_PRESET)
    setPresetInlineError(null)
    setPresetInlineStatus('Loaded built-in preset "FULLON".')
  }

  const handleDeleteSelectedPreset = () => {
    if (!selectedBehaviorPresetName) {
      setPresetInlineError('Select a saved preset to delete.')
      setPresetInlineStatus(null)
      return
    }

    const nextPresets = savedBehaviorPresets.filter((preset) => preset.name !== selectedBehaviorPresetName)
    persistBehaviorPresets(nextPresets)
    setSelectedBehaviorPresetName(nextPresets[0]?.name ?? '')
    setPresetInlineError(null)
    setPresetInlineStatus(`Deleted preset "${selectedBehaviorPresetName}".`)
  }

  const handleCopyCurrentPresetJson = async () => {
    try {
      const presetJson = serializeBehaviorPreset(currentBehaviorPreset)
      await navigator.clipboard.writeText(presetJson)
      setPresetInlineError(null)
      setPresetInlineStatus('Copied current preset JSON to clipboard.')
    } catch {
      setPresetInlineError('Clipboard copy failed. Browser clipboard permission may be blocked.')
      setPresetInlineStatus(null)
    }
  }

  const handleApplyImportedPreset = () => {
    const validation = parseBehaviorPresetJson(importPresetJsonText)

    if (!validation.valid) {
      setPresetInlineError(validation.error)
      setPresetInlineStatus(null)
      return
    }

    applyBehaviorPreset(validation.preset)
    setPresetNameInput(validation.preset.name)
    setPresetInlineError(null)
    setPresetInlineStatus(`Applied imported preset "${validation.preset.name}".`)
  }

  const handleClearImportPreset = () => {
    setImportPresetJsonText('')
    setPresetInlineError(null)
    setPresetInlineStatus('Cleared import JSON.')
  }

  const handleRadioPresetChange = (nextPresetId: LabRadioPresetId) => {
    setSelectedRadioPresetId(nextPresetId)
    setLastStartFailure(null)

    if (sourceType !== 'external-radio') {
      return
    }

    void (async () => {
      if (isRadioPlaying) {
        await stopSignal()
        return
      }

      await applyRadioPreset(nextPresetId)
    })()
  }

  const handleStart = async () => {
    if (sourceType === 'local-mp3') {
      await radioController.stopSignal()

      if (audioController.playbackStatus !== 'playing') {
        await mp3Analysis.requestInitializationFromUserGesture()
        await audioController.play()
      }

      return
    }

    audioController.pause()

    try {
      setLastStartFailure(null)
      await applyRadioPreset(selectedRadioPresetId)
      await startSignal()
    } catch (error) {
      setLastStartFailure(error instanceof Error ? error.message : String(error))
    }
  }

  const handleStop = async () => {
    if (sourceType === 'local-mp3') {
      audioController.pause()
      return
    }

    await stopSignal()
  }

  const currentVolume = sourceType === 'local-mp3' ? mp3ListenerVolume : radioVolume
  const activeSourceLabel = sourceType === 'local-mp3' ? 'Local MP3' : 'External radio'
  const activeSelectionLabel = sourceType === 'local-mp3'
    ? (selectedMp3 ? formatAudioSourceLabel(selectedMp3) : 'n/a')
    : stationName
  const activePlaybackState = sourceType === 'local-mp3' ? audioController.playbackStatus : radioSignalState
  const inactiveSelectionLabel = sourceType === 'local-mp3'
    ? `Inactive radio preset: ${selectedRadioLabel}`
    : `Inactive MP3 track: ${selectedMp3 ? formatAudioSourceLabel(selectedMp3) : 'n/a'}`
  const startButtonLabel = sourceType === 'local-mp3' ? 'Start MP3' : 'Start Radio'

  const handleVolumeChange = (value: number) => {
    if (sourceType === 'local-mp3') {
      setMp3ListenerVolume(value)
      return
    }

    setRadioVolume(value)
  }

  const handleReactiveTelemetry = (telemetry: ReactivePreviewTelemetry) => {
    setRenderedDepth(telemetry.depthFinalAfterClamp)
    setRenderedHueShiftDegrees(telemetry.finalHueShiftDegrees)
  }

  const handleSceneDevCountersChange = useCallback((nextCounters: ImageDepthSceneDevCounters) => {
    setSceneDevCounters(nextCounters)
  }, [])

  const handleSceneColorDiagnosticsChange = useCallback((nextDiagnostics: ImageDepthSceneColorDiagnostics) => {
    setSceneColorDiagnostics(nextDiagnostics)
    setRenderedSaturation(nextDiagnostics.finalSaturationMultiplier)
  }, [])

  return (
    <main className="reactivity-lab" aria-label="Reactivity lab">
      <div className="reactivity-lab__workspace-shell">
        <section className="reactivity-lab__panel" aria-label="Reactivity lab controls">
          <p className="reactivity-lab__eyebrow">DeepSignals DEV Reactivity Lab</p>
          <h1 className="reactivity-lab__title">Behavior Authoring Workspace</h1>

          <div className="reactivity-lab__controls-grid reactivity-lab__controls-grid--top">
            <label className="reactivity-lab__field">
              <span className="reactivity-lab__label">Source Type</span>
              <select
                className="reactivity-lab__select"
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value as SourceType)}
              >
                <option value="local-mp3">Local MP3</option>
                <option value="external-radio">External radio</option>
              </select>
            </label>

            {sourceType === 'local-mp3' ? (
              <div className="reactivity-lab__field">
                <span className="reactivity-lab__label">Local MP3</span>
                <SignalSourceSelector
                  value={selectedMp3SourceId}
                  signals={MP3_SIGNAL_OPTIONS}
                  onChange={setSelectedMp3SourceId}
                />
              </div>
            ) : (
              <label className="reactivity-lab__field">
                <span className="reactivity-lab__label">External Radio Preset</span>
                <select
                  className="reactivity-lab__select"
                  value={selectedRadioPresetId}
                  onChange={(event) => handleRadioPresetChange(event.target.value as LabRadioPresetId)}
                >
                  {RADIO_PRESET_OPTIONS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="reactivity-lab__field">
              <span className="reactivity-lab__label">Playback</span>
              <div className="reactivity-lab__button-row">
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={isCurrentSourcePlaying}
                >
                  {startButtonLabel}
                </button>
                <button
                  type="button"
                  onClick={() => void handleStop()}
                  disabled={!isCurrentSourcePlaying}
                >
                  Stop
                </button>
              </div>
            </div>

            <div className="reactivity-lab__field">
              <span className="reactivity-lab__label">Listener Volume</span>
              <VolumeControl value={currentVolume} onChange={handleVolumeChange} />
            </div>
          </div>

          <section className="reactivity-lab__status reactivity-lab__status--compact" aria-label="Current source status">
            <p className="reactivity-lab__status-primary">Active source: {activeSourceLabel}</p>
            <p className="reactivity-lab__status-primary">Playback state: {activePlaybackState}</p>
            <p className="reactivity-lab__status-primary">Active track/station: {activeSelectionLabel}</p>
          </section>
        </section>

        <section className="reactivity-lab__visual-workspace" aria-label="Image depth manual preview">
          <aside className="reactivity-lab__visual-controls">
            <h2>Behavior Authoring Controls</h2>

            <label className="reactivity-lab__field">
              <span className="reactivity-lab__label">Image-depth environment</span>
              <select
                className="reactivity-lab__select"
                value={selectedImageDepthEnvironment?.id ?? ''}
                onChange={(event) => setSelectedImageDepthEnvironmentId(event.target.value)}
              >
                {imageDepthEnvironmentCatalog.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.displayName}
                  </option>
                ))}
              </select>
            </label>

            <div className="reactivity-lab__field">
              <span className="reactivity-lab__label">Preview Effect Toggles</span>
              <span className="reactivity-lab__toggle-row">
                <label className="reactivity-lab__toggle-pill">
                  <input
                    type="checkbox"
                    checked={depthPreviewEnabled}
                    onChange={(event) => setDepthPreviewEnabled(event.target.checked)}
                  />
                  <span>Depth</span>
                </label>
                <label className="reactivity-lab__toggle-pill">
                  <input
                    type="checkbox"
                    checked={huePreviewEnabled}
                    onChange={(event) => setHuePreviewEnabled(event.target.checked)}
                  />
                  <span>Hue</span>
                </label>
                <label className="reactivity-lab__toggle-pill">
                  <input
                    type="checkbox"
                    checked={saturationPreviewEnabled}
                    onChange={(event) => setSaturationPreviewEnabled(event.target.checked)}
                  />
                  <span>Saturation</span>
                </label>
              </span>
            </div>

            <details className="reactivity-lab__details" open>
              <summary>
                <span>Behavior presets</span>
                <span className="reactivity-lab__details-chevron" aria-hidden="true">
                  <PanelChevronIcon collapsed expandDirection="down" />
                </span>
              </summary>
              <div className="reactivity-lab__details-body">
                <section className="reactivity-lab__preset-panel" aria-label="Behavior presets">
                  <h2 className="reactivity-lab__preset-title">Behavior Presets (DEV)</h2>

                  <div className="reactivity-lab__preset-subpanel" aria-label="Built-In Presets">
                    <p className="reactivity-lab__preset-subtitle">Built-In Presets</p>
                    <div className="reactivity-lab__button-row">
                      <button type="button" onClick={handleLoadBuiltInFullOnPreset}>Load Built-In FULLON</button>
                    </div>
                  </div>

                  <label className="reactivity-lab__field">
                    <span className="reactivity-lab__label">Preset name</span>
                    <input
                      className="reactivity-lab__text-input"
                      type="text"
                      value={presetNameInput}
                      onChange={(event) => setPresetNameInput(event.target.value)}
                      placeholder="Enter preset name"
                    />
                  </label>

                  <div className="reactivity-lab__button-row">
                    <button type="button" onClick={handleSaveCurrentPreset}>Save Current Preset</button>
                    <button type="button" onClick={() => void handleCopyCurrentPresetJson()}>Copy Current Preset JSON</button>
                  </div>

                  <label className="reactivity-lab__field">
                    <span className="reactivity-lab__label">Saved Presets</span>
                    <select
                      className="reactivity-lab__select"
                      value={selectedBehaviorPresetName}
                      onChange={(event) => setSelectedBehaviorPresetName(event.target.value)}
                    >
                      {savedBehaviorPresets.length === 0 ? (
                        <option value="">No saved presets</option>
                      ) : null}
                      {savedBehaviorPresets.map((preset) => (
                        <option key={preset.name} value={preset.name}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="reactivity-lab__button-row">
                    <button type="button" onClick={handleLoadSelectedPreset}>Load Selected</button>
                    <button type="button" onClick={handleDeleteSelectedPreset}>Delete Selected</button>
                  </div>

                  <label className="reactivity-lab__field">
                    <span className="reactivity-lab__label">Import JSON</span>
                    <textarea
                      className="reactivity-lab__textarea"
                      value={importPresetJsonText}
                      onChange={(event) => setImportPresetJsonText(event.target.value)}
                      placeholder="Paste preset JSON"
                      rows={8}
                    />
                  </label>

                  <div className="reactivity-lab__button-row">
                    <button type="button" onClick={handleApplyImportedPreset}>Apply Imported Preset</button>
                    <button type="button" onClick={handleClearImportPreset}>Clear Import</button>
                  </div>

                  {presetInlineError ? <p className="reactivity-lab__preset-error">{presetInlineError}</p> : null}
                  {presetInlineStatus ? <p className="reactivity-lab__preset-status">{presetInlineStatus}</p> : null}
                </section>
              </div>
            </details>

            <details className="reactivity-lab__details" open>
              <summary>
                <span>Depth mapping</span>
                <span className="reactivity-lab__details-chevron" aria-hidden="true">
                  <PanelChevronIcon collapsed expandDirection="down" />
                </span>
              </summary>
              <div className="reactivity-lab__details-body">
                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Depth Mode</span>
                  <select
                    className="reactivity-lab__select"
                    value={depthMode}
                    onChange={(event) => setDepthMode(event.target.value as DepthMode)}
                  >
                    <option value="manual">Manual</option>
                    <option value="audio-mapped">Audio Mapped</option>
                  </select>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Depth Signal</span>
                  <select
                    className="reactivity-lab__select"
                    value={depthSignalField}
                    onChange={(event) => setDepthSignalField(event.target.value as TelemetrySignalField)}
                    disabled={depthMode !== 'audio-mapped'}
                  >
                    {TELEMETRY_SIGNAL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Minimum Depth</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min={DEPTH_CONTROL_LIMITS.min}
                    max={DEPTH_CONTROL_LIMITS.max}
                    step="0.01"
                    value={minimumDepth}
                    onChange={(event) => {
                      const nextMinimum = Number(event.target.value)
                      setMinimumDepth(nextMinimum)

                      if (nextMinimum > maximumDepth) {
                        setMaximumDepth(nextMinimum)
                      }
                    }}
                    disabled={depthMode !== 'audio-mapped'}
                  />
                  <strong>{minimumDepth.toFixed(2)}</strong>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Maximum Depth</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min={DEPTH_CONTROL_LIMITS.min}
                    max={DEPTH_CONTROL_LIMITS.max}
                    step="0.01"
                    value={maximumDepth}
                    onChange={(event) => {
                      const nextMaximum = Number(event.target.value)
                      setMaximumDepth(nextMaximum)

                      if (nextMaximum < minimumDepth) {
                        setMinimumDepth(nextMaximum)
                      }
                    }}
                    disabled={depthMode !== 'audio-mapped'}
                  />
                  <strong>{maximumDepth.toFixed(2)}</strong>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Response Smoothing</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min={DEPTH_CONTROL_LIMITS.smoothingMin}
                    max={DEPTH_CONTROL_LIMITS.smoothingMax}
                    step="0.01"
                    value={responseSmoothing}
                    onChange={(event) => setResponseSmoothing(Number(event.target.value))}
                    disabled={depthMode !== 'audio-mapped'}
                  />
                  <strong>{responseSmoothing.toFixed(2)}</strong>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Manual depth override</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={manualDepthOverride}
                    onChange={(event) => setManualDepthOverride(Number(event.target.value))}
                    disabled={depthMode !== 'manual'}
                  />
                  <strong>{manualDepthOverride.toFixed(2)}</strong>
                </label>

                <div className="reactivity-lab__button-row">
                  <button
                    type="button"
                    className="reactivity-lab__inline-button"
                    onClick={() => setManualDepthOverride(DEFAULT_MANUAL_DEPTH)}
                  >
                    Reset Depth to 0.5
                  </button>
                  <button
                    type="button"
                    className="reactivity-lab__inline-button"
                    onClick={() => {
                      setDepthSignalField('bass')
                      setMinimumDepth(DEFAULT_MINIMUM_DEPTH)
                      setMaximumDepth(DEFAULT_MAXIMUM_DEPTH)
                      setResponseSmoothing(DEFAULT_RESPONSE_SMOOTHING)
                    }}
                  >
                    Reset Depth Defaults
                  </button>
                </div>
              </div>
            </details>

            <details className="reactivity-lab__details" open>
              <summary>
                <span>Hue mapping</span>
                <span className="reactivity-lab__details-chevron" aria-hidden="true">
                  <PanelChevronIcon collapsed expandDirection="down" />
                </span>
              </summary>
              <div className="reactivity-lab__details-body">
                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Hue Mode</span>
                  <select
                    className="reactivity-lab__select"
                    value={hueMode}
                    onChange={(event) => setHueMode(event.target.value as HueMode)}
                  >
                    <option value="manual">Manual</option>
                    <option value="audio-mapped">Audio Mapped</option>
                    <option value="off">Off / Neutral</option>
                  </select>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Hue Signal</span>
                  <select
                    className="reactivity-lab__select"
                    value={hueSignalField}
                    onChange={(event) => setHueSignalField(event.target.value as TelemetrySignalField)}
                    disabled={hueMode !== 'audio-mapped'}
                  >
                    {TELEMETRY_SIGNAL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Minimum Hue Shift</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min={HUE_CONTROL_LIMITS.minDegrees}
                    max={HUE_CONTROL_LIMITS.maxDegrees}
                    step="1"
                    value={minimumHueShiftDegrees}
                    onChange={(event) => {
                      const nextMinimum = Number(event.target.value)
                      setMinimumHueShiftDegrees(nextMinimum)

                      if (nextMinimum > maximumHueShiftDegrees) {
                        setMaximumHueShiftDegrees(nextMinimum)
                      }
                    }}
                    disabled={hueMode !== 'audio-mapped'}
                  />
                  <strong>{minimumHueShiftDegrees.toFixed(0)}deg</strong>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Maximum Hue Shift</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min={HUE_CONTROL_LIMITS.minDegrees}
                    max={HUE_CONTROL_LIMITS.maxDegrees}
                    step="1"
                    value={maximumHueShiftDegrees}
                    onChange={(event) => {
                      const nextMaximum = Number(event.target.value)
                      setMaximumHueShiftDegrees(nextMaximum)

                      if (nextMaximum < minimumHueShiftDegrees) {
                        setMinimumHueShiftDegrees(nextMaximum)
                      }
                    }}
                    disabled={hueMode !== 'audio-mapped'}
                  />
                  <strong>{maximumHueShiftDegrees.toFixed(0)}deg</strong>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Hue Response Smoothing</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min={HUE_CONTROL_LIMITS.smoothingMin}
                    max={HUE_CONTROL_LIMITS.smoothingMax}
                    step="0.01"
                    value={hueResponseSmoothing}
                    onChange={(event) => setHueResponseSmoothing(Number(event.target.value))}
                    disabled={hueMode !== 'audio-mapped'}
                  />
                  <strong>{hueResponseSmoothing.toFixed(2)}</strong>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Manual Hue Shift</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min={HUE_CONTROL_LIMITS.minDegrees}
                    max={HUE_CONTROL_LIMITS.maxDegrees}
                    step="1"
                    value={manualHueShiftDegrees}
                    onChange={(event) => setManualHueShiftDegrees(Number(event.target.value))}
                    disabled={hueMode !== 'manual'}
                  />
                  <strong>{manualHueShiftDegrees.toFixed(0)}deg</strong>
                </label>

                <div className="reactivity-lab__button-row">
                  <button
                    type="button"
                    className="reactivity-lab__inline-button"
                    onClick={() => {
                      setHueMode('off')
                      setHueSignalField('mids')
                      setMinimumHueShiftDegrees(DEFAULT_MINIMUM_HUE_SHIFT_DEGREES)
                      setMaximumHueShiftDegrees(DEFAULT_MAXIMUM_HUE_SHIFT_DEGREES)
                      setHueResponseSmoothing(DEFAULT_HUE_RESPONSE_SMOOTHING)
                      setManualHueShiftDegrees(DEFAULT_MANUAL_HUE_SHIFT_DEGREES)
                    }}
                  >
                    Reset Hue Defaults
                  </button>
                </div>
              </div>
            </details>

            <details className="reactivity-lab__details" open>
              <summary>
                <span>Saturation mapping</span>
                <span className="reactivity-lab__details-chevron" aria-hidden="true">
                  <PanelChevronIcon collapsed expandDirection="down" />
                </span>
              </summary>
              <div className="reactivity-lab__details-body">
                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Saturation Mode</span>
                  <select
                    className="reactivity-lab__select"
                    value={saturationMode}
                    onChange={(event) => setSaturationMode(event.target.value as SaturationMode)}
                  >
                    <option value="off">Off / Neutral</option>
                    <option value="manual">Manual</option>
                    <option value="audio-mapped">Audio Mapped</option>
                  </select>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Saturation Signal</span>
                  <select
                    className="reactivity-lab__select"
                    value={saturationSignalField}
                    onChange={(event) => setSaturationSignalField(event.target.value as TelemetrySignalField)}
                    disabled={saturationMode !== 'audio-mapped'}
                  >
                    {TELEMETRY_SIGNAL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Minimum Saturation</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min={SATURATION_CONTROL_LIMITS.min}
                    max={SATURATION_CONTROL_LIMITS.max}
                    step="0.01"
                    value={minimumSaturation}
                    onChange={(event) => {
                      const nextMinimum = Number(event.target.value)
                      setMinimumSaturation(Math.max(0, nextMinimum))

                      if (nextMinimum > maximumSaturation) {
                        setMaximumSaturation(Math.max(0, nextMinimum))
                      }
                    }}
                    disabled={saturationMode !== 'audio-mapped'}
                  />
                  <strong>{minimumSaturation.toFixed(2)}</strong>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Maximum Saturation</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min={SATURATION_CONTROL_LIMITS.min}
                    max={SATURATION_CONTROL_LIMITS.max}
                    step="0.01"
                    value={maximumSaturation}
                    onChange={(event) => {
                      const nextMaximum = Number(event.target.value)
                      setMaximumSaturation(Math.max(0, nextMaximum))

                      if (nextMaximum < minimumSaturation) {
                        setMinimumSaturation(Math.max(0, nextMaximum))
                      }
                    }}
                    disabled={saturationMode !== 'audio-mapped'}
                  />
                  <strong>{maximumSaturation.toFixed(2)}</strong>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Saturation Response Smoothing</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min={SATURATION_CONTROL_LIMITS.smoothingMin}
                    max={SATURATION_CONTROL_LIMITS.smoothingMax}
                    step="0.01"
                    value={saturationResponseSmoothing}
                    onChange={(event) => setSaturationResponseSmoothing(Number(event.target.value))}
                    disabled={saturationMode !== 'audio-mapped'}
                  />
                  <strong>{saturationResponseSmoothing.toFixed(2)}</strong>
                </label>

                <label className="reactivity-lab__field">
                  <span className="reactivity-lab__label">Manual Saturation</span>
                  <input
                    className="reactivity-lab__range"
                    type="range"
                    min={SATURATION_CONTROL_LIMITS.min}
                    max={SATURATION_CONTROL_LIMITS.max}
                    step="0.01"
                    value={manualSaturation}
                    onChange={(event) => setManualSaturation(Math.max(0, Number(event.target.value)))}
                    disabled={saturationMode !== 'manual'}
                  />
                  <strong>{manualSaturation.toFixed(2)}</strong>
                </label>

                <div className="reactivity-lab__button-row">
                  <button
                    type="button"
                    className="reactivity-lab__inline-button"
                    onClick={() => {
                      setSaturationMode('off')
                      setSaturationSignalField('smoothedEnergy')
                      setMinimumSaturation(DEFAULT_MINIMUM_SATURATION)
                      setMaximumSaturation(DEFAULT_MAXIMUM_SATURATION)
                      setSaturationResponseSmoothing(DEFAULT_SATURATION_RESPONSE_SMOOTHING)
                      setManualSaturation(DEFAULT_MANUAL_SATURATION)
                    }}
                  >
                    Reset Saturation Defaults
                  </button>
                </div>
              </div>
            </details>

            <details className="reactivity-lab__details" open>
              <summary>
                <span>Live mapping readout</span>
                <span className="reactivity-lab__details-chevron" aria-hidden="true">
                  <PanelChevronIcon collapsed expandDirection="down" />
                </span>
              </summary>
              <div className="reactivity-lab__details-body">
                <div className="reactivity-lab__comparison-stack" aria-label="Mapped depth comparison">
                  <div className="reactivity-lab__comparison-row">
                    <span className="reactivity-lab__comparison-label reactivity-lab__label">Depth Selected Signal</span>
                    <div className="reactivity-lab__comparison-meter" aria-hidden="true">
                      <span className="reactivity-lab__comparison-meter-fill" style={{ width: `${selectedDepthSignalValue * 100}%` }} />
                    </div>
                    <p className="reactivity-lab__comparison-value reactivity-lab__status-primary">{selectedDepthSignalValue.toFixed(3)}</p>
                  </div>

                  <div className="reactivity-lab__comparison-row">
                    <span className="reactivity-lab__comparison-label reactivity-lab__label">Target Depth</span>
                    <div className="reactivity-lab__comparison-meter" aria-hidden="true">
                      <span className="reactivity-lab__comparison-meter-fill" style={{ width: `${clampUnit(targetDepthForDisplay) * 100}%` }} />
                    </div>
                    <p className="reactivity-lab__comparison-value reactivity-lab__status-primary">{targetDepthForDisplay.toFixed(3)}</p>
                  </div>

                  <div className="reactivity-lab__comparison-row">
                    <span className="reactivity-lab__comparison-label reactivity-lab__label">Rendered Depth</span>
                    <div className="reactivity-lab__comparison-meter" aria-hidden="true">
                      <span className="reactivity-lab__comparison-meter-fill" style={{ width: `${clampUnit(renderedDepth) * 100}%` }} />
                    </div>
                    <p className="reactivity-lab__comparison-value reactivity-lab__status-primary">{renderedDepth.toFixed(3)}</p>
                  </div>
                </div>

                <div className="reactivity-lab__comparison-stack" aria-label="Mapped hue comparison">
                  <div className="reactivity-lab__comparison-row">
                    <span className="reactivity-lab__comparison-label reactivity-lab__label">Hue Selected Signal</span>
                    <div className="reactivity-lab__comparison-meter" aria-hidden="true">
                      <span className="reactivity-lab__comparison-meter-fill" style={{ width: `${selectedHueSignalValue * 100}%` }} />
                    </div>
                    <p className="reactivity-lab__comparison-value reactivity-lab__comparison-value--hue reactivity-lab__status-primary">{selectedHueSignalValue.toFixed(3)}</p>
                  </div>

                  <div className="reactivity-lab__comparison-row">
                    <span className="reactivity-lab__comparison-label reactivity-lab__label">Target Hue Shift</span>
                    <div className="reactivity-lab__comparison-meter" aria-hidden="true">
                      <span
                        className="reactivity-lab__comparison-meter-fill"
                        style={{ width: `${normalizeValueWithinRange(targetHueShiftForDisplay, minimumHueShiftDegrees, maximumHueShiftDegrees) * 100}%` }}
                      />
                    </div>
                    <p className="reactivity-lab__comparison-value reactivity-lab__comparison-value--hue reactivity-lab__status-primary">{targetHueShiftForDisplay.toFixed(1)}deg</p>
                  </div>

                  <div className="reactivity-lab__comparison-row">
                    <span className="reactivity-lab__comparison-label reactivity-lab__label">Rendered Hue Shift</span>
                    <div className="reactivity-lab__comparison-meter" aria-hidden="true">
                      <span
                        className="reactivity-lab__comparison-meter-fill"
                        style={{ width: `${normalizeValueWithinRange(renderedHueShiftDegrees, minimumHueShiftDegrees, maximumHueShiftDegrees) * 100}%` }}
                      />
                    </div>
                    <p className="reactivity-lab__comparison-value reactivity-lab__comparison-value--hue reactivity-lab__status-primary">{renderedHueShiftDegrees.toFixed(1)}deg</p>
                  </div>
                </div>

                <div className="reactivity-lab__comparison-stack" aria-label="Mapped saturation comparison">
                  <div className="reactivity-lab__comparison-row">
                    <span className="reactivity-lab__comparison-label reactivity-lab__label">Saturation Selected Signal</span>
                    <div className="reactivity-lab__comparison-meter" aria-hidden="true">
                      <span className="reactivity-lab__comparison-meter-fill" style={{ width: `${selectedSaturationSignalValue * 100}%` }} />
                    </div>
                    <p className="reactivity-lab__comparison-value reactivity-lab__status-primary">{selectedSaturationSignalValue.toFixed(3)}</p>
                  </div>

                  <div className="reactivity-lab__comparison-row">
                    <span className="reactivity-lab__comparison-label reactivity-lab__label">Target Saturation</span>
                    <div className="reactivity-lab__comparison-meter" aria-hidden="true">
                      <span
                        className="reactivity-lab__comparison-meter-fill"
                        style={{ width: `${normalizeValueWithinRange(targetSaturationForDisplay, minimumSaturation, maximumSaturation) * 100}%` }}
                      />
                    </div>
                    <p className="reactivity-lab__comparison-value reactivity-lab__status-primary">{targetSaturationForDisplay.toFixed(3)}</p>
                  </div>

                  <div className="reactivity-lab__comparison-row">
                    <span className="reactivity-lab__comparison-label reactivity-lab__label">Rendered Saturation</span>
                    <div className="reactivity-lab__comparison-meter" aria-hidden="true">
                      <span
                        className="reactivity-lab__comparison-meter-fill"
                        style={{ width: `${normalizeValueWithinRange(renderedSaturation, minimumSaturation, maximumSaturation) * 100}%` }}
                      />
                    </div>
                    <p className="reactivity-lab__comparison-value reactivity-lab__status-primary">{renderedSaturation.toFixed(3)}</p>
                  </div>
                </div>
              </div>
            </details>
          </aside>

          <div className="reactivity-lab__image-depth-scene-column">
            <div className="reactivity-lab__image-depth-scene-wrap">
              {selectedImageDepthEnvironment && previewScenePreset ? (
                <ImageDepthThemeScene
                  sceneId={`${selectedImageDepthEnvironment.id}-reactivity-lab-preview`}
                  sceneBackdrop={selectedImageDepthEnvironment.sceneBackdrop}
                  asset={selectedImageDepthEnvironment.asset}
                  scenePreset={previewScenePreset}
                  className="reactivity-lab__image-depth-scene"
                  manualDepthOverride={liveDepthOverride}
                  manualHueShiftOverrideDegrees={liveHueShiftOverrideDegrees}
                  manualSaturationOverrideMultiplier={liveSaturationOverride}
                  preserveColorWhenStopped
                  isPlaying={false}
                  volume={0}
                  signalId={null}
                  audioLevel={0}
                  reducedMotion={false}
                  motionEnabled
                  sourceBpm={null}
                  reactivePreviewEnabled={false}
                  reactiveBehavior="chill"
                  reactiveDepthMode="default"
                  onReactivePreviewTelemetry={handleReactiveTelemetry}
                  onDevSceneCountersChange={handleSceneDevCountersChange}
                  onDevColorDiagnosticsChange={handleSceneColorDiagnosticsChange}
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="reactivity-lab__diagnostics-stack" aria-label="Diagnostics panels">
          <details className="reactivity-lab__details">
            <summary>
              <span>Detailed telemetry/resource diagnostics</span>
              <span className="reactivity-lab__details-chevron" aria-hidden="true">
                <PanelChevronIcon collapsed expandDirection="down" />
              </span>
            </summary>
            <div className="reactivity-lab__details-body">
              <div className="reactivity-lab__diagnostics-stack-inner">
                <section className="reactivity-lab__telemetry-summary" aria-label="Telemetry summary values">
                  <h2>Common Snapshot Fields</h2>
                  <p>energy: {telemetrySnapshot.energy.toFixed(3)}</p>
                  <p>smoothedEnergy: {telemetrySnapshot.smoothedEnergy.toFixed(3)}</p>
                  <p>bass: {telemetrySnapshot.bass.toFixed(3)}</p>
                  <p>kickPulse: {telemetrySnapshot.kickPulse.toFixed(3)}</p>
                  <p>bassPulse: {telemetrySnapshot.bassPulse.toFixed(3)}</p>
                  <p>mids: {telemetrySnapshot.mids.toFixed(3)}</p>
                  <p>highs: {telemetrySnapshot.highs.toFixed(3)}</p>
                  <p>transient: {telemetrySnapshot.transient.toFixed(3)}</p>
                  <p>analysis status: {telemetryStatus}</p>
                  <p>graph context: {telemetryGraphDetails.contextState ?? 'n/a'}</p>
                  <p>graph range: {formatDbRange(telemetryGraphDetails.minDecibels, telemetryGraphDetails.maxDecibels)}</p>
                </section>

                <AudioAnalysisDiagnostics
                  status={telemetryStatus}
                  snapshot={telemetrySnapshot}
                  bassPulseDebug={sourceType === 'local-mp3' ? mp3Analysis.bassPulseDebug : ZERO_BASS_PULSE_DEBUG}
                  kickPulseDebug={sourceType === 'local-mp3' ? mp3Analysis.kickPulseDebug : ZERO_KICK_PULSE_DEBUG}
                  graphDetails={telemetryGraphDetails}
                  errorMessage={telemetryErrorMessage}
                  diagnosticsPublishHz={sourceType === 'local-mp3' ? mp3Analysis.diagnosticsPublishHz : 20}
                  analysisCalculationMode="requestAnimationFrame"
                  sourceBpm={telemetrySourceBpm}
                  effectiveReactiveBpm={telemetrySourceBpm}
                  reactiveDiagnosticsEnabled={false}
                  ignoreSourceBpmEnabled={false}
                />

                <section className="reactivity-lab__resources" aria-label="Audio resource diagnostics">
                  <h2>Resource Diagnostics</h2>
                  <dl>
                    <div>
                      <dt>audio elements</dt>
                      <dd>{telemetryResourceDiagnostics.audioElements}</dd>
                    </div>
                    <div>
                      <dt>AudioContexts</dt>
                      <dd>{telemetryResourceDiagnostics.audioContexts}</dd>
                    </div>
                    <div>
                      <dt>MediaElementSourceNodes</dt>
                      <dd>{telemetryResourceDiagnostics.mediaElementSourceNodes}</dd>
                    </div>
                    <div>
                      <dt>analyzers</dt>
                      <dd>{telemetryResourceDiagnostics.analyzers}</dd>
                    </div>
                    <div>
                      <dt>GainNodes</dt>
                      <dd>{telemetryResourceDiagnostics.gainNodes}</dd>
                    </div>
                    <div>
                      <dt>active analysis loops</dt>
                      <dd>{telemetryResourceDiagnostics.activeAnalysisLoops}</dd>
                    </div>
                    <div>
                      <dt>current source type</dt>
                      <dd>{telemetryResourceDiagnostics.sourceType}</dd>
                    </div>
                  </dl>

                  {radioGraphDetailsSummary ? (
                    <p className="reactivity-lab__resource-note">
                      Radio frame diagnostics: rms {radioGraphDetailsSummary.timeDomainRms.toFixed(4)}, frame delta{' '}
                      {radioGraphDetailsSummary.frameDeltaMs.toFixed(2)} ms, context{' '}
                      {radioGraphDetailsSummary.audioContextState}
                    </p>
                  ) : null}
                </section>

                <section className="reactivity-lab__status" aria-label="Detailed source status diagnostics">
                <p className="reactivity-lab__status-primary">Active source: {activeSourceLabel}</p>
                <p className="reactivity-lab__status-primary">Active track/station: {activeSelectionLabel}</p>
                <p className="reactivity-lab__status-primary">Playback state: {activePlaybackState}</p>
                <p className="reactivity-lab__status-secondary">{inactiveSelectionLabel}</p>
                <p className="reactivity-lab__status-secondary">
                  Last radio lifecycle event: {reconnectDiagnostics.lastEvent ?? 'n/a'}
                </p>
                <p className="reactivity-lab__status-secondary">
                  Last start failure: {lastStartFailure ?? radioErrorMessage ?? 'none'}
                </p>
                <p className="reactivity-lab__status-secondary">
                  Scene mounts: {sceneDevCounters.sceneComponentMountCount} | unmounts: {sceneDevCounters.sceneComponentUnmountCount}
                </p>
                <p className="reactivity-lab__status-secondary">
                  Renderer creates: {sceneDevCounters.rendererCreationCount} | texture loads: {sceneDevCounters.textureLoadCount}
                </p>
                <p className="reactivity-lab__status-secondary">
                  Material/geometry inits: {sceneDevCounters.materialGeometryInitializationCount} | environment changes: {sceneDevCounters.environmentChangeCount}
                </p>
                <p className="reactivity-lab__status-secondary">
                  Depth updates: {sceneDevCounters.depthUpdateCount}
                </p>
                <p className="reactivity-lab__status-secondary">
                  Color texture: {sceneColorDiagnostics.colorTextureUrl.split('/').pop() || 'n/a'}
                </p>
                <p className="reactivity-lab__status-secondary">
                  Depth texture: {sceneColorDiagnostics.depthTextureUrl.split('/').pop() || 'n/a'}
                </p>
                <p className="reactivity-lab__status-secondary">
                  Final filter: {sceneColorDiagnostics.finalFilterString}
                </p>
                <p className="reactivity-lab__status-secondary">
                  Final hue: {sceneColorDiagnostics.finalHueDegrees.toFixed(2)}deg | saturation: {sceneColorDiagnostics.finalSaturationMultiplier.toFixed(3)} | grayscale: {sceneColorDiagnostics.finalGrayscaleAmount.toFixed(3)}
                </p>
                <p className="reactivity-lab__status-secondary">
                  Brightness: {sceneColorDiagnostics.finalBrightnessMultiplier.toFixed(3)} | contrast: {sceneColorDiagnostics.finalContrastMultiplier.toFixed(3)} | visual state: {sceneColorDiagnostics.playbackVisualState}
                </p>
                </section>
              </div>
            </div>
          </details>
        </section>
      </div>
    </main>
  )
}

export default ReactivityLabShell
