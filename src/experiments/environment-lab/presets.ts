import type { ImageEnvironmentAsset, ImageEnvironmentPreset } from "./types";

export const UV_JUNGLE_ASSET_ID = "uv-jungle";

export const IMAGE_ENVIRONMENT_ASSETS: ImageEnvironmentAsset[] = [
  {
    id: UV_JUNGLE_ASSET_ID,
    name: "UV Jungle",
    colorImageUrl: "/experiments/depth-lab/jungle-color.png",
    depthMapUrl: "/experiments/depth-lab/jungle-depth.png",
    metadata: {
      description: "Experimental UV-reactive jungle artwork and aligned depth map.",
    },
  },
];

export const UV_JUNGLE_SHOWCASE_PRESET: ImageEnvironmentPreset = {
  id: "uv-jungle-showcase",
  name: "UV Jungle Showcase",
  assetId: UV_JUNGLE_ASSET_ID,
  depth: {
    motionIntensity: 0.35,
    depthStrength: 0.45,
    staticDepth: 0.56,
    breathingMin: 0,
    breathingMax: 1,
    breathingCycleSeconds: 4,
    pointerParallaxEnabled: true,
    pointerParallaxStrength: 0.42,
    ambientMotionEnabled: true,
  },
  color: {
    driftEnabled: true,
    hueRangeDegrees: 10,
    cycleSeconds: 75,
    saturation: 1.05,
    glowPulseEnabled: true,
    glowPulseAmount: 0.08,
    glowPulseCycleSeconds: 11,
  },
  saturationPulse: {
    enabled: false,
    minimumSaturation: 0.75,
    maximumSaturation: 1.15,
    cycleSeconds: 8,
    phaseOffset: 0,
    syncToDepthBreathing: false,
  },
  twinkles: {
    enabled: true,
    hotspots: [
      {
        id: "twk-0",
        u: 0.23,
        v: 0.34,
        color: "#7fffe2",
        size: 0.16,
        intensity: 0.9,
        phase: 0.14,
      },
      {
        id: "twk-1",
        u: 0.76,
        v: 0.47,
        color: "#9fffd3",
        size: 0.2,
        intensity: 0.82,
        phase: 0.52,
      },
      {
        id: "twk-2",
        u: 0.64,
        v: 0.23,
        color: "#83ffe8",
        size: 0.14,
        intensity: 0.94,
        phase: 0.81,
      },
    ],
    defaultColor: "#8fffe2",
    defaultSize: 0.18,
    defaultIntensity: 0.88,
    pulseSpeed: 0.75,
  },
  surfaceGlows: {
    enabled: true,
    hotspots: [],
    defaultColor: "#8fffe2",
    defaultRadius: 0.01,
    defaultSoftness: 0.65,
    defaultIntensity: 1.05,
    defaultPulseEnabled: true,
    defaultPulseMode: "brightness-bloom",
    defaultPulseAmount: 0.6,
    defaultMinimumIntensityMultiplier: 0.7,
    defaultMaximumIntensityMultiplier: 1.35,
    defaultRadiusExpansionMultiplier: 1.18,
    defaultPulseCycleSeconds: 3.5,
    defaultHueDriftEnabled: true,
    defaultHueDriftRangeDegrees: 14,
    defaultHueDriftCycleSeconds: 20,
  },
  particles: {
    enabled: true,
    count: 80,
    speed: 0.055,
    size: 0.03,
    opacity: 0.24,
    color: "#83ffd7",
    seed: 14,
  },
  haze: {
    enabled: true,
    opacity: 0.1,
    blurPixels: 28,
    driftCycleSeconds: 60,
    driftDistance: 24,
    driftBiasX: 1,
    driftBiasY: 0.65,
    primaryColor: "#52f4d1",
    secondaryColor: "#7a54ff",
  },
};

export const NEUTRAL_BASELINE_PRESET: ImageEnvironmentPreset = {
  ...UV_JUNGLE_SHOWCASE_PRESET,
  id: "neutral-baseline",
  name: "Neutral Baseline",
  depth: {
    ...UV_JUNGLE_SHOWCASE_PRESET.depth,
    pointerParallaxEnabled: false,
    ambientMotionEnabled: false,
  },
  color: {
    ...UV_JUNGLE_SHOWCASE_PRESET.color,
    driftEnabled: false,
    glowPulseEnabled: false,
  },
  saturationPulse: {
    ...UV_JUNGLE_SHOWCASE_PRESET.saturationPulse,
    enabled: false,
  },
  twinkles: {
    ...UV_JUNGLE_SHOWCASE_PRESET.twinkles,
    enabled: false,
  },
  surfaceGlows: {
    ...UV_JUNGLE_SHOWCASE_PRESET.surfaceGlows,
    enabled: false,
  },
  particles: {
    ...UV_JUNGLE_SHOWCASE_PRESET.particles,
    enabled: false,
  },
  haze: {
    ...UV_JUNGLE_SHOWCASE_PRESET.haze,
    enabled: false,
  },
};

export const IMAGE_ENVIRONMENT_PRESETS: ImageEnvironmentPreset[] = [
  NEUTRAL_BASELINE_PRESET,
  UV_JUNGLE_SHOWCASE_PRESET,
];

export function getImageEnvironmentAssetById(assetId: string) {
  return IMAGE_ENVIRONMENT_ASSETS.find((asset) => asset.id === assetId) ?? null;
}

export function cloneEnvironmentPreset(preset: ImageEnvironmentPreset): ImageEnvironmentPreset {
  return {
    ...preset,
    depth: { ...preset.depth },
    color: { ...preset.color },
    saturationPulse: { ...preset.saturationPulse },
    twinkles: {
      ...preset.twinkles,
      hotspots: preset.twinkles.hotspots.map((hotspot) => ({ ...hotspot })),
    },
    surfaceGlows: {
      ...preset.surfaceGlows,
      hotspots: preset.surfaceGlows.hotspots.map((hotspot) => ({ ...hotspot })),
    },
    particles: { ...preset.particles },
    haze: { ...preset.haze },
  };
}
