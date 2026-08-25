import type { ThemeId } from '../themes/themeTypes'

type EnvironmentOptionItem = { id: ThemeId; name: string }
type EnvironmentOptionGroup = {
  groupName: string
  options: EnvironmentOptionItem[]
}

type ThemeSelectorProps = {
  value: ThemeId
  options: EnvironmentOptionGroup[]
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
        {options.map((group) => (
          <optgroup key={group.groupName} label={group.groupName}>
            {group.options.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

export default ThemeSelector
