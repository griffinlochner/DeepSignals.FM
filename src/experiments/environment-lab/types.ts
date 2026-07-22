export type EnvironmentPlaybackState = "stopped" | "playing";
export type EnvironmentLoadingState = "loading" | "ready" | "error";
export type EnvironmentFramingMode = "full-artwork" | "player-preview";

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

export type EnvironmentBehaviorSettings = {
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
};

export type EnvironmentBehaviorPreset = {
  id: string;
  name: string;
  description?: string;
  settings: EnvironmentBehaviorSettings;
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

export type SurfaceGlowDefaultSettings = {
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
};

export type SurfaceGlowSceneSettings = {
  enabled: boolean;
  hotspots: SurfaceGlowHotspot[];
  defaults: SurfaceGlowDefaultSettings;
};

export type ImageEnvironmentScenePreset = {
  id: string;
  name: string;
  assetId: string;
  behavior: EnvironmentBehaviorSettings;
  surfaceGlows: SurfaceGlowSceneSettings;
};

export type EnvironmentLabSessionState = {
  playbackState: EnvironmentPlaybackState;
  geometryMotionPreviewEnabled: boolean;
  surfaceGlowPlacementModeEnabled: boolean;
  framingMode: EnvironmentFramingMode;
};

export type EnvironmentDiagnostics = {
  fps: number;
  effectiveDepth: number;
  surfaceGlowCount: number;
  hueOffsetDegrees: number;
  currentSaturation: number;
  shaderSurfaceGlowCapacity: number;
  surfaceGlowDefaultIntensity: number;
  surfaceGlowAnimationActive: boolean;
  automaticMotionActive: boolean;
  surfaceGlowAnimationStatus: string;
  surfaceGlowPulseFactor: number;
  assetDiagnostics: RuntimeAssetDiagnostics;
  mostRecentSurfaceGlowU?: number;
  mostRecentSurfaceGlowV?: number;
  surfaceGlowPickCanvasX?: number;
  surfaceGlowPickCanvasY?: number;
  surfaceGlowPickU?: number;
  surfaceGlowPickV?: number;
  surfaceGlowPickFoundPlane?: boolean;
  surfaceGlowPickEffectiveDepth?: number;
};

export type EnvironmentLabSceneProps = {
  playbackState: EnvironmentPlaybackState;
  geometryMotionPreviewEnabled: boolean;
  surfaceGlowPlacementModeEnabled: boolean;
  framingMode: EnvironmentFramingMode;
  preset: ImageEnvironmentScenePreset;
  asset: ImageEnvironmentAsset;
  reducedMotionActive: boolean;
  onLoadingStateChange?: (state: EnvironmentLoadingState) => void;
  onDiagnosticsChange?: (diagnostics: EnvironmentDiagnostics) => void;
  onCreateSurfaceGlowHotspot?: (u: number, v: number, phase: number) => void;
  onRemoveNearestSurfaceGlowHotspot?: (u: number, v: number) => void;
  onSurfaceGlowCapacityReached?: () => void;
};
