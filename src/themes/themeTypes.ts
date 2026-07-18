import type { ReactNode } from 'react'
import type { SignalSource } from '../app/playerTypes'

export type ThemeId = string

export type PerformanceTier = 'minimal' | 'standard' | 'enhanced'

export type MainDisplayMode = 'standby' | 'video' | 'visualizer' | 'artwork'

export type ThemeSceneProps = {
  isPlaying: boolean
  volume: number
  signalId: string | null
  audioLevel: number
  reducedMotion: boolean
  motionEnabled?: boolean
  displayMode?: MainDisplayMode
  onDepthResonanceChange?: (value: number) => void
}

export type ThemeTelemetry = {
  depthResonance: number
}

export type ThemePlayerOverlayProps = {
  selectedSignalId: string | null
  signals: SignalSource[]
  signalLabel: string | null
  isPlaying: boolean
  volume: number
  motionEnabled: boolean
  displayMode: MainDisplayMode
  telemetry: ThemeTelemetry
  onSignalChange: (id: string) => void
  onPlayToggle: (playing: boolean) => void
  onVolumeChange: (volume: number) => void
  onMotionToggle: (enabled: boolean) => void
  onDisplayModeChange: (mode: MainDisplayMode) => void
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
  PlayerOverlay?: React.ComponentType<ThemePlayerOverlayProps>
  supportsVideo: boolean
  defaultDisplayMode: MainDisplayMode
}
