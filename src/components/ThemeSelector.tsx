import type { ThemeId } from '../themes/themeTypes'

type ThemeSelectorProps = {
  value: ThemeId
  options: Array<{ id: ThemeId; name: string }>
  onChange: (value: ThemeId) => void
}

function ThemeSelector({ value, options, onChange }: ThemeSelectorProps) {
  return (
    <div className="theme-selector">
      <select
        className="theme-selector__select"
        value={value}
        onChange={(event) => onChange(event.target.value as ThemeId)}
        aria-label="Visual environment"
      >
        {options.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export default ThemeSelector
