import * as THREE from "three";
import type { AudioReactiveSnapshot, ReactiveBehaviorId } from "../../app/playerTypes";
import type { ImageDepthAmbientParticlePreset, ImageDepthAsset } from "./types";

type AmbientParticleFieldUpdateArgs = {
  elapsedSeconds: number;
  audioSnapshot: AudioReactiveSnapshot | null;
  isPlaying: boolean;
  motionEnabled: boolean;
  reducedMotion: boolean;
  reactiveIsolationEnabled: boolean;
  reactiveBehavior: ReactiveBehaviorId;
  scenePulseEnvelope: number;
  scenePulseDepthContributionNormalized: number;
};

type AmbientParticleFieldDiagnostics = {
  active: boolean;
  count: number;
  visibleCountEstimate: number;
  allocationCount: number;
  drawCallCount: number;
  behavior: ReactiveBehaviorId;
  motionEnabled: boolean;
  reducedMotion: boolean;
  reactiveIsolationEnabled: boolean;
  averageVisibility: number;
  depthSamplingActive: boolean;
  colorSamplingActive: boolean;
  generatedUvMinU: number;
  generatedUvMaxU: number;
  generatedUvMinV: number;
  generatedUvMaxV: number;
  generatedLocalMinX: number;
  generatedLocalMaxX: number;
  generatedLocalMinY: number;
  generatedLocalMaxY: number;
  planeWidth: number;
  planeHeight: number;
  scenePulseEnvelope: number;
  scenePulseDepthContributionNormalized: number;
  pulseParticipation: number;
  pulseAmplitude: number;
};

type AmbientParticleFieldPerfDiagnostics = {
  active: boolean;
  initMs: number;
  updateCpuMsLast: number;
  updateCpuMsAverage: number;
  allocationCount: number;
  drawCallCount: number;
  particleCount: number;
  sampledArtworkCacheHit: boolean;
  sampledArtworkCacheKey: string;
  sampledColorWidth: number;
  sampledColorHeight: number;
  sampledDepthWidth: number;
  sampledDepthHeight: number;
  sampleCacheEntries: number;
};

type AmbientParticleRole = 0 | 1 | 2;

type AmbientParticleCandidate = {
  uv: { u: number; v: number };
  position: THREE.Vector3;
  color: THREE.Color;
  role: AmbientParticleRole;
  seed: number;
  size: number;
  driftSpeed: number;
  visibility: number;
  brightnessBias: number;
  depthFactor: number;
  driftDirectionX: number;
  driftDirectionY: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
  orbitCurve: number;
  sparkSeed: number;
  bassThreshold: number;
  highThreshold: number;
  transientThreshold: number;
  twinkleRate: number;
  twinklePhase: number;
};

type AmbientParticleUniforms = {
  uTime: { value: number };
  uEnergy: { value: number };
  uBassPulse: { value: number };
  uKickPulse: { value: number };
  uHighs: { value: number };
  uTransient: { value: number };
  uMids: { value: number };
  uScenePulseEnvelope: { value: number };
  uPulseAmplitude: { value: number };
  uPulseParticipation: { value: number };
  uSpatialMotionEnabled: { value: number };
  uBehaviorDrive: { value: number };
  uVisibilityScale: { value: number };
  uSizeScale: { value: number };
  uMaxPointSize: { value: number };
  uBassLiftScale: { value: number };
  uKickLiftScale: { value: number };
  uTransientLiftScale: { value: number };
  uTwinkleScale: { value: number };
};

type SampledTexture = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type SampledArtworkPair = {
  color: SampledTexture;
  depth: SampledTexture;
};

type SampledArtworkEntry = SampledArtworkPair & {
  key: string;
};

const BASELINE_VIEWPORT_AREA = 1440 * 900;
const SAMPLE_LIMIT = 512;
const SAMPLED_ARTWORK_CACHE_LIMIT = 6;
const SPORE_ROLE_RATIO = 0.72;
const GLOW_ROLE_RATIO = 0.94;

const sampledArtworkCache = new Map<string, SampledArtworkEntry>();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function fract(value: number) {
  return value - Math.floor(value);
}

function hash01(value: number) {
  return fract(Math.sin(value) * 43758.5453123);
}

function hashSeed(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed: number, offset: number) {
  return hash01(seed * 0.0000001 + offset * 12.9898 + 0.137);
}

function sampleCanvasImage(texture: THREE.Texture): SampledTexture | null {
  if (typeof document === "undefined") {
    return null;
  }

  const image = texture.image as CanvasImageSource | undefined;

  if (!image) {
    return null;
  }

  const sourceWidth = Number((image as { width?: number }).width ?? 0);
  const sourceHeight = Number((image as { height?: number }).height ?? 0);

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }

  const scale = Math.min(1, SAMPLE_LIMIT / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);

  try {
    const data = context.getImageData(0, 0, width, height).data;
    return { width, height, data };
  } catch {
    return null;
  }
}

