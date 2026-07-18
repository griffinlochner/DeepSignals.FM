import { useEffect, useMemo, useState } from 'react'
import PlayStopButton from '../../components/PlayStopButton'
import SignalSourceSelector from '../../components/SignalSourceSelector'
import TrackMarquee from '../../components/TrackMarquee'
import VolumeControl from '../../components/VolumeControl'
import type { ThemePlayerOverlayProps } from '../themeTypes'

type TelemetryReadout = {
  carrierLock: number
  mycelialSync: number
  biospherePhase: string
}

const PHASE_LABELS = ['NADIR', 'LIMINAL', 'ASCENT', 'AURORA'] as const

function UvReactiveJunglePlayerPanel({
  selectedSignalId,
  signals,
  signalLabel,
  isPlaying,
  volume,
  motionEnabled,
  displayMode,
  telemetry,
  onSignalChange,
  onPlayToggle,
  onVolumeChange,
  onMotionToggle,
  onDisplayModeChange,
}: ThemePlayerOverlayProps) {
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [telemetryReadout, setTelemetryReadout] = useState<TelemetryReadout>({
    carrierLock: 12,
    mycelialSync: 9,
    biospherePhase: 'NADIR',
  })

  const marqueeState: 'no-signal' | 'ready' | 'playing' = !selectedSignalId
    ? 'no-signal'
    : isPlaying
      ? 'playing'
      : 'ready'

  useEffect(() => {
    let phaseTick = 0

    const telemetryTimer = window.setInterval(() => {
      phaseTick += 1

      setTelemetryReadout(() => {
        const phaseDrift = phaseTick * 0.4
        const lockCenter = isPlaying ? 92 : selectedSignalId ? 54 : 12
        const syncCenter = isPlaying ? 86 : selectedSignalId ? 38 : 9

        const carrierLock = Math.max(0, Math.min(100, lockCenter + Math.sin(phaseDrift) * (isPlaying ? 4 : 3)))
        const mycelialSync = Math.max(
          0,
          Math.min(100, syncCenter + Math.cos(phaseDrift * 0.82) * (isPlaying ? 6 : 4)),
        )

        return {
          carrierLock,
          mycelialSync,
          biospherePhase: PHASE_LABELS[Math.floor((phaseTick / 3) % PHASE_LABELS.length)],
        }
      })
    }, 850)

    return () => window.clearInterval(telemetryTimer)
  }, [isPlaying, selectedSignalId])

  const statusLine = isPlaying ? 'TRANSMISSION LIVE' : 'SIGNAL STANDBY'
  const visualFeedOpen = displayMode === 'video' || displayMode === 'artwork'
  const feedExpanded = displayMode === 'video'

  const telemetryRows = useMemo(
    () => [
      { label: 'DEPTH RESONANCE', value: `${Math.round(telemetry.depthResonance * 100)}%`, live: true },
      { label: 'CARRIER LOCK', value: `${Math.round(telemetryReadout.carrierLock)}%`, live: false },
      { label: 'MYCELIAL SYNC', value: `${Math.round(telemetryReadout.mycelialSync)}%`, live: false },
      { label: 'BIOSPHERE PHASE', value: telemetryReadout.biospherePhase, live: false },
    ],
    [telemetry.depthResonance, telemetryReadout],
  )

  return (
    <>
      <aside className="uv-jungle-panel" aria-label="UV Reactive Jungle controls">
        <header className="uv-jungle-panel__header">
          <p className="uv-jungle-panel__brand">DEEPSIGNALS.FM · UV REACTIVE JUNGLE</p>
          <h2 className="uv-jungle-panel__status">{statusLine}</h2>
        </header>

        {!panelCollapsed && (
          <div className="uv-jungle-panel__body">
            <section className="uv-jungle-panel__section">
              <p className="uv-jungle-panel__label">Signal Source</p>
              <SignalSourceSelector value={selectedSignalId || ''} signals={signals} onChange={onSignalChange} />
            </section>

            <section className="uv-jungle-panel__section">
              <p className="uv-jungle-panel__label">Transmission</p>
              <TrackMarquee signalLabel={signalLabel} marqueeState={marqueeState} />
            </section>

            <section className="uv-jungle-panel__controls">
              <PlayStopButton isPlaying={isPlaying} isDisabled={!selectedSignalId} onToggle={onPlayToggle} />

              <label className="uv-jungle-panel__motion-toggle">
                <input
                  type="checkbox"
                  checked={motionEnabled}
                  onChange={(event) => onMotionToggle(event.target.checked)}
                />
                <span>Motion</span>
              </label>

              <button
                type="button"
                className="uv-jungle-panel__feed-button"
                onClick={() => onDisplayModeChange(visualFeedOpen ? 'standby' : 'video')}
              >
                Visual Feed
              </button>
            </section>

            <section className="uv-jungle-panel__section">
              <p className="uv-jungle-panel__label">Volume</p>
              <VolumeControl value={volume} onChange={onVolumeChange} />
            </section>

            <section className="uv-jungle-panel__telemetry" aria-label="Signal telemetry">
              {telemetryRows.map((row) => (
                <div key={row.label} className="uv-jungle-panel__telemetry-row">
                  <span>{row.label}</span>
                  <strong data-live={row.live || undefined}>{row.value}</strong>
                </div>
              ))}
            </section>
          </div>
        )}

        <footer className="uv-jungle-panel__footer">
          <button
            type="button"
            className="uv-jungle-panel__collapse"
            onClick={() => setPanelCollapsed((value) => !value)}
          >
            {panelCollapsed ? 'Expand Panel' : 'Collapse Panel'}
          </button>
        </footer>
      </aside>

      {visualFeedOpen && (
        <section className="uv-jungle-feed" aria-label="Visual feed panel">
          <header className="uv-jungle-feed__header">
            <p>Visual Feed</p>
            <div className="uv-jungle-feed__actions">
              <button
                type="button"
                onClick={() => onDisplayModeChange('artwork')}
                className="uv-jungle-feed__action"
                aria-label="Collapse feed"
                disabled={!feedExpanded}
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={() => onDisplayModeChange('video')}
                className="uv-jungle-feed__action"
                aria-label="Expand feed"
                disabled={feedExpanded}
              >
                Expand
              </button>
              <button
                type="button"
                onClick={() => onDisplayModeChange('standby')}
                className="uv-jungle-feed__action"
                aria-label="Close feed"
              >
                Close
              </button>
            </div>
          </header>

          {feedExpanded ? (
            <div className="uv-jungle-feed__viewport" role="img" aria-label="Video feed placeholder">
              <p>No video source configured.</p>
              <span>Attach a live capture endpoint to activate this feed.</span>
            </div>
          ) : (
            <div className="uv-jungle-feed__collapsed">Feed collapsed</div>
          )}
        </section>
      )}
    </>
  )
}

export default UvReactiveJunglePlayerPanel
