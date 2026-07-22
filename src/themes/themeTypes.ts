import type { ReactNode } from 'react'
import type { AudioReactiveSnapshot, ReactiveBehaviorId, ReactivePreviewTelemetry } from '../app/playerTypes'

export type ThemeId = string

export type PerformanceTier = 'minimal' | 'standard' | 'enhanced'

export type ThemeSceneProps = {
  isPlaying: boolean
  volume: number
  signalId: string | null
  audioLevel: number
  reducedMotion: boolean
  sourceBpm?: number | null
  motionEnabled?: boolean
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null
  reactivePreviewEnabled?: boolean
  reactiveBehavior?: ReactiveBehaviorId
  onReactivePreviewTelemetry?: (telemetry: ReactivePreviewTelemetry) => void
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
