import type { ThemeId } from '../themes/themeTypes'
import { isShuffleMode } from '../app/environmentSelection'

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
  const shuffleActive = isShuffleMode(value)

  return (
    <div className="theme-selector" data-shuffle-active={shuffleActive}>
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
      {shuffleActive && (
        <svg
          className="theme-selector__shuffle-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4" />
          <path d="M3 18h3c1.7 0 3-1.4 4.2-3.4M13.8 9.4C15 7.4 16.3 6 18 6h3m-4-4 4 4-4 4" />
        </svg>
      )}
    </div>
  )
}

export default ThemeSelector
