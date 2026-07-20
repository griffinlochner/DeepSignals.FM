import { cloneEnvironmentPreset, UV_JUNGLE_LAB_PRESET } from "./presets";
import type {
  EnvironmentPreset,
  SurfaceGlowHotspot,
  TwinkleHotspot,
} from "./types";

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

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

function sanitizeSurfaceGlowHotspot(
  raw: unknown,
  index: number,
): SurfaceGlowHotspot | null {
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
    id:
      typeof raw.id === "string" && raw.id.trim() ? raw.id : `surface-${index}`,
    u,
    v,
    color,
    radius: clamp(readNumber(raw.radius, 0.012), 0.002, 0.09),
    softness: clamp(readNumber(raw.softness, 0.65), 0.05, 0.98),
    intensity: clamp(readNumber(raw.intensity, 1.2), 0, 4),
    pulseEnabled:
      typeof raw.pulseEnabled === "boolean" ? raw.pulseEnabled : true,
    pulseAmount: clamp(readNumber(raw.pulseAmount, 0.55), 0, 2),
    pulseCycleSeconds: clamp(readNumber(raw.pulseCycleSeconds, 3.5), 0.2, 120),
    phase: clamp(readNumber(raw.phase, Math.random()), 0, 1),
  };
}

export function parseEnvironmentPresetJson(rawText: string):
  | { ok: true; preset: EnvironmentPreset }
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

  const defaults = cloneEnvironmentPreset(UV_JUNGLE_LAB_PRESET);
  const assets = isObject(parsed.assets) ? parsed.assets : {};
  const depth = isObject(parsed.depth) ? parsed.depth : {};
  const color = isObject(parsed.color) ? parsed.color : {};
  const twinkles = isObject(parsed.twinkles) ? parsed.twinkles : {};
  const surfaceGlows = isObject(parsed.surfaceGlows) ? parsed.surfaceGlows : {};
  const saturationPulse = isObject(parsed.saturationPulse) ? parsed.saturationPulse : {};
  const particles = isObject(parsed.particles) ? parsed.particles : {};
  const haze = isObject(parsed.haze) ? parsed.haze : {};

  const merged: EnvironmentPreset = {
    id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id : defaults.id,
    name:
      typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : defaults.name,
    assets: {
      colorImageUrl:
        typeof assets.colorImageUrl === "string" && assets.colorImageUrl.trim()
          ? assets.colorImageUrl
          : defaults.assets.colorImageUrl,
      depthMapUrl:
        typeof assets.depthMapUrl === "string" && assets.depthMapUrl.trim()
          ? assets.depthMapUrl
          : defaults.assets.depthMapUrl,
    },
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
        typeof color.driftEnabled === "boolean"
          ? color.driftEnabled
          : defaults.color.driftEnabled,
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
      enabled:
        typeof twinkles.enabled === "boolean"
          ? twinkles.enabled
          : defaults.twinkles.enabled,
      hotspots: Array.isArray(twinkles.hotspots)
        ? twinkles.hotspots
            .map((entry, index) => sanitizeHotspot(entry, index))
            .filter((entry): entry is TwinkleHotspot => entry !== null)
        : defaults.twinkles.hotspots,
      defaultColor: isValidColor(twinkles.defaultColor)
        && isHexColor(twinkles.defaultColor)
        ? twinkles.defaultColor
        : defaults.twinkles.defaultColor,
      defaultSize: clamp(readNumber(twinkles.defaultSize, defaults.twinkles.defaultSize), 0.04, 0.6),
      defaultIntensity: clamp(
        readNumber(twinkles.defaultIntensity, defaults.twinkles.defaultIntensity),
        0.05,
        2,
      ),
      pulseSpeed: clamp(readNumber(twinkles.pulseSpeed, defaults.twinkles.pulseSpeed), 0, 3),
    },
    surfaceGlows: {
      enabled:
        typeof surfaceGlows.enabled === "boolean"
          ? surfaceGlows.enabled
          : defaults.surfaceGlows.enabled,
      hotspots: Array.isArray(surfaceGlows.hotspots)
        ? surfaceGlows.hotspots
            .map((entry, index) => sanitizeSurfaceGlowHotspot(entry, index))
            .filter((entry): entry is SurfaceGlowHotspot => entry !== null)
            .slice(0, 32)
        : defaults.surfaceGlows.hotspots,
      defaultColor: isHexColor(surfaceGlows.defaultColor)
        ? surfaceGlows.defaultColor
        : defaults.surfaceGlows.defaultColor,
      defaultRadius: clamp(
        readNumber(surfaceGlows.defaultRadius, defaults.surfaceGlows.defaultRadius),
        0.002,
        0.09,
      ),
      defaultSoftness: clamp(
        readNumber(surfaceGlows.defaultSoftness, defaults.surfaceGlows.defaultSoftness),
        0.05,
        0.98,
      ),
      defaultIntensity: clamp(
        readNumber(surfaceGlows.defaultIntensity, defaults.surfaceGlows.defaultIntensity),
        0,
        4,
      ),
      defaultPulseEnabled:
        typeof surfaceGlows.defaultPulseEnabled === "boolean"
          ? surfaceGlows.defaultPulseEnabled
          : defaults.surfaceGlows.defaultPulseEnabled,
      defaultPulseAmount: clamp(
        readNumber(surfaceGlows.defaultPulseAmount, defaults.surfaceGlows.defaultPulseAmount),
        0,
        2,
      ),
      defaultPulseCycleSeconds: clamp(
        readNumber(
          surfaceGlows.defaultPulseCycleSeconds,
          defaults.surfaceGlows.defaultPulseCycleSeconds,
        ),
        0.2,
        120,
      ),
    },
    particles: {
      enabled:
        typeof particles.enabled === "boolean"
          ? particles.enabled
          : defaults.particles.enabled,
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
      driftCycleSeconds: clamp(readNumber(haze.driftCycleSeconds, defaults.haze.driftCycleSeconds), 1, 600),
      primaryColor: isHexColor(haze.primaryColor)
        ? haze.primaryColor
        : defaults.haze.primaryColor,
      secondaryColor: isHexColor(haze.secondaryColor)
        ? haze.secondaryColor
        : defaults.haze.secondaryColor,
    },
  };

  if (!merged.assets.colorImageUrl || !merged.assets.depthMapUrl) {
    return {
      ok: false,
      error: "Preset assets require both colorImageUrl and depthMapUrl.",
    };
  }

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

  return { ok: true, preset: merged };
}
