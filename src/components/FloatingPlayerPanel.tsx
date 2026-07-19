import { useId, useMemo } from 'react'
import type { SignalSource } from '../app/playerTypes'
import type { ThemeId } from '../themes/themeTypes'
import PlayStopButton from './PlayStopButton'
import SignalSourceSelector from './SignalSourceSelector'
import ThemeSelector from './ThemeSelector'
import TrackMarquee from './TrackMarquee'
import VolumeControl from './VolumeControl'
import './floatingPlayerPanel.css'

type FloatingPlayerPanelProps = {
  brandLabel?: string
  environmentName: string
  environmentOptions: Array<{ id: ThemeId; name: string }>
  selectedEnvironmentId: ThemeId
  onEnvironmentChange: (id: ThemeId) => void
  signalOptions: SignalSource[]
  selectedSignalId: string | null
  onSignalChange: (id: string) => void
  signalLabel: string | null
  isPlaying: boolean
  onPlayToggle: (playing: boolean) => void
  volume: number
  onVolumeChange: (volume: number) => void
  motionEnabled: boolean
  supportsMotion: boolean
  onMotionToggle: (enabled: boolean) => void
  visualFeedOpen: boolean
  onVisualFeedChange: (enabled: boolean) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

type PanelChevronIconProps = {
  collapsed: boolean
}

function PanelChevronIcon({ collapsed }: PanelChevronIconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {collapsed ? (
        <>
          <path d="M4 6.25L8 10.25L12 6.25" />
          <path d="M4 3.75L8 7.75L12 3.75" />
        </>
      ) : (
        <>
          <path d="M4 12.25L8 8.25L12 12.25" />
          <path d="M4 9.75L8 5.75L12 9.75" />
        </>
      )}
    </svg>
  )
}

function FloatingPlayerPanel({
  brandLabel = 'DEEPSIGNALS.FM',
  environmentName,
  environmentOptions,
  selectedEnvironmentId,
  onEnvironmentChange,
  signalOptions,
  selectedSignalId,
  onSignalChange,
  signalLabel,
  isPlaying,
  onPlayToggle,
  volume,
  onVolumeChange,
  motionEnabled,
  supportsMotion,
  onMotionToggle,
  visualFeedOpen,
  onVisualFeedChange,
  collapsed,
  onCollapsedChange,
}: FloatingPlayerPanelProps) {
  const contentId = useId()

  const marqueeState: 'no-signal' | 'ready' | 'playing' = !selectedSignalId
    ? 'no-signal'
    : isPlaying
      ? 'playing'
      : 'ready'

  const identity = useMemo(
    () => `${brandLabel} · ${environmentName.toUpperCase()}`,
    [brandLabel, environmentName],
  )

  const toggleLabel = collapsed ? 'Expand player panel' : 'Collapse player panel'

  return (
    <aside className="floating-player-panel" data-collapsed={collapsed} aria-label={`${environmentName} controls`}>
      <header className="floating-player-panel__header">
        <p
          className="floating-player-panel__identity"
          title={identity}
          aria-label={identity}
        >
          {identity}
        </p>

        <button
          type="button"
          className="floating-player-panel__toggle"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-controls={contentId}
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          <PanelChevronIcon collapsed={collapsed} />
        </button>
      </header>

      {collapsed ? (
        <div className="floating-player-panel__collapsed-body" id={contentId}>
          <div className="floating-player-panel__field">
            <p className="floating-player-panel__label">Signal Source</p>
            <SignalSourceSelector value={selectedSignalId || ''} signals={signalOptions} onChange={onSignalChange} />
          </div>

          <TrackMarquee signalLabel={signalLabel} marqueeState={marqueeState} />

          <PlayStopButton
            isPlaying={isPlaying}
            isDisabled={!selectedSignalId}
            onToggle={onPlayToggle}
          />
        </div>
      ) : (
        <div className="floating-player-panel__body" id={contentId}>
          <div className="floating-player-panel__field">
            <p className="floating-player-panel__label">Environment</p>
            <ThemeSelector
              value={selectedEnvironmentId}
              options={environmentOptions}
              onChange={onEnvironmentChange}
            />
          </div>

          <div className="floating-player-panel__field">
            <p className="floating-player-panel__label">Signal Source</p>
            <SignalSourceSelector value={selectedSignalId || ''} signals={signalOptions} onChange={onSignalChange} />
          </div>

          <div className="floating-player-panel__field">
            <p className="floating-player-panel__label">Transmission</p>
            <TrackMarquee signalLabel={signalLabel} marqueeState={marqueeState} />
          </div>

          <section className="floating-player-panel__controls" aria-label="Main controls">
            <PlayStopButton
              isPlaying={isPlaying}
              isDisabled={!selectedSignalId}
              onToggle={onPlayToggle}
            />

            <label className="floating-player-panel__switch floating-player-panel__visual-switch">
              <input
                className="floating-player-panel__switch-checkbox"
                type="checkbox"
                checked={visualFeedOpen}
                onChange={(event) => onVisualFeedChange(event.target.checked)}
                aria-label="Visual Feed"
              />
              <span className="floating-player-panel__switch-label">Visual Feed</span>
              <span className="floating-player-panel__switch-track" aria-hidden="true">
                <span className="floating-player-panel__switch-thumb" />
              </span>
            </label>

            <label className="floating-player-panel__switch floating-player-panel__motion-switch">
              <input
                className="floating-player-panel__switch-checkbox"
                type="checkbox"
                checked={motionEnabled}
                disabled={!supportsMotion}
                onChange={(event) => onMotionToggle(event.target.checked)}
                aria-label="Motion"
              />
              <span className="floating-player-panel__switch-label">Motion</span>
              <span className="floating-player-panel__switch-track" aria-hidden="true">
                <span className="floating-player-panel__switch-thumb" />
              </span>
            </label>
          </section>

          <section className="floating-player-panel__volume-row" aria-label="Volume control">
            <p className="floating-player-panel__label">Volume</p>
            <VolumeControl value={volume} onChange={onVolumeChange} />
          </section>
        </div>
      )}
    </aside>
  )
}

export default FloatingPlayerPanel
