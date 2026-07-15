import type { ThemeDefinition } from '../themeTypes'
import MinimalTheme from './MinimalTheme'

const MinimalDefinition: ThemeDefinition = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Lightweight, high-performance theme with clean grid background',
  className: 'theme-minimal',
  performanceTier: 'minimal',
  Scene: MinimalTheme,
  supportsVideo: false,
  defaultDisplayMode: 'standby',
}

export default MinimalDefinition
