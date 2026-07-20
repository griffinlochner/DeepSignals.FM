import { MAX_SURFACE_GLOW_HOTSPOTS } from "./constants";
import {
  cloneEnvironmentPreset,
  getImageEnvironmentAssetById,
  UV_JUNGLE_SHOWCASE_PRESET,
} from "./presets";
import type {
  ImageEnvironmentPreset,
  SurfaceGlowHotspot,
  SurfaceGlowPulseMode,
  TwinkleHotspot,
} from "./types";

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const PULSE_MODES: SurfaceGlowPulseMode[] = [
  "brightness",
  "bloom",
  "brightness-bloom",
  "soft-blink",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isValidColor(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", value);
  }

  return HEX_COLOR_PATTERN.test(value);
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

function sanitizeHotspot(raw: unknown, index: number): TwinkleHotspot | null {
  if (!isObject(raw)) {
    return null;
  }

  const u = readNumber(raw.u, NaN);
  const v = readNumber(raw.v, NaN);

  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
    return null;
  }

  const phase = readNumber(raw.phase, Math.random());
  const size = readNumber(raw.size, NaN);
  const intensity = readNumber(raw.intensity, NaN);

  const hotspot: TwinkleHotspot = {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `twk-${index}`,
    u,
    v,
    phase: clamp(phase, 0, 1),
  };

  if (isValidColor(raw.color)) {
    hotspot.color = raw.color;
  }

  if (Number.isFinite(size)) {
    hotspot.size = clamp(size, 0.04, 0.6);
  }

  if (Number.isFinite(intensity)) {
    hotspot.intensity = clamp(intensity, 0.05, 2);
  }

  return hotspot;
}

function sanitizeSurfaceGlowHotspot(raw: unknown, index: number): SurfaceGlowHotspot | null {
  if (!isObject(raw)) {
    return null;
  }

  const u = readNumber(raw.u, NaN);
  const v = readNumber(raw.v, NaN);

  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
    return null;
  }

  const color = isHexColor(raw.color) ? raw.color : "#8fffe2";

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `surface-${index}`,
    u,
    v,
    color,
    radius: clamp(readNumber(raw.radius, 0.01), 0.002, 0.09),
    softness: clamp(readNumber(raw.softness, 0.65), 0.05, 0.98),
    intensity: clamp(readNumber(raw.intensity, 1.05), 0, 4),
    pulseEnabled: typeof raw.pulseEnabled === "boolean" ? raw.pulseEnabled : true,
    pulseMode: readPulseMode(raw.pulseMode, "brightness-bloom"),
    pulseAmount: clamp(readNumber(raw.pulseAmount, 0.6), 0, 2),
    minimumIntensityMultiplier: clamp(readNumber(raw.minimumIntensityMultiplier, 0.7), 0, 2),
    maximumIntensityMultiplier: clamp(readNumber(raw.maximumIntensityMultiplier, 1.35), 0.1, 3.5),
    radiusExpansionMultiplier: clamp(readNumber(raw.radiusExpansionMultiplier, 1.18), 1, 2.5),
    pulseCycleSeconds: clamp(readNumber(raw.pulseCycleSeconds, 3.5), 0.2, 120),
    hueDriftEnabled: typeof raw.hueDriftEnabled === "boolean" ? raw.hueDriftEnabled : false,
    hueDriftRangeDegrees: clamp(readNumber(raw.hueDriftRangeDegrees, 12), 0, 180),
    hueDriftCycleSeconds: clamp(readNumber(raw.hueDriftCycleSeconds, 20), 0.4, 240),
    phase: clamp(readNumber(raw.phase, Math.random()), 0, 1),
  };
}

