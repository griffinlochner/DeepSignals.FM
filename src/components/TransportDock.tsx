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
      <div className="transport-dock__item transport-dock__item--theme">
        <ThemeSelector
          value={selectedThemeId}
          options={themeOptions}
          onChange={onThemeChange}
        />
      </div>

      <div className="transport-dock__item transport-dock__item--signal">
        <SignalSourceSelector
          value={selectedSignalId || ''}
          signals={signals}
          onChange={onSignalChange}
        />
      </div>

      <div className="transport-dock__item transport-dock__item--marquee">
        <TrackMarquee isPlaying={isPlaying} signalLabel={selectedSignal?.label || null} />
      </div>

      <div className="transport-dock__item transport-dock__item--play">
        <PlayStopButton
          isPlaying={isPlaying}
          isDisabled={!selectedSignalId}
          onToggle={onPlayToggle}
        />
      </div>

      <div className="transport-dock__item transport-dock__item--volume">
        <VolumeControl value={volume} onChange={onVolumeChange} />
      </div>
    </div>
  )
}

export default TransportDock
