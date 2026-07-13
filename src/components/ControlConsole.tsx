import SignalSourceSelector from './SignalSourceSelector'
import ThemeSelector from './ThemeSelector'
import type { Station, VisualThemeId } from '../app/types'

type ControlConsoleProps = {
  selectedSignalSourceId: string
  selectedThemeId: VisualThemeId
  stations: Station[]
  onSignalSourceChange: (value: string) => void
  onThemeChange: (value: VisualThemeId) => void
}

function ControlConsole({
  selectedSignalSourceId,
  selectedThemeId,
  stations,
  onSignalSourceChange,
  onThemeChange,
}: ControlConsoleProps) {
  return (
    <aside
      style={{
        border: '1px solid rgba(121, 255, 242, 0.3)',
        background: 'rgba(1, 1, 4, 0.78)',
        padding: '24px',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 0 30px rgba(57, 255, 20, 0.12)',
        display: 'grid',
        gap: '16px',
      }}
    >
      <SignalSourceSelector value={selectedSignalSourceId} stations={stations} onChange={onSignalSourceChange} />
      <ThemeSelector value={selectedThemeId} onChange={onThemeChange} />
    </aside>
  )
}

export default ControlConsole
