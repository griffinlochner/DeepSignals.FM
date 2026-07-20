import { MAX_SURFACE_GLOW_HOTSPOTS } from "./constants";
import {
  cloneBehaviorSettings,
  cloneScenePreset,
  DEFAULT_SURFACE_GLOW_SETTINGS,
  getImageEnvironmentAssetById,
  UV_JUNGLE_SHOWCASE_SCENE_PRESET,
} from "./presets";
import type {
  EnvironmentBehaviorSettings,
  ImageEnvironmentScenePreset,
  SurfaceGlowDefaultSettings,
  SurfaceGlowHotspot,
  SurfaceGlowPulseMode,
} from "./types";

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const PULSE_MODES: SurfaceGlowPulseMode[] = [
  "brightness",
  "bloom",
  "brightness-bloom",
  "soft-blink",
];

type ParseResult =
  | { ok: true; preset: ImageEnvironmentScenePreset; warnings: string[] }
  | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readPulseMode(value: unknown, fallback: SurfaceGlowPulseMode): SurfaceGlowPulseMode {
  return typeof value === "string" && PULSE_MODES.includes(value as SurfaceGlowPulseMode)
    ? (value as SurfaceGlowPulseMode)
    : fallback;
}

function sanitizeBehaviorSettings(
  raw: unknown,
  fallback: EnvironmentBehaviorSettings,
): EnvironmentBehaviorSettings {
  const settingsSource = isObject(raw) ? raw : {};
  const depth = isObject(settingsSource.depth) ? settingsSource.depth : {};
  const color = isObject(settingsSource.color) ? settingsSource.color : {};
  const saturationPulse = isObject(settingsSource.saturationPulse)
    ? settingsSource.saturationPulse
    : {};

  return {
    depth: {
      motionIntensity: clamp(readNumber(depth.motionIntensity, fallback.depth.motionIntensity), 0, 1),
      depthStrength: clamp(readNumber(depth.depthStrength, fallback.depth.depthStrength), 0, 1),
      staticDepth: clamp(readNumber(depth.staticDepth, fallback.depth.staticDepth), 0, 1),
      breathingMin: clamp(readNumber(depth.breathingMin, fallback.depth.breathingMin), 0, 1),
      breathingMax: clamp(readNumber(depth.breathingMax, fallback.depth.breathingMax), 0, 1),
      breathingCycleSeconds: clamp(
        readNumber(depth.breathingCycleSeconds, fallback.depth.breathingCycleSeconds),
        0.4,
        240,
      ),
      pointerParallaxEnabled:
        typeof depth.pointerParallaxEnabled === "boolean"
          ? depth.pointerParallaxEnabled
          : fallback.depth.pointerParallaxEnabled,
      pointerParallaxStrength: clamp(
        readNumber(depth.pointerParallaxStrength, fallback.depth.pointerParallaxStrength),
        0,
        1.2,
      ),
      ambientMotionEnabled:
        typeof depth.ambientMotionEnabled === "boolean"
          ? depth.ambientMotionEnabled
          : fallback.depth.ambientMotionEnabled,
    },
    color: {
      driftEnabled:
        typeof color.driftEnabled === "boolean"
          ? color.driftEnabled
          : fallback.color.driftEnabled,
      hueRangeDegrees: clamp(
        readNumber(color.hueRangeDegrees, fallback.color.hueRangeDegrees),
        0,
        180,
      ),
      cycleSeconds: clamp(readNumber(color.cycleSeconds, fallback.color.cycleSeconds), 1, 600),
      saturation: clamp(readNumber(color.saturation, fallback.color.saturation), 0, 2.2),
      glowPulseEnabled:
        typeof color.glowPulseEnabled === "boolean"
          ? color.glowPulseEnabled
          : fallback.color.glowPulseEnabled,
      glowPulseAmount: clamp(
        readNumber(color.glowPulseAmount, fallback.color.glowPulseAmount),
        0,
        0.7,
      ),
      glowPulseCycleSeconds: clamp(
        readNumber(color.glowPulseCycleSeconds, fallback.color.glowPulseCycleSeconds),
        1,
        300,
      ),
    },
    saturationPulse: {
      enabled:
        typeof saturationPulse.enabled === "boolean"
          ? saturationPulse.enabled
          : fallback.saturationPulse.enabled,
      minimumSaturation: clamp(
        readNumber(
          saturationPulse.minimumSaturation,
          fallback.saturationPulse.minimumSaturation,
        ),
        0,
        3,
      ),
      maximumSaturation: clamp(
        readNumber(
          saturationPulse.maximumSaturation,
          fallback.saturationPulse.maximumSaturation,
        ),
        0,
        3,
      ),
      cycleSeconds: clamp(
        readNumber(saturationPulse.cycleSeconds, fallback.saturationPulse.cycleSeconds),
        0.2,
        300,
      ),
      phaseOffset: clamp(
        readNumber(saturationPulse.phaseOffset, fallback.saturationPulse.phaseOffset),
        -Math.PI * 2,
        Math.PI * 2,
      ),
      syncToDepthBreathing:
        typeof saturationPulse.syncToDepthBreathing === "boolean"
          ? saturationPulse.syncToDepthBreathing
          : fallback.saturationPulse.syncToDepthBreathing,
    },
  };
}

