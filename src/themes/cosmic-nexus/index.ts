import type { ThemeDefinition } from '../themeTypes'
import CosmicNexusVisualFeedFrame from './CosmicNexusVisualFeedFrame'
import CosmicNexusTheme from './CosmicNexusTheme'

const CosmicNexusDefinition: ThemeDefinition = {
  id: 'cosmic-nexus',
  name: 'Cosmic Signal Nexus',
  description: 'A reactive orbital signal-analysis array suspended in deep space.',
  className: 'theme-cosmic-nexus',
  performanceTier: 'enhanced',
  Scene: CosmicNexusTheme,
  VisualFeedFrame: CosmicNexusVisualFeedFrame,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
}

export default CosmicNexusDefinition