function sampleTextureAt(texture: SampledTexture, u: number, v: number) {
  const x = Math.max(0, Math.min(texture.width - 1, Math.floor(u * (texture.width - 1))));
  const y = Math.max(0, Math.min(texture.height - 1, Math.floor(v * (texture.height - 1))));
  const offset = (y * texture.width + x) * 4;

  return {
    r: texture.data[offset] ?? 0,
    g: texture.data[offset + 1] ?? 0,
    b: texture.data[offset + 2] ?? 0,
    a: texture.data[offset + 3] ?? 255,
  };
}

function sampleLuma(sample: { r: number; g: number; b: number }) {
  return (0.2126 * sample.r + 0.7152 * sample.g + 0.0722 * sample.b) / 255;
}

function sampleSaturation(sample: { r: number; g: number; b: number }) {
  const red = sample.r / 255;
  const green = sample.g / 255;
  const blue = sample.b / 255;
  const maxValue = Math.max(red, green, blue);
  const minValue = Math.min(red, green, blue);

  if (maxValue <= 0) {
    return 0;
  }

  return clamp((maxValue - minValue) / maxValue, 0, 1);
}

function createBiasPalette(colors: string[]) {
  return colors.map((color) => new THREE.Color(color));
}

function textureCacheKey(asset: ImageDepthAsset) {
  return `${asset.id}|${asset.colorImageUrl}|${asset.depthMapUrl}`;
}

function getOrCreateSampledArtworkPair(
  asset: ImageDepthAsset,
  colorTexture: THREE.Texture,
  depthTexture: THREE.Texture,
) {
  const key = textureCacheKey(asset);
  const cached = sampledArtworkCache.get(key);

  if (cached) {
    sampledArtworkCache.delete(key);
    sampledArtworkCache.set(key, cached);
    return {
      cacheHit: true,
      key: cached.key,
      color: cached.color,
      depth: cached.depth,
    };
  }

  const color = sampleCanvasImage(colorTexture);
  const depth = sampleCanvasImage(depthTexture);

  if (!color || !depth) {
    return null;
  }

  const entry: SampledArtworkEntry = { key, color, depth };
  sampledArtworkCache.set(key, entry);

  while (sampledArtworkCache.size > SAMPLED_ARTWORK_CACHE_LIMIT) {
    const oldestKey = sampledArtworkCache.keys().next().value as string | undefined;

    if (!oldestKey) {
      break;
    }

    sampledArtworkCache.delete(oldestKey);
  }

  return {
    cacheHit: false,
    key: entry.key,
    color: entry.color,
    depth: entry.depth,
  };
}

