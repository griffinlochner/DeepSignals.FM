import type { ThemeDefinition } from '../themeTypes'
import MyceliumTempleDisplayFrame from './MyceliumTempleDisplayFrame'
import MyceliumTempleTheme from './MyceliumTempleTheme'

const MyceliumTempleDefinition: ThemeDefinition = {
  id: 'mycelium-temple',
  name: 'The Mycelium Temple',
  description: 'A living ultraviolet forest intelligence that awakens around the selected transmission.',
  className: 'theme-mycelium-temple',
  performanceTier: 'enhanced',
  Scene: MyceliumTempleTheme,
  DisplayFrame: MyceliumTempleDisplayFrame,
  supportsVideo: true,
  defaultDisplayMode: 'standby',
}

export default MyceliumTempleDefinition
