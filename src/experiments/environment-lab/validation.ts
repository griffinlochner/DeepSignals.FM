import { cloneEnvironmentPreset, UV_JUNGLE_LAB_PRESET } from "./presets";
import type { EnvironmentPreset, TwinkleHotspot } from "./types";

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

  return { ok: true, preset: merged };
}
