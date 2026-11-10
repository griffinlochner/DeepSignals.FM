import * as THREE from "three";
import { toxicAuroraShader } from "./toxicAurora";
import { toxicVolcanoShader } from "./toxicVolcano";

// The visible sky and reflected sky use exactly the same linear-light treatment, as in Twilight Tides.
export const toxicColorShader = /* glsl */`
  uniform sampler2D noiseMap;
  uniform float chroma;
  uniform float colorEnergy;
  uniform float glintEnergy;
  uniform float skyTime;
  uniform float waterEnergy;
  uniform vec2 volcanoFrame;
  uniform vec3 craterDirection;
  #ifdef TOXIC_BAKED_VOLCANO
    uniform sampler2D volcanoMap;
  #endif
  const float TOXIC_BAKE_RANGE = 4.0;

  ${toxicAuroraShader}
  ${toxicVolcanoShader}

  // CHROMA OFF is restrained and steady, never grayscale.
  vec3 toxicTreatment(vec3 color) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luminance), color, mix(0.78, 1.10, chroma));
    return max(color, vec3(0.0)) * (0.80 + chroma * (0.20 + colorEnergy * 0.5));
  }
  float volcanoFacing(vec3 d) {
    return pow(max(dot(normalize(vec3(d.x, 0.0, d.z - 0.0001)),
      normalize(vec3(craterDirection.x, 0.0, craterDirection.z))), 0.0), 8.0);
  }
  // Near-black night with magenta haze gathered at the horizon behind the volcano.
  vec3 toxicAtmosphere(vec3 d) {
    float height = max(d.y, 0.0);
    float facing = volcanoFacing(d);
    vec3 color = mix(vec3(0.018, 0.004, 0.036), vec3(0.20, 0.018, 0.19), facing);
    color = mix(color, mix(vec3(0.010, 0.003, 0.026), vec3(0.045, 0.006, 0.07), facing), smoothstep(0.0, 0.04, height));
    color = mix(color, vec3(0.006, 0.002, 0.016), smoothstep(0.03, 0.15, height));
    color = mix(color, vec3(0.0025, 0.0015, 0.009), smoothstep(0.13, 0.34, height));
    return mix(color, vec3(0.0008, 0.0008, 0.004), smoothstep(0.30, 0.55, height));
  }
  float starHash(vec2 cell) {
    return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  }
  vec3 toxicStars(vec3 d, vec2 coordinates, float aa) {
    if (d.y < 0.07) return vec3(0.0);
    vec2 cell = floor(coordinates);
    float seed = starHash(cell);
    vec2 center = vec2(starHash(cell + 17.3), starHash(cell - 9.1)) * 0.6 + 0.2;
    float radius = mix(0.025, 0.07, starHash(cell + 5.7));
    float point = 1.0 - smoothstep(max(0.0, radius - aa * 0.5), radius + aa * 0.5, length(fract(coordinates) - center));
    float twinkle = 0.74 + 0.26 * sin(magmaTime * 2.2 + seed * 90.0);
    float stars = point * step(0.93, seed) * twinkle * smoothstep(0.07, 0.2, d.y) * (1.0 - smoothstep(0.3, 1.0, aa));
    return mix(vec3(0.42, 0.48, 0.61), vec3(0.50, 0.38, 0.66), starHash(cell + 3.1)) * stars;
  }
  vec3 toxicMist(vec3 d) {
    return toxicTreatment(toxicAtmosphere(normalize(vec3(d.x, 0.0, d.z - 0.0001))));
  }
  // The visible sky evaluates the volcano analytically for crisp edges. Rippled reflection directions
  // are incoherent, so the water samples the same layer from a small mipmapped bake instead.
  vec3 toxicSkyLight(vec3 d, float auroraVisibility) {
    vec2 p = d.xy / max(0.2, -d.z);
    // Derivatives and filtered lookups stay outside every divergent branch.
    vec2 pixelSize = fwidth(p);
    vec2 starGrid = vec2(atan(d.x, -d.z), asin(clamp(d.y, -1.0, 1.0))) * 90.0;
    float starPixel = max(length(fwidth(starGrid)), 0.001);
    vec2 v = (p - vec2(volcanoFrame.x, 0.0)) / volcanoFrame.y;
    vec4 veilNoise = texture2D(noiseMap, vec2(v.x * 0.55 + skyTime * 0.012, v.y * 3.2 - skyTime * 0.004));
    #ifdef TOXIC_BAKED_VOLCANO
      vec4 baked = texture2D(volcanoMap, vec2(v.x / TOXIC_VOLCANO_EXTENT.x * 0.5 + 0.5, v.y / TOXIC_VOLCANO_EXTENT.y));
      vec4 volcano = vec4(baked.rgb * baked.rgb * TOXIC_BAKE_RANGE, baked.a);
    #else
      vec4 volcano = toxicVolcanoLayer(v, max(length(pixelSize), 0.00002) / volcanoFrame.y, toxicMist(d), 1.0);
    #endif
    if (d.z > -0.2) volcano = vec4(0.0, 0.0, 0.0, 1.0);

    vec3 color = toxicTreatment(toxicAtmosphere(d));
    color += toxicTreatment(toxicStars(d, starGrid, starPixel));
    vec4 aurora = toxicAurora(p, pixelSize, d.z) * auroraVisibility;
    color = color * (1.0 - min(0.65, aurora.a)) + aurora.rgb;
    color = color * volcano.a + volcano.rgb;
    // Thin smoke veils drift across the flanks, in front of the fissures.
    float veilMask = smoothstep(0.012, 0.05, v.y) * (1.0 - smoothstep(0.13, 0.27, v.y))
      * (1.0 - smoothstep(0.45, 1.25, abs(v.x)));
    float veil = smoothstep(0.50, 0.80, veilNoise.b * 0.55 + veilNoise.r * 0.45) * veilMask;
    vec3 veilColor = toxicTreatment(vec3(0.030, 0.007, 0.048))
      + toxicMagma() * toxicCraterHeat() * 0.012 * exp(-abs(v.x) * 3.0);
    return mix(color, veilColor, veil * 0.5);
  }
`;