export function parseEnvironmentPresetJson(rawText: string):
  | { ok: true; preset: ImageEnvironmentPreset }
  | { ok: false; error: string } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "Invalid JSON. Please provide valid preset JSON." };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: "Preset payload must be a JSON object." };
  }

  const defaults = cloneEnvironmentPreset(UV_JUNGLE_SHOWCASE_PRESET);
  const depth = isObject(parsed.depth) ? parsed.depth : {};
  const color = isObject(parsed.color) ? parsed.color : {};
  const twinkles = isObject(parsed.twinkles) ? parsed.twinkles : {};
  const surfaceGlows = isObject(parsed.surfaceGlows) ? parsed.surfaceGlows : {};
  const saturationPulse = isObject(parsed.saturationPulse) ? parsed.saturationPulse : {};
  const particles = isObject(parsed.particles) ? parsed.particles : {};
  const haze = isObject(parsed.haze) ? parsed.haze : {};

  const hotspotEntries = Array.isArray(surfaceGlows.hotspots) ? surfaceGlows.hotspots : null;
  if (hotspotEntries && hotspotEntries.length > MAX_SURFACE_GLOW_HOTSPOTS) {
    return {
      ok: false,
      error: `Surface Glow hotspot limit exceeded. Maximum of ${MAX_SURFACE_GLOW_HOTSPOTS} Surface Glow Hotspots reached.`,
    };
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

  const merged: ImageEnvironmentPreset = {
    id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id : defaults.id,
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : defaults.name,
    assetId,
    depth: {
      motionIntensity: clamp(readNumber(depth.motionIntensity, defaults.depth.motionIntensity), 0, 1),
      depthStrength: clamp(readNumber(depth.depthStrength, defaults.depth.depthStrength), 0, 1),
      staticDepth: clamp(readNumber(depth.staticDepth, defaults.depth.staticDepth), 0, 1),
      breathingMin: clamp(readNumber(depth.breathingMin, defaults.depth.breathingMin), 0, 1),
      breathingMax: clamp(readNumber(depth.breathingMax, defaults.depth.breathingMax), 0, 1),
      breathingCycleSeconds: clamp(
        readNumber(depth.breathingCycleSeconds, defaults.depth.breathingCycleSeconds),
        0.4,
        240,
      ),
      pointerParallaxEnabled:
        typeof depth.pointerParallaxEnabled === "boolean"
          ? depth.pointerParallaxEnabled
          : defaults.depth.pointerParallaxEnabled,
      pointerParallaxStrength: clamp(
        readNumber(depth.pointerParallaxStrength, defaults.depth.pointerParallaxStrength),
        0,
        1.2,
      ),
      ambientMotionEnabled:
        typeof depth.ambientMotionEnabled === "boolean"
          ? depth.ambientMotionEnabled
          : defaults.depth.ambientMotionEnabled,
    },
    color: {
      driftEnabled:
        typeof color.driftEnabled === "boolean" ? color.driftEnabled : defaults.color.driftEnabled,
      hueRangeDegrees: clamp(readNumber(color.hueRangeDegrees, defaults.color.hueRangeDegrees), 0, 180),
      cycleSeconds: clamp(readNumber(color.cycleSeconds, defaults.color.cycleSeconds), 1, 600),
      saturation: clamp(readNumber(color.saturation, defaults.color.saturation), 0, 2.2),
      glowPulseEnabled:
        typeof color.glowPulseEnabled === "boolean"
          ? color.glowPulseEnabled
          : defaults.color.glowPulseEnabled,
      glowPulseAmount: clamp(readNumber(color.glowPulseAmount, defaults.color.glowPulseAmount), 0, 0.7),
      glowPulseCycleSeconds: clamp(
        readNumber(color.glowPulseCycleSeconds, defaults.color.glowPulseCycleSeconds),
        1,
        300,
      ),
    },
    saturationPulse: {
      enabled:
        typeof saturationPulse.enabled === "boolean"
          ? saturationPulse.enabled
          : defaults.saturationPulse.enabled,
      minimumSaturation: clamp(
        readNumber(saturationPulse.minimumSaturation, defaults.saturationPulse.minimumSaturation),
        0,
        3,
      ),
      maximumSaturation: clamp(
        readNumber(saturationPulse.maximumSaturation, defaults.saturationPulse.maximumSaturation),
        0,
        3,
      ),
      cycleSeconds: clamp(
        readNumber(saturationPulse.cycleSeconds, defaults.saturationPulse.cycleSeconds),
        0.2,
        300,
      ),
      phaseOffset: clamp(
        readNumber(saturationPulse.phaseOffset, defaults.saturationPulse.phaseOffset),
        -Math.PI * 2,
        Math.PI * 2,
      ),
      syncToDepthBreathing:
        typeof saturationPulse.syncToDepthBreathing === "boolean"
          ? saturationPulse.syncToDepthBreathing
          : defaults.saturationPulse.syncToDepthBreathing,
    },
    twinkles: {
      enabled: typeof twinkles.enabled === "boolean" ? twinkles.enabled : defaults.twinkles.enabled,
      hotspots: Array.isArray(twinkles.hotspots)
        ? twinkles.hotspots
            .map((entry, index) => sanitizeHotspot(entry, index))
            .filter((entry): entry is TwinkleHotspot => entry !== null)
        : defaults.twinkles.hotspots,
      defaultColor:
        isValidColor(twinkles.defaultColor) && isHexColor(twinkles.defaultColor)
          ? twinkles.defaultColor
          : defaults.twinkles.defaultColor,
      defaultSize: clamp(readNumber(twinkles.defaultSize, defaults.twinkles.defaultSize), 0.04, 0.6),
      defaultIntensity: clamp(readNumber(twinkles.defaultIntensity, defaults.twinkles.defaultIntensity), 0.05, 2),
      pulseSpeed: clamp(readNumber(twinkles.pulseSpeed, defaults.twinkles.pulseSpeed), 0, 3),
    },
    surfaceGlows: {
      enabled:
        typeof surfaceGlows.enabled === "boolean"
          ? surfaceGlows.enabled
          : defaults.surfaceGlows.enabled,
      hotspots: hotspotEntries
        ? hotspotEntries
            .map((entry, index) => sanitizeSurfaceGlowHotspot(entry, index))
            .filter((entry): entry is SurfaceGlowHotspot => entry !== null)
        : defaults.surfaceGlows.hotspots,
      defaultColor: isHexColor(surfaceGlows.defaultColor)
        ? surfaceGlows.defaultColor
        : defaults.surfaceGlows.defaultColor,
      defaultRadius: clamp(readNumber(surfaceGlows.defaultRadius, defaults.surfaceGlows.defaultRadius), 0.002, 0.09),
      defaultSoftness: clamp(readNumber(surfaceGlows.defaultSoftness, defaults.surfaceGlows.defaultSoftness), 0.05, 0.98),
      defaultIntensity: clamp(readNumber(surfaceGlows.defaultIntensity, defaults.surfaceGlows.defaultIntensity), 0, 4),
      defaultPulseEnabled:
        typeof surfaceGlows.defaultPulseEnabled === "boolean"
          ? surfaceGlows.defaultPulseEnabled
          : defaults.surfaceGlows.defaultPulseEnabled,
      defaultPulseMode: readPulseMode(surfaceGlows.defaultPulseMode, defaults.surfaceGlows.defaultPulseMode),
      defaultPulseAmount: clamp(readNumber(surfaceGlows.defaultPulseAmount, defaults.surfaceGlows.defaultPulseAmount), 0, 2),
      defaultMinimumIntensityMultiplier: clamp(
        readNumber(
          surfaceGlows.defaultMinimumIntensityMultiplier,
          defaults.surfaceGlows.defaultMinimumIntensityMultiplier,
        ),
        0,
        2,
      ),
      defaultMaximumIntensityMultiplier: clamp(
        readNumber(
          surfaceGlows.defaultMaximumIntensityMultiplier,
          defaults.surfaceGlows.defaultMaximumIntensityMultiplier,
        ),
        0.1,
        3.5,
      ),
      defaultRadiusExpansionMultiplier: clamp(
        readNumber(
          surfaceGlows.defaultRadiusExpansionMultiplier,
          defaults.surfaceGlows.defaultRadiusExpansionMultiplier,
        ),
        1,
        2.5,
      ),
      defaultPulseCycleSeconds: clamp(
        readNumber(surfaceGlows.defaultPulseCycleSeconds, defaults.surfaceGlows.defaultPulseCycleSeconds),
        0.2,
        120,
      ),
      defaultHueDriftEnabled:
        typeof surfaceGlows.defaultHueDriftEnabled === "boolean"
          ? surfaceGlows.defaultHueDriftEnabled
          : defaults.surfaceGlows.defaultHueDriftEnabled,
      defaultHueDriftRangeDegrees: clamp(
        readNumber(surfaceGlows.defaultHueDriftRangeDegrees, defaults.surfaceGlows.defaultHueDriftRangeDegrees),
        0,
        180,
      ),
      defaultHueDriftCycleSeconds: clamp(
        readNumber(surfaceGlows.defaultHueDriftCycleSeconds, defaults.surfaceGlows.defaultHueDriftCycleSeconds),
        0.4,
        240,
      ),
    },
    particles: {
      enabled: typeof particles.enabled === "boolean" ? particles.enabled : defaults.particles.enabled,
      count: Math.round(clamp(readNumber(particles.count, defaults.particles.count), 0, 240)),
      speed: clamp(readNumber(particles.speed, defaults.particles.speed), 0, 0.6),
      size: clamp(readNumber(particles.size, defaults.particles.size), 0.004, 0.2),
      opacity: clamp(readNumber(particles.opacity, defaults.particles.opacity), 0, 1),
      color: isHexColor(particles.color) ? particles.color : defaults.particles.color,
      seed: Math.round(clamp(readNumber(particles.seed, defaults.particles.seed), 0, 1_000_000)),
    },
    haze: {
      enabled: typeof haze.enabled === "boolean" ? haze.enabled : defaults.haze.enabled,
      opacity: clamp(readNumber(haze.opacity, defaults.haze.opacity), 0, 1),
      blurPixels: clamp(readNumber(haze.blurPixels, defaults.haze.blurPixels), 0, 120),
      driftCycleSeconds: clamp(readNumber(haze.driftCycleSeconds, defaults.haze.driftCycleSeconds), 2, 120),
      driftDistance: clamp(readNumber(haze.driftDistance, defaults.haze.driftDistance), 0, 120),
      driftBiasX: clamp(readNumber(haze.driftBiasX, defaults.haze.driftBiasX), -1, 1),
      driftBiasY: clamp(readNumber(haze.driftBiasY, defaults.haze.driftBiasY), -1, 1),
      primaryColor: isHexColor(haze.primaryColor) ? haze.primaryColor : defaults.haze.primaryColor,
      secondaryColor: isHexColor(haze.secondaryColor) ? haze.secondaryColor : defaults.haze.secondaryColor,
    },
  };

  if (merged.depth.breathingMin > merged.depth.breathingMax) {
    return {
      ok: false,
      error: "Depth breathingMin must be less than or equal to breathingMax.",
    };
  }

  if (merged.saturationPulse.minimumSaturation > merged.saturationPulse.maximumSaturation) {
    return {
      ok: false,
      error: "Saturation pulse minimum must be less than or equal to maximum.",
    };
  }

  if (merged.surfaceGlows.defaultMinimumIntensityMultiplier > merged.surfaceGlows.defaultMaximumIntensityMultiplier) {
    return {
      ok: false,
      error: "Surface Glow minimum intensity multiplier must be less than or equal to maximum.",
    };
  }

  return { ok: true, preset: merged };
}
