import * as THREE from "three";
import { twilightAuroraShader } from "./twilightAurora";
import { twilightSurgeShader } from "./twilightSurge";

export const TWILIGHT_SUN = new THREE.Vector3(-0.12, 0.045, -1).normalize();
export const TWILIGHT_ALIEN_SUN = new THREE.Vector3(0.13, 0.15, -1).normalize();

const paletteStops = [
  {
    horizonAwayColor: new THREE.Color(0.55, 0.105, 0.17), horizonColor: new THREE.Color(1.0, 0.32, 0.075),
    lowSkyColor: new THREE.Color(0.63, 0.07, 0.23), midSkyColor: new THREE.Color(0.22, 0.025, 0.22),
    highSkyColor: new THREE.Color(0.017, 0.009, 0.06),
    cloudShadowColor: new THREE.Color(0.22, 0.035, 0.18), cloudLightColor: new THREE.Color(1.0, 0.30, 0.21),
    cloudVeilColor: new THREE.Color(0.09, 0.012, 0.065),
    sunColor: new THREE.Color(1.10, 0.46, 0.055), alienSunColor: new THREE.Color(0.12, 0.90, 0.025),
  },
  {
    horizonAwayColor: new THREE.Color(0.24, 0.04, 0.23), horizonColor: new THREE.Color(0.70, 0.12, 0.25),
    lowSkyColor: new THREE.Color(0.16, 0.07, 0.42), midSkyColor: new THREE.Color(0.025, 0.025, 0.19),
    highSkyColor: new THREE.Color(0.006, 0.012, 0.045),
    cloudShadowColor: new THREE.Color(0.10, 0.025, 0.17), cloudLightColor: new THREE.Color(0.44, 0.18, 0.52),
    cloudVeilColor: new THREE.Color(0.05, 0.018, 0.07),
    sunColor: new THREE.Color(1.05, 0.38, 0.055), alienSunColor: new THREE.Color(0.03, 0.90, 0.24),
  },
  {
    horizonAwayColor: new THREE.Color(0.12, 0.035, 0.27), horizonColor: new THREE.Color(0.30, 0.09, 0.48),
    lowSkyColor: new THREE.Color(0.07, 0.30, 0.12), midSkyColor: new THREE.Color(0.015, 0.14, 0.065),
    highSkyColor: new THREE.Color(0.004, 0.020, 0.026),
    cloudShadowColor: new THREE.Color(0.018, 0.095, 0.08), cloudLightColor: new THREE.Color(0.35, 0.52, 0.10),
    cloudVeilColor: new THREE.Color(0.015, 0.07, 0.035),
    sunColor: new THREE.Color(1.08, 0.50, 0.075), alienSunColor: new THREE.Color(0.075, 0.30, 1.10),
  },
  {
    horizonAwayColor: new THREE.Color(0.35, 0.045, 0.17), horizonColor: new THREE.Color(1.0, 0.20, 0.105),
    lowSkyColor: new THREE.Color(0.035, 0.28, 0.34), midSkyColor: new THREE.Color(0.014, 0.095, 0.17),
    highSkyColor: new THREE.Color(0.006, 0.012, 0.04),
    cloudShadowColor: new THREE.Color(0.035, 0.07, 0.14), cloudLightColor: new THREE.Color(0.60, 0.18, 0.26),
    cloudVeilColor: new THREE.Color(0.035, 0.05, 0.09),
    sunColor: new THREE.Color(1.10, 0.40, 0.05), alienSunColor: new THREE.Color(0.20, 1.0, 0.04),
  },
];

export function createTwilightPalette() {
  return {
    horizonAwayColor: paletteStops[0].horizonAwayColor.clone(), horizonColor: paletteStops[0].horizonColor.clone(),
    lowSkyColor: paletteStops[0].lowSkyColor.clone(), midSkyColor: paletteStops[0].midSkyColor.clone(),
    highSkyColor: paletteStops[0].highSkyColor.clone(),
    cloudShadowColor: paletteStops[0].cloudShadowColor.clone(), cloudLightColor: paletteStops[0].cloudLightColor.clone(),
    cloudVeilColor: paletteStops[0].cloudVeilColor.clone(),
    sunColor: paletteStops[0].sunColor.clone(), alienSunColor: paletteStops[0].alienSunColor.clone(),
  };
}

const paletteKeys = [
  "horizonAwayColor", "horizonColor", "lowSkyColor", "midSkyColor", "highSkyColor",
  "cloudShadowColor", "cloudLightColor", "cloudVeilColor", "sunColor", "alienSunColor",
] as const;

export function updateTwilightPalette(palette: ReturnType<typeof createTwilightPalette>, phase: number) {
  const position = THREE.MathUtils.euclideanModulo(phase, 1) * paletteStops.length;
  const index = Math.floor(position);
  const blend = THREE.MathUtils.smoothstep(position - index, 0, 1);
  for (const key of paletteKeys) {
    palette[key].lerpColors(paletteStops[index][key], paletteStops[(index + 1) % paletteStops.length][key], blend);
  }
}