// One fragment evaluates the volcano layer for the reflection bake. Radiance is stored as
// sqrt(rgb / range) so an 8-bit target keeps dark smoke and white-hot fire.
export const toxicVolcanoBakeShader = /* glsl */`
  varying vec2 bakeUv;
  uniform float bakePixel;
  ${toxicColorShader}
  void main() {
    vec2 v = vec2((bakeUv.x * 2.0 - 1.0) * TOXIC_VOLCANO_EXTENT.x, bakeUv.y * TOXIC_VOLCANO_EXTENT.y);
    vec3 d = vec3(v.x * volcanoFrame.y + volcanoFrame.x, 0.0, -1.0);
    // Eruption light is mirrored at 60%, like Twilight's restrained flare reflections.
    vec4 volcano = toxicVolcanoLayer(v, bakePixel, toxicMist(d), 0.6);
    gl_FragColor = vec4(sqrt(clamp(volcano.rgb / TOXIC_BAKE_RANGE, 0.0, 1.0)), volcano.a);
  }
`;
function latticeValue(x: number, y: number, seed: number) {
  let hash = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

function tileableFbm(size: number, period: number, seed: number, ridged: boolean) {
  const values = new Float32Array(size * size);
  let amplitude = 0.55;
  for (let octave = 0; octave < 5; octave++) {
    const cells = period << octave;
    if (cells > size / 2) break;
    const lattice = new Float32Array(cells * cells);
    for (let index = 0; index < lattice.length; index++) {
      lattice[index] = latticeValue(index % cells, Math.floor(index / cells), seed + octave * 101);
    }
    for (let y = 0; y < size; y++) {
      const fy = y / size * cells;
      const y0 = Math.floor(fy);
      const y1 = (y0 + 1) % cells;
      const ty = (fy - y0) * (fy - y0) * (3 - 2 * (fy - y0));
      for (let x = 0; x < size; x++) {
        const fx = x / size * cells;
        const x0 = Math.floor(fx);
        const x1 = (x0 + 1) % cells;
        const tx = (fx - x0) * (fx - x0) * (3 - 2 * (fx - x0));
        const top = lattice[y0 * cells + x0] + (lattice[y0 * cells + x1] - lattice[y0 * cells + x0]) * tx;
        const bottom = lattice[y1 * cells + x0] + (lattice[y1 * cells + x1] - lattice[y1 * cells + x0]) * tx;
        const value = top + (bottom - top) * ty;
        values[y * size + x] += (ridged ? 1 - Math.abs(value * 2 - 1) : value) * amplitude;
      }
    }
    amplitude *= 0.5;
  }
  let low = Infinity;
  let high = -Infinity;
  for (const value of values) {
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  for (let index = 0; index < values.length; index++) values[index] = (values[index] - low) / (high - low);
  return values;
}

// One small seamless CPU-generated noise tile feeds smoke, veils and fire. Unlike a baked render
// target it survives WebGL context restoration without a rebuild.
export function createToxicNoise(size: number) {
  const channels = [
    tileableFbm(size, 4, 11, false),
    tileableFbm(size, 5, 47, false),
    tileableFbm(size, 3, 83, true),
    tileableFbm(size, 6, 131, false),
  ];
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < size * size; index++) {
    for (let channel = 0; channel < 4; channel++) data[index * 4 + channel] = Math.round(channels[channel][index] * 255);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
