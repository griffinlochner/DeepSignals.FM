import { useEffect, useMemo, useState } from 'react'
import { AUDIO_SOURCES } from './audioSources'
import AudioAnalysisDiagnostics from '../components/AudioAnalysisDiagnostics'
import FloatingPlayerPanel from '../components/FloatingPlayerPanel'
import StationIdentOverlay from '../components/StationIdentOverlay'
import VisualFeedWindow from '../components/VisualFeedWindow'
import { themeRegistry } from '../themes/themeRegistry'
import type { SignalSource } from './playerTypes'
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

const PLAYER_PREFERENCES_STORAGE_KEY = 'deepsignals.player.preferences.v1'

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
    return 0.7
  }

  return Math.min(1, Math.max(0, value))
}

function readStoredPlayerPreferences(): PlayerPreferencesV1 {
  const fallback: PlayerPreferencesV1 = {
    selectedThemeId: defaultThemeId,
    selectedAudioSourceId: AUDIO_SOURCES[0]?.id ?? '',
    volume: 0.7,
    motionEnabled: true,
    visualFeedOpen: false,
  }

  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(PLAYER_PREFERENCES_STORAGE_KEY)

    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw) as Partial<PlayerPreferencesV1>

    return {
      selectedThemeId: sanitizeThemeId(parsed.selectedThemeId),
      selectedAudioSourceId: sanitizeAudioSourceId(parsed.selectedAudioSourceId),
      volume: sanitizeVolume(parsed.volume),
      motionEnabled: sanitizeBoolean(parsed.motionEnabled, true),
      visualFeedOpen: sanitizeBoolean(parsed.visualFeedOpen, false),
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

function PlayerShell({ className }: PlayerShellProps) {
  const [audioDebugEnabled] = useState(() => isAudioDebugEnabled())
  const [storedPreferences] = useState<PlayerPreferencesV1>(() => readStoredPlayerPreferences())
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(storedPreferences.selectedThemeId)
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(storedPreferences.selectedAudioSourceId)
  const [motionEnabled, setMotionEnabled] = useState(storedPreferences.motionEnabled)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [visualFeedOpen, setVisualFeedOpen] = useState(storedPreferences.visualFeedOpen)
  const audioController = usePersistentAudioController(storedPreferences.volume, selectedSignalId ?? undefined)
  const audioAnalysis = useAudioAnalysis({
    audioElement: audioController.audioElement,
    playbackStatus: audioController.playbackStatus,
    isSeeking: audioController.isSeeking,
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
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    motionEnabled,
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const payload: PlayerPreferencesV1 = {
        selectedThemeId: sanitizeThemeId(selectedThemeId),
        selectedAudioSourceId: sanitizeAudioSourceId(selectedSignalId),
        volume: sanitizeVolume(audioController.volume),
        motionEnabled,
        visualFeedOpen: visualFeedOpen && supportsVisualFeed,
      }

      window.localStorage.setItem(PLAYER_PREFERENCES_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Gracefully ignore localStorage write failures.
    }
  }, [audioController.volume, motionEnabled, selectedSignalId, selectedThemeId, supportsVisualFeed, visualFeedOpen])

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
          graphDetails={audioAnalysis.graphDetails}
          errorMessage={audioAnalysis.errorMessage}
          diagnosticsPublishHz={audioAnalysis.diagnosticsPublishHz}
          analysisCalculationMode={audioAnalysis.analysisCalculationMode}
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
