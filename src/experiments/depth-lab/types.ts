export type DepthLabEnvironment = 'beach-panorama' | 'jungle-depth'
export type DepthLabPlaybackState = 'dormant' | 'armed' | 'playing'
export type DepthLabLoadingState = 'loading' | 'ready' | 'error'

export type DepthLabSettings = {
  environment: DepthLabEnvironment
  playbackState: DepthLabPlaybackState
  motionIntensity: number
  depthStrength: number
  pointerParallaxEnabled: boolean
  autoMotionEnabled: boolean
}

export type DepthLabSceneProps = {
  playbackState: DepthLabPlaybackState
  motionIntensity: number
  depthStrength: number
  pointerParallaxEnabled: boolean
  autoMotionEnabled: boolean
  onLoadingStateChange?: (state: DepthLabLoadingState) => void
}
