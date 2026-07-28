import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AUDIO_SOURCES, formatAudioSourceLabel } from './audioSources'
import AudioAnalysisDiagnostics from '../components/AudioAnalysisDiagnostics'
import FloatingPlayerPanel from '../components/FloatingPlayerPanel'
import SignalTelemetryPanel from '../components/SignalTelemetryPanel'
import StationIdentOverlay from '../components/StationIdentOverlay'
import VisualFeedWindow from '../components/VisualFeedWindow'
import { themeRegistry } from '../themes/themeRegistry'
import type {
  ImageDepthSceneCounters,
  ReactivePreviewTelemetry,
  SignalSource,
} from './playerTypes'
import type { ThemeId, ThemeSceneProps } from '../themes/themeTypes'
import { preloadImageDepthTextures } from '../themes/image-depth/imageDepthTextureCache'
import { imageDepthEnvironmentCatalog } from '../themes/image-depth/environmentCatalog'
import { useAudioAnalysis } from './useAudioAnalysis'
import { usePersistentAudioController } from './usePersistentAudioController'
import { defaultThemeId } from '../themes/themeRegistry'
import {
  mapSignalTarget,
  resolveShortestHueDeltaDegrees,
  stepSmoothedValue,
  wrapSignedDegrees,
} from './reactiveBehaviorMapping'
import { FULLON_BUILT_IN_PRESET, resolveSnapshotSignal } from './reactiveBehaviorPresetSchema'
import '../styles/player.css'

type PlayerShellProps = {
  className?: string
}

type PlayerPreferencesV1 = {
  selectedThemeId: ThemeId
  selectedAudioSourceId: string
  volume: number
  motionEnabled: boolean
  visualFeedOpen: boolean
}

type PlayerPreferencesV2 = PlayerPreferencesV1 & {
  selectedBehavior?: 'chill' | 'fullon'
  signalTelemetryVisible?: boolean
}

const PLAYER_PREFERENCES_STORAGE_KEY_V1 = 'deepsignals.player.preferences.v1'
const PLAYER_PREFERENCES_STORAGE_KEY_V2 = 'deepsignals.player.preferences.v2'
const SIGNAL_TELEMETRY_VISIBLE_STORAGE_KEY_V1 = 'deepsignals.player.signal-telemetry.visible.v1'
const SIGNAL_TELEMETRY_COLLAPSED_STORAGE_KEY_V1 = 'deepsignals.player.signal-telemetry.collapsed.v1'

const FULLON_STOP_SETTLE_DEPTH = 0.5
const FULLON_STOP_SETTLE_HUE_DEGREES = 0
const FULLON_STOP_SETTLE_SATURATION = 1

const availableAudioSourceIds = new Set(AUDIO_SOURCES.map((source) => source.id))

function sanitizeThemeId(value: unknown): ThemeId {
  if (typeof value !== 'string') {
    return defaultThemeId
  }

  return themeRegistry.some((theme) => theme.id === value) ? value : defaultThemeId
}

function sanitizeAudioSourceId(value: unknown): string {
  if (typeof value !== 'string') {
    return AUDIO_SOURCES[0]?.id ?? ''
  }

  return availableAudioSourceIds.has(value) ? value : (AUDIO_SOURCES[0]?.id ?? '')
}

function sanitizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function sanitizeVolume(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1
  }

  return Math.min(1, Math.max(0, value))
}

function readStoredPlayerPreferences(): PlayerPreferencesV2 {
  const fallback: PlayerPreferencesV2 = {
    selectedThemeId: defaultThemeId,
    selectedAudioSourceId: AUDIO_SOURCES[0]?.id ?? '',
    volume: 1,
    motionEnabled: true,
    visualFeedOpen: false,
  }

  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const rawV2 = window.localStorage.getItem(PLAYER_PREFERENCES_STORAGE_KEY_V2)

    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<PlayerPreferencesV2>

      return {
        selectedThemeId: sanitizeThemeId(parsed.selectedThemeId),
        selectedAudioSourceId: sanitizeAudioSourceId(parsed.selectedAudioSourceId),
        volume: 1,
        motionEnabled: sanitizeBoolean(parsed.motionEnabled, true),
        visualFeedOpen: sanitizeBoolean(parsed.visualFeedOpen, false),
      }
    }

    const rawV1 = window.localStorage.getItem(PLAYER_PREFERENCES_STORAGE_KEY_V1)

    if (!rawV1) {
      return fallback
    }

    const parsed = JSON.parse(rawV1) as Partial<PlayerPreferencesV1>

    return {
      selectedThemeId: sanitizeThemeId(parsed.selectedThemeId),
      selectedAudioSourceId: sanitizeAudioSourceId(parsed.selectedAudioSourceId),
      volume: 1,
      motionEnabled: sanitizeBoolean(parsed.motionEnabled, true),
      visualFeedOpen: sanitizeBoolean(parsed.visualFeedOpen, false),
    }
  } catch {
    return fallback
  }
}

