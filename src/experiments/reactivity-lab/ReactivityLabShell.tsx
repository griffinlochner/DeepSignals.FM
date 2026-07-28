import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AUDIO_SOURCES, formatAudioSourceLabel } from '../../app/audioSources'
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
import SignalSourceSelector from '../../components/SignalSourceSelector'
import VolumeControl from '../../components/VolumeControl'
import { useExternalRadioController, type DevSignalSourceId } from '../radio-player/useExternalRadioController'
import { defaultThemeId } from '../../themes/themeRegistry'
import { imageDepthEnvironmentCatalog } from '../../themes/image-depth/environmentCatalog'
import { ImageDepthThemeScene, type ImageDepthSceneDevCounters } from '../../themes/image-depth/ImageDepthThemeScene'
import './reactivityLab.css'

type SourceType = 'local-mp3' | 'external-radio'
type LabRadioPresetId = 'psyradio-progressive' | 'psyradio-chillout' | 'psyndora' | 'psystream'

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
  { id: 'psyndora', label: 'Psyndora' },
  { id: 'psystream', label: 'PsyStream' },
]

const CHILLOUT_STREAM_URL = 'http://65.109.32.21:8020/stream'

const MP3_SIGNAL_OPTIONS = AUDIO_SOURCES.map((source) => ({
  id: source.id,
  label: formatAudioSourceLabel(source),
}))

const DEFAULT_MANUAL_DEPTH = 0.5

const INITIAL_SCENE_DEV_COUNTERS: ImageDepthSceneDevCounters = {
  sceneComponentMountCount: 0,
  sceneComponentUnmountCount: 0,
  rendererCreationCount: 0,
  textureLoadCount: 0,
  materialGeometryInitializationCount: 0,
  environmentChangeCount: 0,
  depthUpdateCount: 0,
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

function ReactivityLabShell() {
  const [sourceType, setSourceType] = useState<SourceType>('local-mp3')
  const [selectedMp3SourceId, setSelectedMp3SourceId] = useState(AUDIO_SOURCES[0]?.id ?? '')
  const [selectedRadioPresetId, setSelectedRadioPresetId] = useState<LabRadioPresetId>('psyradio-progressive')
  const [mp3ListenerVolume, setMp3ListenerVolume] = useState(0.72)
  const [selectedImageDepthEnvironmentId, setSelectedImageDepthEnvironmentId] = useState(
    imageDepthEnvironmentCatalog[0]?.id ?? '',
  )
  const [manualDepthOverride, setManualDepthOverride] = useState(DEFAULT_MANUAL_DEPTH)
  const [renderedDepth, setRenderedDepth] = useState(DEFAULT_MANUAL_DEPTH)
  const [sceneDevCounters, setSceneDevCounters] = useState<ImageDepthSceneDevCounters>(
    INITIAL_SCENE_DEV_COUNTERS,
  )
  const [radioSnapshot, setRadioSnapshot] = useState<AudioReactiveSnapshot>(ZERO_SNAPSHOT)
  const [lastStartFailure, setLastStartFailure] = useState<string | null>(null)

  const previousSourceTypeRef = useRef<SourceType>('local-mp3')
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
    setCustomStreamUrlInput,
    applyCustomSignalSource,
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
    if (presetId === 'psyradio-chillout') {
      setCustomStreamUrlInput(CHILLOUT_STREAM_URL)
      await selectSignalSource('custom-dev-url')
      await applyCustomSignalSource()
      return
    }

    const mappedPresetId: DevSignalSourceId = presetId === 'psyndora' ? 'psyndora-psytrance' : presetId
    await selectSignalSource(mappedPresetId)
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
    return AUDIO_SOURCES.find((source) => source.id === selectedMp3SourceId) ?? null
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
  }

  const handleSceneDevCountersChange = useCallback((nextCounters: ImageDepthSceneDevCounters) => {
    setSceneDevCounters(nextCounters)
  }, [])

  return (
    <main className="reactivity-lab" aria-label="Reactivity lab">
      <div className="reactivity-lab__workspace-shell">
        <section className="reactivity-lab__panel" aria-label="Reactivity lab controls">
          <p className="reactivity-lab__eyebrow">DeepSignals Reactivity Lab - DEV only</p>
          <h1 className="reactivity-lab__title">Common Audio Telemetry Validation</h1>

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
            <h2>Image Depth Manual Preview</h2>

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
              />
              <strong>{manualDepthOverride.toFixed(2)}</strong>
            </label>

            <div className="reactivity-lab__field">
              <span className="reactivity-lab__label">Rendered depth</span>
              <p className="reactivity-lab__status-primary">{renderedDepth.toFixed(3)}</p>
            </div>

            <button
              type="button"
              className="reactivity-lab__inline-button"
              onClick={() => setManualDepthOverride(DEFAULT_MANUAL_DEPTH)}
            >
              Reset Depth to 0.5
            </button>
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
                  manualDepthOverride={manualDepthOverride}
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
                />
              ) : null}
            </div>
          </div>
        </section>

        <section className="reactivity-lab__diagnostics-stack" aria-label="Diagnostics panels">
          <details className="reactivity-lab__details">
            <summary>Common audio telemetry</summary>
            <div className="reactivity-lab__details-body">
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
            </div>
          </details>

          <details className="reactivity-lab__details">
            <summary>Resource diagnostics</summary>
            <div className="reactivity-lab__details-body">
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
            </div>
          </details>

          <details className="reactivity-lab__details">
            <summary>Detailed lifecycle/status diagnostics</summary>
            <div className="reactivity-lab__details-body">
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
              </section>
            </div>
          </details>
        </section>
      </div>
    </main>
  )
}

export default ReactivityLabShell
