import type { ThemeDefinition } from '../themeTypes'
import UvReactiveJungleTheme from './UvReactiveJungleTheme'

const UvReactiveJungleDefinition: ThemeDefinition = {
  id: 'uv-reactive-jungle',
  name: 'UV Reactive Jungle',
  description: 'Production prototype for UV-responsive jungle depth imaging and live signal ambience.',
  className: 'theme-uv-reactive-jungle',
  performanceTier: 'enhanced',
  Scene: UvReactiveJungleTheme,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
}

export default UvReactiveJungleDefinition
