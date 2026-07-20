import { useEffect, useMemo, useState } from 'react'
import FloatingPlayerPanel from '../components/FloatingPlayerPanel'
import VisualFeedWindow from '../components/VisualFeedWindow'
import { themeRegistry } from '../themes/themeRegistry'
import type { SignalSource, PlaybackState } from './playerTypes'
import type { ThemeId, ThemeSceneProps } from '../themes/themeTypes'
import { preloadUvJungleTextures } from '../themes/uv-reactive-jungle/uvJungleTextureCache'
import '../styles/player.css'

type PlayerShellProps = {
  className?: string
}

function PlayerShell({ className }: PlayerShellProps) {
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>('minimal')
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState<PlaybackState>('stopped')
  const [volume, setVolume] = useState(0.7)
  const [motionEnabled, setMotionEnabled] = useState(true)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [visualFeedOpen, setVisualFeedOpen] = useState(false)

  useEffect(() => {
    void preloadUvJungleTextures()
  }, [])

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

  const supportsMotion = activeTheme?.supportsMotion ?? true
  const supportsVisualFeed = activeTheme?.supportsVisualFeed ?? true

  const handleSignalChange = (id: string) => {
    setSelectedSignalId(id || null)
  }

  const handleThemeChange = (themeId: ThemeId) => {
    setSelectedThemeId(themeId)

    const nextTheme = themeRegistry.find((theme) => theme.id === themeId)

    if (!nextTheme?.supportsVisualFeed) {
      setVisualFeedOpen(false)
    }
  }

  const sceneProps: ThemeSceneProps = {
    isPlaying: isPlaying === 'playing',
    volume,
    signalId: selectedSignalId,
    audioLevel: 0,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    motionEnabled,
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

      <FloatingPlayerPanel
        environmentName={activeTheme.name}
        environmentOptions={themeOptions}
        selectedEnvironmentId={selectedThemeId}
        onEnvironmentChange={handleThemeChange}
        signalOptions={signals}
        selectedSignalId={selectedSignalId}
        onSignalChange={handleSignalChange}
        signalLabel={selectedSignal?.label || null}
        isPlaying={isPlaying === 'playing'}
        onPlayToggle={(playing: boolean) => setIsPlaying(playing ? 'playing' : 'stopped')}
        volume={volume}
        onVolumeChange={setVolume}
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
