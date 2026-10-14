import * as THREE from "three";
import { createTwilightSky, TWILIGHT_SUN, TWILIGHT_ALIEN_SUN, twilightColorShader } from "./twilightSky";
import type { createTwilightState, twilightQuality } from "./twilightRuntime";
import { TWILIGHT_METEOR_PATHS, TWILIGHT_PALETTE_SECONDS } from "./twilightRuntime";

function createRippleNormals() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const modes = Array.from({ length: 18 }, (_, i) => {
    const angle = i * 2.399963;
    const frequency = 2 + i * 1.7;
    return {
      x: Math.round(Math.cos(angle) * frequency),
      y: Math.round(Math.sin(angle) * frequency),
      phase: i * 1.618,
      weight: 0.20 / (1 + i * 0.16),
    };
  });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0;
      let dy = 0;
      for (const mode of modes) {
        const wave = Math.cos((x * mode.x + y * mode.y) / size * Math.PI * 2 + mode.phase) * mode.weight;
        const length = Math.hypot(mode.x, mode.y);
        dx += wave * mode.x / length;
        dy += wave * mode.y / length;
      }
      const length = Math.hypot(dx, dy, 1);
      const offset = (y * size + x) * 4;
      data[offset] = Math.round((dx / length * 0.5 + 0.5) * 255);
      data[offset + 1] = Math.round((dy / length * 0.5 + 0.5) * 255);
      data[offset + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createOceanGrid(columns: number, rows: number) {
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    // Concentrate vertices in the foreground; no huge uniform tessellation at the horizon.
    const depth = 2 * Math.pow(5000, row / rows);
    const halfWidth = 30 + depth * 3;
    for (let column = 0; column <= columns; column++) {
      const index = row * (columns + 1) + column;
      positions[index * 3] = (column / columns * 2 - 1) * halfWidth;
      positions[index * 3 + 2] = -depth;
      if (row < rows && column < columns) {
        const next = index + columns + 1;
        indices.push(index, index + 1, next, index + 1, next + 1, next);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

export function createTwilightOcean(renderer: THREE.WebGLRenderer, quality: ReturnType<typeof twilightQuality>) {
  let skyTarget = createTwilightSky(renderer, quality.reflectionSize);
  const normals = createRippleNormals();
  normals.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const uniforms = {
    skyMap: { value: skyTarget.texture },
    rippleMap: { value: normals },
    time: { value: 0 },
    turbulence: { value: 0.65 },
    chroma: { value: 1 },
    colorEnergy: { value: 0 },
    glintEnergy: { value: 0 },
    waterEnergy: { value: 0 },
    skyTime: { value: 0 },
    palettePhase: { value: 0 },
    meteorProgress: { value: 1 },
    meteorPath: { value: new THREE.Vector4(...TWILIGHT_METEOR_PATHS[0]) },
    sunDirection: { value: TWILIGHT_SUN },
    alienSunDirection: { value: TWILIGHT_ALIEN_SUN },
    sunColor: { value: new THREE.Color() },
    alienSunColor: { value: new THREE.Color() },
  };
  const skyGeometry = new THREE.BoxGeometry(2, 2, 2);
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */`
      varying vec3 direction;
      void main() {
        direction = position;
        vec4 clip = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position = clip.xyww;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 direction;
      ${twilightColorShader}
      void main() {
        gl_FragColor = vec4(skyLight(normalize(direction), 1.0), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  const waterGeometry = createOceanGrid(quality.columns, quality.rows);
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      uniform float time;
      uniform float turbulence;
      varying vec3 worldPosition;
      varying vec2 swellSlope;
      void wave(vec2 p, vec2 direction, float frequency, float amplitude, float speed,
        inout float height, inout vec2 slope) {
        float phase = dot(p, direction) * frequency + time * speed;
        height += sin(phase) * amplitude;
        slope += cos(phase) * amplitude * frequency * direction;
      }
      void main() {
        vec3 p = position;
        float height = 0.0;
        vec2 slope = vec2(0.0);
        wave(p.xz, vec2(0.94, 0.34), 0.43, 0.16, 0.72, height, slope);
        wave(p.xz, vec2(-0.55, 0.83), 0.71, 0.085, 0.93, height, slope);
        wave(p.xz, vec2(0.22, 0.98), 1.13, 0.035, 1.21, height, slope);
        float fade = 1.0 - smoothstep(90.0, 600.0, -p.z);
        p.y = height * turbulence * fade;
        swellSlope = slope * turbulence * fade;
        worldPosition = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D rippleMap;
      uniform float time;
      uniform float turbulence;
      varying vec3 worldPosition;
      varying vec2 swellSlope;
      ${twilightColorShader}
      vec3 reflectedHighlight(vec3 normal, vec3 eye, vec3 lightDirection, vec3 radiance, float sharpness) {
        vec3 halfDirection = normalize(eye + lightDirection);
        float alignment = max(dot(normal, halfDirection), 0.0);
        float highlight = pow(alignment, sharpness);
        float broadHighlight = pow(alignment, 45.0);
        return radiance * (highlight * (0.85 + chroma * glintEnergy * 0.16) + broadHighlight * 0.055);
      }
      void main() {
        vec2 p = worldPosition.xz;
        vec2 a = texture2D(rippleMap, p * 0.031 + time * vec2(0.008, 0.005)).rg * 2.0 - 1.0;
        vec2 b = texture2D(rippleMap, p * 0.067 + time * vec2(-0.006, 0.009)).rg * 2.0 - 1.0;
        vec2 c = texture2D(rippleMap, p * 0.173 + time * vec2(0.009, -0.007)).rg * 2.0 - 1.0;
        float distanceToEye = length(cameraPosition - worldPosition);
        float detail = 1.0 - smoothstep(60.0, 1600.0, distanceToEye);
        vec2 slope = swellSlope + (a * 0.42 + b * 0.25 + c * 0.12) * turbulence * detail;
        vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
        vec3 eye = normalize(cameraPosition - worldPosition);
        // Fade by the undistorted viewing angle, not ripple normals or viewport pixels.
        float solarVisibility = smoothstep(0.012, 0.035, eye.y);
        vec3 reflected = reflect(-eye, normal);
        reflected.y = max(reflected.y, 0.002);
        vec3 reflection = skyLight(normalize(reflected), solarVisibility);
        float facing = max(dot(normal, eye), 0.0);
        float fresnel = 0.025 + 0.975 * pow(1.0 - facing, 5.0);
        vec3 body = vec3(0.018, 0.025, 0.063) + twilightTreatment(vec3(0.12, 0.025, 0.16)) * 0.075;
        vec3 sun = reflectedHighlight(normal, eye, sunDirection, orangeRadiance(), 380.0)
          + reflectedHighlight(normal, eye, alienSunDirection, alienRadiance(), 240.0);
        vec3 color = mix(body, reflection, fresnel) + sun * solarVisibility;
        float haze = smoothstep(180.0, 7000.0, distanceToEye) * 0.4;
        // Match the actual sky at the finite grid edge, including fractional-pixel horizons.
        haze = mix(haze, 1.0, 1.0 - smoothstep(0.001, 0.012, eye.y));
        vec3 horizon = normalize(vec3(-eye.x, 0.0, -eye.z));
        color = mix(color, twilightTreatment(atmosphereLight(horizon, vec2(0.0))), haze);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(sky, water);
  return {
    scene,
    restoreSky() {
      skyTarget.dispose();
      skyTarget = createTwilightSky(renderer, quality.reflectionSize);
      uniforms.skyMap.value = skyTarget.texture;
    },
    update(state: ReturnType<typeof createTwilightState>, chromaEnabled: boolean) {
      uniforms.time.value = state.time;
      uniforms.turbulence.value = 0.65 + state.waterEnergy * 0.85;
      uniforms.chroma.value = chromaEnabled ? 1 : 0;
      uniforms.colorEnergy.value = chromaEnabled ? state.colorEnergy : 0;
      uniforms.glintEnergy.value = chromaEnabled ? state.glintEnergy : 0;
      uniforms.waterEnergy.value = state.waterEnergy;
      uniforms.skyTime.value = state.skyTime;
      const palettePhase = chromaEnabled ? 0.5 - 0.5 * Math.cos(state.paletteTime / TWILIGHT_PALETTE_SECONDS * Math.PI * 2) : 0;
      uniforms.palettePhase.value = palettePhase;
      const kick = chromaEnabled ? state.kickEnergy : 0;
      uniforms.sunColor.value.setHSL(0.075 - kick * 0.12 + palettePhase * 0.045, 0.94, 0.48);
      uniforms.alienSunColor.value.setHSL(0.315 + kick * 0.23 + palettePhase * 0.06, 0.92, 0.44);
      uniforms.meteorProgress.value = chromaEnabled ? state.meteorProgress : 1;
      const [startX, startY, endX, endY] = TWILIGHT_METEOR_PATHS[Math.max(0, state.meteorCount - 1) % TWILIGHT_METEOR_PATHS.length];
      uniforms.meteorPath.value.set(startX, startY, endX, endY);
    },
    dispose() {
      scene.clear();
      skyGeometry.dispose();
      skyMaterial.dispose();
      waterGeometry.dispose();
      waterMaterial.dispose();
      normals.dispose();
      skyTarget.dispose();
    },
  };
}
