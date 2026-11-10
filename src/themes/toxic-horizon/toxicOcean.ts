import * as THREE from "three";
import { createToxicNoise, toxicColorShader, toxicVolcanoBakeShader } from "./toxicSky";
import { TOXIC_VOLCANO, toxicVolcanoFrame } from "./toxicRuntime";
import type { createToxicState, toxicQuality } from "./toxicRuntime";

// Same generated ripple normals as Twilight Tides.
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

export function createToxicOcean(renderer: THREE.WebGLRenderer, quality: ReturnType<typeof toxicQuality>) {
  const normals = createRippleNormals();
  normals.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const noise = createToxicNoise(quality.noiseSize);
  // The volcano layer for reflections only: one small quad per frame instead of the full analytic
  // mountain at every rippled water fragment. Mipmaps filter it under strong ripples.
  const volcanoTarget = new THREE.WebGLRenderTarget(quality.bakeWidth, quality.bakeHeight, {
    type: THREE.UnsignedByteType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const uniforms = {
    noiseMap: { value: noise },
    volcanoMap: { value: volcanoTarget.texture },
    bakePixel: { value: 2.2 / quality.bakeWidth },
    rippleMap: { value: normals },
    time: { value: 0 },
    turbulence: { value: 0.65 },
    chroma: { value: 1 },
    colorEnergy: { value: 0 },
    glintEnergy: { value: 0 },
    auroraBass: { value: 0 },
    auroraMids: { value: 0 },
    auroraHighs: { value: 0 },
    waterEnergy: { value: 0 },
    skyTime: { value: 0 },
    magmaTime: { value: 0 },
    fissureGlow: { value: 0 },
    moltenPulse: { value: 0 },
    moltenTrail: { value: 0 },
    sparkEnergy: { value: 0 },
    eruption: { value: 0 },
    eruptionAge: { value: 0 },
    eruptionPressure: { value: 0 },
    eruptionFountain: { value: 0 },
    eruptionFlare: { value: 0 },
    eruptionFront: { value: 0 },
    eruptionAurora: { value: 0 },
    eruptionLightning: { value: 0 },
    eruptionSeed: { value: new THREE.Vector2() },
    volcanoFrame: { value: new THREE.Vector2(0.06, 1) },
    craterDirection: { value: new THREE.Vector3(0.06, TOXIC_VOLCANO.craterHeight, -1).normalize() },
  };
  const defines = { TOXIC_AURORA_LAYERS: quality.auroraLayers, TOXIC_EJECTA: quality.ejecta };
  const skyGeometry = new THREE.BoxGeometry(2, 2, 2);
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms,
    defines,
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
      ${toxicColorShader}
      void main() {
        gl_FragColor = vec4(toxicSkyLight(normalize(direction), 1.0), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  const waterGeometry = createOceanGrid(quality.columns, quality.rows);
  const bakeGeometry = new THREE.PlaneGeometry(2, 2);
  const bakeMaterial = new THREE.ShaderMaterial({
    uniforms,
    defines,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    vertexShader: /* glsl */`
      varying vec2 bakeUv;
      void main() {
        bakeUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: toxicVolcanoBakeShader,
  });
  const bakeQuad = new THREE.Mesh(bakeGeometry, bakeMaterial);
  bakeQuad.frustumCulled = false;
  const bakeScene = new THREE.Scene();
  bakeScene.add(bakeQuad);
  const bakeCamera = new THREE.Camera();
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms,
    defines: { ...defines, TOXIC_BAKED_VOLCANO: "" },
    // Twilight Tides' three low-amplitude foreground swells, plus the swell height for the slime body.
    vertexShader: /* glsl */`
      uniform float time;
      uniform float turbulence;
      varying vec3 worldPosition;
      varying vec2 swellSlope;
      varying float swellHeight;
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
        swellHeight = height * fade;
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
      varying float swellHeight;
      ${toxicColorShader}
      // Twilight's directional sun highlight, re-aimed at the crater: a tight molten core
      // inside a broader magma lobe, broken up by the same ripple normals.
      vec3 craterGlitter(vec3 normal, vec3 eye) {
        float alignment = max(dot(normal, normalize(eye + craterDirection)), 0.0);
        float boost = toxicCraterHeat() * (1.0 + eruptionFountain * (0.4 + chroma * 0.6));
        // Past its ambient level the path gains magma colour rather than bleaching to white.
        vec3 molten = toxicEmber() * min(boost, 1.6) + toxicMagma() * clamp(boost - 1.2, 0.0, 1.4) * 0.22;
        return molten * pow(alignment, 260.0) * (0.8 + chroma * glintEnergy * 0.16)
          + toxicMagma() * pow(alignment, 60.0) * 0.03 * min(boost, 2.4);
      }
      void main() {
        vec2 p = worldPosition.xz;
        vec2 a = texture2D(rippleMap, p * 0.031 + time * vec2(0.008, 0.005)).rg * 2.0 - 1.0;
        vec2 b = texture2D(rippleMap, p * 0.067 + time * vec2(-0.006, 0.009)).rg * 2.0 - 1.0;
        vec2 c = texture2D(rippleMap, p * 0.173 + time * vec2(0.009, -0.007)).rg * 2.0 - 1.0;
        float distanceToEye = length(cameraPosition - worldPosition);
        float detail = 1.0 - smoothstep(60.0, 1600.0, distanceToEye);
        // Thick liquid: the finest ripple layer carries less weight than in Twilight's water.
        vec2 slope = swellSlope + (a * 0.44 + b * 0.25 + c * 0.08) * turbulence * detail;
        vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
        vec3 eye = normalize(cameraPosition - worldPosition);
        // Fade by the undistorted viewing angle, not ripple normals or viewport pixels.
        float glowVisibility = smoothstep(0.012, 0.035, eye.y);
        vec3 reflected = reflect(-eye, normal);
        // Facets tipped away mirror more slime, not the bright horizon line.
        float selfReflection = smoothstep(0.0, -0.08, reflected.y) * 0.75;
        reflected.y = max(reflected.y, 0.002);
        reflected = normalize(reflected);
        vec3 reflection = toxicSkyLight(reflected, 0.5);
        // Nearby facets would otherwise trace the thin bright horizon band as contour lines.
        reflection *= mix(1.0, mix(0.4, 1.0, smoothstep(0.0, 0.07, reflected.y)), detail);
        float facing = max(dot(normal, eye), 0.0);
        float fresnel = 0.025 + 0.975 * pow(1.0 - facing, 5.0);
        // Luminous slime: facets tilted toward the viewer glow, troughs stay near-black.
        float tilt = dot(normal.xz, normalize(eye.xz));
        float crest = smoothstep(-0.04, 0.36, tilt);
        vec3 slime = mix(vec3(0.006, 0.22, 0.03), vec3(0.28, 0.92, 0.045), crest * crest) * crest * sqrt(crest);
        float cyanAccent = smoothstep(0.15, 0.6, a.x * b.y * 6.0);
        float violetAccent = smoothstep(0.15, 0.6, -a.y * b.x * 6.0);
        slime = mix(slime, slime.g * vec3(0.08, 0.72, 0.95), chroma * cyanAccent * crest * 0.4);
        slime = mix(slime, slime.g * vec3(0.48, 0.16, 1.0), chroma * violetAccent * crest * 0.3);
        float luminous = 0.42 + chroma * (0.38 + colorEnergy * 0.55 + glintEnergy * 0.3);
        vec3 body = mix(vec3(0.0012, 0.008, 0.0035), vec3(0.004, 0.060, 0.018),
          smoothstep(-0.12, 0.2, swellHeight) * 0.7 + crest * 0.3);
        body = toxicTreatment(body);
        // The glow is emitted, not mirrored, so grazing angles dim it only partly: green reaches the horizon.
        vec3 color = mix(body, mix(reflection, body, selfReflection), fresnel) + slime * luminous * (1.0 - fresnel * 0.65);
        color += craterGlitter(normal, eye) * glowVisibility;
        float haze = smoothstep(180.0, 7000.0, distanceToEye) * 0.4;
        // Match the actual sky at the finite grid edge, including fractional-pixel horizons.
        haze = mix(haze, 1.0, 1.0 - smoothstep(0.001, 0.012, eye.y));
        vec3 horizon = normalize(vec3(-eye.x, 0.0, -eye.z));
        color = mix(color, toxicTreatment(toxicAtmosphere(horizon)), haze);
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
    setAspect(aspect: number) {
      const frame = toxicVolcanoFrame(aspect);
      uniforms.volcanoFrame.value.set(frame.centerX, frame.scale);
      uniforms.craterDirection.value.set(frame.centerX, TOXIC_VOLCANO.craterHeight * frame.scale, -1).normalize();
    },
    update(state: ReturnType<typeof createToxicState>, chromaEnabled: boolean) {
      const phases = state.surge.phases;
      uniforms.time.value = state.time;
      uniforms.turbulence.value = 0.65 + state.waterEnergy * 0.7 + state.swellEnergy * 0.2;
      uniforms.chroma.value = chromaEnabled ? 1 : 0;
      uniforms.colorEnergy.value = chromaEnabled ? state.colorEnergy : 0;
      uniforms.glintEnergy.value = chromaEnabled ? state.glintEnergy : 0;
      uniforms.auroraBass.value = state.auroraBass;
      uniforms.auroraMids.value = state.auroraMids;
      uniforms.auroraHighs.value = state.auroraHighs;
      uniforms.waterEnergy.value = state.waterEnergy;
      uniforms.skyTime.value = state.skyTime;
      uniforms.magmaTime.value = state.magmaTime;
      uniforms.fissureGlow.value = state.fissureGlow;
      uniforms.moltenPulse.value = state.moltenPulse;
      uniforms.moltenTrail.value = state.moltenTrail;
      uniforms.sparkEnergy.value = state.sparkEnergy;
      uniforms.eruption.value = phases.envelope;
      uniforms.eruptionAge.value = state.surge.ageSeconds;
      uniforms.eruptionPressure.value = phases.pressure;
      uniforms.eruptionFountain.value = phases.fountain;
      uniforms.eruptionFlare.value = phases.flare;
      uniforms.eruptionFront.value = phases.front;
      uniforms.eruptionAurora.value = phases.aurora;
      uniforms.eruptionLightning.value = phases.lightning;
      uniforms.eruptionSeed.value.set(state.surge.count % 64, phases.flash);
    },
    render(camera: THREE.Camera) {
      renderer.setRenderTarget(volcanoTarget);
      renderer.render(bakeScene, bakeCamera);
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    },
    dispose() {
      scene.clear();
      bakeScene.clear();
      bakeGeometry.dispose();
      bakeMaterial.dispose();
      volcanoTarget.dispose();
      skyGeometry.dispose();
      skyMaterial.dispose();
      waterGeometry.dispose();
      waterMaterial.dispose();
      normals.dispose();
      noise.dispose();
    },
  };
}
