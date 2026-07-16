import type { ThemeDefinition } from '../themeTypes'
import CosmicNexusDisplayFrame from './CosmicNexusDisplayFrame'
import CosmicNexusTheme from './CosmicNexusTheme'

const CosmicNexusDefinition: ThemeDefinition = {
  id: 'cosmic-nexus',
  name: 'Cosmic Signal Nexus',
  description: 'A reactive orbital signal-analysis array suspended in deep space.',
  className: 'theme-cosmic-nexus',
  performanceTier: 'enhanced',
  Scene: CosmicNexusTheme,
  DisplayFrame: CosmicNexusDisplayFrame,
  supportsVideo: true,
  defaultDisplayMode: 'standby',
}

export default CosmicNexusDefinition
