import type { ImageDepthScenePreset } from "./types";

export const DEFAULT_IMAGE_DEPTH_CHILL_BEHAVIOR: ImageDepthScenePreset["behavior"] = {
  "depth": {
    "motionIntensity": 0.52,
    "depthStrength": 0.62,
    "staticDepth": 0.6,
    "breathingMin": 0.04,
    "breathingMax": 1,
    "breathingCycleSeconds": 2.8,
    "pointerParallaxEnabled": true,
    "pointerParallaxStrength": 0.62,
    "ambientMotionEnabled": true
  },
  "color": {
    "driftEnabled": true,
    "hueRangeDegrees": 24,
    "cycleSeconds": 26,
    "saturation": 1.16,
    "glowPulseEnabled": true,
    "glowPulseAmount": 0.18,
    "glowPulseCycleSeconds": 5.2
  },
  "saturationPulse": {
    "enabled": true,
    "minimumSaturation": 0.72,
    "maximumSaturation": 1.38,
    "cycleSeconds": 4.2,
    "phaseOffset": 0,
    "syncToDepthBreathing": false
  }
};

function createProductionScenePreset(
  assetId: string,
  assetName: string,
  presetId: string,
): ImageDepthScenePreset {
  return {
    id: presetId,
    name: assetName,
    assetId,
    behavior: {
      depth: { ...DEFAULT_IMAGE_DEPTH_CHILL_BEHAVIOR.depth },
      color: { ...DEFAULT_IMAGE_DEPTH_CHILL_BEHAVIOR.color },
      saturationPulse: { ...DEFAULT_IMAGE_DEPTH_CHILL_BEHAVIOR.saturationPulse },
    },
  };
}

export const UV_JUNGLE_PRODUCTION_SCENE_PRESET: ImageDepthScenePreset = {
  "id": "uv-jungle-default",
  "name": "UV Reactive Jungle",
  "assetId": "uv-reactive-jungle",
  "behavior": {
    "depth": {
      "motionIntensity": 0.52,
      "depthStrength": 0.62,
      "staticDepth": 0.6,
      "breathingMin": 0.04,
      "breathingMax": 1,
      "breathingCycleSeconds": 2.8,
      "pointerParallaxEnabled": true,
      "pointerParallaxStrength": 0.62,
      "ambientMotionEnabled": true
    },
    "color": {
      "driftEnabled": true,
      "hueRangeDegrees": 24,
      "cycleSeconds": 26,
      "saturation": 1.16,
      "glowPulseEnabled": true,
      "glowPulseAmount": 0.18,
      "glowPulseCycleSeconds": 5.2
    },
    "saturationPulse": {
      "enabled": true,
      "minimumSaturation": 0.72,
      "maximumSaturation": 1.38,
      "cycleSeconds": 4.2,
      "phaseOffset": 0,
      "syncToDepthBreathing": false
    }
  },
  "ambientParticles": {
    "count": 320,
    "sizeRange": {
      "min": 1.35,
      "max": 4.35
    },
    "depthOffsetRange": {
      "min": 0.02,
      "max": 0.18
    },
    "driftSpeedRange": {
      "chill": 0.012,
      "fullOn": 0.032
    },
    "visibilityDensityScaleRange": {
      "min": 0.48,
      "max": 1
    },
    "brightnessBiasRange": {
      "min": 0.06,
      "max": 0.22
    },
    "colorBiasPalette": [
      "#7fffd4",
      "#4ef7a2",
      "#d86cff",
      "#a6ff6a"
    ]
  }
};