function sanitizeSurfaceGlowDefaults(
  raw: unknown,
  fallback: SurfaceGlowDefaultSettings,
): SurfaceGlowDefaultSettings {
  const source = isObject(raw) ? raw : {};

  return {
    color: isHexColor(source.color) ? source.color : fallback.color,
    radius: clamp(readNumber(source.radius, fallback.radius), 0.002, 0.09),
    softness: clamp(readNumber(source.softness, fallback.softness), 0.05, 0.98),
    intensity: clamp(readNumber(source.intensity, fallback.intensity), 0, 4),
    pulseEnabled:
      typeof source.pulseEnabled === "boolean" ? source.pulseEnabled : fallback.pulseEnabled,
    pulseMode: readPulseMode(source.pulseMode, fallback.pulseMode),
    pulseAmount: clamp(readNumber(source.pulseAmount, fallback.pulseAmount), 0, 2),
    minimumIntensityMultiplier: clamp(
      readNumber(source.minimumIntensityMultiplier, fallback.minimumIntensityMultiplier),
      0,
      2,
    ),
    maximumIntensityMultiplier: clamp(
      readNumber(source.maximumIntensityMultiplier, fallback.maximumIntensityMultiplier),
      0.1,
      3.5,
    ),
    radiusExpansionMultiplier: clamp(
      readNumber(source.radiusExpansionMultiplier, fallback.radiusExpansionMultiplier),
      1,
      2.5,
    ),
    pulseCycleSeconds: clamp(
      readNumber(source.pulseCycleSeconds, fallback.pulseCycleSeconds),
      0.2,
      120,
    ),
    hueDriftEnabled:
      typeof source.hueDriftEnabled === "boolean"
        ? source.hueDriftEnabled
        : fallback.hueDriftEnabled,
    hueDriftRangeDegrees: clamp(
      readNumber(source.hueDriftRangeDegrees, fallback.hueDriftRangeDegrees),
      0,
      180,
    ),
    hueDriftCycleSeconds: clamp(
      readNumber(source.hueDriftCycleSeconds, fallback.hueDriftCycleSeconds),
      0.4,
      240,
    ),
  };
}

function sanitizeSurfaceGlowHotspot(raw: unknown, index: number): SurfaceGlowHotspot | null {
  if (!isObject(raw)) {
    return null;
  }

  const u = readNumber(raw.u, Number.NaN);
  const v = readNumber(raw.v, Number.NaN);

  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
    return null;
  }

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `surface-${index}`,
    u,
    v,
    color: isHexColor(raw.color) ? raw.color : DEFAULT_SURFACE_GLOW_SETTINGS.color,
    radius: clamp(readNumber(raw.radius, DEFAULT_SURFACE_GLOW_SETTINGS.radius), 0.002, 0.09),
    softness: clamp(
      readNumber(raw.softness, DEFAULT_SURFACE_GLOW_SETTINGS.softness),
      0.05,
      0.98,
    ),
    intensity: clamp(
      readNumber(raw.intensity, DEFAULT_SURFACE_GLOW_SETTINGS.intensity),
      0,
      4,
    ),
    pulseEnabled:
      typeof raw.pulseEnabled === "boolean"
        ? raw.pulseEnabled
        : DEFAULT_SURFACE_GLOW_SETTINGS.pulseEnabled,
    pulseMode: readPulseMode(raw.pulseMode, DEFAULT_SURFACE_GLOW_SETTINGS.pulseMode),
    pulseAmount: clamp(
      readNumber(raw.pulseAmount, DEFAULT_SURFACE_GLOW_SETTINGS.pulseAmount),
      0,
      2,
    ),
    minimumIntensityMultiplier: clamp(
      readNumber(
        raw.minimumIntensityMultiplier,
        DEFAULT_SURFACE_GLOW_SETTINGS.minimumIntensityMultiplier,
      ),
      0,
      2,
    ),
    maximumIntensityMultiplier: clamp(
      readNumber(
        raw.maximumIntensityMultiplier,
        DEFAULT_SURFACE_GLOW_SETTINGS.maximumIntensityMultiplier,
      ),
      0.1,
      3.5,
    ),
    radiusExpansionMultiplier: clamp(
      readNumber(
        raw.radiusExpansionMultiplier,
        DEFAULT_SURFACE_GLOW_SETTINGS.radiusExpansionMultiplier,
      ),
      1,
      2.5,
    ),
    pulseCycleSeconds: clamp(
      readNumber(raw.pulseCycleSeconds, DEFAULT_SURFACE_GLOW_SETTINGS.pulseCycleSeconds),
      0.2,
      120,
    ),
    hueDriftEnabled:
      typeof raw.hueDriftEnabled === "boolean"
        ? raw.hueDriftEnabled
        : DEFAULT_SURFACE_GLOW_SETTINGS.hueDriftEnabled,
    hueDriftRangeDegrees: clamp(
      readNumber(raw.hueDriftRangeDegrees, DEFAULT_SURFACE_GLOW_SETTINGS.hueDriftRangeDegrees),
      0,
      180,
    ),
    hueDriftCycleSeconds: clamp(
      readNumber(raw.hueDriftCycleSeconds, DEFAULT_SURFACE_GLOW_SETTINGS.hueDriftCycleSeconds),
      0.4,
      240,
    ),
    phase: clamp(readNumber(raw.phase, Math.random()), 0, 1),
  };
}

