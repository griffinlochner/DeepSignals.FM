import type {
  ImageDepthAmbientParticlePreset,
  ImageDepthAsset,
  ImageDepthScenePreset,
  ImageDepthSurfaceGlowDefaults,
  ImageDepthSurfaceGlowHotspot,
} from "./types";
import {
  ANALOG_SIGNAL_LABORATORY_PRODUCTION_SCENE_PRESET,
  BIOLUMINESCENT_PSY_FOREST_PRODUCTION_SCENE_PRESET,
  BIOLUMINESCENT_PSY_REEF_PRODUCTION_SCENE_PRESET,
  CRYSTAL_CAVERN_PRODUCTION_SCENE_PRESET,
  FEMALE_DJ_1_PRODUCTION_SCENE_PRESET,
  FEMALE_DJ_2_PRODUCTION_SCENE_PRESET,
  SLIME_CAVERN_PRODUCTION_SCENE_PRESET,
  DEFAULT_IMAGE_DEPTH_CHILL_BEHAVIOR,
  DEFAULT_SURFACE_GLOW_SETTINGS,
  UV_JUNGLE_PRODUCTION_SCENE_PRESET,
} from "./productionScenePresets";

export const PLAYER_SKIN_IDS = [
  "violet-cyan",
  "neon-pink",
  "acid-green",
  "deep-ocean",
  "ember-orange",
] as const;

export type PlayerSkinId = (typeof PLAYER_SKIN_IDS)[number];

export type EnvironmentCatalogEntry = {
  id: string;
  displayName: string;
  uiSkin: PlayerSkinId;
  glowDots: ImageDepthSurfaceGlowHotspot[];
  description: string;
  sceneBackdrop?: string;
  asset: ImageDepthAsset;
  productionScenePreset: ImageDepthScenePreset;
};

type EnvironmentCatalogSeed = {
  id: string;
  displayName: string;
  uiSkin: PlayerSkinId;
  glowDots: ImageDepthSurfaceGlowHotspot[];
  description?: string;
  sceneBackdrop?: string;
  productionBehaviorOverride?: ImageDepthScenePreset["behavior"];
  surfaceGlowDefaultsOverride?: ImageDepthSurfaceGlowDefaults;
  surfaceGlowsEnabledOverride?: boolean;
  ambientParticlesOverride?: ImageDepthAmbientParticlePreset;
};

function cloneGlowDots(hotspots: ImageDepthSurfaceGlowHotspot[]): ImageDepthSurfaceGlowHotspot[] {
  return hotspots.map((hotspot) => ({ ...hotspot }));
}

function createEnvironmentAssetUrls(id: string) {
  return {
    colorImageUrl: `/environments/${id}/${id}-color.webp`,
    depthMapUrl: `/environments/${id}/${id}-depth.png`,
  };
}

function cloneBehavior(behavior: ImageDepthScenePreset["behavior"]): ImageDepthScenePreset["behavior"] {
  return {
    depth: { ...behavior.depth },
    color: { ...behavior.color },
    saturationPulse: { ...behavior.saturationPulse },
  };
}

function cloneSurfaceGlowDefaults(defaults: ImageDepthSurfaceGlowDefaults): ImageDepthSurfaceGlowDefaults {
  return { ...defaults };
}

function cloneAmbientParticles(
  ambientParticles: ImageDepthAmbientParticlePreset | undefined,
): ImageDepthAmbientParticlePreset | undefined {
  if (!ambientParticles) {
    return undefined;
  }

  return {
    count: ambientParticles.count,
    sizeRange: { ...ambientParticles.sizeRange },
    depthOffsetRange: { ...ambientParticles.depthOffsetRange },
    driftSpeedRange: { ...ambientParticles.driftSpeedRange },
    visibilityDensityScaleRange: { ...ambientParticles.visibilityDensityScaleRange },
    brightnessBiasRange: { ...ambientParticles.brightnessBiasRange },
    colorBiasPalette: [...ambientParticles.colorBiasPalette],
  };
}

function createDerivedProductionScenePreset(seed: EnvironmentCatalogSeed): ImageDepthScenePreset {
  const behavior = cloneBehavior(seed.productionBehaviorOverride ?? DEFAULT_IMAGE_DEPTH_CHILL_BEHAVIOR);
  const defaults = cloneSurfaceGlowDefaults(
    seed.surfaceGlowDefaultsOverride ?? DEFAULT_SURFACE_GLOW_SETTINGS,
  );
  const hotspots = cloneGlowDots(seed.glowDots);
  const surfaceGlowsEnabled = seed.surfaceGlowsEnabledOverride ?? true;

  return {
    id: `${seed.id}-default`,
    name: seed.displayName,
    assetId: seed.id,
    behavior,
    surfaceGlows: {
      enabled: surfaceGlowsEnabled,
      defaults,
      hotspots,
    },
    ambientParticles: cloneAmbientParticles(seed.ambientParticlesOverride),
  };
}

