export type ImageDepthAsset = {
  id: string;
  name: string;
  colorImageUrl: string;
  depthMapUrl: string;
};

export type ImageDepthBehaviorSettings = {
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

export type ImageDepthAmbientParticlePreset = {
  count: number;
  sizeRange: {
    min: number;
    max: number;
  };
  depthOffsetRange: {
    min: number;
    max: number;
  };
  driftSpeedRange: {
    chill: number;
    fullOn: number;
  };
  visibilityDensityScaleRange: {
    min: number;
    max: number;
  };
  brightnessBiasRange: {
    min: number;
    max: number;
  };
  colorBiasPalette: string[];
};

export type ImageDepthSurfaceGlowPulseMode =
  | "brightness"
  | "bloom"
  | "brightness-bloom"
  | "soft-blink";

export type ImageDepthSurfaceGlowHotspot = {
  id: string;
  u: number;
  v: number;
  color: string;
  radius: number;
  softness: number;
  intensity: number;
  pulseEnabled: boolean;
  pulseMode: ImageDepthSurfaceGlowPulseMode;
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

export type ImageDepthSurfaceGlowDefaults = {
  color: string;
  radius: number;
  softness: number;
  intensity: number;
  pulseEnabled: boolean;
  pulseMode: ImageDepthSurfaceGlowPulseMode;
  pulseAmount: number;
  minimumIntensityMultiplier: number;
  maximumIntensityMultiplier: number;
  radiusExpansionMultiplier: number;
  pulseCycleSeconds: number;
  hueDriftEnabled: boolean;
  hueDriftRangeDegrees: number;
  hueDriftCycleSeconds: number;
};

export type ImageDepthSurfaceGlows = {
  enabled: boolean;
  hotspots: ImageDepthSurfaceGlowHotspot[];
  defaults?: ImageDepthSurfaceGlowDefaults;
};

export type ImageDepthScenePreset = {
  id: string;
  name: string;
  assetId: string;
  behavior: ImageDepthBehaviorSettings;
  surfaceGlows: ImageDepthSurfaceGlows;
  ambientParticles?: ImageDepthAmbientParticlePreset;
};
