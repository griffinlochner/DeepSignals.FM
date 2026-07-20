import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { stepUvJunglePlaybackVisualMix } from "../../../themes/uv-reactive-jungle/uvReactivePlaybackVisuals";
import type {
  EnvironmentDiagnostics,
  EnvironmentLabSceneProps,
  EnvironmentPreset,
  SurfaceGlowHotspot,
  TwinkleHotspot,
} from "../types";

const DIAGNOSTIC_UPDATE_INTERVAL_SECONDS = 0.16;
const DISPLACEMENT_SCALE_MULTIPLIER = 0.36;
const PLAYING_DRIFT_AMOUNT = 0.6;
const PLAYING_DRIFT_SPEED = 0.58;
const POINTER_IDLE_TIMEOUT_SECONDS = 1.25;
const STOPPED_POINTER_PARALLAX_MULTIPLIER = 0.12;
const SURFACE_GLOW_CAPACITY = 32;

type TwinkleRuntime = {
  sprite: THREE.Sprite;
  hotspot: TwinkleHotspot;
  depthSample: number;
};

type ParticleRuntime = {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  velocities: Float32Array;
  drifts: Float32Array;
};

type SceneCallbacks = {
  onLoadingStateChange?: EnvironmentLabSceneProps["onLoadingStateChange"];
  onDiagnosticsChange?: EnvironmentLabSceneProps["onDiagnosticsChange"];
  onCreateTwinkleHotspot?: EnvironmentLabSceneProps["onCreateTwinkleHotspot"];
  onRemoveNearestTwinkleHotspot?: EnvironmentLabSceneProps["onRemoveNearestTwinkleHotspot"];
  onCreateSurfaceGlowHotspot?: EnvironmentLabSceneProps["onCreateSurfaceGlowHotspot"];
  onRemoveNearestSurfaceGlowHotspot?: EnvironmentLabSceneProps["onRemoveNearestSurfaceGlowHotspot"];
};

type SurfaceGlowUniformState = {
  uSurfaceGlowEnabled: { value: number };
  uSurfaceGlowCount: { value: number };
  uSurfaceGlowGlobalDim: { value: number };
  uSurfaceGlowTime: { value: number };
  uSurfaceGlowUVs: { value: THREE.Vector2[] };
  uSurfaceGlowColors: { value: THREE.Vector3[] };
  uSurfaceGlowRadii: { value: number[] };
  uSurfaceGlowSoftness: { value: number[] };
  uSurfaceGlowIntensity: { value: number[] };
  uSurfaceGlowPulseEnabled: { value: number[] };
  uSurfaceGlowPulseAmount: { value: number[] };
  uSurfaceGlowPulseCycles: { value: number[] };
  uSurfaceGlowPhases: { value: number[] };
};

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createSurfaceGlowUniformState(): SurfaceGlowUniformState {
  return {
    uSurfaceGlowEnabled: { value: 1 },
    uSurfaceGlowCount: { value: 0 },
    uSurfaceGlowGlobalDim: { value: 1 },
    uSurfaceGlowTime: { value: 0 },
    uSurfaceGlowUVs: {
      value: Array.from({ length: SURFACE_GLOW_CAPACITY }, () => new THREE.Vector2(0, 0)),
    },
    uSurfaceGlowColors: {
      value: Array.from({ length: SURFACE_GLOW_CAPACITY }, () => new THREE.Vector3(0, 0, 0)),
    },
    uSurfaceGlowRadii: { value: Array.from({ length: SURFACE_GLOW_CAPACITY }, () => 0) },
    uSurfaceGlowSoftness: { value: Array.from({ length: SURFACE_GLOW_CAPACITY }, () => 0.65) },
    uSurfaceGlowIntensity: { value: Array.from({ length: SURFACE_GLOW_CAPACITY }, () => 0) },
    uSurfaceGlowPulseEnabled: { value: Array.from({ length: SURFACE_GLOW_CAPACITY }, () => 0) },
    uSurfaceGlowPulseAmount: { value: Array.from({ length: SURFACE_GLOW_CAPACITY }, () => 0) },
    uSurfaceGlowPulseCycles: { value: Array.from({ length: SURFACE_GLOW_CAPACITY }, () => 3.5) },
    uSurfaceGlowPhases: { value: Array.from({ length: SURFACE_GLOW_CAPACITY }, () => 0) },
  };
}

function buildEnvironmentFilter(params: {
  playbackMix: number;
  hueOffsetDegrees: number;
  currentSaturation: number;
  glowPulseAmount: number;
}) {
  const grayscale = 1 - params.playbackMix;
  const brightness = 0.85 + params.playbackMix * 0.15 + params.glowPulseAmount;
  const saturation =
    params.playbackMix * params.currentSaturation * (1 + params.glowPulseAmount * 0.7);

  return [
    `grayscale(${grayscale.toFixed(3)})`,
    `hue-rotate(${params.hueOffsetDegrees.toFixed(3)}deg)`,
    `saturate(${Math.max(saturation, 0).toFixed(3)})`,
    `brightness(${Math.max(brightness, 0).toFixed(3)})`,
  ].join(" ");
}

