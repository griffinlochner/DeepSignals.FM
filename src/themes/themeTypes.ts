import type { ReactNode } from 'react'

export type ThemeId = string

export type PerformanceTier = 'minimal' | 'standard' | 'enhanced'

export type MainDisplayMode = 'standby' | 'video' | 'visualizer' | 'artwork'

export type ThemeSceneProps = {
  isPlaying: boolean
  volume: number
  signalId: string | null
  audioLevel: number
  reducedMotion: boolean
}

export type ThemeDisplayFrameProps = {
  children: ReactNode
  displayMode: MainDisplayMode
  isPlaying: boolean
}

export type ThemeDefinition = {
  id: ThemeId
  name: string
  description: string
  className: string
  performanceTier: PerformanceTier
  Scene: React.ComponentType<ThemeSceneProps>
  DisplayFrame?: React.ComponentType<ThemeDisplayFrameProps>
  supportsVideo: boolean
  defaultDisplayMode: MainDisplayMode
}