function createCandidatePool(
  asset: ImageDepthAsset,
  preset: ImageDepthAmbientParticlePreset,
  colorTexture: SampledTexture,
  depthTexture: SampledTexture,
) {
  const candidateCount = Math.max(1, preset.count);
  const aspectRatio = colorTexture.width / Math.max(colorTexture.height, 1);
  const gridColumns = Math.max(1, Math.round(Math.sqrt(candidateCount * aspectRatio)));
  const gridRows = Math.max(1, Math.ceil(candidateCount / gridColumns));
  const seedBase = hashSeed(asset.id);
  const palette = createBiasPalette(preset.colorBiasPalette);
  const candidates: AmbientParticleCandidate[] = [];

  for (let index = 0; index < gridColumns * gridRows && candidates.length < candidateCount; index += 1) {
    const cellX = index % gridColumns;
    const cellY = Math.floor(index / gridColumns);
    const candidateSeed = seedBase + index * 977;
    const u = clamp((cellX + seededRandom(candidateSeed, 1.7)) / gridColumns, 0, 1);
    const v = clamp((cellY + seededRandom(candidateSeed, 4.1)) / gridRows, 0, 1);
    const sampledColor = sampleTextureAt(colorTexture, u, v);
    const sampledDepth = sampleTextureAt(depthTexture, u, v);
    const brightness = sampleLuma(sampledColor);
    const saturation = sampleSaturation(sampledColor);
    const depthLuma = sampleLuma(sampledDepth);
    const weight = clamp(
      brightness * 0.54 + saturation * 0.26 + depthLuma * 0.2,
      0,
      1,
    );
    const paletteColor = palette[Math.floor(seededRandom(candidateSeed, 11.9) * palette.length) % Math.max(palette.length, 1)] ?? null;
    const color = new THREE.Color(
      sampledColor.r / 255,
      sampledColor.g / 255,
      sampledColor.b / 255,
    );
    const roleRoll = seededRandom(candidateSeed, 41.7);
    const role: AmbientParticleRole = roleRoll >= GLOW_ROLE_RATIO ? 2 : roleRoll >= SPORE_ROLE_RATIO ? 1 : 0;
    const roleVisibilityScale = role === 0 ? 0.62 : role === 1 ? 0.96 : 0.24;
    const roleSizeScale = role === 0 ? lerp(0.56, 0.82, depthLuma) : role === 1 ? lerp(1.02, 1.34, weight) : lerp(0.7, 0.96, depthLuma);
    const roleBrightnessScale = role === 0 ? 0.32 : role === 1 ? 0.62 : 0.18;
    const driftDirectionAngle = seededRandom(candidateSeed, 47.3) * Math.PI * 2;
    const driftDirectionX = Math.cos(driftDirectionAngle);
    const driftDirectionY = Math.sin(driftDirectionAngle);
    const orbitRadius = lerp(0.0045, 0.018, seededRandom(candidateSeed, 53.1)) * lerp(0.78, 1.18, 1 - depthLuma);
    const orbitSpeed = lerp(0.065, 0.34, seededRandom(candidateSeed, 59.7)) * lerp(0.82, 1.14, 1 - depthLuma);
    const orbitPhase = seededRandom(candidateSeed, 61.1) * Math.PI * 2;
    const orbitCurve = lerp(0.32, 1.08, seededRandom(candidateSeed, 67.5));
    const sparkSeed = seededRandom(candidateSeed, 71.3);

    if (paletteColor) {
      color.lerp(paletteColor, lerp(preset.brightnessBiasRange.min, preset.brightnessBiasRange.max, weight) * 0.18);
    }

    color.lerp(new THREE.Color(0xffffff), roleBrightnessScale * 0.2);

    const depth = clamp(0.1 + depthLuma * 0.9, 0, 1);
    const x = u - 0.5;
    const y = 0.5 - v;
    const z = lerp(preset.depthOffsetRange.min, preset.depthOffsetRange.max, depth);
    const baseSize = lerp(preset.sizeRange.min, preset.sizeRange.max, seededRandom(candidateSeed, 7.3));
    const driftSpeed = lerp(preset.driftSpeedRange.chill, preset.driftSpeedRange.fullOn, seededRandom(candidateSeed, 8.2));
    const visibility = clamp(lerp(preset.visibilityDensityScaleRange.min, preset.visibilityDensityScaleRange.max, weight) * roleVisibilityScale, 0, 1.35);
    const brightnessBias = clamp(lerp(preset.brightnessBiasRange.min, preset.brightnessBiasRange.max, weight) * (0.84 + roleBrightnessScale * 0.55), 0, 1.6);

    candidates.push({
      uv: { u, v },
      position: new THREE.Vector3(x, y, z),
      color,
      role,
      seed: candidateSeed,
      size: baseSize * roleSizeScale,
      driftSpeed: driftSpeed * (role === 0 ? 0.72 : role === 1 ? 0.94 : 1.02),
      visibility,
      brightnessBias,
      depthFactor: depth,
      driftDirectionX,
      driftDirectionY,
      orbitRadius,
      orbitSpeed,
      orbitPhase,
      orbitCurve,
      sparkSeed,
      bassThreshold: lerp(0.24, 0.76, seededRandom(candidateSeed, 17.1)),
      highThreshold: lerp(0.36, 0.9, seededRandom(candidateSeed, 19.7)),
      transientThreshold: lerp(0.42, 0.94, seededRandom(candidateSeed, 23.9)),
      twinkleRate: lerp(0.6, 2.8, seededRandom(candidateSeed, 29.1)),
      twinklePhase: seededRandom(candidateSeed, 31.3) * Math.PI * 2,
    });
  }

  return candidates;
}