function createDepthSampler(
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
): ((u: number, v: number) => number) | null {
  const canvas = document.createElement("canvas");
  const width = (image as { width?: number }).width;
  const height = (image as { height?: number }).height;

  if (!width || !height) {
    return null;
  }

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);
  const pixelData = context.getImageData(0, 0, width, height).data;

  return (u: number, v: number) => {
    const x = Math.max(0, Math.min(width - 1, Math.round(u * (width - 1))));
    const y = Math.max(0, Math.min(height - 1, Math.round((1 - v) * (height - 1))));
    const index = (y * width + x) * 4;
    return pixelData[index] / 255;
  };
}

function hotspotSignature(hotspots: TwinkleHotspot[]) {
  return hotspots
    .map((hotspot) => {
      return [
        hotspot.id,
        hotspot.u.toFixed(4),
        hotspot.v.toFixed(4),
        hotspot.color ?? "",
        hotspot.size?.toFixed(3) ?? "",
        hotspot.intensity?.toFixed(3) ?? "",
        hotspot.phase?.toFixed(3) ?? "",
      ].join("|");
    })
    .join(";");
}

function surfaceGlowSignature(hotspots: SurfaceGlowHotspot[]) {
  return hotspots
    .map((hotspot) => {
      return [
        hotspot.id,
        hotspot.u.toFixed(4),
        hotspot.v.toFixed(4),
        hotspot.color,
        hotspot.radius.toFixed(4),
        hotspot.softness.toFixed(4),
        hotspot.intensity.toFixed(4),
        hotspot.pulseEnabled ? 1 : 0,
        hotspot.pulseAmount.toFixed(4),
        hotspot.pulseCycleSeconds.toFixed(4),
        hotspot.phase.toFixed(4),
      ].join("|");
    })
    .join(";");
}

