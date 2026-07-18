import type { ThemeDefinition } from './themeTypes'
import CosmicNexusDefinition from './cosmic-nexus'
import MinimalDefinition from './minimal'
import MyceliumTempleDefinition from './mycelium-temple'
import UvReactiveJungleDefinition from './uv-reactive-jungle'

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  CosmicNexusDefinition,
  MyceliumTempleDefinition,
  UvReactiveJungleDefinition,
]

export const defaultThemeId = 'minimal' as const
