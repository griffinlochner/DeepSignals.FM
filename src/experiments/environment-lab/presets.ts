import type { EnvironmentPreset } from "./types";

export const UV_JUNGLE_LAB_PRESET: EnvironmentPreset = {
  id: "uv-jungle-lab-default",
  name: "UV Jungle Laboratory",
  assets: {
    colorImageUrl: "/experiments/depth-lab/jungle-color.png",
    depthMapUrl: "/experiments/depth-lab/jungle-depth.png",
  },
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
    primaryColor: "#52f4d1",
    secondaryColor: "#7a54ff",
  },
};

export function cloneEnvironmentPreset(preset: EnvironmentPreset): EnvironmentPreset {
  return {
    ...preset,
    assets: { ...preset.assets },
    depth: { ...preset.depth },
    color: { ...preset.color },
    twinkles: {
      ...preset.twinkles,
      hotspots: preset.twinkles.hotspots.map((hotspot) => ({ ...hotspot })),
    },
    particles: { ...preset.particles },
    haze: { ...preset.haze },
  };
}
