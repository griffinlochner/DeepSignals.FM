import { useMemo, useState } from 'react'
import MainDisplay from '../components/MainDisplay'
import TransportDock from '../components/TransportDock'
import { themeRegistry } from '../themes/themeRegistry'
import type { SignalSource, PlaybackState } from './playerTypes'
import type { ThemeId, ThemeSceneProps } from '../themes/themeTypes'
import '../styles/player.css'

type PlayerShellProps = {
  className?: string
}

function PlayerShell({ className }: PlayerShellProps) {
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>('minimal')
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState<PlaybackState>('stopped')
  const [volume, setVolume] = useState(0.7)
  const [displayMode] = useState<'standby'>('standby')

  const signals: SignalSource[] = useMemo(
    () => [
      { id: 'test-alpha', label: 'Test Signal Alpha' },
      { id: 'test-beta', label: 'Test Signal Beta' },
    ],
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

  const sceneProps: ThemeSceneProps = {
    isPlaying: isPlaying === 'playing',
    volume,
    signalId: selectedSignalId,
    audioLevel: 0,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }

  if (!activeTheme) {
    return null
  }

  const SceneComponent = activeTheme.Scene
  const signalState = !selectedSignalId
    ? 'dormant'
    : isPlaying === 'playing'
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

      <div className="player-shell__main">
        <MainDisplay
          isPlaying={isPlaying}
          signalLabel={selectedSignal?.label || null}
          displayMode={displayMode}
          DisplayFrame={activeTheme.DisplayFrame}
        />
      </div>

      <TransportDock
        selectedThemeId={selectedThemeId}
        selectedSignalId={selectedSignalId}
        isPlaying={isPlaying === 'playing'}
        volume={volume}
        signals={signals}
        themeOptions={themeOptions}
        onThemeChange={setSelectedThemeId}
        onSignalChange={setSelectedSignalId}
        onPlayToggle={(playing) => setIsPlaying(playing ? 'playing' : 'stopped')}
        onVolumeChange={setVolume}
      />
    </div>
  )
}

export default PlayerShell
