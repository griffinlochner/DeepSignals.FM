import type { ComponentType, ReactNode } from 'react'

export type Station = {
  id: string
  label: string
}

export type VisualThemeId = 'cosmic-nexus'

export type DisplayMode = 'standby' | 'active'

export type ThemeProps = {
  className?: string
  children?: ReactNode
}

export type ThemeDefinition = {
  id: VisualThemeId
  label: string
  component: ComponentType<ThemeProps>
}
