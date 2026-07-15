import type { ThemeDefinition } from './themeTypes'
import CosmicNexusDefinition from './cosmic-nexus'
import MinimalDefinition from './minimal'

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  CosmicNexusDefinition,
]

export const defaultThemeId = 'minimal' as const