function createParticleGeometry(candidates: AmbientParticleCandidate[]) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(candidates.length * 3);
  const colors = new Float32Array(candidates.length * 3);
  const seeds = new Float32Array(candidates.length);
  const roles = new Float32Array(candidates.length);
  const sizes = new Float32Array(candidates.length);
  const visibility = new Float32Array(candidates.length);
  const responsePack = new Float32Array(candidates.length * 4);
  const driftPack = new Float32Array(candidates.length * 4);
  const phasePack = new Float32Array(candidates.length * 2);
  const thresholdPack = new Float32Array(candidates.length * 4);

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const positionOffset = index * 3;
    const responseOffset = index * 4;
    const driftOffset = index * 4;
    const phaseOffset = index * 2;
    positions[positionOffset] = candidate.position.x;
    positions[positionOffset + 1] = candidate.position.y;
    positions[positionOffset + 2] = candidate.position.z;
    colors[positionOffset] = candidate.color.r;
    colors[positionOffset + 1] = candidate.color.g;
    colors[positionOffset + 2] = candidate.color.b;
    seeds[index] = candidate.seed;
    roles[index] = candidate.role;
    sizes[index] = candidate.size;
    visibility[index] = candidate.visibility;
    responsePack[responseOffset] = candidate.driftSpeed;
    responsePack[responseOffset + 1] = candidate.depthFactor;
    responsePack[responseOffset + 2] = candidate.sparkSeed;
    responsePack[responseOffset + 3] = candidate.orbitCurve;
    driftPack[driftOffset] = candidate.driftDirectionX;
    driftPack[driftOffset + 1] = candidate.driftDirectionY;
    driftPack[driftOffset + 2] = candidate.orbitRadius;
    driftPack[driftOffset + 3] = candidate.orbitSpeed;
    phasePack[phaseOffset] = candidate.orbitPhase;
    phasePack[phaseOffset + 1] = candidate.twinkleRate;
    thresholdPack[responseOffset] = candidate.bassThreshold;
    thresholdPack[responseOffset + 1] = candidate.highThreshold;
    thresholdPack[responseOffset + 2] = candidate.transientThreshold;
    thresholdPack[responseOffset + 3] = candidate.twinklePhase;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aRole", new THREE.BufferAttribute(roles, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aVisibility", new THREE.BufferAttribute(visibility, 1));
  geometry.setAttribute("aResponsePack", new THREE.BufferAttribute(responsePack, 4));
  geometry.setAttribute("aDriftPack", new THREE.BufferAttribute(driftPack, 4));
  geometry.setAttribute("aPhasePack", new THREE.BufferAttribute(phasePack, 2));
  geometry.setAttribute("aThresholdPack", new THREE.BufferAttribute(thresholdPack, 4));
  geometry.computeBoundingSphere();

  return geometry;
}

