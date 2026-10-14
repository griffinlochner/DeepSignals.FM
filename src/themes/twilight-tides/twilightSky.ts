import * as THREE from "three";

export const TWILIGHT_SUN = new THREE.Vector3(-0.12, 0.045, -1).normalize();
export const TWILIGHT_ALIEN_SUN = new THREE.Vector3(0.13, 0.15, -1).normalize();

// The visible sky and reflected sky use exactly the same linear-light treatment.
export const twilightColorShader = /* glsl */`
  uniform samplerCube skyMap;
  uniform float chroma;
  uniform float colorEnergy;
  uniform float glintEnergy;
  uniform float skyTime;
  uniform float palettePhase;
  uniform float waterEnergy;
  uniform float meteorProgress;
  uniform vec4 meteorPath;
  uniform vec3 sunDirection;
  uniform vec3 alienSunDirection;
  uniform vec3 sunColor;
  uniform vec3 alienSunColor;

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
  vec3 atmosphereLight(vec3 d, vec2 clouds) {
    float height = max(d.y, 0.0);
    float sunFacing = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)),
      normalize(vec3(sunDirection.x, 0.0, sunDirection.z))), 0.0), 6.0);
    float cycle = chroma * palettePhase;
    vec3 horizon = mix(vec3(0.55, 0.105, 0.17), vec3(1.0, 0.32, 0.075), sunFacing);
    horizon = mix(horizon, vec3(0.85, 0.12, 0.24), chroma * (0.12 + colorEnergy * 0.12));
    horizon = mix(horizon, mix(vec3(0.25, 0.055, 0.23), vec3(0.8, 0.16, 0.33), sunFacing), cycle);
    vec3 color = mix(horizon, mix(vec3(0.63, 0.07, 0.23), vec3(0.25, 0.11, 0.43), cycle), smoothstep(0.0, 0.12, height));
    color = mix(color, mix(vec3(0.22, 0.025, 0.22), vec3(0.055, 0.06, 0.24), cycle), smoothstep(0.08, 0.23, height));
    color = mix(color, mix(vec3(0.017, 0.009, 0.06), vec3(0.012, 0.017, 0.06), cycle), smoothstep(0.18, 0.32, height));
    color = mix(color, vec3(0.0015, 0.003, 0.014), smoothstep(0.28, 0.46, height));
    vec3 cloudColor = mix(vec3(0.22, 0.035, 0.18), vec3(1.0, 0.30, 0.21),
      exp(-height * 4.0) * (0.4 + 0.6 * sunFacing));
    cloudColor = mix(cloudColor, cloudColor * vec3(0.8, 0.65, 1.45), chroma * 0.2);
    cloudColor = mix(cloudColor, mix(vec3(0.055, 0.045, 0.22), vec3(0.38, 0.30, 0.6),
      exp(-height * 4.0) * (0.4 + 0.6 * sunFacing)), cycle);
    color = mix(color, cloudColor, clouds.x * 0.55);
    color += vec3(0.09, 0.012, 0.065) * clouds.y * (1.0 + chroma * colorEnergy * 0.65);
    float sunAngle = acos(clamp(dot(d, sunDirection), -1.0, 1.0));
    float alienAngle = acos(clamp(dot(d, alienSunDirection), -1.0, 1.0));
    color += orangeRadiance() * 0.27 * exp(-sunAngle * 12.0);
    color += alienRadiance() * 0.065 * exp(-alienAngle * 22.0) * (1.0 + chroma * colorEnergy);
    return color;
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
  vec3 skyLight(vec3 direction, float solarVisibility) {
    vec3 d = normalize(direction);
    vec2 clouds = twilightClouds(d);
    vec3 color = twilightTreatment(atmosphereLight(d, clouds));
    float sunAngle = acos(clamp(dot(d, sunDirection), -1.0, 1.0));
    float alienAngle = acos(clamp(dot(d, alienSunDirection), -1.0, 1.0));
    float sunEdge = max(fwidth(sunAngle), 0.0006);
    float alienEdge = max(fwidth(alienAngle), 0.0006);
    float sunDisc = 1.0 - smoothstep(0.017 - sunEdge, 0.017 + sunEdge, sunAngle);
    float alienDisc = 1.0 - smoothstep(0.032 - alienEdge, 0.032 + alienEdge, alienAngle);
    color = mix(color, orangeRadiance() * (0.82 + chroma * 0.18), sunDisc * solarVisibility);
    float limb = 0.7 + 0.3 * sqrt(max(0.0, 1.0 - pow(alienAngle / 0.032, 2.0)));
    color = mix(color, alienRadiance() * limb * (0.82 + chroma * 0.18), alienDisc * solarVisibility);
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
