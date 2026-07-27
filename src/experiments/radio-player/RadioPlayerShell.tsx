import { useEffect, useMemo, useState } from 'react'
import ThemeSelector from '../../components/ThemeSelector'
import VolumeControl from '../../components/VolumeControl'
import StationIdentOverlay from '../../components/StationIdentOverlay'
import VisualFeedWindow from '../../components/VisualFeedWindow'
import RadioAnalyzerDiagnosticsPanel from './RadioAnalyzerDiagnosticsPanel'
import { defaultThemeId, themeRegistry } from '../../themes/themeRegistry'
import type { ThemeSceneProps } from '../../themes/themeTypes'
import { useExternalRadioController } from './useExternalRadioController'
import '../../styles/player.css'
import './radioPlayer.css'

type DevDepthMode = 'stabilized-depth' | 'lighting-only'

function RadioPlayerShell() {
  const radio = useExternalRadioController(defaultThemeId)
  const [devDepthMode, setDevDepthMode] = useState<DevDepthMode>('stabilized-depth')
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
          <p className="radio-player-shell__source-attribution">
            Programming and audio provided by PsyRadio.FM
          </p>
          <a className="radio-player-shell__source-link" href={radio.stationWebsite} target="_blank" rel="noreferrer">
            {radio.stationWebsite}
          </a>

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
            <details className="radio-player-shell__dev-details">
              <summary>DEV Analyzer Panel</summary>
              <RadioAnalyzerDiagnosticsPanel diagnostics={radio.analyzerDiagnostics} />
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
