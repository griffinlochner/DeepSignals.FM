export type EnvironmentPlaybackState = "stopped" | "playing";
export type EnvironmentLoadingState = "loading" | "ready" | "error";

export type SurfaceGlowPulseMode =
  | "brightness"
  | "bloom"
  | "brightness-bloom"
  | "soft-blink";

export type ImageEnvironmentAsset = {
  id: string;
  name: string;
  colorImageUrl: string;
  depthMapUrl: string;
  metadata?: {
    description?: string;
  };
};

export type RuntimeAssetDiagnostics = {
  colorWidth: number;
  colorHeight: number;
  depthWidth: number;
  depthHeight: number;
  colorAspectRatio: number;
  depthAspectRatio: number;
  dimensionsMatch: boolean;
  aspectMatch: boolean;
};

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
  pulseMode: SurfaceGlowPulseMode;
  pulseAmount: number;
  minimumIntensityMultiplier: number;
  maximumIntensityMultiplier: number;
  radiusExpansionMultiplier: number;
  pulseCycleSeconds: number;
  hueDriftEnabled: boolean;
  hueDriftRangeDegrees: number;
  hueDriftCycleSeconds: number;
  phase: number;
};

export type ImageEnvironmentPreset = {
  id: string;
  name: string;
  assetId: string;
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
    defaultPulseMode: SurfaceGlowPulseMode;
    defaultPulseAmount: number;
    defaultMinimumIntensityMultiplier: number;
    defaultMaximumIntensityMultiplier: number;
    defaultRadiusExpansionMultiplier: number;
    defaultPulseCycleSeconds: number;
    defaultHueDriftEnabled: boolean;
    defaultHueDriftRangeDegrees: number;
    defaultHueDriftCycleSeconds: number;
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
    driftDistance: number;
    driftBiasX: number;
    driftBiasY: number;
    primaryColor: string;
    secondaryColor: string;
  };
};

export type EnvironmentLabSessionState = {
  playbackState: EnvironmentPlaybackState;
  twinklePlacementModeEnabled: boolean;
  surfaceGlowPlacementModeEnabled: boolean;
  hazeMotionPreview4xEnabled: boolean;
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
  surfaceGlowAnimationStatus: string;
  surfaceGlowPulseFactor: number;
  hazeAnimationStatus: string;
  hazeOffsetX: number;
  hazeOffsetY: number;
  assetDiagnostics: RuntimeAssetDiagnostics;
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
  hazeMotionPreview4xEnabled: boolean;
  preset: ImageEnvironmentPreset;
  asset: ImageEnvironmentAsset;
  reducedMotionActive: boolean;
  onLoadingStateChange?: (state: EnvironmentLoadingState) => void;
  onDiagnosticsChange?: (diagnostics: EnvironmentDiagnostics) => void;
  onCreateTwinkleHotspot?: (u: number, v: number, phase: number) => void;
  onRemoveNearestTwinkleHotspot?: (u: number, v: number) => void;
  onCreateSurfaceGlowHotspot?: (u: number, v: number, phase: number) => void;
  onRemoveNearestSurfaceGlowHotspot?: (u: number, v: number) => void;
  onSurfaceGlowCapacityReached?: () => void;
};
