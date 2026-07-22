import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AUDIO_SOURCES } from './audioSources'
import AudioAnalysisDiagnostics from '../components/AudioAnalysisDiagnostics'
import FloatingPlayerPanel from '../components/FloatingPlayerPanel'
import SignalTelemetryPanel from '../components/SignalTelemetryPanel'
import StationIdentOverlay from '../components/StationIdentOverlay'
import VisualFeedWindow from '../components/VisualFeedWindow'
import { themeRegistry } from '../themes/themeRegistry'
import type { ReactiveBehaviorId, ReactivePreviewTelemetry, SignalSource } from './playerTypes'
import type { ThemeId, ThemeSceneProps } from '../themes/themeTypes'
import { preloadImageDepthTextures } from '../themes/image-depth/imageDepthTextureCache'
import {
  ANALOG_SIGNAL_LABORATORY_PRODUCTION_ASSET,
  BIOLUMINESCENT_PSY_FOREST_PRODUCTION_ASSET,
  BIOLUMINESCENT_PSY_REEF_PRODUCTION_ASSET,
  UV_JUNGLE_PRODUCTION_ASSET,
} from '../themes/image-depth/productionScenePresets'
import { useAudioAnalysis } from './useAudioAnalysis'
import { usePersistentAudioController } from './usePersistentAudioController'
import { defaultThemeId } from '../themes/themeRegistry'
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
  selectedBehavior: ReactiveBehaviorId
  signalTelemetryVisible: boolean
}

const PLAYER_PREFERENCES_STORAGE_KEY_V1 = 'deepsignals.player.preferences.v1'
const PLAYER_PREFERENCES_STORAGE_KEY_V2 = 'deepsignals.player.preferences.v2'

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

function sanitizeReactiveBehaviorId(value: unknown): ReactiveBehaviorId {
  return value === 'fullon' ? 'fullon' : 'chill'
}

function sanitizeVolume(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0.7
  }

  return Math.min(1, Math.max(0, value))
}

function readStoredPlayerPreferences(): PlayerPreferencesV2 {
  const fallback: PlayerPreferencesV2 = {
    selectedThemeId: defaultThemeId,
    selectedAudioSourceId: AUDIO_SOURCES[0]?.id ?? '',
    volume: 0.7,
    motionEnabled: true,
    visualFeedOpen: false,
    selectedBehavior: 'chill',
    signalTelemetryVisible: false,
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
        volume: sanitizeVolume(parsed.volume),
        motionEnabled: sanitizeBoolean(parsed.motionEnabled, true),
        visualFeedOpen: sanitizeBoolean(parsed.visualFeedOpen, false),
        selectedBehavior: sanitizeReactiveBehaviorId(parsed.selectedBehavior),
        signalTelemetryVisible: sanitizeBoolean(parsed.signalTelemetryVisible, false),
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
      volume: sanitizeVolume(parsed.volume),
      motionEnabled: sanitizeBoolean(parsed.motionEnabled, true),
      visualFeedOpen: sanitizeBoolean(parsed.visualFeedOpen, false),
      selectedBehavior: 'chill',
      signalTelemetryVisible: false,
    }
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

function readReactiveBehaviorOverrideFromQuery(): ReactiveBehaviorId | null {
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

function PlayerShell({ className }: PlayerShellProps) {
  const [audioDebugEnabled] = useState(() => isAudioDebugEnabled())
  const [reactiveBehaviorOverride] = useState(() => readReactiveBehaviorOverrideFromQuery())
  const [ignoreSourceBpmEnabled] = useState(() => isIgnoreSourceBpmEnabled())
  const [storedPreferences] = useState<PlayerPreferencesV2>(() => readStoredPlayerPreferences())
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(storedPreferences.selectedThemeId)
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(storedPreferences.selectedAudioSourceId)
  const [selectedBehavior, setSelectedBehavior] = useState<ReactiveBehaviorId>(storedPreferences.selectedBehavior)
  const [motionEnabled, setMotionEnabled] = useState(storedPreferences.motionEnabled)
  const [signalTelemetryVisible, setSignalTelemetryVisible] = useState(storedPreferences.signalTelemetryVisible)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [visualFeedOpen, setVisualFeedOpen] = useState(storedPreferences.visualFeedOpen)
  const reactivePreviewTelemetryRef = useRef<ReactivePreviewTelemetry>(ZERO_REACTIVE_PREVIEW_TELEMETRY)
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
      new Map<ThemeId, typeof UV_JUNGLE_PRODUCTION_ASSET>([
        ['uv-reactive-jungle', UV_JUNGLE_PRODUCTION_ASSET],
        ['analog-signal-laboratory', ANALOG_SIGNAL_LABORATORY_PRODUCTION_ASSET],
        ['bioluminescent-psy-forest', BIOLUMINESCENT_PSY_FOREST_PRODUCTION_ASSET],
        ['bioluminescent-psy-reef', BIOLUMINESCENT_PSY_REEF_PRODUCTION_ASSET],
      ]),
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
    () => AUDIO_SOURCES.map((source) => ({ id: source.id, label: source.displayName })),
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
  const effectiveReactiveBehavior = reactiveBehaviorOverride ?? selectedBehavior

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

  const sceneProps: ThemeSceneProps = {
    isPlaying: audioController.playbackStatus === 'playing',
    volume: audioController.volume,
    signalId: selectedSignalId,
    audioLevel: 0,
    sourceBpm: effectiveReactiveBpm,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    motionEnabled,
    getLatestAudioSnapshot: audioAnalysis.getLatestSnapshot,
    reactivePreviewEnabled: supportsAudioReactiveBehavior,
    reactiveBehavior: effectiveReactiveBehavior,
    onReactivePreviewTelemetry: (telemetry) => {
      reactivePreviewTelemetryRef.current = telemetry
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
        selectedBehavior: sanitizeReactiveBehaviorId(selectedBehavior),
        signalTelemetryVisible,
      }

      window.localStorage.setItem(PLAYER_PREFERENCES_STORAGE_KEY_V2, JSON.stringify(payload))
    } catch {
      // Gracefully ignore localStorage write failures.
    }
  }, [audioController.volume, motionEnabled, selectedBehavior, selectedSignalId, selectedThemeId, signalTelemetryVisible, supportsVisualFeed, visualFeedOpen])

  const transmissionLabel = useMemo(() => {
    if (audioController.audioSource.artist && audioController.audioSource.title) {
      return `${audioController.audioSource.artist} — ${audioController.audioSource.title}`
    }

    if (audioController.audioSource.title) {
      return audioController.audioSource.title
    }

    return audioController.audioSource.displayName
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
          reactiveBehaviorOverride={reactiveBehaviorOverride}
          reactiveDiagnosticsEnabled={reactiveDiagnosticsEnabled}
          getReactivePreviewTelemetry={getReactivePreviewTelemetry}
        />
      ) : null}

      {!audioDebugEnabled && signalTelemetryVisible ? (
        <SignalTelemetryPanel
          analysisStatus={audioAnalysis.status}
          playbackStatus={audioController.playbackStatus}
          getLatestSnapshot={audioAnalysis.getLatestSnapshot}
          getLatestReactiveTelemetry={getReactivePreviewTelemetry}
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
        showBehaviorControl={supportsAudioReactiveBehavior}
        selectedBehavior={selectedBehavior}
        onBehaviorChange={setSelectedBehavior}
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