export const ANALOG_SIGNAL_LABORATORY_PRODUCTION_SCENE_PRESET: ImageDepthScenePreset = {
  "id": "analog-signal-laboratory-default",
  "name": "Analog Signal Laboratory",
  "assetId": "analog-signal-laboratory",
  "behavior": {
    "depth": {
      "motionIntensity": 1,
      "depthStrength": 1,
      "staticDepth": 0,
      "breathingMin": 0,
      "breathingMax": 1,
      "breathingCycleSeconds": 1,
      "pointerParallaxEnabled": true,
      "pointerParallaxStrength": 1,
      "ambientMotionEnabled": true
    },
    "color": {
      "driftEnabled": true,
      "hueRangeDegrees": 60,
      "cycleSeconds": 10,
      "saturation": 0,
      "glowPulseEnabled": true,
      "glowPulseAmount": 0.27,
      "glowPulseCycleSeconds": 47
    },
    "saturationPulse": {
      "enabled": true,
      "minimumSaturation": 0,
      "maximumSaturation": 2.18,
      "cycleSeconds": 1.6,
      "phaseOffset": -2.29,
      "syncToDepthBreathing": false
    }
  }
};

export const BIOLUMINESCENT_PSY_FOREST_PRODUCTION_SCENE_PRESET: ImageDepthScenePreset = {
  "id": "bioluminescent-psy-forest-default",
  "name": "Bioluminescent Psy Forest",
  "assetId": "bioluminescent-psy-forest",
  "behavior": {
    "depth": {
      "motionIntensity": 0.52,
      "depthStrength": 0.62,
      "staticDepth": 0.6,
      "breathingMin": 0.04,
      "breathingMax": 1,
      "breathingCycleSeconds": 2.8,
      "pointerParallaxEnabled": true,
      "pointerParallaxStrength": 0.62,
      "ambientMotionEnabled": true
    },
    "color": {
      "driftEnabled": true,
      "hueRangeDegrees": 24,
      "cycleSeconds": 26,
      "saturation": 1.16,
      "glowPulseEnabled": true,
      "glowPulseAmount": 0.18,
      "glowPulseCycleSeconds": 5.2
    },
    "saturationPulse": {
      "enabled": true,
      "minimumSaturation": 0.72,
      "maximumSaturation": 1.38,
      "cycleSeconds": 4.2,
      "phaseOffset": 0,
      "syncToDepthBreathing": true
    }
  }
};

export const BIOLUMINESCENT_PSY_REEF_PRODUCTION_SCENE_PRESET: ImageDepthScenePreset = {
  "id": "bioluminescent-psy-reef-default",
  "name": "Bioluminescent Psy Reef",
  "assetId": "bioluminescent-psy-reef",
  "behavior": {
    "depth": {
      "motionIntensity": 1,
      "depthStrength": 1,
      "staticDepth": 0,
      "breathingMin": 0,
      "breathingMax": 1,
      "breathingCycleSeconds": 8.4,
      "pointerParallaxEnabled": true,
      "pointerParallaxStrength": 1,
      "ambientMotionEnabled": true
    },
    "color": {
      "driftEnabled": true,
      "hueRangeDegrees": 60,
      "cycleSeconds": 56,
      "saturation": 0.75,
      "glowPulseEnabled": true,
      "glowPulseAmount": 0.005,
      "glowPulseCycleSeconds": 17
    },
    "saturationPulse": {
      "enabled": true,
      "minimumSaturation": 0.8,
      "maximumSaturation": 2.19,
      "cycleSeconds": 7.5,
      "phaseOffset": -0.01,
      "syncToDepthBreathing": false
    }
  }
};

export const CRYSTAL_CAVERN_PRODUCTION_SCENE_PRESET = createProductionScenePreset(
  "crystal-cavern",
  "Crystal Cavern",
  "crystal-cavern-default",
);

export const SLIME_CAVERN_PRODUCTION_SCENE_PRESET = createProductionScenePreset(
  "slime-cavern",
  "Slime Cavern",
  "slime-cavern-default",
);

export const FEMALE_DJ_1_PRODUCTION_SCENE_PRESET = createProductionScenePreset(
  "female-dj-1",
  "Female DJ 1",
  "female-dj-1-default",
);