function createParticleMaterial() {
  const uniforms: AmbientParticleUniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uBassPulse: { value: 0 },
    uKickPulse: { value: 0 },
    uHighs: { value: 0 },
    uTransient: { value: 0 },
    uMids: { value: 0 },
    uScenePulseEnvelope: { value: 0 },
    uPulseAmplitude: { value: 0 },
    uPulseParticipation: { value: 0 },
    uSpatialMotionEnabled: { value: 0 },
    uBehaviorDrive: { value: 0.82 },
    uVisibilityScale: { value: 1 },
    uSizeScale: { value: 1 },
    uMaxPointSize: { value: 12 },
    uBassLiftScale: { value: 1 },
    uKickLiftScale: { value: 1 },
    uTransientLiftScale: { value: 1 },
    uTwinkleScale: { value: 1 },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexColors: false,
    vertexShader: `
      attribute vec3 aColor;
      attribute float aRole;
      attribute float aSeed;
      attribute float aSize;
      attribute float aVisibility;
      attribute vec4 aResponsePack;
      attribute vec4 aDriftPack;
      attribute vec2 aPhasePack;
      attribute vec4 aThresholdPack;

      uniform float uTime;
      uniform float uEnergy;
      uniform float uBassPulse;
      uniform float uKickPulse;
      uniform float uHighs;
      uniform float uTransient;
      uniform float uMids;
      uniform float uScenePulseEnvelope;
      uniform float uPulseAmplitude;
      uniform float uPulseParticipation;
      uniform float uSpatialMotionEnabled;
      uniform float uBehaviorDrive;
      uniform float uVisibilityScale;
      uniform float uSizeScale;
      uniform float uMaxPointSize;
      uniform float uBassLiftScale;
      uniform float uKickLiftScale;
      uniform float uTransientLiftScale;
      uniform float uTwinkleScale;

      varying vec3 vColor;
      varying float vAlpha;
      varying float vTwinkle;
      varying float vRole;
      varying float vDepthFactor;
      varying float vSparkStretch;
      varying vec2 vSparkDirection;
      varying float vPulseGlow;

      float hash(float value) {
        return fract(sin(value) * 43758.5453123);
      }

      void main() {
        vec3 basePosition = position;
        float seed = aSeed * 0.000001;
        float spatialEnabled = clamp(uSpatialMotionEnabled, 0.0, 1.0);
        float behaviorDrive = clamp(uBehaviorDrive, 0.0, 1.5);
        float energy = clamp(uEnergy, 0.0, 1.0);
        float bassPulse = clamp(uBassPulse, 0.0, 1.0);
        float kickPulse = clamp(uKickPulse, 0.0, 1.0);
        float highs = clamp(uHighs, 0.0, 1.0);
        float transient = clamp(uTransient, 0.0, 1.0);
        float mids = clamp(uMids, 0.0, 1.0);
        float driftSpeed = aResponsePack.x;
        float depthFactor = aResponsePack.y;
        float sparkSeed = aResponsePack.z;
        float orbitCurve = aResponsePack.w;
        vec2 driftDirection = normalize(aDriftPack.xy);
        float orbitRadius = aDriftPack.z;
        float orbitSpeed = aDriftPack.w;
        float orbitPhase = aPhasePack.x;
        float twinkleRate = aPhasePack.y;
        float bassThreshold = aThresholdPack.x;
        float highThreshold = aThresholdPack.y;
        float transientThreshold = aThresholdPack.z;
        float twinklePhase = aThresholdPack.w;
        float driftPhase = uTime * driftSpeed * mix(0.12, 0.48, behaviorDrive) + orbitSpeed * 0.18;
        float scenePulse = clamp(uScenePulseEnvelope, 0.0, 1.0);
        float pulseParticipationDrive = clamp(uPulseParticipation, 0.0, 1.0);
        float pulseAmplitudeDrive = clamp(uPulseAmplitude, 0.0, 1.25);
        float driftStrength = spatialEnabled * (0.0024 + mix(0.0009, 0.0021, behaviorDrive) * (0.35 + energy * 0.65));
        float depthMotionScale = mix(0.72, 1.18, depthFactor);
        float role = aRole;
        float sporeRole = role < 0.5 ? 1.0 : 0.0;
        float glowRole = role >= 0.5 && role < 1.5 ? 1.0 : 0.0;
        float sparkRole = role >= 1.5 ? 1.0 : 0.0;
        vec2 driftPerpendicular = vec2(-driftDirection.y, driftDirection.x);
        float driftWave = sin(driftPhase + orbitPhase + sparkSeed * 6.28318);
        float orbitWave = cos(driftPhase * orbitCurve + orbitPhase * 0.73 + sparkSeed * 2.7);
        float curveWave = sin(driftPhase * 0.41 + orbitPhase * 1.17 + aSeed * 97.0);
        float bassLift = smoothstep(bassThreshold, 1.0, bassPulse) * uBassLiftScale * spatialEnabled;
        float kickLift = smoothstep(bassThreshold * 0.72, 1.0, kickPulse) * uKickLiftScale * spatialEnabled;
        float transientLift = smoothstep(transientThreshold, 1.0, transient) * uTransientLiftScale * spatialEnabled;
        float sparkleGate = smoothstep(highThreshold, 1.0, highs);
        float midsLift = smoothstep(0.16, 0.92, mids) * mix(0.12, 0.28, glowRole + sparkRole);
        float roleDriftScale = sporeRole * 0.72 + glowRole * 1.0 + sparkRole * 0.62;
        float roleSizeScale = sporeRole * 0.76 + glowRole * 1.18 + sparkRole * 0.92;
        float roleVisibilityScale = sporeRole * 0.58 + glowRole * 1.0 + sparkRole * 0.32;
        float pulseThresholdNoise = hash(aSeed * 0.0000013 + 0.37);
        float rolePulseThreshold = sporeRole * 0.56 + glowRole * 0.34 + sparkRole * 0.78;
        float depthPulseBias = mix(0.08, 0.24, depthFactor);
        float pulseThreshold = clamp(rolePulseThreshold + pulseThresholdNoise * 0.26 - depthPulseBias, 0.08, 0.92);
        float pulseParticipation = smoothstep(pulseThreshold - 0.16, pulseThreshold + 0.1, pulseParticipationDrive);
        float pulseRoleScale = sporeRole * 0.72 + glowRole * 1.05 + sparkRole * 0.46;
        vec2 radialDirection = normalize(basePosition.xy + vec2(0.0001, 0.0001));
        vec2 pulseDirection = normalize(mix(radialDirection, driftDirection, 0.42 + hash(aSeed * 0.0000097) * 0.34));
        float coherentPulse = scenePulse * pulseAmplitudeDrive * pulseParticipation * pulseRoleScale * spatialEnabled;
        float coherentPulseDisplacement = coherentPulse * mix(0.0055, 0.0145, depthFactor);
        float coherentPulseDepthLift = coherentPulse * mix(0.001, 0.0038, depthFactor);
        float coherentPulseSizeLift = coherentPulse * mix(0.24, 0.48, depthFactor);
        float coherentPulseGlow = coherentPulse * (0.16 + glowRole * 0.38 + sparkRole * 0.12);
        float microTurbulenceWave =
          sin(driftPhase * 2.8 + sparkSeed * 10.7) * 0.5 +
          cos(driftPhase * 1.9 + orbitPhase * 1.4) * 0.5;
        float microTurbulenceAmount = spatialEnabled * mix(0.00025, 0.00125, behaviorDrive) * (0.45 + energy * 0.55) * (1.0 - scenePulse * 0.58);
        vec2 drift = driftDirection * driftWave * orbitRadius * driftStrength * depthMotionScale * roleDriftScale;
        drift += driftPerpendicular * curveWave * orbitRadius * driftStrength * 0.7 * (0.68 + depthFactor * 0.62);
        drift += driftPerpendicular * microTurbulenceWave * microTurbulenceAmount;
        drift += driftDirection * (bassLift * 0.0048 + kickLift * 0.0066 + transientLift * 0.0028 + midsLift * 0.0024);
        drift += driftPerpendicular * (bassLift * 0.0026 + midsLift * 0.0022) * (0.42 + sparkRole * 0.34);
        drift += pulseDirection * coherentPulseDisplacement;
        vec3 displaced = basePosition + vec3(drift, orbitWave * driftStrength * orbitRadius * 0.52);
        displaced.z += (bassLift * 0.004 + kickLift * 0.005 + transientLift * 0.003) * (0.6 + depthFactor * 0.4) + coherentPulseDepthLift;
        vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);

        float twinkleWave = sin(uTime * twinkleRate + twinklePhase + sparkSeed * 7.0) * 0.5 + 0.5;
        float twinkle = smoothstep(0.62, 0.98, twinkleWave) * sparkleGate * uTwinkleScale;
        float roleEnergyLift = sporeRole * 0.34 + glowRole * (0.46 + energy * 0.22) + sparkRole * 0.22;
        float glowLift = glowRole * (0.24 + energy * 0.54) + bassLift * 0.36 + kickLift * 0.32 + transientLift * 0.14;
        float sparkFlash = sparkRole * (sparkleGate * (0.24 + transientLift * 0.66 + twinkle * 0.42));
        float overallBrightness = 0.42 + energy * 0.26 + roleEnergyLift + glowLift + sparkFlash + coherentPulseGlow;
        vColor = aColor * overallBrightness + vec3(1.0) * (glowRole * 0.12 + sparkFlash * 0.22 + twinkle * 0.08);
        vAlpha = clamp(aVisibility * uVisibilityScale * roleVisibilityScale * (0.28 + energy * 0.34 + glowLift * 0.8 + sparkFlash * 0.72 + twinkle * 0.24 + coherentPulseGlow * 0.92), 0.0, 1.0);
        vTwinkle = twinkle * (0.44 + sparkRole * 0.66);
        vRole = role;
        vDepthFactor = depthFactor;
        vSparkStretch = mix(1.0, 1.72, sparkRole) + transientLift * 0.82 + kickLift * 0.34 + coherentPulse * 0.18;
        vSparkDirection = driftDirection;
        vPulseGlow = coherentPulseGlow;

        float foregroundScale = mix(0.94, 1.22, depthFactor);
        float rolePointScale = sporeRole * 0.74 + glowRole * 1.12 + sparkRole * 0.92;
        float sizeBoost = 1.0 + energy * 0.18 + bassLift * 0.38 + kickLift * 0.46 + transientLift * 0.22 + twinkle * 0.38 + roleEnergyLift * 0.2 + coherentPulseSizeLift;
        gl_PointSize = clamp(aSize * uSizeScale * roleSizeScale * foregroundScale * sizeBoost * (320.0 / max(1.0, -mvPosition.z)), 1.0, uMaxPointSize * rolePointScale);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vTwinkle;
      varying float vRole;
      varying float vDepthFactor;
      varying float vSparkStretch;
      varying vec2 vSparkDirection;
      varying float vPulseGlow;

      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float role = vRole;
        if (role >= 1.5) {
          float angle = atan(vSparkDirection.y, vSparkDirection.x);
          float sine = sin(angle);
          float cosine = cos(angle);
          centered = vec2(
            cosine * centered.x - sine * centered.y,
            sine * centered.x + cosine * centered.y
          );
          centered.x /= max(vSparkStretch, 1.0);
        }

        float dist = length(centered);
        float depthFactor = clamp(vDepthFactor, 0.0, 1.0);
        float coreRadius = role < 0.5 ? 0.18 : role < 1.5 ? 0.14 : 0.09;
        float haloRadius = role < 0.5 ? 0.54 : role < 1.5 ? 0.7 : 0.42;
        float core = 1.0 - smoothstep(0.0, coreRadius, dist);
        float halo = 1.0 - smoothstep(coreRadius * 0.45, haloRadius, dist);
        float whiteCore = role < 0.5 ? 0.18 : role < 1.5 ? 0.4 : 0.72;
        float haloStrength = role < 0.5 ? 0.16 : role < 1.5 ? 0.42 : 0.28;
        float sparkAccent = role < 1.5 ? 0.0 : (1.0 - smoothstep(0.0, 0.44, dist)) * (0.56 + vTwinkle * 0.44);
        float alpha = core * core * (0.88 + whiteCore * 0.18) + halo * haloStrength + vTwinkle * 0.16 + sparkAccent * 0.18 + vPulseGlow * 0.16;

        if (alpha <= 0.001) {
          discard;
        }

        vec3 haloColor = mix(vColor, vec3(1.0), role < 0.5 ? 0.08 : role < 1.5 ? 0.22 : 0.48);
        vec3 coreColor = mix(vec3(1.0), haloColor, role < 0.5 ? 0.72 : role < 1.5 ? 0.52 : 0.34);
        vec3 finalColor = mix(haloColor, coreColor, core);
        finalColor += vec3(1.0) * sparkAccent * 0.18 * depthFactor;

        gl_FragColor = vec4(finalColor, clamp(alpha * vAlpha, 0.0, 1.0));
      }
    `,
  });
}