function readStoredSignalTelemetryVisiblePreference() {
  const fallback = true

  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(SIGNAL_TELEMETRY_VISIBLE_STORAGE_KEY_V1)

    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw) as { visible?: unknown } | unknown

    if (typeof parsed === 'object' && parsed !== null && 'visible' in parsed) {
      return sanitizeBoolean((parsed as { visible?: unknown }).visible, fallback)
    }

    return fallback
  } catch {
    return fallback
  }
}

function readStoredSignalTelemetryCollapsedPreference() {
  const fallback = false

  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(SIGNAL_TELEMETRY_COLLAPSED_STORAGE_KEY_V1)

    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw) as { collapsed?: unknown } | unknown

    if (typeof parsed === 'object' && parsed !== null && 'collapsed' in parsed) {
      return sanitizeBoolean((parsed as { collapsed?: unknown }).collapsed, fallback)
    }

    return fallback
  } catch {
    return fallback
  }
}

function isAudioDebugEnabled() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false
  }

  const searchParams = new URLSearchParams(window.location.search)
  return searchParams.get('audioDebug') === '1'
}

function readReactiveBehaviorOverrideFromQuery(): 'chill' | 'fullon' | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return null
  }

  const searchParams = new URLSearchParams(window.location.search)
  const requestedBehavior = searchParams.get('reactiveBehavior')?.toLowerCase()

  if (requestedBehavior === 'fullon' || requestedBehavior === 'chill') {
    return requestedBehavior
  }

  return null
}

function isIgnoreSourceBpmEnabled() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false
  }

  const searchParams = new URLSearchParams(window.location.search)
  return searchParams.get('ignoreSourceBpm') === '1'
}

const ZERO_REACTIVE_PREVIEW_TELEMETRY: ReactivePreviewTelemetry = {
  selectedReactiveBehavior: 'Chill',
  selectedDepthSignalField: 'n/a',
  selectedHueSignalField: 'n/a',
  selectedSaturationSignalField: 'n/a',
  reactivePreviewEnabled: false,
  reactiveIsolationEnabled: false,
  reactiveTimingAuthorityActive: false,
  musicAuthorityActive: false,
  motionGateOpen: false,
  authoredCyclicBreathingEnabled: false,
  authoredDepthContribution: 0,
  authoredAmbientGeometryContribution: 0,
  depthSustainedContribution: 0,
  kickDrivenDepthContribution: 0,
  depthPulseContribution: 0,
  depthCombinedBeforeClamp: 0,
  configuredDepthMinimum: 0,
  configuredDepthMaximum: 0,
  depthFinalAfterClamp: 0,
  finalDisplacementScale: 0,
  kickPulse: 0,
  kickPulseAcceptedEvent: false,
  kickPulseAcceptedEventCount: 0,
  kickPulseAcceptedEventSequence: 0,
  rendererKickEventCountLastSeen: 0,
  rendererKickEventSequenceLastSeen: 0,
  sourceBpm: null,
  beatIntervalMs: null,
  acceptedEventMinimumIntervalMs: 0,
  millisecondsSincePreviousAcceptedEvent: 0,
  acceptedEventRatePerSecondRecent: 0,
  smoothedEnergy: 0,
  sectionIntensity: 0,
  fullOnPhase: 'n/a',
  fullOnTargetDepth: 0,
  fullOnCurrentDepth: 0,
  fullOnTargetSaturation: 1,
  fullOnCurrentSaturation: 1,
  millisecondsSinceAcceptedKickEvent: 0,
  inactivityReturnActive: false,
  kickBreathEnvelope: 0,
  fullOnLowTargetDepth: 0,
  fullOnHighTargetDepth: 0,
  fullOnAttackDurationMs: 0,
  fullOnReleaseDurationMs: 0,
  kickBloomEnvelope: 0,
  hueEventStride: 1,
  hueEventStepAppliedDegrees: 0,
  reactiveHueTargetDegrees: 0,
  reactiveHueOffsetDegrees: 0,
  finalHueShiftDegrees: 0,
  authoredBaseSaturation: 1,
  authoredPeriodicSaturationContribution: 0,
  reactiveSaturationMultiplier: 1,
  finalSaturation: 1,
  grayscaleFilterActive: false,
  saturationBloomMultiplier: 1,
  saturationCap: 2,
  authoredBaseGlow: 1,
  reactiveKickBloom: 0,
  reactiveKickSurfaceGlowBloom: 0,
  globalGlowMultiplier: 1,
  saturationMultiplier: 1,
  globalLightMultiplier: 1,
  finalGlobalGlowMultiplier: 1,
  finalSurfaceGlowMultiplier: 1,
  surfaceGlowMultiplier: 1,
  authoredHueCycleSuppressed: false,
  authoredSaturationCycleSuppressed: false,
  authoredGlobalGlowCycleSuppressed: false,
  transientAccent: 0,
  geometryMotionActive: false,
}

