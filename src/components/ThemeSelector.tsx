import type { ThemeId } from '../themes/themeTypes'

type ThemeSelectorProps = {
  value: ThemeId
  options: Array<{ id: ThemeId; name: string }>
  onChange: (value: ThemeId) => void
}

function ThemeSelector({ value, options, onChange }: ThemeSelectorProps) {
  return (
    <label className="theme-selector">
      <span className="theme-selector__label">Visual environment</span>
      <select
        className="theme-selector__select"
        value={value}
        onChange={(event) => onChange(event.target.value as ThemeId)}
      >
        {options.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export default ThemeSelector
