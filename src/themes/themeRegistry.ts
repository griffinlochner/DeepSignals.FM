import type { ThemeDefinition } from './themeTypes'
import CosmicNexusDefinition from './cosmic-nexus'
import MinimalDefinition from './minimal'
import MyceliumTempleDefinition from './mycelium-temple'

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  CosmicNexusDefinition,
  MyceliumTempleDefinition,
]

export const defaultThemeId = 'minimal' as const
