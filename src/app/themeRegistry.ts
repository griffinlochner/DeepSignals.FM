import CosmicNexusTheme from '../themes/cosmic-nexus/CosmicNexusTheme'
import type { ThemeDefinition } from './types'

export const themeRegistry: ThemeDefinition[] = [
  {
    id: 'cosmic-nexus',
    label: 'Cosmic Signal Nexus',
    component: CosmicNexusTheme,
  },
]

export const defaultThemeId = 'cosmic-nexus' as const
