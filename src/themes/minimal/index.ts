import type { ThemeDefinition } from '../themeTypes'
import MinimalTheme from './MinimalTheme'

const MinimalDefinition: ThemeDefinition = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Lightweight grayscale theme for low-power and distraction-free browsing',
  className: 'theme-minimal',
  performanceTier: 'minimal',
  Scene: MinimalTheme,
  supportsMotion: false,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
}

export default MinimalDefinition
