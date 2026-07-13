import { useMemo, useState } from 'react'
import type { DisplayMode, Station, ThemeDefinition, VisualThemeId } from './types'
import { defaultThemeId, themeRegistry } from './themeRegistry'
import MainDisplay from '../components/MainDisplay'
import ControlConsole from '../components/ControlConsole'
import CosmicNexusTheme from '../themes/cosmic-nexus/CosmicNexusTheme'
import '../styles/playerPage.css'

type PlayerShellProps = {
  className?: string
}

function PlayerShell({ className }: PlayerShellProps) {
  const [selectedSignalSourceId, setSelectedSignalSourceId] = useState('transmission-unavailable')
  const [selectedThemeId, setSelectedThemeId] = useState<VisualThemeId>(defaultThemeId)
  const [playbackState] = useState<'stopped' | 'loading'>('stopped')
  const [displayMode] = useState<DisplayMode>('standby')

  const stations: Station[] = useMemo(
    () => [{ id: 'transmission-unavailable', label: 'Transmission unavailable' }],
    [],
  )

  const activeTheme = useMemo<ThemeDefinition | undefined>(() => {
    return themeRegistry.find((theme) => theme.id === selectedThemeId)
  }, [selectedThemeId])

  const ThemeComponent = activeTheme?.component ?? CosmicNexusTheme

  return (
    <div className={['player-page', className].filter(Boolean).join(' ')}>
      <div className="player-page__theme" aria-hidden="true">
        <ThemeComponent />
      </div>

      <div className="player-page__overlay">
        <div>
          <MainDisplay />
        </div>
        <ControlConsole
          selectedSignalSourceId={selectedSignalSourceId}
          selectedThemeId={selectedThemeId}
          stations={stations}
          onSignalSourceChange={setSelectedSignalSourceId}
          onThemeChange={setSelectedThemeId}
        />
      </div>

      <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 4, color: '#79fff2', fontSize: '0.85rem' }}>
        <div>Playback state: {playbackState}</div>
        <div>Display mode: {displayMode}</div>
      </div>
    </div>
  )
}

export default PlayerShell