// The visible sky and reflected sky use exactly the same linear-light treatment.
export const twilightColorShader = /* glsl */`
  uniform samplerCube skyMap;
  uniform float chroma;
  uniform float colorEnergy;
  uniform float glintEnergy;
  uniform float skyTime;
  uniform float waterEnergy;
  uniform float meteorProgress;
  uniform vec4 meteorPath;
  uniform vec3 sunDirection;
  uniform vec3 alienSunDirection;
  uniform vec3 sunColor;
  uniform vec3 alienSunColor;
  uniform vec3 horizonAwayColor;
  uniform vec3 horizonColor;
  uniform vec3 lowSkyColor;
  uniform vec3 midSkyColor;
  uniform vec3 highSkyColor;
  uniform vec3 cloudShadowColor;
  uniform vec3 cloudLightColor;
  uniform vec3 cloudVeilColor;

  ${twilightAuroraShader}
  ${twilightSurgeShader}

  vec3 orangeRadiance() {
    return sunColor;
  }
  vec3 alienRadiance() {
    return alienSunColor;
  }
  vec3 twilightTreatment(vec3 color) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luminance), color, mix(0.72, 1.12, chroma));
    return max(color, vec3(0.0)) * (0.82 + chroma * (0.18 + colorEnergy * 0.55));
  }
  vec2 twilightClouds(vec3 d) {
    float height = max(d.y, 0.0);
    float mask = smoothstep(0.025, 0.13, height) * (1.0 - smoothstep(0.28, 0.55, height));
    float angle = skyTime * 0.025;
    vec3 drift = d;
    drift.xz = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * d.xz;
    drift.y += sin(d.x * 5.0 + skyTime * 0.12) * 0.008 * mask;
    return textureCube(skyMap, normalize(drift)).rg * mask;
  }
  float twilightSunFacing(vec3 d) {
    return pow(max(dot(normalize(vec3(d.x, 0.0, d.z)),
      normalize(vec3(sunDirection.x, 0.0, sunDirection.z))), 0.0), 6.0);
  }
  vec3 atmosphereLight(vec3 d) {
    float height = max(d.y, 0.0);
    vec3 horizon = mix(horizonAwayColor, horizonColor, twilightSunFacing(d));
    horizon = mix(horizon, lowSkyColor, chroma * (0.12 + colorEnergy * 0.12));
    vec3 color = mix(horizon, lowSkyColor, smoothstep(0.0, 0.12, height));
    color = mix(color, midSkyColor, smoothstep(0.08, 0.23, height));
    color = mix(color, highSkyColor, smoothstep(0.18, 0.32, height));
    color = mix(color, vec3(0.0015, 0.003, 0.014), smoothstep(0.28, 0.46, height));
    float sunAngle = acos(clamp(dot(d, sunDirection), -1.0, 1.0));
    float alienAngle = acos(clamp(dot(d, alienSunDirection), -1.0, 1.0));
    color += orangeRadiance() * 0.27 * exp(-sunAngle * 12.0);
    color += alienRadiance() * 0.065 * exp(-alienAngle * 22.0);
    return color;
  }
  float twilightCloudOpacity(vec2 clouds) {
    return min(0.58, clouds.x * 0.55 + clouds.y * 0.12);
  }
  vec3 cloudLight(vec3 d) {
    vec3 color = mix(cloudShadowColor, cloudLightColor,
      exp(-max(d.y, 0.0) * 4.0) * (0.4 + 0.6 * twilightSunFacing(d)));
    return mix(color, color * vec3(0.8, 0.65, 1.45), chroma * 0.2);
  }
  vec3 celestialBody(vec3 background, vec3 radiance, float angle, float radius, float visibility) {
    float edge = max(fwidth(angle), radius * 0.12);
    float disc = 1.0 - smoothstep(radius - edge, radius + edge, angle);
    float limb = 0.64 + 0.36 * sqrt(max(0.0, 1.0 - pow(angle / radius, 2.0)));
    float halo = exp(-pow(angle / (radius * 1.8), 2.0)) * 0.09;
    background += radiance * halo * visibility;
    return mix(background, radiance * limb * (0.82 + chroma * 0.18), disc * visibility);
  }
  float starHash(vec2 cell) {
    return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  }
  vec3 starlight(vec3 d, float cloudCover) {
    if (d.y < 0.22) return vec3(0.0);
    vec2 coordinates = vec2(atan(d.x, -d.z), asin(clamp(d.y, -1.0, 1.0))) * 90.0;
    vec2 cell = floor(coordinates);
    float seed = starHash(cell);
    vec2 center = vec2(starHash(cell + 17.3), starHash(cell - 9.1)) * 0.6 + 0.2;
    float radius = mix(0.025, 0.065, starHash(cell + 5.7));
    float aa = max(length(fwidth(coordinates)), 0.001);
    float point = 1.0 - smoothstep(max(0.0, radius - aa * 0.5), radius + aa * 0.5, length(fract(coordinates) - center));
    float twinkle = 0.88 + chroma * waterEnergy * 0.12 * sin(skyTime * 1.4 + seed * 90.0);
    float visibility = smoothstep(0.22, 0.35, d.y) * (1.0 - cloudCover * 0.8);
    float stars = point * step(0.955, seed) * twinkle * visibility * (1.0 - smoothstep(0.3, 1.0, aa));
    return vec3(0.42, 0.48, 0.61) * stars;
  }
  vec3 shootingStar(vec3 d) {
    if (meteorProgress >= 1.0 || d.z >= 0.0 || d.y < 0.20) return vec3(0.0);
    vec2 p = d.xy / -d.z;
    vec2 head = mix(meteorPath.xy, meteorPath.zw, meteorProgress);
    vec2 tail = mix(meteorPath.xy, meteorPath.zw, max(0.0, meteorProgress - 0.18));
    vec2 line = head - tail;
    float along = clamp(dot(p - tail, line) / max(dot(line, line), 0.000001), 0.0, 1.0);
    float distanceToTrail = length(p - tail - line * along);
    float aa = max(length(fwidth(p)), 0.0001);
    float trail = 1.0 - smoothstep(0.0003, 0.0006 + aa, distanceToTrail);
    float fade = smoothstep(0.0, 0.16, meteorProgress) * (1.0 - smoothstep(0.55, 1.0, meteorProgress));
    return vec3(0.45, 0.65, 0.57) * trail * along * fade * chroma * waterEnergy * 0.55;
  }
  vec3 skyLight(vec3 d, float solarVisibility, vec2 clouds, float auroraVisibility, float flareVisibility) {
    vec3 color = twilightTreatment(atmosphereLight(d));
    float sunAngle = acos(clamp(dot(d, sunDirection), -1.0, 1.0));
    float alienAngle = acos(clamp(dot(d, alienSunDirection), -1.0, 1.0));
    vec4 aurora = auroraLight(d, sunAngle, alienAngle) * auroraVisibility;
    color = color * (1.0 - min(0.65, aurora.a)) + aurora.rgb;
    float pixelWidth = length(fwidth(d));
    if (solarSurge > 0.0) {
      vec3 flares = solarSignal(d, sunDirection, orangeRadiance(), 0.017 * solarScale, 1.0, pixelWidth)
        + solarSignal(d, alienSunDirection, alienRadiance(), 0.032 * solarScale, -1.0, pixelWidth);
      color += flares * solarVisibility * flareVisibility;
    }
    color = celestialBody(color, orangeRadiance(), sunAngle, 0.017 * solarScale, solarVisibility);
    color = celestialBody(color, alienRadiance(), alienAngle, 0.032 * solarScale, solarVisibility);
    // Thin cloud veils pass in front of both bodies without fully extinguishing them.
    color = mix(color, twilightTreatment(cloudLight(d)), twilightCloudOpacity(clouds));
    color += twilightTreatment(cloudVeilColor) * clouds.y * (1.0 + chroma * colorEnergy * 0.65);
    color += twilightTreatment(starlight(d, clouds.x) + shootingStar(d) * (1.0 - clouds.x * 0.75));
    return color;
  }
`;