function EnvironmentLabScene({
  playbackState,
  twinklePlacementModeEnabled,
  surfaceGlowPlacementModeEnabled,
  preset,
  reducedMotionActive,
  onLoadingStateChange,
  onDiagnosticsChange,
  onCreateTwinkleHotspot,
  onRemoveNearestTwinkleHotspot,
  onCreateSurfaceGlowHotspot,
  onRemoveNearestSurfaceGlowHotspot,
}: EnvironmentLabSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const hazeRef = useRef<HTMLDivElement | null>(null);
  const configRef = useRef({
    playbackState,
    twinklePlacementModeEnabled,
    surfaceGlowPlacementModeEnabled,
    reducedMotionActive,
    preset,
  });
  const callbackRef = useRef<SceneCallbacks>({
    onLoadingStateChange,
    onDiagnosticsChange,
    onCreateTwinkleHotspot,
    onRemoveNearestTwinkleHotspot,
    onCreateSurfaceGlowHotspot,
    onRemoveNearestSurfaceGlowHotspot,
  });

  const placementNote = useMemo(() => {
    if (surfaceGlowPlacementModeEnabled && twinklePlacementModeEnabled) {
      return "Surface Glow and Twinkle placement enabled: click to place Surface Glow, Shift/Alt-click removes nearest Surface Glow.";
    }

    if (surfaceGlowPlacementModeEnabled) {
      return "Surface Glow placement enabled: click to add glow, Shift/Alt-click removes nearest glow.";
    }

    if (twinklePlacementModeEnabled) {
      return "Twinkle placement enabled: click to add twinkle, Shift/Alt-click removes nearest twinkle.";
    }

    return "";
  }, [surfaceGlowPlacementModeEnabled, twinklePlacementModeEnabled]);

  useEffect(() => {
    configRef.current = {
      playbackState,
      twinklePlacementModeEnabled,
      surfaceGlowPlacementModeEnabled,
      reducedMotionActive,
      preset,
    };
  }, [
    playbackState,
    twinklePlacementModeEnabled,
    surfaceGlowPlacementModeEnabled,
    reducedMotionActive,
    preset,
  ]);

  useEffect(() => {
    callbackRef.current = {
      onLoadingStateChange,
      onDiagnosticsChange,
      onCreateTwinkleHotspot,
      onRemoveNearestTwinkleHotspot,
      onCreateSurfaceGlowHotspot,
      onRemoveNearestSurfaceGlowHotspot,
    };
  }, [
    onLoadingStateChange,
    onDiagnosticsChange,
    onCreateTwinkleHotspot,
    onRemoveNearestTwinkleHotspot,
    onCreateSurfaceGlowHotspot,
    onRemoveNearestSurfaceGlowHotspot,
  ]);

  useEffect(() => {
    const mount = mountRef.current;
    const hazeElement = hazeRef.current;

    if (!mount || !hazeElement) {
      return;
    }

    callbackRef.current.onLoadingStateChange?.("loading");

    let animationFrameId = 0;
    let disposed = false;
    let colorTexture: THREE.Texture | null = null;
    let depthTexture: THREE.Texture | null = null;
    let depthSampler: ((u: number, v: number) => number) | null = null;

    const pointerTarget = new THREE.Vector2(0, 0);
    const pointer = new THREE.Vector2(0, 0);
    const blendedPointer = new THREE.Vector2(0, 0);
    const autonomousPointer = new THREE.Vector2(0, 0);
    const planeScale = new THREE.Vector2(1, 1);
    const raycaster = new THREE.Raycaster();
    const ndcPointer = new THREE.Vector2();

    let pointerInfluence = 0;
    let lastPointerInputAt = -100;
    let lastDiagnosticUpdateAt = -100;
    let lastFrameAt = performance.now();
    let elapsedSeconds = 0;
    let playbackVisualMix = 0;
    let huePhase = 0;
    let glowPhase = 0;
    let twinklePhase = 0;
    let hazePhase = 0;
    let saturationPulsePhase = 0;
    let surfaceGlowPulseTimeSeconds = 0;
    let currentHueOffset = 0;
    let currentGlowOffset = 0;
    let currentSaturation = configRef.current.preset.color.saturation;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08110d);
    scene.fog = new THREE.FogExp2(0x08110d, 0.045);

    const camera = new THREE.PerspectiveCamera(
      46,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      80,
    );
    camera.position.z = 3.2;
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.domElement.className = "environment-lab__scene";
    mount.appendChild(renderer.domElement);

    const planeGroup = new THREE.Group();
    scene.add(planeGroup);

    const ambientLight = new THREE.AmbientLight(0xf2ffe7, 1.85);
    const keyLight = new THREE.DirectionalLight(0xf8f6d2, 1.3);
    keyLight.position.set(-2, 2, 3);
    const rimLight = new THREE.DirectionalLight(0x77ffd9, 0.6);
    rimLight.position.set(2, -1, 2);
    scene.add(ambientLight, keyLight, rimLight);

    const planeGeometry = new THREE.PlaneGeometry(1, 1, 320, 224);
    const planeMaterial = new THREE.MeshStandardMaterial({
      displacementScale: 0.18,
      roughness: 1,
      metalness: 0,
    });

    const surfaceGlowUniforms = createSurfaceGlowUniformState();

    planeMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uSurfaceGlowEnabled = surfaceGlowUniforms.uSurfaceGlowEnabled;
      shader.uniforms.uSurfaceGlowCount = surfaceGlowUniforms.uSurfaceGlowCount;
      shader.uniforms.uSurfaceGlowGlobalDim = surfaceGlowUniforms.uSurfaceGlowGlobalDim;
      shader.uniforms.uSurfaceGlowTime = surfaceGlowUniforms.uSurfaceGlowTime;
      shader.uniforms.uSurfaceGlowUVs = surfaceGlowUniforms.uSurfaceGlowUVs;
      shader.uniforms.uSurfaceGlowColors = surfaceGlowUniforms.uSurfaceGlowColors;
      shader.uniforms.uSurfaceGlowRadii = surfaceGlowUniforms.uSurfaceGlowRadii;
      shader.uniforms.uSurfaceGlowSoftness = surfaceGlowUniforms.uSurfaceGlowSoftness;
      shader.uniforms.uSurfaceGlowIntensity = surfaceGlowUniforms.uSurfaceGlowIntensity;
      shader.uniforms.uSurfaceGlowPulseEnabled = surfaceGlowUniforms.uSurfaceGlowPulseEnabled;
      shader.uniforms.uSurfaceGlowPulseAmount = surfaceGlowUniforms.uSurfaceGlowPulseAmount;
      shader.uniforms.uSurfaceGlowPulseCycles = surfaceGlowUniforms.uSurfaceGlowPulseCycles;
      shader.uniforms.uSurfaceGlowPhases = surfaceGlowUniforms.uSurfaceGlowPhases;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vSurfaceUv;",
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <uv_vertex>",
        "#include <uv_vertex>\nvSurfaceUv = uv;",
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
varying vec2 vSurfaceUv;
uniform float uSurfaceGlowEnabled;
uniform int uSurfaceGlowCount;
uniform float uSurfaceGlowGlobalDim;
uniform float uSurfaceGlowTime;
uniform vec2 uSurfaceGlowUVs[${SURFACE_GLOW_CAPACITY}];
uniform vec3 uSurfaceGlowColors[${SURFACE_GLOW_CAPACITY}];
uniform float uSurfaceGlowRadii[${SURFACE_GLOW_CAPACITY}];
uniform float uSurfaceGlowSoftness[${SURFACE_GLOW_CAPACITY}];
uniform float uSurfaceGlowIntensity[${SURFACE_GLOW_CAPACITY}];
uniform float uSurfaceGlowPulseEnabled[${SURFACE_GLOW_CAPACITY}];
uniform float uSurfaceGlowPulseAmount[${SURFACE_GLOW_CAPACITY}];
uniform float uSurfaceGlowPulseCycles[${SURFACE_GLOW_CAPACITY}];
uniform float uSurfaceGlowPhases[${SURFACE_GLOW_CAPACITY}];`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
if (uSurfaceGlowEnabled > 0.5) {
  vec3 surfaceGlowAccum = vec3(0.0);
  for (int i = 0; i < ${SURFACE_GLOW_CAPACITY}; i++) {
    if (i >= uSurfaceGlowCount) {
      break;
    }

    float radius = max(uSurfaceGlowRadii[i], 0.0001);
    float softness = clamp(uSurfaceGlowSoftness[i], 0.05, 0.98);
    float inner = radius * (1.0 - softness);
    float distToGlow = distance(vSurfaceUv, uSurfaceGlowUVs[i]);
    float radialFalloff = 1.0 - smoothstep(inner, radius, distToGlow);

    float pulseIntensity = 1.0;
    if (uSurfaceGlowPulseEnabled[i] > 0.5) {
      float cycle = max(uSurfaceGlowPulseCycles[i], 0.2);
      float wave = sin((uSurfaceGlowTime / cycle) * 6.28318530718 + uSurfaceGlowPhases[i] * 6.28318530718);
      pulseIntensity = 1.0 + (wave * 0.5 + 0.5) * uSurfaceGlowPulseAmount[i];
    }

    surfaceGlowAccum += uSurfaceGlowColors[i] * radialFalloff * uSurfaceGlowIntensity[i] * pulseIntensity;
  }

  diffuseColor.rgb += surfaceGlowAccum * uSurfaceGlowGlobalDim;
}`,
      );
    };
    planeMaterial.needsUpdate = true;

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.z = -0.15;
    planeGroup.add(plane);

    const glowGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x6de0c0,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial);
    glowPlane.position.z = -0.8;
    planeGroup.add(glowPlane);

    const twinkleGroup = new THREE.Group();
    twinkleGroup.position.z = 0.02;
    planeGroup.add(twinkleGroup);

    const particleGroup = new THREE.Group();
    particleGroup.position.z = 0.32;
    planeGroup.add(particleGroup);

    const twinkleRuntimes: TwinkleRuntime[] = [];
    let particlesRuntime: ParticleRuntime | null = null;

    let lastTwinkleSignature = "";
    let lastSurfaceGlowSignature = "";
    let lastParticlesSignature = "";

    const loadingManager = new THREE.LoadingManager();
    const textureLoader = new THREE.TextureLoader(loadingManager);

    loadingManager.onLoad = () => {
      if (!disposed) {
        callbackRef.current.onLoadingStateChange?.("ready");
      }
    };

    loadingManager.onError = () => {
      if (!disposed) {
        callbackRef.current.onLoadingStateChange?.("error");
      }
    };

    const fitPlane = () => {
      const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      const viewHeight =
        2 *
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
        Math.abs(camera.position.z - plane.position.z);
      const viewWidth = viewHeight * aspect;
      planeScale.set(viewWidth * 1.18, viewHeight * 1.28);
      plane.scale.set(planeScale.x, planeScale.y, 1);
      glowPlane.scale.set(planeScale.x * 1.14, planeScale.y * 1.08, 1);
    };

    const toPlanePosition = (u: number, v: number) => {
      const x = (u - 0.5) * planeScale.x;
      const y = (0.5 - v) * planeScale.y;
      return new THREE.Vector3(x, y, 0);
    };

    const syncSurfaceGlowUniforms = (activePreset: EnvironmentPreset) => {
      const activeHotspots = activePreset.surfaceGlows.hotspots.slice(0, SURFACE_GLOW_CAPACITY);
      surfaceGlowUniforms.uSurfaceGlowCount.value = activeHotspots.length;

      for (let index = 0; index < SURFACE_GLOW_CAPACITY; index += 1) {
        const hotspot = activeHotspots[index];

        if (hotspot) {
          surfaceGlowUniforms.uSurfaceGlowUVs.value[index].set(hotspot.u, hotspot.v);
          const color = new THREE.Color(hotspot.color);
          surfaceGlowUniforms.uSurfaceGlowColors.value[index].set(color.r, color.g, color.b);
          surfaceGlowUniforms.uSurfaceGlowRadii.value[index] = hotspot.radius;
          surfaceGlowUniforms.uSurfaceGlowSoftness.value[index] = hotspot.softness;
          surfaceGlowUniforms.uSurfaceGlowIntensity.value[index] = hotspot.intensity;
          surfaceGlowUniforms.uSurfaceGlowPulseEnabled.value[index] = hotspot.pulseEnabled ? 1 : 0;
          surfaceGlowUniforms.uSurfaceGlowPulseAmount.value[index] = hotspot.pulseAmount;
          surfaceGlowUniforms.uSurfaceGlowPulseCycles.value[index] = hotspot.pulseCycleSeconds;
          surfaceGlowUniforms.uSurfaceGlowPhases.value[index] = hotspot.phase;
        } else {
          surfaceGlowUniforms.uSurfaceGlowUVs.value[index].set(0, 0);
          surfaceGlowUniforms.uSurfaceGlowColors.value[index].set(0, 0, 0);
          surfaceGlowUniforms.uSurfaceGlowRadii.value[index] = 0;
          surfaceGlowUniforms.uSurfaceGlowSoftness.value[index] = 0.65;
          surfaceGlowUniforms.uSurfaceGlowIntensity.value[index] = 0;
          surfaceGlowUniforms.uSurfaceGlowPulseEnabled.value[index] = 0;
          surfaceGlowUniforms.uSurfaceGlowPulseAmount.value[index] = 0;
          surfaceGlowUniforms.uSurfaceGlowPulseCycles.value[index] = 3.5;
          surfaceGlowUniforms.uSurfaceGlowPhases.value[index] = 0;
        }
      }
    };

    const clearTwinkles = () => {
      while (twinkleGroup.children.length > 0) {
        const child = twinkleGroup.children.pop();

        if (!child) {
          continue;
        }

        const sprite = child as THREE.Sprite;
        const material = sprite.material;

        if (material instanceof THREE.SpriteMaterial) {
          material.dispose();
        }

        twinkleGroup.remove(sprite);
      }
      twinkleRuntimes.length = 0;
    };

    const rebuildTwinkles = (activePreset: EnvironmentPreset) => {
      clearTwinkles();

      activePreset.twinkles.hotspots.forEach((hotspot) => {
        const color = new THREE.Color(hotspot.color ?? activePreset.twinkles.defaultColor);
        const material = new THREE.SpriteMaterial({
          color,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const sprite = new THREE.Sprite(material);
        const localPosition = toPlanePosition(hotspot.u, hotspot.v);
        const size = hotspot.size ?? activePreset.twinkles.defaultSize;
        sprite.position.set(localPosition.x, localPosition.y, 0.04);
        sprite.scale.set(size, size, 1);
        twinkleGroup.add(sprite);

        twinkleRuntimes.push({
          sprite,
          hotspot,
          depthSample: depthSampler ? depthSampler(hotspot.u, hotspot.v) : 0,
        });
      });
    };

    const clearParticles = () => {
      if (!particlesRuntime) {
        return;
      }

      particleGroup.remove(particlesRuntime.points);
      particlesRuntime.points.geometry.dispose();
      particlesRuntime.points.material.dispose();
      particlesRuntime = null;
    };

    const rebuildParticles = (activePreset: EnvironmentPreset) => {
      clearParticles();

      if (activePreset.particles.count <= 0) {
        return;
      }

      const count = activePreset.particles.count;
      const rng = createRng(activePreset.particles.seed);
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);
      const drifts = new Float32Array(count);

      const width = planeScale.x * 0.9;
      const height = planeScale.y * 0.9;

      for (let index = 0; index < count; index += 1) {
        const base = index * 3;

        positions[base] = (rng() * 2 - 1) * width;
        positions[base + 1] = (rng() * 2 - 1) * height;
        positions[base + 2] = 0.12 + rng() * 0.24;

        velocities[base] = (rng() * 2 - 1) * 0.024;
        velocities[base + 1] = 0.008 + rng() * 0.02;
        velocities[base + 2] = 0;

        drifts[index] = rng() * Math.PI * 2;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: new THREE.Color(activePreset.particles.color),
        size: activePreset.particles.size,
        transparent: true,
        opacity: activePreset.particles.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geometry, material);
      particleGroup.add(points);

      particlesRuntime = {
        points,
        velocities,
        drifts,
      };
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointerTarget.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerTarget.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      lastPointerInputAt = elapsedSeconds;
    };

    const handlePointerLeave = () => {
      pointerTarget.set(0, 0);
    };

    const handleResize = () => {
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      fitPlane();

      const currentPreset = configRef.current.preset;
      rebuildParticles(currentPreset);
      rebuildTwinkles(currentPreset);
      syncSurfaceGlowUniforms(currentPreset);
      lastParticlesSignature = `${currentPreset.particles.count}|${currentPreset.particles.seed}`;
      lastTwinkleSignature = hotspotSignature(currentPreset.twinkles.hotspots);
      lastSurfaceGlowSignature = surfaceGlowSignature(currentPreset.surfaceGlows.hotspots);
    };

    const handlePlacementClick = (event: PointerEvent) => {
      const currentConfig = configRef.current;

      if (!currentConfig.twinklePlacementModeEnabled && !currentConfig.surfaceGlowPlacementModeEnabled) {
        return;
      }

      const rect = mount.getBoundingClientRect();
      ndcPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndcPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(ndcPointer, camera);
      const intersections = raycaster.intersectObject(plane, false);

      if (intersections.length === 0) {
        return;
      }

      const hitUv = intersections[0].uv;

      if (!hitUv) {
        return;
      }

      const normalizedV = 1 - hitUv.y;

      if (currentConfig.surfaceGlowPlacementModeEnabled) {
        if (event.shiftKey || event.altKey) {
          callbackRef.current.onRemoveNearestSurfaceGlowHotspot?.(hitUv.x, normalizedV);
          return;
        }

        callbackRef.current.onCreateSurfaceGlowHotspot?.(hitUv.x, normalizedV, Math.random());
        return;
      }

      if (currentConfig.twinklePlacementModeEnabled) {
        if (event.shiftKey || event.altKey) {
          callbackRef.current.onRemoveNearestTwinkleHotspot?.(hitUv.x, normalizedV);
          return;
        }

        callbackRef.current.onCreateTwinkleHotspot?.(hitUv.x, normalizedV, Math.random());
      }
    };

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => {
      configRef.current.reducedMotionActive = reducedMotionQuery.matches;
    };

    syncReducedMotion();

    mount.addEventListener("pointermove", handlePointerMove);
    mount.addEventListener("pointerleave", handlePointerLeave);
    mount.addEventListener("pointerdown", handlePlacementClick);
    window.addEventListener("resize", handleResize);
    reducedMotionQuery.addEventListener("change", syncReducedMotion);

    fitPlane();

    const currentPresetAtMount = configRef.current.preset;

    textureLoader.load(
      currentPresetAtMount.assets.colorImageUrl,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }

        colorTexture = texture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        planeMaterial.map = texture;
        planeMaterial.needsUpdate = true;
      },
      undefined,
      () => callbackRef.current.onLoadingStateChange?.("error"),
    );

    textureLoader.load(
      currentPresetAtMount.assets.depthMapUrl,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }

        depthTexture = texture;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        planeMaterial.displacementMap = texture;
        planeMaterial.needsUpdate = true;

        const image = texture.image as unknown;
        if (
          image instanceof HTMLImageElement ||
          image instanceof HTMLCanvasElement ||
          image instanceof ImageBitmap
        ) {
          depthSampler = createDepthSampler(image);
        }

        rebuildTwinkles(configRef.current.preset);
        lastTwinkleSignature = hotspotSignature(configRef.current.preset.twinkles.hotspots);
      },
      undefined,
      () => callbackRef.current.onLoadingStateChange?.("error"),
    );

    rebuildParticles(currentPresetAtMount);
    syncSurfaceGlowUniforms(currentPresetAtMount);

    lastParticlesSignature = `${currentPresetAtMount.particles.count}|${currentPresetAtMount.particles.seed}`;
    rebuildTwinkles(currentPresetAtMount);
    lastTwinkleSignature = hotspotSignature(currentPresetAtMount.twinkles.hotspots);
    lastSurfaceGlowSignature = surfaceGlowSignature(currentPresetAtMount.surfaceGlows.hotspots);

    const diagnostics: EnvironmentDiagnostics = {
      fps: 0,
      effectiveDepth: 0,
      twinkleCount: currentPresetAtMount.twinkles.hotspots.length,
      surfaceGlowCount: currentPresetAtMount.surfaceGlows.hotspots.length,
      particleCount: currentPresetAtMount.particles.count,
      hueOffsetDegrees: 0,
      currentSaturation: currentPresetAtMount.color.saturation,
      shaderSurfaceGlowCapacity: SURFACE_GLOW_CAPACITY,
      surfaceGlowDefaultIntensity: currentPresetAtMount.surfaceGlows.defaultIntensity,
      surfaceGlowAnimationActive: false,
      automaticMotionActive: false,
    };

    const animate = (now: number) => {
      animationFrameId = window.requestAnimationFrame(animate);

      const deltaSeconds = Math.min(0.2, Math.max(0.001, (now - lastFrameAt) / 1000));
      elapsedSeconds = now / 1000;
      lastFrameAt = now;

      const current = configRef.current;
      const activePreset = current.preset;
      const isPlaying = current.playbackState === "playing";
      const automaticMotionActive =
        isPlaying && activePreset.depth.ambientMotionEnabled && !current.reducedMotionActive;

      const particlesSignature = `${activePreset.particles.count}|${activePreset.particles.seed}`;
      if (particlesSignature !== lastParticlesSignature) {
        rebuildParticles(activePreset);
        lastParticlesSignature = particlesSignature;
      }

      const currentTwinkleSignature = hotspotSignature(activePreset.twinkles.hotspots);
      if (currentTwinkleSignature !== lastTwinkleSignature) {
        rebuildTwinkles(activePreset);
        lastTwinkleSignature = currentTwinkleSignature;
      }

      const currentSurfaceSignature = surfaceGlowSignature(activePreset.surfaceGlows.hotspots);
      if (currentSurfaceSignature !== lastSurfaceGlowSignature) {
        syncSurfaceGlowUniforms(activePreset);
        lastSurfaceGlowSignature = currentSurfaceSignature;
      }

      pointer.lerp(pointerTarget, 0.05);

      const motionAmount =
        isPlaying && !current.reducedMotionActive
          ? activePreset.depth.motionIntensity * activePreset.depth.pointerParallaxStrength
          : 0;
      const autoAmount = automaticMotionActive ? motionAmount : 0;

      autonomousPointer.x =
        Math.sin(elapsedSeconds * PLAYING_DRIFT_SPEED) * PLAYING_DRIFT_AMOUNT * autoAmount;
      autonomousPointer.y =
        Math.sin(elapsedSeconds * PLAYING_DRIFT_SPEED * 0.65) *
        Math.cos(elapsedSeconds * PLAYING_DRIFT_SPEED * 0.42) *
        PLAYING_DRIFT_AMOUNT *
        autoAmount *
        0.82;

      const pointerIsActive = elapsedSeconds - lastPointerInputAt <= POINTER_IDLE_TIMEOUT_SECONDS;
      const pointerEnabled = activePreset.depth.pointerParallaxEnabled && !current.reducedMotionActive;
      const pointerInfluenceTarget = pointerEnabled && pointerIsActive ? 1 : 0;
      pointerInfluence = THREE.MathUtils.lerp(pointerInfluence, pointerInfluenceTarget, 0.045);

      const pointerMotionAmount = pointerEnabled
        ? isPlaying
          ? motionAmount
          : STOPPED_POINTER_PARALLAX_MULTIPLIER
        : 0;

      blendedPointer.x = THREE.MathUtils.lerp(
        autonomousPointer.x,
        pointer.x * pointerMotionAmount,
        pointerInfluence,
      );
      blendedPointer.y = THREE.MathUtils.lerp(
        autonomousPointer.y,
        pointer.y * pointerMotionAmount,
        pointerInfluence,
      );

      const minBreathingDepth = Math.min(activePreset.depth.breathingMin, activePreset.depth.breathingMax);
      const maxBreathingDepth = Math.max(activePreset.depth.breathingMin, activePreset.depth.breathingMax);
      const breathingFrequency =
        (Math.PI * 2) / Math.max(activePreset.depth.breathingCycleSeconds, 0.4);

      const breathingWave = Math.sin(elapsedSeconds * breathingFrequency);
      const breathingProgress = (breathingWave + 1) / 2;
      const breathingDepth = automaticMotionActive
        ? THREE.MathUtils.lerp(minBreathingDepth, maxBreathingDepth, breathingProgress)
        : THREE.MathUtils.lerp(minBreathingDepth, maxBreathingDepth, activePreset.depth.staticDepth);

      const effectiveDepth = isPlaying ? breathingDepth : activePreset.depth.staticDepth;

      playbackVisualMix = stepUvJunglePlaybackVisualMix(
        playbackVisualMix,
        isPlaying,
        current.reducedMotionActive,
      );

      if (automaticMotionActive && activePreset.color.driftEnabled) {
        huePhase += (deltaSeconds / Math.max(activePreset.color.cycleSeconds, 1)) * Math.PI * 2;
      }

      if (automaticMotionActive && activePreset.color.glowPulseEnabled) {
        glowPhase +=
          (deltaSeconds / Math.max(activePreset.color.glowPulseCycleSeconds, 1)) * Math.PI * 2;
      }

      if (automaticMotionActive && activePreset.twinkles.enabled) {
        twinklePhase += deltaSeconds * activePreset.twinkles.pulseSpeed * Math.PI * 2;
      }

      if (automaticMotionActive && activePreset.haze.enabled) {
        hazePhase +=
          (deltaSeconds / Math.max(activePreset.haze.driftCycleSeconds, 1)) * Math.PI * 2;
      }

      if (automaticMotionActive && activePreset.surfaceGlows.enabled) {
        surfaceGlowPulseTimeSeconds += deltaSeconds;
      }

      if (activePreset.saturationPulse.enabled && automaticMotionActive) {
        if (activePreset.saturationPulse.syncToDepthBreathing) {
          const syncAngle =
            breathingProgress * Math.PI * 2 + activePreset.saturationPulse.phaseOffset;
          const pulseProgress = (Math.sin(syncAngle) + 1) / 2;
          currentSaturation = THREE.MathUtils.lerp(
            activePreset.saturationPulse.minimumSaturation,
            activePreset.saturationPulse.maximumSaturation,
            pulseProgress,
          );
        } else {
          saturationPulsePhase +=
            (deltaSeconds / Math.max(activePreset.saturationPulse.cycleSeconds, 0.2)) *
            Math.PI *
            2;
          const pulseProgress =
            (Math.sin(saturationPulsePhase + activePreset.saturationPulse.phaseOffset) + 1) /
            2;
          currentSaturation = THREE.MathUtils.lerp(
            activePreset.saturationPulse.minimumSaturation,
            activePreset.saturationPulse.maximumSaturation,
            pulseProgress,
          );
        }
      } else if (!activePreset.saturationPulse.enabled) {
        currentSaturation = activePreset.color.saturation;
      }

      currentHueOffset = activePreset.color.driftEnabled
        ? Math.sin(huePhase) * activePreset.color.hueRangeDegrees
        : 0;
      currentGlowOffset = activePreset.color.glowPulseEnabled
        ? (Math.sin(glowPhase) * 0.5 + 0.5) * activePreset.color.glowPulseAmount
        : 0;

      renderer.domElement.style.filter = buildEnvironmentFilter({
        playbackMix: playbackVisualMix,
        hueOffsetDegrees: currentHueOffset,
        currentSaturation,
        glowPulseAmount: currentGlowOffset,
      });

      surfaceGlowUniforms.uSurfaceGlowEnabled.value = activePreset.surfaceGlows.enabled ? 1 : 0;
      surfaceGlowUniforms.uSurfaceGlowGlobalDim.value = isPlaying ? 1 : 0.22;
      surfaceGlowUniforms.uSurfaceGlowTime.value = surfaceGlowPulseTimeSeconds;

      planeMaterial.displacementScale =
        effectiveDepth * activePreset.depth.depthStrength * DISPLACEMENT_SCALE_MULTIPLIER;
      planeMaterial.bumpScale = effectiveDepth * 0.04;

      planeGroup.position.x =
        Math.sin(elapsedSeconds * 0.16) * 0.06 * autoAmount + blendedPointer.x * 0.14;
      planeGroup.position.y =
        Math.cos(elapsedSeconds * 0.12) * 0.04 * autoAmount - blendedPointer.y * 0.11;
      planeGroup.rotation.y =
        Math.sin(elapsedSeconds * 0.1) * 0.022 * autoAmount + blendedPointer.x * 0.13;
      planeGroup.rotation.x =
        Math.cos(elapsedSeconds * 0.085) * 0.016 * autoAmount - blendedPointer.y * 0.1;
      plane.position.z = -0.15 + Math.sin(elapsedSeconds * 0.22) * 0.06 * autoAmount;
      glowPlane.material.opacity = 0.05 + effectiveDepth * 0.06 + currentGlowOffset * 0.8;

      twinkleGroup.visible = activePreset.twinkles.enabled;
      twinkleRuntimes.forEach((entry) => {
        const entrySize = entry.hotspot.size ?? activePreset.twinkles.defaultSize;
        const entryIntensity = entry.hotspot.intensity ?? activePreset.twinkles.defaultIntensity;
        const point = toPlanePosition(entry.hotspot.u, entry.hotspot.v);

        entry.sprite.position.x = point.x;
        entry.sprite.position.y = point.y;
        entry.sprite.position.z =
          0.06 + entry.depthSample * effectiveDepth * activePreset.depth.depthStrength * 0.12;

        const phaseOffset = (entry.hotspot.phase ?? 0) * Math.PI * 2;
        const twinkleWave = activePreset.twinkles.enabled
          ? Math.sin(twinklePhase + phaseOffset) * 0.5 + 0.5
          : 0.5;
        const pulseMix = automaticMotionActive ? twinkleWave : 0.45;
        const opacity = 0.12 + pulseMix * 0.78 * entryIntensity;

        entry.sprite.scale.set(entrySize, entrySize, 1);
        const material = entry.sprite.material;
        if (material instanceof THREE.SpriteMaterial) {
          material.opacity = opacity * (isPlaying ? 1 : 0.85);
        }
      });

      if (particlesRuntime) {
        particlesRuntime.points.visible = activePreset.particles.enabled;
        particlesRuntime.points.material.size = activePreset.particles.size;
        particlesRuntime.points.material.color.set(activePreset.particles.color);
        particlesRuntime.points.material.opacity =
          activePreset.particles.opacity * (isPlaying ? 1 : 0.55);

        if (automaticMotionActive && activePreset.particles.enabled) {
          const positionAttribute = particlesRuntime.points.geometry.getAttribute(
            "position",
          ) as THREE.BufferAttribute;
          const positions = positionAttribute.array as Float32Array;
          const width = planeScale.x * 0.95;
          const height = planeScale.y * 0.95;

          for (let index = 0; index < activePreset.particles.count; index += 1) {
            const base = index * 3;
            const drift =
              Math.sin(elapsedSeconds * 0.35 + particlesRuntime.drifts[index]) * 0.016;
            positions[base] +=
              (particlesRuntime.velocities[base] + drift) *
              activePreset.particles.speed *
              deltaSeconds;
            positions[base + 1] +=
              particlesRuntime.velocities[base + 1] *
              activePreset.particles.speed *
              deltaSeconds;

            if (positions[base] > width) {
              positions[base] = -width;
            } else if (positions[base] < -width) {
              positions[base] = width;
            }

            if (positions[base + 1] > height) {
              positions[base + 1] = -height;
            }
          }

          positionAttribute.needsUpdate = true;
        }
      }

      const hazeOpacity = activePreset.haze.enabled
        ? activePreset.haze.opacity * (isPlaying ? 1 : 0.62)
        : 0;
      const hazeOffsetX = Math.sin(hazePhase) * 14;
      const hazeOffsetY = Math.cos(hazePhase * 0.72) * 11;

      hazeElement.style.opacity = `${hazeOpacity.toFixed(3)}`;
      hazeElement.style.filter = `blur(${activePreset.haze.blurPixels.toFixed(1)}px)`;
      hazeElement.style.transform = `translate3d(${hazeOffsetX.toFixed(2)}px, ${hazeOffsetY.toFixed(2)}px, 0)`;
      hazeElement.style.background = `
        radial-gradient(circle at 24% 34%, ${activePreset.haze.primaryColor}, transparent 56%),
        radial-gradient(circle at 76% 62%, ${activePreset.haze.secondaryColor}, transparent 58%)
      `;

      camera.position.x = blendedPointer.x * 0.06;
      camera.position.y = -blendedPointer.y * 0.045;
      camera.lookAt(0, 0, -0.4);

      renderer.render(scene, camera);

      if (elapsedSeconds - lastDiagnosticUpdateAt >= DIAGNOSTIC_UPDATE_INTERVAL_SECONDS) {
        lastDiagnosticUpdateAt = elapsedSeconds;
        diagnostics.fps =
          diagnostics.fps === 0
            ? 1 / deltaSeconds
            : diagnostics.fps * 0.65 + (1 / deltaSeconds) * 0.35;
        diagnostics.effectiveDepth = effectiveDepth;
        diagnostics.twinkleCount = activePreset.twinkles.hotspots.length;
        diagnostics.surfaceGlowCount = activePreset.surfaceGlows.hotspots.length;
        diagnostics.particleCount = activePreset.particles.count;
        diagnostics.hueOffsetDegrees = currentHueOffset;
        diagnostics.currentSaturation = currentSaturation;
        diagnostics.shaderSurfaceGlowCapacity = SURFACE_GLOW_CAPACITY;
        diagnostics.surfaceGlowDefaultIntensity = activePreset.surfaceGlows.defaultIntensity;
        diagnostics.surfaceGlowAnimationActive =
          automaticMotionActive && activePreset.surfaceGlows.enabled;
        diagnostics.automaticMotionActive = automaticMotionActive;
        callbackRef.current.onDiagnosticsChange?.({ ...diagnostics });
      }
    };

    animationFrameId = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeEventListener("pointerleave", handlePointerLeave);
      mount.removeEventListener("pointerdown", handlePlacementClick);
      window.removeEventListener("resize", handleResize);
      reducedMotionQuery.removeEventListener("change", syncReducedMotion);

      clearTwinkles();
      clearParticles();

      colorTexture?.dispose();
      depthTexture?.dispose();
      renderer.domElement.style.filter = "";

      planeGeometry.dispose();
      planeMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();

      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <>
      <div ref={mountRef} className="environment-lab__scene-root" />
      <div ref={hazeRef} className="environment-lab__haze" aria-hidden="true" />
      {placementNote && (
        <p className="environment-lab__placement-note" aria-live="polite">
          {placementNote}
        </p>
      )}
    </>
  );
}

export default EnvironmentLabScene;
