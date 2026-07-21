import type { ImageDepthAsset, ImageDepthScenePreset } from "./types";

export const UV_JUNGLE_PRODUCTION_ASSET: ImageDepthAsset = {
  id: "uv-jungle",
  name: "UV Reactive Jungle",
  colorImageUrl: "/experiments/environment-lab/jungle-color.png",
  depthMapUrl: "/experiments/environment-lab/jungle-depth.png",
};

export const ANALOG_SIGNAL_LABORATORY_PRODUCTION_ASSET: ImageDepthAsset = {
  id: "analog-signal-laboratory",
  name: "Analog Signal Laboratory",
  colorImageUrl: "/environments/analog-signal-laboratory/analog-signal-laboratory-color.webp",
  depthMapUrl: "/environments/analog-signal-laboratory/analog-signal-laboratory-depth.png",
};

export const UV_JUNGLE_PRODUCTION_SCENE_PRESET: ImageDepthScenePreset = {
  id: "uv-jungle-default",
  name: "UV Reactive Jungle",
  assetId: "uv-jungle",
  behavior: {
    depth: {
      motionIntensity: 1,
      depthStrength: 1,
      staticDepth: 0.42,
      breathingMin: 0,
      breathingMax: 1,
      breathingCycleSeconds: 4.9,
      pointerParallaxEnabled: true,
      pointerParallaxStrength: 0.085,
      ambientMotionEnabled: true,
    },
    color: {
      driftEnabled: false,
      hueRangeDegrees: 0,
      cycleSeconds: 75,
      saturation: 1,
      glowPulseEnabled: false,
      glowPulseAmount: 0,
      glowPulseCycleSeconds: 11,
    },
    saturationPulse: {
      enabled: false,
      minimumSaturation: 1,
      maximumSaturation: 1,
      cycleSeconds: 8,
      phaseOffset: 0,
      syncToDepthBreathing: false,
    },
  },
  surfaceGlows: {
    enabled: false,
    hotspots: [],
  },
};

export const ANALOG_SIGNAL_LABORATORY_PRODUCTION_SCENE_PRESET: ImageDepthScenePreset = {
  id: "analog-signal-laboratory-default",
  name: "Analog Signal Laboratory",
  assetId: "analog-signal-laboratory",
  behavior: {
    depth: {
      motionIntensity: 1,
      depthStrength: 1,
      staticDepth: 0,
      breathingMin: 0,
      breathingMax: 1,
      breathingCycleSeconds: 1,
      pointerParallaxEnabled: true,
      pointerParallaxStrength: 1,
      ambientMotionEnabled: true,
    },
    color: {
      driftEnabled: true,
      hueRangeDegrees: 60,
      cycleSeconds: 10,
      saturation: 0,
      glowPulseEnabled: true,
      glowPulseAmount: 0.27,
      glowPulseCycleSeconds: 47,
    },
    saturationPulse: {
      enabled: true,
      minimumSaturation: 0,
      maximumSaturation: 2.18,
      cycleSeconds: 1.6,
      phaseOffset: -2.29,
      syncToDepthBreathing: false,
    },
  },
  surfaceGlows: {
    enabled: false,
    hotspots: [],
    defaults: {
      color: "#8fffe2",
      radius: 0.01,
      softness: 0.65,
      intensity: 1.05,
      pulseEnabled: true,
      pulseMode: "brightness-bloom",
      pulseAmount: 0.6,
      minimumIntensityMultiplier: 0.7,
      maximumIntensityMultiplier: 1.35,
      radiusExpansionMultiplier: 1.18,
      pulseCycleSeconds: 3.5,
      hueDriftEnabled: true,
      hueDriftRangeDegrees: 14,
      hueDriftCycleSeconds: 20,
    },
  },
};
