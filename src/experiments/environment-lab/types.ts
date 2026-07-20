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

export type SurfaceGlowHotspot = {
  id: string;
  u: number;
  v: number;
  color: string;
  radius: number;
  softness: number;
  intensity: number;
  pulseEnabled: boolean;
  pulseAmount: number;
  pulseCycleSeconds: number;
  phase: number;
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
  saturationPulse: {
    enabled: boolean;
    minimumSaturation: number;
    maximumSaturation: number;
    cycleSeconds: number;
    phaseOffset: number;
    syncToDepthBreathing: boolean;
  };
  twinkles: {
    enabled: boolean;
    hotspots: TwinkleHotspot[];
    defaultColor: string;
    defaultSize: number;
    defaultIntensity: number;
    pulseSpeed: number;
  };
  surfaceGlows: {
    enabled: boolean;
    hotspots: SurfaceGlowHotspot[];
    defaultColor: string;
    defaultRadius: number;
    defaultSoftness: number;
    defaultIntensity: number;
    defaultPulseEnabled: boolean;
    defaultPulseAmount: number;
    defaultPulseCycleSeconds: number;
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
  surfaceGlowCount: number;
  particleCount: number;
  hueOffsetDegrees: number;
  currentSaturation: number;
  shaderSurfaceGlowCapacity: number;
  surfaceGlowDefaultIntensity: number;
  surfaceGlowAnimationActive: boolean;
  automaticMotionActive: boolean;
  surfaceGlowPickCanvasX?: number;
  surfaceGlowPickCanvasY?: number;
  surfaceGlowPickU?: number;
  surfaceGlowPickV?: number;
  surfaceGlowPickFoundPlane?: boolean;
  surfaceGlowPickEffectiveDepth?: number;
};

export type EnvironmentLabSceneProps = {
  playbackState: EnvironmentPlaybackState;
  twinklePlacementModeEnabled: boolean;
  surfaceGlowPlacementModeEnabled: boolean;
  preset: EnvironmentPreset;
  reducedMotionActive: boolean;
  onLoadingStateChange?: (state: EnvironmentLoadingState) => void;
  onDiagnosticsChange?: (diagnostics: EnvironmentDiagnostics) => void;
  onCreateTwinkleHotspot?: (u: number, v: number, phase: number) => void;
  onRemoveNearestTwinkleHotspot?: (u: number, v: number) => void;
  onCreateSurfaceGlowHotspot?: (u: number, v: number, phase: number) => void;
  onRemoveNearestSurfaceGlowHotspot?: (u: number, v: number) => void;
};
