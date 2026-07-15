import type { ThemeDefinition } from '../themeTypes'
import CosmicNexusTheme from './CosmicNexusTheme'

const CosmicNexusDefinition: ThemeDefinition = {
  id: 'cosmic-nexus',
  name: 'Cosmic Signal Nexus',
  description: 'Immersive psychedelic cosmic receiver with WebGL animation',
  className: 'theme-cosmic-nexus',
  performanceTier: 'enhanced',
  Scene: CosmicNexusTheme,
  supportsVideo: false,
  defaultDisplayMode: 'standby',
}

export default CosmicNexusDefinition
