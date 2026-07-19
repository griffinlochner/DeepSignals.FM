import type { ReactNode } from 'react'

export type ThemeId = string

export type PerformanceTier = 'minimal' | 'standard' | 'enhanced'

export type ThemeSceneProps = {
  isPlaying: boolean
  volume: number
  signalId: string | null
  audioLevel: number
  reducedMotion: boolean
  motionEnabled?: boolean
}

export type ThemeVisualFeedFrameProps = {
  children: ReactNode
}

export type ThemeDefinition = {
  id: ThemeId
  name: string
  description: string
  className: string
  performanceTier: PerformanceTier
  Scene: React.ComponentType<ThemeSceneProps>
  VisualFeedFrame?: React.ComponentType<ThemeVisualFeedFrameProps>
  supportsMotion: boolean
  supportsVisualFeed: boolean
}