const ZERO_IMAGE_DEPTH_SCENE_COUNTERS: ImageDepthSceneCounters = {
  sceneComponentMountCount: 0,
  sceneComponentUnmountCount: 0,
  rendererCreationCount: 0,
  textureLoadCount: 0,
  materialGeometryInitializationCount: 0,
  environmentChangeCount: 0,
  depthUpdateCount: 0,
}

function PlayerShell({ className }: PlayerShellProps) {
  const [audioDebugEnabled] = useState(() => isAudioDebugEnabled())
  const [reactiveBehaviorOverride] = useState(() => readReactiveBehaviorOverrideFromQuery())
  const [ignoreSourceBpmEnabled] = useState(() => isIgnoreSourceBpmEnabled())
  const [storedPreferences] = useState<PlayerPreferencesV2>(() => readStoredPlayerPreferences())
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(storedPreferences.selectedThemeId)
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(storedPreferences.selectedAudioSourceId)
  const [motionEnabled, setMotionEnabled] = useState(storedPreferences.motionEnabled)
  const [signalTelemetryVisible, setSignalTelemetryVisible] = useState(() => readStoredSignalTelemetryVisiblePreference())
  const [signalTelemetryCollapsed, setSignalTelemetryCollapsed] = useState(() =>
    readStoredSignalTelemetryCollapsedPreference(),
  )
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [visualFeedOpen, setVisualFeedOpen] = useState(storedPreferences.visualFeedOpen)
  const reactivePreviewTelemetryRef = useRef<ReactivePreviewTelemetry>(ZERO_REACTIVE_PREVIEW_TELEMETRY)
  const [sceneCounters, setSceneCounters] = useState<ImageDepthSceneCounters>(ZERO_IMAGE_DEPTH_SCENE_COUNTERS)
  const [fullOnDepthOverride, setFullOnDepthOverride] = useState(FULLON_STOP_SETTLE_DEPTH)
  const [fullOnHueShiftOverrideDegrees, setFullOnHueShiftOverrideDegrees] = useState(FULLON_STOP_SETTLE_HUE_DEGREES)
  const [fullOnSaturationOverrideMultiplier, setFullOnSaturationOverrideMultiplier] = useState(FULLON_STOP_SETTLE_SATURATION)
  const fullOnDepthCurrentRef = useRef(FULLON_STOP_SETTLE_DEPTH)
  const fullOnHueCurrentRef = useRef(FULLON_STOP_SETTLE_HUE_DEGREES)
  const fullOnSaturationCurrentRef = useRef(FULLON_STOP_SETTLE_SATURATION)
  const audioController = usePersistentAudioController(storedPreferences.volume, selectedSignalId ?? undefined)
  const registrySourceBpm = audioController.audioSource.bpm ?? null
  const effectiveReactiveBpm = ignoreSourceBpmEnabled ? null : registrySourceBpm
  const audioAnalysis = useAudioAnalysis({
    audioElement: audioController.audioElement,
    playbackStatus: audioController.playbackStatus,
    isSeeking: audioController.isSeeking,
    audioSourceId: selectedSignalId,
    sourceBpm: effectiveReactiveBpm,
    publishDiagnostics: audioDebugEnabled,
  })

  const imageDepthAssetsByThemeId = useMemo(
    () =>
      new Map(imageDepthEnvironmentCatalog.map((environment) => [environment.id as ThemeId, environment.asset])),
    [],
  )

  useEffect(() => {
    const selectedAsset = imageDepthAssetsByThemeId.get(selectedThemeId)

    if (!selectedAsset) {
      return
    }

    void preloadImageDepthTextures(selectedAsset)
  }, [selectedThemeId, imageDepthAssetsByThemeId])

  const signals: SignalSource[] = useMemo(
    () => AUDIO_SOURCES.map((source) => ({ id: source.id, label: formatAudioSourceLabel(source) })),
    [],
  )

  const activeTheme = useMemo(() => {
    return themeRegistry.find((theme) => theme.id === selectedThemeId)
  }, [selectedThemeId])

  const themeOptions = useMemo(
    () => themeRegistry.map((theme) => ({ id: theme.id, name: theme.name })),
    [],
  )

  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.id === selectedSignalId),
    [selectedSignalId, signals],
  )

  const supportsMotion = activeTheme?.supportsMotion ?? true
  const supportsVisualFeed = activeTheme?.supportsVisualFeed ?? true
  const supportsAudioReactiveBehavior = activeTheme?.supportsAudioReactiveBehavior ?? false
  const productionFullOnActive = supportsAudioReactiveBehavior
  const productionDepthMotionSuppressed = supportsAudioReactiveBehavior && !motionEnabled

  const handleSignalChange = (id: string) => {
    setSelectedSignalId(sanitizeAudioSourceId(id) || null)
  }

  const handleThemeChange = (themeId: ThemeId) => {
    setSelectedThemeId(themeId)

    const nextTheme = themeRegistry.find((theme) => theme.id === themeId)

    if (!nextTheme?.supportsVisualFeed) {
      setVisualFeedOpen(false)
    }
  }

  useEffect(() => {
    const resetFullOnOverrides = () => {
      if (
        fullOnDepthCurrentRef.current === FULLON_STOP_SETTLE_DEPTH &&
        fullOnHueCurrentRef.current === FULLON_STOP_SETTLE_HUE_DEGREES &&
        fullOnSaturationCurrentRef.current === FULLON_STOP_SETTLE_SATURATION
      ) {
        return
      }

      fullOnDepthCurrentRef.current = FULLON_STOP_SETTLE_DEPTH
      fullOnHueCurrentRef.current = FULLON_STOP_SETTLE_HUE_DEGREES
      fullOnSaturationCurrentRef.current = FULLON_STOP_SETTLE_SATURATION
      setFullOnDepthOverride(FULLON_STOP_SETTLE_DEPTH)
      setFullOnHueShiftOverrideDegrees(FULLON_STOP_SETTLE_HUE_DEGREES)
      setFullOnSaturationOverrideMultiplier(FULLON_STOP_SETTLE_SATURATION)
    }

    if (!productionFullOnActive) {
      resetFullOnOverrides()
      return
    }

    let rafId: number | null = null
    const getLatestSnapshot = audioAnalysis.getLatestSnapshot

    const tick = () => {
      const snapshot = getLatestSnapshot()
      const isPlayingNow = audioController.playbackStatus === 'playing'

      const energySignal = resolveSnapshotSignal(snapshot, FULLON_BUILT_IN_PRESET.depth.signal)
      const bassSignal = resolveSnapshotSignal(snapshot, FULLON_BUILT_IN_PRESET.saturation.signal)

      const depthTarget = isPlayingNow
        ? mapSignalTarget(energySignal, FULLON_BUILT_IN_PRESET.depth.min, FULLON_BUILT_IN_PRESET.depth.max)
        : FULLON_STOP_SETTLE_DEPTH
      const hueTarget = isPlayingNow
        ? mapSignalTarget(energySignal, FULLON_BUILT_IN_PRESET.hue.minDegrees, FULLON_BUILT_IN_PRESET.hue.maxDegrees)
        : FULLON_STOP_SETTLE_HUE_DEGREES
      const saturationTarget = isPlayingNow
        ? mapSignalTarget(bassSignal, FULLON_BUILT_IN_PRESET.saturation.min, FULLON_BUILT_IN_PRESET.saturation.max)
        : FULLON_STOP_SETTLE_SATURATION

      const nextDepth = stepSmoothedValue(
        fullOnDepthCurrentRef.current,
        depthTarget,
        FULLON_BUILT_IN_PRESET.depth.smoothing,
      )
      const shortestHueDelta = resolveShortestHueDeltaDegrees(fullOnHueCurrentRef.current, hueTarget)
      const nextHue = wrapSignedDegrees(
        stepSmoothedValue(
          fullOnHueCurrentRef.current,
          fullOnHueCurrentRef.current + shortestHueDelta,
          FULLON_BUILT_IN_PRESET.hue.smoothing,
        ),
      )
      const nextSaturation = Math.max(
        0,
        stepSmoothedValue(
          fullOnSaturationCurrentRef.current,
          saturationTarget,
          FULLON_BUILT_IN_PRESET.saturation.smoothing,
        ),
      )

      fullOnDepthCurrentRef.current = Math.abs(nextDepth - depthTarget) < 0.0005 ? depthTarget : nextDepth
      fullOnHueCurrentRef.current = Math.abs(shortestHueDelta) < 0.05 ? wrapSignedDegrees(hueTarget) : nextHue
      fullOnSaturationCurrentRef.current =
        Math.abs(nextSaturation - saturationTarget) < 0.0005 ? saturationTarget : nextSaturation

      const effectiveRenderedDepth = productionDepthMotionSuppressed
        ? FULLON_STOP_SETTLE_DEPTH
        : fullOnDepthCurrentRef.current

      setFullOnDepthOverride(effectiveRenderedDepth)
      setFullOnHueShiftOverrideDegrees(fullOnHueCurrentRef.current)
      setFullOnSaturationOverrideMultiplier(fullOnSaturationCurrentRef.current)

      reactivePreviewTelemetryRef.current = {
        ...reactivePreviewTelemetryRef.current,
        selectedReactiveBehavior: 'Full On',
        selectedDepthSignalField: FULLON_BUILT_IN_PRESET.depth.signal,
        selectedHueSignalField: FULLON_BUILT_IN_PRESET.hue.signal,
        selectedSaturationSignalField: FULLON_BUILT_IN_PRESET.saturation.signal,
        reactivePreviewEnabled: true,
        fullOnTargetDepth: depthTarget,
        fullOnCurrentDepth: effectiveRenderedDepth,
        reactiveHueTargetDegrees: hueTarget,
        reactiveHueOffsetDegrees: fullOnHueCurrentRef.current,
        finalHueShiftDegrees: fullOnHueCurrentRef.current,
        fullOnTargetSaturation: saturationTarget,
        fullOnCurrentSaturation: fullOnSaturationCurrentRef.current,
        finalSaturation: fullOnSaturationCurrentRef.current,
      }

      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [
    audioAnalysis.getLatestSnapshot,
    audioController.playbackStatus,
    productionDepthMotionSuppressed,
    productionFullOnActive,
  ])

  const effectiveProductionDepthOverride = productionDepthMotionSuppressed
    ? FULLON_STOP_SETTLE_DEPTH
    : productionFullOnActive
      ? fullOnDepthOverride
      : undefined

  const handleSceneCountersChange = useCallback((nextCounters: ImageDepthSceneCounters) => {
    setSceneCounters((current) => {
      if (
        current.sceneComponentMountCount === nextCounters.sceneComponentMountCount &&
        current.sceneComponentUnmountCount === nextCounters.sceneComponentUnmountCount &&
        current.rendererCreationCount === nextCounters.rendererCreationCount &&
        current.textureLoadCount === nextCounters.textureLoadCount &&
        current.materialGeometryInitializationCount === nextCounters.materialGeometryInitializationCount &&
        current.environmentChangeCount === nextCounters.environmentChangeCount &&
        current.depthUpdateCount === nextCounters.depthUpdateCount
      ) {
        return current
      }

      return nextCounters
    })
  }, [])

  const sceneProps: ThemeSceneProps = {
    isPlaying: audioController.playbackStatus === 'playing',
    volume: audioController.volume,
    signalId: selectedSignalId,
    audioLevel: 0,
    sourceBpm: effectiveReactiveBpm,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    motionEnabled,
    getLatestAudioSnapshot: audioAnalysis.getLatestSnapshot,
    reactivePreviewEnabled: supportsAudioReactiveBehavior && !productionFullOnActive,
    reactiveBehavior: 'chill',
    manualDepthOverride: effectiveProductionDepthOverride,
    manualHueShiftOverrideDegrees: productionFullOnActive ? fullOnHueShiftOverrideDegrees : null,
    manualSaturationOverrideMultiplier: productionFullOnActive ? fullOnSaturationOverrideMultiplier : null,
    onDevSceneCountersChange: handleSceneCountersChange,
    onReactivePreviewTelemetry: (telemetry) => {
      reactivePreviewTelemetryRef.current = productionFullOnActive
        ? {
            ...telemetry,
            selectedReactiveBehavior: 'Full On',
            selectedDepthSignalField: FULLON_BUILT_IN_PRESET.depth.signal,
            selectedHueSignalField: FULLON_BUILT_IN_PRESET.hue.signal,
            selectedSaturationSignalField: FULLON_BUILT_IN_PRESET.saturation.signal,
            fullOnTargetDepth: reactivePreviewTelemetryRef.current.fullOnTargetDepth,
            fullOnCurrentDepth: productionDepthMotionSuppressed
              ? FULLON_STOP_SETTLE_DEPTH
              : reactivePreviewTelemetryRef.current.fullOnCurrentDepth,
            reactiveHueTargetDegrees: reactivePreviewTelemetryRef.current.reactiveHueTargetDegrees,
            reactiveHueOffsetDegrees: reactivePreviewTelemetryRef.current.reactiveHueOffsetDegrees,
            finalHueShiftDegrees: reactivePreviewTelemetryRef.current.finalHueShiftDegrees,
            fullOnTargetSaturation: reactivePreviewTelemetryRef.current.fullOnTargetSaturation,
            fullOnCurrentSaturation: reactivePreviewTelemetryRef.current.fullOnCurrentSaturation,
            finalSaturation: reactivePreviewTelemetryRef.current.fullOnCurrentSaturation,
          }
        : telemetry
    },
  }

  const reactiveDiagnosticsEnabled = audioDebugEnabled

  const getReactivePreviewTelemetry = useCallback(() => {
    return reactivePreviewTelemetryRef.current
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const payload: PlayerPreferencesV2 = {
        selectedThemeId: sanitizeThemeId(selectedThemeId),
        selectedAudioSourceId: sanitizeAudioSourceId(selectedSignalId),
        volume: sanitizeVolume(audioController.volume),
        motionEnabled,
        visualFeedOpen: visualFeedOpen && supportsVisualFeed,
      }

      window.localStorage.setItem(PLAYER_PREFERENCES_STORAGE_KEY_V2, JSON.stringify(payload))
    } catch {
      // Gracefully ignore localStorage write failures.
    }
  }, [audioController.volume, motionEnabled, selectedSignalId, selectedThemeId, supportsVisualFeed, visualFeedOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(
        SIGNAL_TELEMETRY_VISIBLE_STORAGE_KEY_V1,
        JSON.stringify({ visible: signalTelemetryVisible }),
      )
    } catch {
      // Gracefully ignore localStorage write failures.
    }
  }, [signalTelemetryVisible])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(
        SIGNAL_TELEMETRY_COLLAPSED_STORAGE_KEY_V1,
        JSON.stringify({ collapsed: signalTelemetryCollapsed }),
      )
    } catch {
      // Gracefully ignore localStorage write failures.
    }
  }, [signalTelemetryCollapsed])

  const transmissionLabel = useMemo(() => {
    return formatAudioSourceLabel(audioController.audioSource)
  }, [audioController.audioSource])

  const handleAudioTogglePlay = async () => {
    if (audioController.playbackStatus !== 'playing') {
      await audioAnalysis.requestInitializationFromUserGesture()
    }

    await audioController.togglePlay()
  }

  if (!activeTheme) {
    return null
  }

  const SceneComponent = activeTheme.Scene
  const signalState = !selectedSignalId
    ? 'dormant'
    : audioController.playbackStatus === 'playing'
      ? 'playing'
      : 'armed'

  return (
    <div
      className={['player-shell', activeTheme.className, className].filter(Boolean).join(' ')}
      data-theme={activeTheme.id}
      data-signal-state={signalState}
    >
      <div className="player-shell__scene" aria-hidden="true">
        <SceneComponent {...sceneProps} />
      </div>

      <StationIdentOverlay isAudioPlaying={audioController.playbackStatus === 'playing'} />

      {audioDebugEnabled ? (
        <AudioAnalysisDiagnostics
          status={audioAnalysis.status}
          snapshot={audioAnalysis.snapshot}
          bassPulseDebug={audioAnalysis.bassPulseDebug}
          kickPulseDebug={audioAnalysis.kickPulseDebug}
          graphDetails={audioAnalysis.graphDetails}
          errorMessage={audioAnalysis.errorMessage}
          diagnosticsPublishHz={audioAnalysis.diagnosticsPublishHz}
          analysisCalculationMode={audioAnalysis.analysisCalculationMode}
          sourceBpm={registrySourceBpm}
          effectiveReactiveBpm={effectiveReactiveBpm}
          ignoreSourceBpmEnabled={ignoreSourceBpmEnabled}
          motionEnabled={motionEnabled}
          reactiveBehaviorOverride={reactiveBehaviorOverride}
          reactiveDiagnosticsEnabled={reactiveDiagnosticsEnabled}
          getReactivePreviewTelemetry={getReactivePreviewTelemetry}
          sceneCounters={sceneCounters}
        />
      ) : null}

      {!audioDebugEnabled && signalTelemetryVisible ? (
        <SignalTelemetryPanel
          analysisStatus={audioAnalysis.status}
          playbackStatus={audioController.playbackStatus}
          getLatestSnapshot={audioAnalysis.getLatestSnapshot}
          getLatestReactiveTelemetry={getReactivePreviewTelemetry}
          collapsed={signalTelemetryCollapsed}
          onCollapsedChange={setSignalTelemetryCollapsed}
        />
      ) : null}

      <FloatingPlayerPanel
        environmentName={activeTheme.name}
        environmentOptions={themeOptions}
        selectedEnvironmentId={selectedThemeId}
        onEnvironmentChange={handleThemeChange}
        audioPlaybackStatus={audioController.playbackStatus}
        audioCurrentTime={audioController.currentTime}
        audioDuration={audioController.duration}
        audioSeekable={audioController.seekable}
        audioMetadataLoaded={audioController.metadataLoaded}
        audioErrorMessage={audioController.errorMessage}
        audioIsSeeking={audioController.isSeeking}
        onAudioTogglePlay={handleAudioTogglePlay}
        onAudioSeek={audioController.seekTo}
        signalOptions={signals}
        selectedSignalId={selectedSignalId}
        onSignalChange={handleSignalChange}
        signalLabel={selectedSignal ? transmissionLabel : null}
        isPlaying={audioController.playbackStatus === 'playing'}
        volume={audioController.volume}
        onVolumeChange={audioController.setVolume}
        motionEnabled={motionEnabled}
        supportsMotion={supportsMotion}
        onMotionToggle={setMotionEnabled}
        signalTelemetryVisible={signalTelemetryVisible}
        onSignalTelemetryChange={setSignalTelemetryVisible}
        visualFeedOpen={visualFeedOpen && supportsVisualFeed}
        onVisualFeedChange={(enabled) => setVisualFeedOpen(enabled)}
        collapsed={panelCollapsed}
        onCollapsedChange={setPanelCollapsed}
      />

      <VisualFeedWindow
        open={visualFeedOpen && supportsVisualFeed}
        onClose={() => setVisualFeedOpen(false)}
        Frame={activeTheme.VisualFeedFrame}
      />
    </div>
  )
}

export default PlayerShell