function createEnvironmentDescription(displayName: string) {
  return `Production image-depth ${displayName} environment authored through the shared runtime.`;
}

function buildCatalogEntry(seed: EnvironmentCatalogSeed): EnvironmentCatalogEntry {
  const derivedUrls = createEnvironmentAssetUrls(seed.id);

  return {
    id: seed.id,
    displayName: seed.displayName,
    uiSkin: seed.uiSkin,
    glowDots: cloneGlowDots(seed.glowDots),
    description: seed.description ?? createEnvironmentDescription(seed.displayName),
    sceneBackdrop: seed.sceneBackdrop,
    asset: {
      id: seed.id,
      name: seed.displayName,
      colorImageUrl: derivedUrls.colorImageUrl,
      depthMapUrl: derivedUrls.depthMapUrl,
    },
    productionScenePreset: createDerivedProductionScenePreset(seed),
  };
}

function createSeedFromLegacyPreset(
  id: string,
  displayName: string,
  uiSkin: PlayerSkinId,
  legacyPreset: ImageDepthScenePreset,
  options: {
    description?: string;
    sceneBackdrop?: string;
  } = {},
): EnvironmentCatalogSeed {
  return {
    id,
    displayName,
    uiSkin,
    glowDots: cloneGlowDots(legacyPreset.surfaceGlows.hotspots),
    description: options.description,
    sceneBackdrop: options.sceneBackdrop,
    productionBehaviorOverride: cloneBehavior(legacyPreset.behavior),
    surfaceGlowDefaultsOverride: legacyPreset.surfaceGlows.defaults
      ? cloneSurfaceGlowDefaults(legacyPreset.surfaceGlows.defaults)
      : cloneSurfaceGlowDefaults(DEFAULT_SURFACE_GLOW_SETTINGS),
    surfaceGlowsEnabledOverride: legacyPreset.surfaceGlows.enabled,
    ambientParticlesOverride: cloneAmbientParticles(legacyPreset.ambientParticles),
  };
}