export function parseFullScenePresetJson(rawText: string): ParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "Invalid JSON. Please provide valid full scene JSON." };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: "Full scene payload must be a JSON object." };
  }

  const warnings: string[] = [];
  const defaults = cloneScenePreset(UV_JUNGLE_SHOWCASE_SCENE_PRESET);

  if ("twinkles" in parsed || "particles" in parsed || "haze" in parsed) {
    warnings.push("Legacy twinkle/particle/haze fields were ignored.");
  }

  const assetId =
    typeof parsed.assetId === "string" && parsed.assetId.trim()
      ? parsed.assetId.trim()
      : defaults.assetId;

  if (!getImageEnvironmentAssetById(assetId)) {
    return {
      ok: false,
      error: `Unknown assetId "${assetId}". This laboratory only supports registered image/depth assets.`,
    };
  }

  const behaviorSource = isObject(parsed.behavior)
    ? parsed.behavior
    : isObject(parsed)
      ? parsed
      : {};
  const behavior = sanitizeBehaviorSettings(behaviorSource, defaults.behavior);

  const surfaceGlowsSource = isObject(parsed.surfaceGlows) ? parsed.surfaceGlows : {};
  const hotspotEntries = Array.isArray(surfaceGlowsSource.hotspots)
    ? surfaceGlowsSource.hotspots
    : Array.isArray(defaults.surfaceGlows.hotspots)
      ? defaults.surfaceGlows.hotspots
      : [];

  if (hotspotEntries.length > MAX_SURFACE_GLOW_HOTSPOTS) {
    return {
      ok: false,
      error: `Surface Glow hotspot limit exceeded. Maximum of ${MAX_SURFACE_GLOW_HOTSPOTS} Surface Glow Hotspots reached.`,
    };
  }

  const defaultsSource = isObject(surfaceGlowsSource.defaults)
    ? surfaceGlowsSource.defaults
    : surfaceGlowsSource;

  const merged: ImageEnvironmentScenePreset = {
    id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id : defaults.id,
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : defaults.name,
    assetId,
    behavior,
    surfaceGlows: {
      enabled:
        typeof surfaceGlowsSource.enabled === "boolean"
          ? surfaceGlowsSource.enabled
          : defaults.surfaceGlows.enabled,
      defaults: sanitizeSurfaceGlowDefaults(defaultsSource, defaults.surfaceGlows.defaults),
      hotspots: hotspotEntries
        .map((entry, index) => sanitizeSurfaceGlowHotspot(entry, index))
        .filter((entry): entry is SurfaceGlowHotspot => entry !== null),
    },
  };

  if (merged.behavior.depth.breathingMin > merged.behavior.depth.breathingMax) {
    return {
      ok: false,
      error: "Depth breathingMin must be less than or equal to breathingMax.",
    };
  }

  if (
    merged.behavior.saturationPulse.minimumSaturation >
    merged.behavior.saturationPulse.maximumSaturation
  ) {
    return {
      ok: false,
      error: "Saturation pulse minimum must be less than or equal to maximum.",
    };
  }

  if (
    merged.surfaceGlows.defaults.minimumIntensityMultiplier >
    merged.surfaceGlows.defaults.maximumIntensityMultiplier
  ) {
    return {
      ok: false,
      error: "Surface Glow minimum intensity multiplier must be less than or equal to maximum.",
    };
  }

  return {
    ok: true,
    preset: {
      ...merged,
      behavior: cloneBehaviorSettings(merged.behavior),
      surfaceGlows: {
        ...merged.surfaceGlows,
        defaults: { ...merged.surfaceGlows.defaults },
        hotspots: merged.surfaceGlows.hotspots.map((hotspot) => ({ ...hotspot })),
      },
    },
    warnings,
  };
}
