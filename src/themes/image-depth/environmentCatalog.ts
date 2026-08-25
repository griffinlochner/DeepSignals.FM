import type {
  ImageDepthAmbientParticlePreset,
  ImageDepthAsset,
  ImageDepthScenePreset,
} from "./types";
import {
  ANALOG_SIGNAL_LABORATORY_PRODUCTION_SCENE_PRESET,
  BIOLUMINESCENT_PSY_FOREST_PRODUCTION_SCENE_PRESET,
  BIOLUMINESCENT_PSY_REEF_PRODUCTION_SCENE_PRESET,
  CRYSTAL_CAVERN_PRODUCTION_SCENE_PRESET,
  FEMALE_DJ_1_PRODUCTION_SCENE_PRESET,
  SLIME_CAVERN_PRODUCTION_SCENE_PRESET,
  DEFAULT_IMAGE_DEPTH_CHILL_BEHAVIOR,
  UV_JUNGLE_PRODUCTION_SCENE_PRESET,
} from "./productionScenePresets";

export type EnvironmentCatalogEntry = {
  id: string;
  displayName: string;
  description: string;
  sceneBackdrop?: string;
  asset: ImageDepthAsset;
  productionScenePreset: ImageDepthScenePreset;
};

type EnvironmentCatalogSeed = {
  id: string;
  displayName: string;
  description?: string;
  sceneBackdrop?: string;
  colorImageUrl?: string;
  depthMapUrl?: string;
  productionBehaviorOverride?: ImageDepthScenePreset["behavior"];
  ambientParticlesOverride?: ImageDepthAmbientParticlePreset;
};

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

  return {
    id: `${seed.id}-default`,
    name: seed.displayName,
    assetId: seed.id,
    behavior,
    ambientParticles: cloneAmbientParticles(seed.ambientParticlesOverride),
  };
}

function createEnvironmentDescription(displayName: string) {
  return `Production image-depth ${displayName} environment authored through the shared runtime.`;
}

function buildCatalogEntry(seed: EnvironmentCatalogSeed): EnvironmentCatalogEntry {
  const derivedUrls = createEnvironmentAssetUrls(seed.id);
  const colorImageUrl = seed.colorImageUrl ?? derivedUrls.colorImageUrl;
  const depthMapUrl = seed.depthMapUrl ?? derivedUrls.depthMapUrl;

  return {
    id: seed.id,
    displayName: seed.displayName,
    description: seed.description ?? createEnvironmentDescription(seed.displayName),
    sceneBackdrop: seed.sceneBackdrop,
    asset: {
      id: seed.id,
      name: seed.displayName,
      colorImageUrl,
      depthMapUrl,
    },
    productionScenePreset: createDerivedProductionScenePreset(seed),
  };
}

function createSeedFromLegacyPreset(
  id: string,
  displayName: string,
  legacyPreset: ImageDepthScenePreset,
  options: {
    description?: string;
    sceneBackdrop?: string;
  } = {},
): EnvironmentCatalogSeed {
  return {
    id,
    displayName,
    description: options.description,
    sceneBackdrop: options.sceneBackdrop,
    productionBehaviorOverride: cloneBehavior(legacyPreset.behavior),
    ambientParticlesOverride: cloneAmbientParticles(legacyPreset.ambientParticles),
  };
}

export const imageDepthEnvironmentRegistrationSeeds: EnvironmentCatalogSeed[] = [
  {
    ...createSeedFromLegacyPreset(
      "uv-reactive-jungle",
      "UV Reactive Jungle",
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
    id: "psychedelic-temple",
    displayName: "Psychedelic Temple",
  },
  {
    id: "alien-dj-1",
    displayName: "Alien DJ",
    colorImageUrl: "/environments/alien-dj-1/alien-dj-1.webp",
    depthMapUrl: "/environments/alien-dj-1/alien-dj-1.png",
  },
  {
    id: "dark-psy-temple",
    displayName: "Dark Psy Temple",
    colorImageUrl: "/environments/dark-psy-temple/dark-psy-temple.webp",
    depthMapUrl: "/environments/dark-psy-temple/dark-psy-temple.png",
  },
  {
    id: "dark-ritual-swamp",
    displayName: "Dark Ritual Swamp",
    colorImageUrl: "/environments/dark-ritual-swamp/dark-ritual-swamp.webp",
    depthMapUrl: "/environments/dark-ritual-swamp/dark-ritual-swamp.png",
  },
  {
    id: "energy-rift-swamp",
    displayName: "Energy Rift Swamp",
    colorImageUrl: "/environments/energy-rift-swamp/energy-rift-swamp.webp",
    depthMapUrl: "/environments/energy-rift-swamp/energy-rift-swamp.png",
  },
  {
    id: "female-meditation-1",
    displayName: "Female Meditation 1",
    colorImageUrl: "/environments/female-meditation-1/female-meditation-1.webp",
    depthMapUrl: "/environments/female-meditation-1/female-meditation-1.png",
  },
  {
    id: "lost-relay-tower",
    displayName: "Lost Relay Tower",
    colorImageUrl: "/environments/lost-relay-tower/lost-relay-tower.webp",
    depthMapUrl: "/environments/lost-relay-tower/lost-relay-tower.png",
  },
  {
    id: "psy-swamp-citadel",
    displayName: "Psy Swamp Citadel",
    colorImageUrl: "/environments/psy-swamp-citadel/psy-swamp-citadel.webp",
    depthMapUrl: "/environments/psy-swamp-citadel/psy-swamp-citadel.png",
  },
  {
    id: "psybrazil",
    displayName: "PsyBrazil",
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
