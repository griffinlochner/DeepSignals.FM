import type { VisualThemeId } from '../app/types'

type ThemeSelectorProps = {
  value: VisualThemeId
  onChange: (value: VisualThemeId) => void
}

function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.95rem' }}>
      <span>Visual environment</span>
      <select value={value} onChange={(event) => onChange(event.target.value as VisualThemeId)}>
        <option value="cosmic-nexus">Cosmic Signal Nexus</option>
      </select>
    </label>
  )
}

export default ThemeSelector
