import type { ThemeDefinition } from '../themeTypes'
import UvReactiveJunglePlayerPanel from './UvReactiveJunglePlayerPanel'
import UvReactiveJungleTheme from './UvReactiveJungleTheme'

const UvReactiveJungleDefinition: ThemeDefinition = {
  id: 'uv-reactive-jungle',
  name: 'UV Reactive Jungle',
  description: 'Production prototype for UV-responsive jungle depth imaging and live signal ambience.',
  className: 'theme-uv-reactive-jungle',
  performanceTier: 'enhanced',
  Scene: UvReactiveJungleTheme,
  PlayerOverlay: UvReactiveJunglePlayerPanel,
  supportsVideo: true,
  defaultDisplayMode: 'standby',
}

export default UvReactiveJungleDefinition
