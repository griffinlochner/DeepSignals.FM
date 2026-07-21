import type {
  EnvironmentBehaviorPreset,
  EnvironmentBehaviorSettings,
  ImageEnvironmentAsset,
  ImageEnvironmentScenePreset,
  SurfaceGlowDefaultSettings,
} from "./types";

export const UV_JUNGLE_ASSET_ID = "uv-jungle";
export const ANALOG_SIGNAL_LABORATORY_ASSET_ID = "analog-signal-laboratory";
export const BIOLUMINESCENT_PSY_FOREST_ASSET_ID = "bioluminescent-psy-forest";
export const BIOLUMINESCENT_PSY_REEF_ASSET_ID = "bioluminescent-psy-reef";

export const IMAGE_ENVIRONMENT_ASSETS: ImageEnvironmentAsset[] = [
  {
    id: UV_JUNGLE_ASSET_ID,
    name: "UV Jungle",
    colorImageUrl: "/experiments/environment-lab/jungle-color.png",
    depthMapUrl: "/experiments/environment-lab/jungle-depth.png",
    metadata: {
      description: "Experimental UV-reactive jungle artwork and aligned depth map.",
    },
  },
  {
    id: ANALOG_SIGNAL_LABORATORY_ASSET_ID,
    name: "Analog Signal Laboratory",
    colorImageUrl:
      "/environments/analog-signal-laboratory/analog-signal-laboratory-color.webp",
    depthMapUrl: "/environments/analog-signal-laboratory/analog-signal-laboratory-depth.png",
    metadata: {
      description: "Premium analog synthesis workstation artwork and aligned depth map.",
    },
  },
  {
    id: BIOLUMINESCENT_PSY_FOREST_ASSET_ID,
    name: "Bioluminescent Psy Forest",
    colorImageUrl:
      "/environments/bioluminescent-psy-forest/bioluminescent-psy-forest-color.webp",
    depthMapUrl:
      "/environments/bioluminescent-psy-forest/bioluminescent-psy-forest-depth.png",
    metadata: {
      description: "Bioluminescent forest artwork and aligned depth map for calm organic environment authoring.",
    },
  },
  {
    id: BIOLUMINESCENT_PSY_REEF_ASSET_ID,
    name: "Bioluminescent Psy Reef",
    colorImageUrl:
      "/environments/bioluminescent-psy-reef/bioluminescent-psy-reef-color.webp",
    depthMapUrl:
      "/environments/bioluminescent-psy-reef/bioluminescent-psy-reef-depth.png",
    metadata: {
      description: "Bioluminescent reef artwork and aligned depth map for laboratory scene authoring.",
    },
  },
];

export const NEUTRAL_BEHAVIOR_SETTINGS: EnvironmentBehaviorSettings = {
  depth: {
    motionIntensity: 0.35,
    depthStrength: 0.45,
    staticDepth: 0.56,
    breathingMin: 0,
    breathingMax: 1,
    breathingCycleSeconds: 4,
    pointerParallaxEnabled: false,
    pointerParallaxStrength: 0.42,
    ambientMotionEnabled: false,
  },
  color: {
    driftEnabled: false,
    hueRangeDegrees: 10,
    cycleSeconds: 75,
    saturation: 1.05,
    glowPulseEnabled: false,
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
};

export const CHILL_BEHAVIOR_SETTINGS: EnvironmentBehaviorSettings = {
  depth: {
    motionIntensity: 0.52,
    depthStrength: 0.62,
    staticDepth: 0.6,
    breathingMin: 0.04,
    breathingMax: 1,
    breathingCycleSeconds: 2.8,
    pointerParallaxEnabled: true,
    pointerParallaxStrength: 0.62,
    ambientMotionEnabled: true,
  },
  color: {
    driftEnabled: true,
    hueRangeDegrees: 24,
    cycleSeconds: 26,
    saturation: 1.16,
    glowPulseEnabled: true,
    glowPulseAmount: 0.18,
    glowPulseCycleSeconds: 5.2,
  },
  saturationPulse: {
    enabled: true,
    minimumSaturation: 0.72,
    maximumSaturation: 1.38,
    cycleSeconds: 4.2,
    phaseOffset: 0,
    syncToDepthBreathing: false,
  },
};

export const FULL_ON_BEHAVIOR_SETTINGS: EnvironmentBehaviorSettings = {
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
    saturation: 0.75,
    glowPulseEnabled: true,
    glowPulseAmount: 0.4,
    glowPulseCycleSeconds: 2,
  },
  saturationPulse: {
    enabled: true,
    minimumSaturation: 0.5,
    maximumSaturation: 1.75,
    cycleSeconds: 0.7,
    phaseOffset: -0.01,
    syncToDepthBreathing: false,
  },
};

