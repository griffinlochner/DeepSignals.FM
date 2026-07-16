import TrackMarquee from './TrackMarquee'
import PlayStopButton from './PlayStopButton'
import VolumeControl from './VolumeControl'
import SignalSourceSelector from './SignalSourceSelector'
import ThemeSelector from './ThemeSelector'
import type { SignalSource } from '../app/playerTypes'
import type { ThemeId } from '../themes/themeTypes'

type TransportDockProps = {
  selectedThemeId: ThemeId
  selectedSignalId: string | null
  isPlaying: boolean
  volume: number
  signals: SignalSource[]
  themeOptions: Array<{ id: ThemeId; name: string }>
  onThemeChange: (id: ThemeId) => void
  onSignalChange: (id: string) => void
  onPlayToggle: (playing: boolean) => void
  onVolumeChange: (volume: number) => void
}

function TransportDock({
  selectedThemeId,
  selectedSignalId,
  isPlaying,
  volume,
  signals,
  themeOptions,
  onThemeChange,
  onSignalChange,
  onPlayToggle,
  onVolumeChange,
}: TransportDockProps) {
  const selectedSignal = signals.find((s) => s.id === selectedSignalId)

  return (
    <div className="transport-dock">
      <div className="transport-dock__inner">
        <div className="transport-dock__item transport-dock__item--theme">
          <div className="transport-dock__item-label">VISUAL ENVIRONMENT</div>
          <div className="transport-dock__item-control">
            <ThemeSelector
              value={selectedThemeId}
              options={themeOptions}
              onChange={onThemeChange}
            />
          </div>
        </div>

        <div className="transport-dock__item transport-dock__item--signal">
          <div className="transport-dock__item-label">SIGNAL SOURCE</div>
          <div className="transport-dock__item-control">
            <SignalSourceSelector
              value={selectedSignalId || ''}
              signals={signals}
              onChange={onSignalChange}
            />
          </div>
        </div>

        <div className="transport-dock__item transport-dock__item--marquee">
          <div className="transport-dock__item-label">NOW RECEIVING</div>
          <div className="transport-dock__item-control">
            <TrackMarquee isPlaying={isPlaying} signalLabel={selectedSignal?.label || null} />
          </div>
        </div>

        <div className="transport-dock__item transport-dock__item--play">
          <div className="transport-dock__item-label" aria-hidden="true" />
          <div className="transport-dock__item-control">
            <PlayStopButton
              isPlaying={isPlaying}
              isDisabled={!selectedSignalId}
              onToggle={onPlayToggle}
            />
          </div>
        </div>

        <div className="transport-dock__item transport-dock__item--volume">
          <div className="transport-dock__item-label" aria-hidden="true" />
          <div className="transport-dock__item-control">
            <VolumeControl value={volume} onChange={onVolumeChange} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default TransportDock
