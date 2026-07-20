export type EnvironmentPlaybackState = "stopped" | "playing";
export type EnvironmentLoadingState = "loading" | "ready" | "error";

export type TwinkleHotspot = {
  id: string;
  u: number;
  v: number;
  color?: string;
  size?: number;
  intensity?: number;
  phase?: number;
};

export type EnvironmentPreset = {
  id: string;
  name: string;
  assets: {
    colorImageUrl: string;
    depthMapUrl: string;
  };
  depth: {
    motionIntensity: number;
    depthStrength: number;
    staticDepth: number;
    breathingMin: number;
    breathingMax: number;
    breathingCycleSeconds: number;
    pointerParallaxEnabled: boolean;
    pointerParallaxStrength: number;
    ambientMotionEnabled: boolean;
  };
  color: {
    driftEnabled: boolean;
    hueRangeDegrees: number;
    cycleSeconds: number;
    saturation: number;
    glowPulseEnabled: boolean;
    glowPulseAmount: number;
    glowPulseCycleSeconds: number;
  };
  twinkles: {
    enabled: boolean;
    hotspots: TwinkleHotspot[];
    defaultColor: string;
    defaultSize: number;
    defaultIntensity: number;
    pulseSpeed: number;
  };
  particles: {
    enabled: boolean;
    count: number;
    speed: number;
    size: number;
    opacity: number;
    color: string;
    seed: number;
  };
  haze: {
    enabled: boolean;
    opacity: number;
    blurPixels: number;
    driftCycleSeconds: number;
    primaryColor: string;
    secondaryColor: string;
  };
};

export type EnvironmentDiagnostics = {
  fps: number;
  effectiveDepth: number;
  twinkleCount: number;
  particleCount: number;
  hueOffsetDegrees: number;
  automaticMotionActive: boolean;
};

export type EnvironmentLabSceneProps = {
  playbackState: EnvironmentPlaybackState;
  placementModeEnabled: boolean;
  preset: EnvironmentPreset;
  reducedMotionActive: boolean;
  onLoadingStateChange?: (state: EnvironmentLoadingState) => void;
  onDiagnosticsChange?: (diagnostics: EnvironmentDiagnostics) => void;
  onCreateHotspot?: (u: number, v: number, phase: number) => void;
  onRemoveNearestHotspot?: (u: number, v: number) => void;
};