export function createTwilightSky(renderer: THREE.WebGLRenderer, resolution: number) {
  const target = new THREE.WebGLCubeRenderTarget(resolution, {
    type: THREE.UnsignedByteType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    depthBuffer: false,
  });
  const geometry = new THREE.BoxGeometry(10, 10, 10);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */`
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 direction;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 cell = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
          mix(hash(cell + vec2(0.0, 1.0)), hash(cell + 1.0), f.x), f.y);
      }
      float cloudNoise(vec2 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int octave = 0; octave < 5; octave++) {
          value += noise(p) * amplitude;
          p = mat2(1.6, -1.2, 1.2, 1.6) * p + 7.3;
          amplitude *= 0.48;
        }
        return value;
      }
      void main() {
        vec3 d = normalize(direction);
        float height = max(d.y, 0.0);
        // A directional cloud layer stays continuous across all six cubemap faces.
        vec2 p = d.xz / (0.22 + height) * 2.1;
        float warp = cloudNoise(p * 0.7);
        float clouds = cloudNoise(p * vec2(1.1, 3.6) + warp * 1.8);
        float wisps = smoothstep(0.46, 0.76, clouds);
        float veil = pow(0.5 + 0.5 * sin(height * 48.0 + warp * 6.0), 6.0);
        gl_FragColor = vec4(wisps, veil * wisps, 0.0, 1.0);
      }
    `,
  });
  const bakeScene = new THREE.Scene();
  bakeScene.add(new THREE.Mesh(geometry, material));
  const cubeCamera = new THREE.CubeCamera(0.1, 20, target);
  cubeCamera.update(renderer, bakeScene);
  geometry.dispose();
  material.dispose();
  bakeScene.clear();
  return target;
}
