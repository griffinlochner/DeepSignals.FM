export type DepthLabPlaybackState = "dormant" | "armed" | "playing";
export type DepthLabLoadingState = "loading" | "ready" | "error";

export type DepthLabSettings = {
  playbackState: DepthLabPlaybackState;
  motionIntensity: number;
  depthStrength: number;
  minimumBreathingDepth: number;
  maximumBreathingDepth: number;
  breathingCycleDurationSeconds: number;
  pointerParallaxEnabled: boolean;
  autoMotionEnabled: boolean;
};

export type DepthLabSceneProps = {
  playbackState: DepthLabPlaybackState;
  motionIntensity: number;
  depthStrength: number;
  minimumBreathingDepth: number;
  maximumBreathingDepth: number;
  breathingCycleDurationSeconds: number;
  pointerParallaxEnabled: boolean;
  autoMotionEnabled: boolean;
  onEffectiveDepthDiagnosticChange?: (value: number) => void;
  onLoadingStateChange?: (state: DepthLabLoadingState) => void;
};
