import * as THREE from "three";

export const TWILIGHT_SUN = new THREE.Vector3(-0.12, 0.045, -1).normalize();

// The visible sky and reflected sky use exactly the same linear-light treatment.
export const twilightColorShader = /* glsl */`
  uniform samplerCube skyMap;
  uniform float chroma;
  uniform float colorEnergy;
  uniform vec3 sunDirection;
  vec3 skyLight(vec3 direction) {
    direction = normalize(direction);
    vec3 color = textureCube(skyMap, direction).rgb;
    float sunAngle = acos(clamp(dot(direction, sunDirection), -1.0, 1.0));
    float edge = max(fwidth(sunAngle), 0.0006);
    color = mix(color, vec3(1.0, 0.79, 0.44), 1.0 - smoothstep(0.017 - edge, 0.017 + edge, sunAngle));
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luminance), color, mix(0.72, 1.12, chroma));
    return max(color, vec3(0.0)) * (0.86 + chroma * (0.14 + colorEnergy * 0.22));
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
    uniforms: { sunDirection: { value: TWILIGHT_SUN } },
    vertexShader: /* glsl */`
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 direction;
      uniform vec3 sunDirection;
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
        float sunFacing = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)),
          normalize(vec3(sunDirection.x, 0.0, sunDirection.z))), 0.0), 6.0);
        vec3 horizon = mix(vec3(0.55, 0.105, 0.17), vec3(1.0, 0.32, 0.075), sunFacing);
        vec3 color = mix(horizon, vec3(0.63, 0.07, 0.23), smoothstep(0.0, 0.12, height));
        color = mix(color, vec3(0.22, 0.025, 0.22), smoothstep(0.08, 0.23, height));
        color = mix(color, vec3(0.035, 0.016, 0.105), smoothstep(0.18, 0.34, height));
        color = mix(color, vec3(0.006, 0.014, 0.048), smoothstep(0.30, 0.56, height));

        // A directional cloud layer stays continuous across all six cubemap faces.
        vec2 p = d.xz / (0.22 + height) * 2.1;
        float warp = cloudNoise(p * 0.7);
        float clouds = cloudNoise(p * vec2(1.1, 3.6) + warp * 1.8);
        float wisps = smoothstep(0.46, 0.76, clouds);
        float cloudMask = smoothstep(0.025, 0.13, height) * (1.0 - smoothstep(0.55, 0.9, height));
        vec3 cloudColor = mix(vec3(0.32, 0.055, 0.20), vec3(1.0, 0.30, 0.21),
          exp(-height * 4.0) * (0.4 + 0.6 * sunFacing));
        color = mix(color, cloudColor, wisps * cloudMask * 0.55 * (1.0 - smoothstep(0.25, 0.6, height)));
        float veil = pow(0.5 + 0.5 * sin(height * 48.0 + warp * 6.0), 6.0);
        color += vec3(0.09, 0.012, 0.065) * veil * cloudMask * wisps;
        float sunAngle = acos(clamp(dot(d, sunDirection), -1.0, 1.0));
        color += vec3(0.30, 0.10, 0.035) * exp(-sunAngle * 12.0);
        gl_FragColor = vec4(color, 1.0);
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
