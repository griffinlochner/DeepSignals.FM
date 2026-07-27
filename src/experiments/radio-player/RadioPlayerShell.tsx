import { useEffect, useMemo, useState } from 'react'
import ThemeSelector from '../../components/ThemeSelector'
import VolumeControl from '../../components/VolumeControl'
import StationIdentOverlay from '../../components/StationIdentOverlay'
import VisualFeedWindow from '../../components/VisualFeedWindow'
import RadioAnalyzerDiagnosticsPanel from './RadioAnalyzerDiagnosticsPanel'
import { defaultThemeId, themeRegistry } from '../../themes/themeRegistry'
import type { ThemeSceneProps } from '../../themes/themeTypes'
import { useExternalRadioController, type DevSignalSourceId } from './useExternalRadioController'
import '../../styles/player.css'
import './radioPlayer.css'

type DevDepthMode = 'stabilized-depth' | 'lighting-only'

function formatMetric(value: number, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.000'
}

function RadioPlayerShell() {
  const radio = useExternalRadioController(defaultThemeId)
  const [devDepthMode, setDevDepthMode] = useState<DevDepthMode>('stabilized-depth')
  const [analyzerPanelOpen, setAnalyzerPanelOpen] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(query.matches)

    sync()

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', sync)
      return () => query.removeEventListener('change', sync)
    }

    query.addListener(sync)
    return () => query.removeListener(sync)
  }, [])

  useEffect(() => {
    document.documentElement.classList.add('radio-player-scroll-root')
    document.body.classList.add('radio-player-scroll-root')

    return () => {
      document.documentElement.classList.remove('radio-player-scroll-root')
      document.body.classList.remove('radio-player-scroll-root')
    }
  }, [])

  const activeTheme = useMemo(() => {
    return themeRegistry.find((theme) => theme.id === radio.selectedThemeId) ?? themeRegistry[0]
  }, [radio.selectedThemeId])

  const themeOptions = useMemo(() => {
    return themeRegistry.map((theme) => ({ id: theme.id, name: theme.name }))
  }, [])

  const supportsVisualFeed = activeTheme?.supportsVisualFeed ?? false
  const supportsMotion = activeTheme?.supportsMotion ?? false
  const supportsAudioReactiveBehavior = activeTheme?.supportsAudioReactiveBehavior ?? false

  const sceneProps: ThemeSceneProps = {
    isPlaying: radio.isPlaying,
    volume: radio.volume,
    signalId: 'external-development-signal',
    audioLevel: 0,
    sourceBpm: null,
    reducedMotion,
    motionEnabled: radio.motionEnabled,
    getLatestAudioSnapshot: radio.getLatestAudioSnapshot,
    reactivePreviewEnabled: supportsAudioReactiveBehavior,
    reactiveBehavior: radio.selectedBehavior,
    reactiveDepthMode:
      import.meta.env.DEV && activeTheme?.id === 'crystal-cavern' ? devDepthMode : 'default',
  }

  if (!activeTheme) {
    return null
  }

  const SceneComponent = activeTheme.Scene
  const metadataText =
    radio.metadata.status === 'available' && radio.metadata.artist && radio.metadata.title
      ? `${radio.metadata.artist} - ${radio.metadata.title}`
      : 'Track metadata unavailable'
  const showCustomSignalInput = import.meta.env.DEV && radio.selectedSignalSourceId === 'custom-dev-url'

  return (
    <div
      className={['player-shell', 'radio-player-shell', activeTheme.className].filter(Boolean).join(' ')}
      data-theme={activeTheme.id}
      data-signal-state={radio.isPlaying ? 'playing' : 'armed'}
    >
      <div className="player-shell__scene" aria-hidden="true">
        <SceneComponent {...sceneProps} />
      </div>

      <StationIdentOverlay isAudioPlaying={radio.isPlaying} />

      <main className="radio-player-shell__overlay">
        <section className="radio-player-shell__panel" aria-label="External development radio controls">
          <p className="radio-player-shell__eyebrow">DeepSignals Radio Prototype · DEV only</p>
          <h1 className="radio-player-shell__title">{radio.stationName}</h1>
          <p className="radio-player-shell__source-label">External Development Signal</p>
          <p className="radio-player-shell__source-attribution">{radio.stationAttribution}</p>
          {radio.stationWebsite ? (
            <a className="radio-player-shell__source-link" href={radio.stationWebsite} target="_blank" rel="noreferrer">
              {radio.stationWebsite}
            </a>
          ) : null}

          <div className="radio-player-shell__status-block">
            <p className="radio-player-shell__status">{radio.signalState}</p>
            <p className="radio-player-shell__metadata" aria-live="polite" aria-atomic="true">
              {metadataText}
            </p>
            {radio.errorMessage ? <p className="radio-player-shell__error">{radio.errorMessage}</p> : null}
          </div>

          <div className="radio-player-shell__button-row">
            <button type="button" onClick={() => void radio.startSignal()} disabled={!radio.canStart}>
              Start Signal
            </button>
            <button type="button" onClick={() => void radio.stopSignal()} disabled={!radio.canStop}>
              Stop Signal
            </button>
            <button type="button" onClick={() => void radio.reconnectSignal()} disabled={!radio.canReconnect}>
              Reconnect Signal
            </button>
          </div>

          <div className="radio-player-shell__control-grid">
            {import.meta.env.DEV ? (
              <div className="radio-player-shell__field radio-player-shell__field--signal-source">
                <p className="radio-player-shell__label">Signal Source (DEV)</p>
                <select
                  className="radio-player-shell__select"
                  value={radio.selectedSignalSourceId}
                  onChange={(event) => {
                    void radio.selectSignalSource(event.target.value as DevSignalSourceId)
                  }}
                >
                  {radio.signalSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.label}
                    </option>
                  ))}
                </select>

                {showCustomSignalInput ? (
                  <div className="radio-player-shell__custom-source-row">
                    <input
                      className="radio-player-shell__input"
                      type="url"
                      value={radio.customStreamUrlInput}
                      onChange={(event) => radio.setCustomStreamUrlInput(event.target.value)}
                      placeholder="https://example.com/live-stream"
                      spellCheck={false}
                    />
                    <button type="button" onClick={() => void radio.applyCustomSignalSource()}>
                      Apply Signal
                    </button>
                  </div>
                ) : null}

                <dl className="radio-player-shell__comparison-grid">
                  <div>
                    <dt>Selected station</dt>
                    <dd>{radio.comparisonReadout.selectedStation}</dd>
                  </div>
                  <div>
                    <dt>Stream URL</dt>
                    <dd className="radio-player-shell__mono">{radio.comparisonReadout.streamUrl}</dd>
                  </div>
                  <div>
                    <dt>Playback status</dt>
                    <dd>{radio.comparisonReadout.playbackStatus}</dd>
                  </div>
                  <div>
                    <dt>Analyzer assessment</dt>
                    <dd>{radio.comparisonReadout.analyzerAssessment}</dd>
                  </div>
                  <div>
                    <dt>Live RMS</dt>
                    <dd>{formatMetric(radio.comparisonReadout.liveRms, 4)}</dd>
                  </div>
                  <div>
                    <dt>Avg frequency energy</dt>
                    <dd>{formatMetric(radio.comparisonReadout.averageFrequencyEnergy, 4)}</dd>
                  </div>
                  <div>
                    <dt>AudioContext state</dt>
                    <dd>{radio.comparisonReadout.audioContextState}</dd>
                  </div>
                  <div>
                    <dt>Elapsed currentTime</dt>
                    <dd>{formatMetric(radio.comparisonReadout.elapsedCurrentTime, 2)} s</dd>
                  </div>
                  <div>
                    <dt>Reconnect attempts</dt>
                    <dd>{radio.comparisonReadout.reconnectAttempts}</dd>
                  </div>
                  <div>
                    <dt>Heap used / peak</dt>
                    <dd>
                      {radio.memoryDiagnostics.supported
                        ? `${(radio.memoryDiagnostics.usedJsHeapSize / (1024 * 1024)).toFixed(1)} MB / ${(radio.memoryDiagnostics.peakUsedJsHeapSize / (1024 * 1024)).toFixed(1)} MB`
                        : 'n/a'}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="radio-player-shell__field">
              <p className="radio-player-shell__label">Environment</p>
              <ThemeSelector
                value={radio.selectedThemeId}
                options={themeOptions}
                onChange={(next) => radio.setSelectedThemeId(next)}
              />
            </div>

            <div className="radio-player-shell__field">
              <p className="radio-player-shell__label">Behavior</p>
              <div className="radio-player-shell__segmented" role="radiogroup" aria-label="Reactive behavior">
                <button
                  type="button"
                  role="radio"
                  aria-checked={radio.selectedBehavior === 'chill'}
                  data-selected={radio.selectedBehavior === 'chill' ? 'true' : 'false'}
                  onClick={() => radio.setSelectedBehavior('chill')}
                  disabled={!supportsAudioReactiveBehavior}
                >
                  Chill
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={radio.selectedBehavior === 'fullon'}
                  data-selected={radio.selectedBehavior === 'fullon' ? 'true' : 'false'}
                  onClick={() => radio.setSelectedBehavior('fullon')}
                  disabled={!supportsAudioReactiveBehavior}
                >
                  Full On
                </button>
              </div>
            </div>

            <div className="radio-player-shell__field">
              <p className="radio-player-shell__label">Motion</p>
              <label className="radio-player-shell__switch">
                <input
                  type="checkbox"
                  checked={radio.motionEnabled}
                  onChange={(event) => radio.setMotionEnabled(event.target.checked)}
                  disabled={!supportsMotion}
                />
                <span>{radio.motionEnabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>

            <div className="radio-player-shell__field">
              <p className="radio-player-shell__label">Visual Feed</p>
              <label className="radio-player-shell__switch">
                <input
                  type="checkbox"
                  checked={radio.visualFeedOpen && supportsVisualFeed}
                  onChange={(event) => radio.setVisualFeedOpen(event.target.checked)}
                  disabled={!supportsVisualFeed}
                />
                <span>{radio.visualFeedOpen && supportsVisualFeed ? 'Open' : 'Closed'}</span>
              </label>
            </div>

            <div className="radio-player-shell__field radio-player-shell__field--volume">
              <p className="radio-player-shell__label">Volume</p>
              <VolumeControl value={radio.volume} onChange={radio.setVolume} />
            </div>

            {import.meta.env.DEV && activeTheme.id === 'crystal-cavern' ? (
              <div className="radio-player-shell__field radio-player-shell__field--depth-mode">
                <p className="radio-player-shell__label">Crystal Cavern Depth Mode (DEV)</p>
                <div className="radio-player-shell__segmented" role="radiogroup" aria-label="Crystal Cavern depth mode">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={devDepthMode === 'stabilized-depth'}
                    data-selected={devDepthMode === 'stabilized-depth' ? 'true' : 'false'}
                    onClick={() => setDevDepthMode('stabilized-depth')}
                  >
                    Stabilized Depth
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={devDepthMode === 'lighting-only'}
                    data-selected={devDepthMode === 'lighting-only' ? 'true' : 'false'}
                    onClick={() => setDevDepthMode('lighting-only')}
                  >
                    Lighting Only
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <details className="radio-player-shell__dev-details">
            <summary>DEV Diagnostics</summary>
            <p>Selected station: {radio.stationName}</p>
            <p>Stream URL: {radio.streamUrl}</p>
            <p>Browser online: {radio.reconnectDiagnostics.browserOnline ? 'yes' : 'no'}</p>
            <p>Stopped by user: {radio.reconnectDiagnostics.stoppedByUser ? 'yes' : 'no'}</p>
            <p>Reconnect attempts: {radio.reconnectDiagnostics.reconnectAttemptCount}</p>
            <p>
              Current retry delay:{' '}
              {radio.reconnectDiagnostics.currentRetryDelayMs
                ? `${(radio.reconnectDiagnostics.currentRetryDelayMs / 1000).toFixed(0)}s`
                : 'none'}
            </p>
            <p>
              Last reconnect reason: {radio.reconnectDiagnostics.lastReconnectReason ?? 'n/a'}
            </p>
            <p>
              Last event: {radio.reconnectDiagnostics.lastEvent ?? 'n/a'}
              {radio.reconnectDiagnostics.lastEventTimestamp
                ? ` at ${new Date(radio.reconnectDiagnostics.lastEventTimestamp).toLocaleTimeString()}`
                : ''}
            </p>
            <p>
              Resources: audio elements={radio.resourceDiagnostics.audioElementsCreated}, audio contexts={radio.resourceDiagnostics.audioContextsCreated}, source nodes={radio.resourceDiagnostics.sourceNodesCreated}, analyzers={radio.resourceDiagnostics.analyzersCreated}, analysis loops started={radio.resourceDiagnostics.analysisLoopsStarted}, loop active={radio.resourceDiagnostics.isAnalysisLoopRunning ? 'yes' : 'no'}
            </p>
            <p>
              Runtime counters: frames={radio.runtimeCounters.animationFramesProcessed}, ui publications={radio.runtimeCounters.diagnosticUiPublications}, rolling samples={radio.runtimeCounters.rollingSampleCount}, spike events={radio.runtimeCounters.spikeEventCount}, RAF chains={radio.runtimeCounters.activeRafChains}, active timers={radio.runtimeCounters.activeTimers}, renderers={radio.runtimeCounters.rendererInstances}, scenes={radio.runtimeCounters.sceneInstances}
            </p>
            <p>
              Heap: {radio.memoryDiagnostics.supported ? `${(radio.memoryDiagnostics.usedJsHeapSize / (1024 * 1024)).toFixed(1)} MB used / ${(radio.memoryDiagnostics.totalJsHeapSize / (1024 * 1024)).toFixed(1)} MB total / ${(radio.memoryDiagnostics.jsHeapSizeLimit / (1024 * 1024)).toFixed(0)} MB limit` : 'performance.memory unavailable'}
            </p>
            <p>
              Heap delta from playback start: {radio.memoryDiagnostics.supported ? `${(radio.memoryDiagnostics.deltaSincePlaybackStart / (1024 * 1024)).toFixed(1)} MB` : 'n/a'}
            </p>
            <p>Metadata endpoint: {radio.metadata.sourceEndpoint ?? 'none'}</p>
            <ul>
              {radio.metadataProbeResults.length === 0 ? <li>No metadata probes executed yet.</li> : null}
              {radio.metadataProbeResults.map((result) => (
                <li key={result.endpoint}>
                  {result.ok ? 'OK' : 'FAIL'} · {result.endpoint} · {result.detail}
                </li>
              ))}
            </ul>
          </details>

          {import.meta.env.DEV ? (
            <details
              className="radio-player-shell__dev-details"
              onToggle={(event) => setAnalyzerPanelOpen((event.currentTarget as HTMLDetailsElement).open)}
            >
              <summary>DEV Analyzer Panel</summary>
              {analyzerPanelOpen ? <RadioAnalyzerDiagnosticsPanel diagnostics={radio.analyzerDiagnostics} /> : null}
            </details>
          ) : null}
        </section>
      </main>

      <VisualFeedWindow
        open={radio.visualFeedOpen && supportsVisualFeed}
        onClose={() => radio.setVisualFeedOpen(false)}
        Frame={activeTheme.VisualFeedFrame}
      />
    </div>
  )
}

export default RadioPlayerShell
