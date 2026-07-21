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

export type ImageDepthSurfaceGlows = {
  enabled: boolean;
  hotspots: Array<{ id: string; u: number; v: number }>;
};

export type ImageDepthScenePreset = {
  id: string;
  name: string;
  assetId: string;
  behavior: ImageDepthBehaviorSettings;
  surfaceGlows: ImageDepthSurfaceGlows;
};