export class AmbientParticleField {
  public readonly points: THREE.Points;

  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly uniforms: AmbientParticleUniforms;
  private readonly diagnostics: AmbientParticleFieldDiagnostics;
  private readonly perfDiagnostics: AmbientParticleFieldPerfDiagnostics;
  private readonly spatialScale = new THREE.Vector3(1, 1, 1);
  private readonly initStartedAtMs: number;

  constructor(
    asset: ImageDepthAsset,
    preset: ImageDepthAmbientParticlePreset,
    colorTexture: THREE.Texture,
    depthTexture: THREE.Texture,
  ) {
    this.initStartedAtMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    const sampledArtwork = getOrCreateSampledArtworkPair(asset, colorTexture, depthTexture);

    if (!sampledArtwork) {
      throw new Error(`Ambient particle sampling failed for ${asset.id}.`);
    }

    const candidates = createCandidatePool(asset, preset, sampledArtwork.color, sampledArtwork.depth);
    this.geometry = createParticleGeometry(candidates);
    this.material = createParticleMaterial();
    this.uniforms = this.material.uniforms as AmbientParticleUniforms;
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.diagnostics = {
      active: true,
      count: candidates.length,
      visibleCountEstimate: candidates.length,
      allocationCount: candidates.length,
      drawCallCount: 1,
      behavior: "chill",
      motionEnabled: false,
      reducedMotion: false,
      reactiveIsolationEnabled: false,
      averageVisibility:
        candidates.length > 0
          ? candidates.reduce((sum, candidate) => sum + candidate.visibility, 0) / candidates.length
          : 0,
      depthSamplingActive: true,
      colorSamplingActive: true,
      generatedUvMinU: 1,
      generatedUvMaxU: 0,
      generatedUvMinV: 1,
      generatedUvMaxV: 0,
      generatedLocalMinX: 1,
      generatedLocalMaxX: 0,
      generatedLocalMinY: 1,
      generatedLocalMaxY: 0,
      planeWidth: 1,
      planeHeight: 1,
      scenePulseEnvelope: 0,
      scenePulseDepthContributionNormalized: 0,
      pulseParticipation: 0,
      pulseAmplitude: 0,
    };

    const initEndedAtMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.perfDiagnostics = {
      active: true,
      initMs: initEndedAtMs - this.initStartedAtMs,
      updateCpuMsLast: 0,
      updateCpuMsAverage: 0,
      allocationCount: candidates.length,
      drawCallCount: 1,
      particleCount: candidates.length,
      sampledArtworkCacheHit: sampledArtwork.cacheHit,
      sampledArtworkCacheKey: sampledArtwork.key,
      sampledColorWidth: sampledArtwork.color.width,
      sampledColorHeight: sampledArtwork.color.height,
      sampledDepthWidth: sampledArtwork.depth.width,
      sampledDepthHeight: sampledArtwork.depth.height,
      sampleCacheEntries: sampledArtworkCache.size,
    };

    for (const candidate of candidates) {
      this.diagnostics.generatedUvMinU = Math.min(this.diagnostics.generatedUvMinU, candidate.uv.u);
      this.diagnostics.generatedUvMaxU = Math.max(this.diagnostics.generatedUvMaxU, candidate.uv.u);
      this.diagnostics.generatedUvMinV = Math.min(this.diagnostics.generatedUvMinV, candidate.uv.v);
      this.diagnostics.generatedUvMaxV = Math.max(this.diagnostics.generatedUvMaxV, candidate.uv.v);
      this.diagnostics.generatedLocalMinX = Math.min(this.diagnostics.generatedLocalMinX, candidate.position.x);
      this.diagnostics.generatedLocalMaxX = Math.max(this.diagnostics.generatedLocalMaxX, candidate.position.x);
      this.diagnostics.generatedLocalMinY = Math.min(this.diagnostics.generatedLocalMinY, candidate.position.y);
      this.diagnostics.generatedLocalMaxY = Math.max(this.diagnostics.generatedLocalMaxY, candidate.position.y);
    }
  }