export const ENVIRONMENT_BEHAVIOR_PRESETS: EnvironmentBehaviorPreset[] = [
  {
    id: "neutral",
    name: "Neutral",
    description: "Global motion and optional color effects disabled. Surface Glow layout is preserved.",
    settings: NEUTRAL_BEHAVIOR_SETTINGS,
  },
  {
    id: "chill",
    name: "Chill",
    description: "A relaxed environment profile with gentle motion and restrained color evolution.",
    settings: CHILL_BEHAVIOR_SETTINGS,
  },
  {
    id: "full-on",
    name: "Full On",
    description:
      "Psychedelic rave in the jungle with full-range depth breathing, maximum parallax, wide hue drift, and aggressive saturation pulse.",
    settings: FULL_ON_BEHAVIOR_SETTINGS,
  },
];

export const DEFAULT_SURFACE_GLOW_SETTINGS: SurfaceGlowDefaultSettings = {
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
};

export const NEUTRAL_BASELINE_SCENE_PRESET: ImageEnvironmentScenePreset = {
  id: "neutral-baseline",
  name: "Neutral Baseline",
  assetId: UV_JUNGLE_ASSET_ID,
  behavior: NEUTRAL_BEHAVIOR_SETTINGS,
  surfaceGlows: {
    enabled: false,
    hotspots: [],
    defaults: DEFAULT_SURFACE_GLOW_SETTINGS,
  },
};

export const UV_JUNGLE_SHOWCASE_SCENE_PRESET: ImageEnvironmentScenePreset = {
  id: "uv-jungle-showcase",
  name: "UV Jungle Showcase",
  assetId: UV_JUNGLE_ASSET_ID,
  behavior: {
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
      enabled: true,
      minimumSaturation: 0.82,
      maximumSaturation: 1.22,
      cycleSeconds: 7,
      phaseOffset: 0,
      syncToDepthBreathing: false,
    },
  },
  surfaceGlows: {
    enabled: true,
    hotspots: [],
    defaults: DEFAULT_SURFACE_GLOW_SETTINGS,
  },
};

export const IMAGE_ENVIRONMENT_SCENE_PRESETS: ImageEnvironmentScenePreset[] = [
  NEUTRAL_BASELINE_SCENE_PRESET,
  UV_JUNGLE_SHOWCASE_SCENE_PRESET,
  {
    id: "analog-signal-laboratory-default",
    name: "Analog Signal Laboratory",
    assetId: ANALOG_SIGNAL_LABORATORY_ASSET_ID,
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
      defaults: DEFAULT_SURFACE_GLOW_SETTINGS,
    },
  },
];

export function createNeutralScenePresetForAsset(assetId: string): ImageEnvironmentScenePreset {
  const asset = getImageEnvironmentAssetById(assetId);
  const safeAssetId = asset?.id ?? UV_JUNGLE_ASSET_ID;
  const neutralId =
    safeAssetId === UV_JUNGLE_ASSET_ID
      ? "neutral-baseline"
      : safeAssetId === ANALOG_SIGNAL_LABORATORY_ASSET_ID
        ? "analog-signal-laboratory-neutral"
        : `${safeAssetId}-neutral`;
  const neutralName =
    safeAssetId === UV_JUNGLE_ASSET_ID
      ? "Neutral Baseline"
      : `${asset?.name ?? "Image Environment"} Neutral`;

  return {
    id: neutralId,
    name: neutralName,
    assetId: safeAssetId,
    behavior: cloneBehaviorSettings(NEUTRAL_BEHAVIOR_SETTINGS),
    surfaceGlows: {
      enabled: false,
      hotspots: [],
      defaults: { ...DEFAULT_SURFACE_GLOW_SETTINGS },
    },
  };
}

export function getImageEnvironmentAssetById(assetId: string) {
  return IMAGE_ENVIRONMENT_ASSETS.find((asset) => asset.id === assetId) ?? null;
}

export function getBehaviorPresetById(presetId: string) {
  return ENVIRONMENT_BEHAVIOR_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function getScenePresetById(presetId: string) {
  return IMAGE_ENVIRONMENT_SCENE_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function cloneBehaviorSettings(settings: EnvironmentBehaviorSettings): EnvironmentBehaviorSettings {
  return {
    depth: { ...settings.depth },
    color: { ...settings.color },
    saturationPulse: { ...settings.saturationPulse },
  };
}

export function cloneScenePreset(preset: ImageEnvironmentScenePreset): ImageEnvironmentScenePreset {
  return {
    ...preset,
    behavior: cloneBehaviorSettings(preset.behavior),
    surfaceGlows: {
      ...preset.surfaceGlows,
      defaults: { ...preset.surfaceGlows.defaults },
      hotspots: preset.surfaceGlows.hotspots.map((hotspot) => ({ ...hotspot })),
    },
  };
}

export function applyBehaviorPreset(
  scenePreset: ImageEnvironmentScenePreset,
  behaviorPreset: EnvironmentBehaviorPreset,
): ImageEnvironmentScenePreset {
  return {
    ...scenePreset,
    behavior: cloneBehaviorSettings(behaviorPreset.settings),
    surfaceGlows: {
      ...scenePreset.surfaceGlows,
      defaults: { ...scenePreset.surfaceGlows.defaults },
      hotspots: scenePreset.surfaceGlows.hotspots.map((hotspot) => ({ ...hotspot })),
    },
  };
}