export const imageDepthEnvironmentRegistrationSeeds: EnvironmentCatalogSeed[] = [
  {
    ...createSeedFromLegacyPreset(
      "uv-reactive-jungle",
      "UV Reactive Jungle",
      "acid-green",
      UV_JUNGLE_PRODUCTION_SCENE_PRESET,
      {
        description:
          "Production prototype for UV-responsive jungle depth imaging and live signal ambience.",
        sceneBackdrop:
          "radial-gradient(circle at 18% 20%, rgba(104, 255, 226, 0.05), transparent 34%), radial-gradient(circle at 78% 24%, rgba(255, 141, 196, 0.04), transparent 32%), #08110d",
      },
    ),
  },
  {
    ...createSeedFromLegacyPreset(
      "analog-signal-laboratory",
      "Analog Signal Laboratory",
      "ember-orange",
      ANALOG_SIGNAL_LABORATORY_PRODUCTION_SCENE_PRESET,
      {
        description:
          "Image-depth environment authored in the Environment Laboratory and promoted to production player.",
        sceneBackdrop:
          "radial-gradient(circle at 12% 14%, rgba(255, 149, 96, 0.08), transparent 38%), radial-gradient(circle at 78% 22%, rgba(83, 183, 255, 0.08), transparent 36%), #0d0a07",
      },
    ),
  },
  {
    ...createSeedFromLegacyPreset(
      "bioluminescent-psy-forest",
      "Bioluminescent Psy Forest",
      "acid-green",
      BIOLUMINESCENT_PSY_FOREST_PRODUCTION_SCENE_PRESET,
      {
        description:
          "Production image-depth forest environment authored in the Environment Laboratory and promoted through the shared runtime.",
        sceneBackdrop:
          "radial-gradient(circle at 18% 18%, rgba(35, 140, 118, 0.12), transparent 30%), radial-gradient(circle at 72% 28%, rgba(255, 216, 77, 0.08), transparent 24%), radial-gradient(circle at 58% 76%, rgba(222, 86, 170, 0.08), transparent 28%), linear-gradient(180deg, rgba(4, 13, 14, 0.98), rgba(2, 7, 8, 1))",
      },
    ),
  },
  {
    ...createSeedFromLegacyPreset(
      "bioluminescent-psy-reef",
      "Bioluminescent Psy Reef",
      "deep-ocean",
      BIOLUMINESCENT_PSY_REEF_PRODUCTION_SCENE_PRESET,
      {
        description:
          "Production image-depth reef environment authored in the Environment Laboratory and promoted through the shared runtime.",
        sceneBackdrop:
          "radial-gradient(circle at 18% 20%, rgba(0, 251, 255, 0.11), transparent 30%), radial-gradient(circle at 68% 24%, rgba(166, 0, 255, 0.11), transparent 28%), radial-gradient(circle at 52% 78%, rgba(30, 255, 0, 0.08), transparent 24%), linear-gradient(180deg, rgba(3, 10, 18, 0.98), rgba(2, 7, 12, 1))",
      },
    ),
  },
  {
    ...createSeedFromLegacyPreset(
      "crystal-cavern",
      "Crystal Cavern",
      "violet-cyan",
      CRYSTAL_CAVERN_PRODUCTION_SCENE_PRESET,
      {
        description:
          "Production image-depth crystal cavern environment authored through the shared runtime.",
        sceneBackdrop:
          "radial-gradient(circle at 24% 18%, rgba(176, 243, 255, 0.12), transparent 28%), radial-gradient(circle at 72% 20%, rgba(203, 241, 255, 0.1), transparent 26%), radial-gradient(circle at 52% 80%, rgba(144, 214, 255, 0.08), transparent 24%), linear-gradient(180deg, rgba(7, 13, 20, 0.98), rgba(3, 7, 12, 1))",
      },
    ),
  },
  {
    ...createSeedFromLegacyPreset(
      "slime-cavern",
      "Slime Cavern",
      "acid-green",
      SLIME_CAVERN_PRODUCTION_SCENE_PRESET,
      {
        description:
          "Production image-depth slime cavern environment authored through the shared runtime.",
        sceneBackdrop:
          "radial-gradient(circle at 20% 18%, rgba(161, 255, 161, 0.12), transparent 28%), radial-gradient(circle at 74% 22%, rgba(214, 255, 120, 0.1), transparent 26%), radial-gradient(circle at 48% 78%, rgba(77, 214, 102, 0.08), transparent 24%), linear-gradient(180deg, rgba(8, 15, 10, 0.98), rgba(4, 9, 6, 1))",
      },
    ),
  },
  {
    ...createSeedFromLegacyPreset(
      "female-dj-1",
      "Female DJ 1",
      "neon-pink",
      FEMALE_DJ_1_PRODUCTION_SCENE_PRESET,
      {
        description:
          "Production image-depth Female DJ 1 environment authored through the shared runtime.",
        sceneBackdrop:
          "radial-gradient(circle at 24% 16%, rgba(255, 158, 214, 0.13), transparent 28%), radial-gradient(circle at 74% 22%, rgba(255, 214, 120, 0.1), transparent 26%), radial-gradient(circle at 52% 80%, rgba(255, 96, 180, 0.08), transparent 24%), linear-gradient(180deg, rgba(24, 8, 20, 0.98), rgba(10, 4, 12, 1))",
      },
    ),
  },
  {
    ...createSeedFromLegacyPreset(
      "female-dj-2",
      "Female DJ 2",
      "violet-cyan",
      FEMALE_DJ_2_PRODUCTION_SCENE_PRESET,
      {
        description:
          "Production image-depth Female DJ 2 environment authored through the shared runtime.",
        sceneBackdrop:
          "radial-gradient(circle at 22% 18%, rgba(139, 207, 255, 0.12), transparent 28%), radial-gradient(circle at 76% 20%, rgba(255, 120, 194, 0.1), transparent 26%), radial-gradient(circle at 50% 82%, rgba(173, 119, 255, 0.08), transparent 24%), linear-gradient(180deg, rgba(16, 10, 25, 0.98), rgba(7, 4, 12, 1))",
      },
    ),
  },
  {
  id: "psychedelic-temple",
  displayName: "Psychedelic Temple",
  uiSkin: "violet-cyan",
  glowDots: [],
},
];

export const imageDepthEnvironmentCatalog: EnvironmentCatalogEntry[] =
  imageDepthEnvironmentRegistrationSeeds.map((seed) => buildCatalogEntry(seed));

export const imageDepthEnvironmentById = new Map(
  imageDepthEnvironmentCatalog.map((environment) => [environment.id, environment]),
);

export function getImageDepthEnvironmentById(id: string) {
  return imageDepthEnvironmentById.get(id) ?? null;
}

export function getImageDepthEnvironmentAssetById(id: string): ImageDepthAsset | null {
  return getImageDepthEnvironmentById(id)?.asset ?? null;
}

export function getProductionScenePresetByEnvironmentId(id: string): ImageDepthScenePreset | null {
  return getImageDepthEnvironmentById(id)?.productionScenePreset ?? null;
}