  setPlaneScale(width: number, height: number) {
    this.spatialScale.set(Math.max(width, 0.0001), Math.max(height, 0.0001), 1);
    this.points.scale.copy(this.spatialScale);
    this.diagnostics.planeWidth = Math.max(width, 0.0001);
    this.diagnostics.planeHeight = Math.max(height, 0.0001);
  }

  setViewport(viewportWidth: number, viewportHeight: number) {
    const area = Math.max(1, viewportWidth * viewportHeight);
    const densityScale = clamp(Math.sqrt(area / BASELINE_VIEWPORT_AREA), 0.35, 1);
    this.uniforms.uVisibilityScale.value = densityScale;
    this.uniforms.uSizeScale.value = lerp(0.95, 1.08, densityScale);
    this.uniforms.uMaxPointSize.value = lerp(9, 13, densityScale);
    this.diagnostics.visibleCountEstimate = Math.max(1, Math.round(this.diagnostics.count * densityScale));
  }

  update(args: AmbientParticleFieldUpdateArgs) {
    const updateStartedAtMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    const behaviorDrive = args.reactiveBehavior === "fullon" ? 1 : 0.82;
    const spatialMotionEnabled = args.motionEnabled && !args.reducedMotion && !args.reactiveIsolationEnabled ? 1 : 0;
    const audioSnapshot = args.audioSnapshot;
    const energy = clamp(audioSnapshot?.smoothedEnergy ?? 0, 0, 1);
    const energyParticipation = clamp((energy - 0.05) / 0.95, 0, 1);
    const pulseAmplitude =
      args.reactiveBehavior === "fullon"
        ? lerp(0.58, 1.04, energyParticipation)
        : lerp(0.42, 0.82, energyParticipation);
    const bassPulse = clamp(audioSnapshot?.bassPulse ?? 0, 0, 1);
    const kickPulse = clamp(audioSnapshot?.kickPulse ?? 0, 0, 1);
    const highs = clamp(audioSnapshot?.highs ?? 0, 0, 1);
    const transient = clamp(audioSnapshot?.transient ?? 0, 0, 1);
    const mids = clamp(audioSnapshot?.mids ?? 0, 0, 1);

    this.uniforms.uTime.value = args.elapsedSeconds;
    this.uniforms.uEnergy.value = energy;
    this.uniforms.uBassPulse.value = bassPulse;
    this.uniforms.uKickPulse.value = kickPulse;
    this.uniforms.uHighs.value = highs;
    this.uniforms.uTransient.value = transient;
    this.uniforms.uMids.value = mids;
    this.uniforms.uScenePulseEnvelope.value = clamp(args.scenePulseEnvelope, 0, 1);
    this.uniforms.uPulseParticipation.value = energyParticipation;
    this.uniforms.uPulseAmplitude.value = pulseAmplitude;
    this.uniforms.uSpatialMotionEnabled.value = spatialMotionEnabled;
    this.uniforms.uBehaviorDrive.value = behaviorDrive;
    this.uniforms.uBassLiftScale.value = args.reactiveBehavior === "fullon" ? 1.15 : 0.86;
    this.uniforms.uKickLiftScale.value = args.reactiveBehavior === "fullon" ? 1.22 : 0.92;
    this.uniforms.uTransientLiftScale.value = args.reactiveBehavior === "fullon" ? 1.2 : 0.82;
    this.uniforms.uTwinkleScale.value = args.reactiveBehavior === "fullon" ? 1.15 : 0.85;

    this.diagnostics.behavior = args.reactiveBehavior;
    this.diagnostics.motionEnabled = args.motionEnabled;
    this.diagnostics.reducedMotion = args.reducedMotion;
    this.diagnostics.reactiveIsolationEnabled = args.reactiveIsolationEnabled;
    this.diagnostics.scenePulseEnvelope = clamp(args.scenePulseEnvelope, 0, 1);
    this.diagnostics.scenePulseDepthContributionNormalized = clamp(args.scenePulseDepthContributionNormalized, 0, 1);
    this.diagnostics.pulseParticipation = energyParticipation;
    this.diagnostics.pulseAmplitude = pulseAmplitude;

    const updateEndedAtMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    const updateCpuMs = updateEndedAtMs - updateStartedAtMs;
    this.perfDiagnostics.updateCpuMsLast = updateCpuMs;
    this.perfDiagnostics.updateCpuMsAverage = this.perfDiagnostics.updateCpuMsAverage === 0
      ? updateCpuMs
      : this.perfDiagnostics.updateCpuMsAverage * 0.88 + updateCpuMs * 0.12;
    this.perfDiagnostics.active = true;
  }

  getDiagnostics() {
    return this.diagnostics;
  }

  getPerfDiagnostics() {
    return {
      ...this.perfDiagnostics,
      sampleCacheEntries: sampledArtworkCache.size,
    };
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.perfDiagnostics.active = false;
  }
}
