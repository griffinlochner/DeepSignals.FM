import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MAX_SURFACE_GLOW_HOTSPOTS } from "../../experiments/environment-lab/constants";
import type { ThemeSceneProps } from "../themeTypes";
import { formatImageDepthPlaybackFilter, stepImageDepthPlaybackVisualMix } from "./imageDepthPlaybackVisuals";
import { computeFramedPlaneScale, IMAGE_DEPTH_PARITY_FRAMING } from "./framing";
import { getImageDepthTexturePair } from "./imageDepthTextureCache";
import { resolveImageDepthElapsedSeconds, writeImageDepthParityStats } from "./timing";
import type { ImageDepthAsset, ImageDepthScenePreset, ImageDepthSurfaceGlowHotspot } from "./types";

type ImageDepthThemeSceneProps = ThemeSceneProps & {
  asset: ImageDepthAsset;
  scenePreset: ImageDepthScenePreset;
  className?: string;
};

const SATURATION_EPSILON = 0.0001;
const DISPLACEMENT_SCALE_MULTIPLIER = 0.36;
const PLAYING_DRIFT_AMOUNT = 0.6;
const PLAYING_DRIFT_SPEED = 0.58;
const POINTER_IDLE_TIMEOUT_SECONDS = 1.25;

type SurfaceGlowUniformState = {
  uSurfaceGlowEnabled: { value: number };
  uSurfaceGlowCount: { value: number };
  uSurfaceGlowGlobalDim: { value: number };
  uSurfaceGlowTime: { value: number };
  uSurfaceGlowAspectScale: { value: THREE.Vector2 };
  uSurfaceGlowUvOffset: { value: THREE.Vector2 };
  uSurfaceGlowUvScale: { value: THREE.Vector2 };
  uSurfaceGlowUVs: { value: THREE.Vector2[] };
  uSurfaceGlowColors: { value: THREE.Vector3[] };
  uSurfaceGlowRadii: { value: number[] };
  uSurfaceGlowSoftness: { value: number[] };
  uSurfaceGlowIntensity: { value: number[] };
  uSurfaceGlowPulseEnabled: { value: number[] };
  uSurfaceGlowPulseMode: { value: number[] };
  uSurfaceGlowPulseAmount: { value: number[] };
  uSurfaceGlowPulseMinIntensity: { value: number[] };
  uSurfaceGlowPulseMaxIntensity: { value: number[] };
  uSurfaceGlowPulseRadiusExpansion: { value: number[] };
  uSurfaceGlowPulseCycles: { value: number[] };
  uSurfaceGlowHueDriftEnabled: { value: number[] };
  uSurfaceGlowHueDriftRange: { value: number[] };
  uSurfaceGlowHueDriftCycles: { value: number[] };
  uSurfaceGlowPhases: { value: number[] };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function createSurfaceGlowUniformState(): SurfaceGlowUniformState {
  return {
    uSurfaceGlowEnabled: { value: 0 },
    uSurfaceGlowCount: { value: 0 },
    uSurfaceGlowGlobalDim: { value: 0 },
    uSurfaceGlowTime: { value: 0 },
    uSurfaceGlowAspectScale: { value: new THREE.Vector2(1, 1) },
    uSurfaceGlowUvOffset: { value: new THREE.Vector2(0, 0) },
    uSurfaceGlowUvScale: { value: new THREE.Vector2(1, 1) },
    uSurfaceGlowUVs: {
      value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => new THREE.Vector2(0, 0)),
    },
    uSurfaceGlowColors: {
      value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => new THREE.Vector3(0, 0, 0)),
    },
    uSurfaceGlowRadii: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
    uSurfaceGlowSoftness: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0.65) },
    uSurfaceGlowIntensity: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
    uSurfaceGlowPulseEnabled: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
    uSurfaceGlowPulseMode: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
    uSurfaceGlowPulseAmount: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
    uSurfaceGlowPulseMinIntensity: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 1) },
    uSurfaceGlowPulseMaxIntensity: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 1) },
    uSurfaceGlowPulseRadiusExpansion: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 1) },
    uSurfaceGlowPulseCycles: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 3.5) },
    uSurfaceGlowHueDriftEnabled: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
    uSurfaceGlowHueDriftRange: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
    uSurfaceGlowHueDriftCycles: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 20) },
    uSurfaceGlowPhases: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
  };
}

function getPulseModeIndex(hotspot: ImageDepthSurfaceGlowHotspot): number {
  if (hotspot.pulseMode === "brightness") {
    return 0;
  }

  if (hotspot.pulseMode === "bloom") {
    return 1;
  }

  if (hotspot.pulseMode === "brightness-bloom") {
    return 2;
  }

  return 3;
}

function syncSurfaceGlowUniforms(
  surfaceGlowUniforms: SurfaceGlowUniformState,
  scenePreset: ImageDepthScenePreset,
  map: THREE.Texture | null,
) {
  const activeHotspots = scenePreset.surfaceGlows.hotspots.slice(0, MAX_SURFACE_GLOW_HOTSPOTS);
  surfaceGlowUniforms.uSurfaceGlowEnabled.value =
    scenePreset.surfaceGlows.enabled && activeHotspots.length > 0 ? 1 : 0;
  surfaceGlowUniforms.uSurfaceGlowCount.value = activeHotspots.length;

  if (map) {
    surfaceGlowUniforms.uSurfaceGlowUvOffset.value.set(map.offset.x, map.offset.y);
    surfaceGlowUniforms.uSurfaceGlowUvScale.value.set(map.repeat.x, map.repeat.y);
  } else {
    surfaceGlowUniforms.uSurfaceGlowUvOffset.value.set(0, 0);
    surfaceGlowUniforms.uSurfaceGlowUvScale.value.set(1, 1);
  }

  for (let index = 0; index < MAX_SURFACE_GLOW_HOTSPOTS; index += 1) {
    const hotspot = activeHotspots[index];

    if (hotspot) {
      surfaceGlowUniforms.uSurfaceGlowUVs.value[index].set(hotspot.u, hotspot.v);
      const color = new THREE.Color(hotspot.color);
      surfaceGlowUniforms.uSurfaceGlowColors.value[index].set(color.r, color.g, color.b);
      surfaceGlowUniforms.uSurfaceGlowRadii.value[index] = hotspot.radius;
      surfaceGlowUniforms.uSurfaceGlowSoftness.value[index] = hotspot.softness;
      surfaceGlowUniforms.uSurfaceGlowIntensity.value[index] = hotspot.intensity;
      surfaceGlowUniforms.uSurfaceGlowPulseEnabled.value[index] = hotspot.pulseEnabled ? 1 : 0;
      surfaceGlowUniforms.uSurfaceGlowPulseMode.value[index] = getPulseModeIndex(hotspot);
      surfaceGlowUniforms.uSurfaceGlowPulseAmount.value[index] = hotspot.pulseAmount;
      surfaceGlowUniforms.uSurfaceGlowPulseMinIntensity.value[index] = hotspot.minimumIntensityMultiplier;
      surfaceGlowUniforms.uSurfaceGlowPulseMaxIntensity.value[index] = hotspot.maximumIntensityMultiplier;
      surfaceGlowUniforms.uSurfaceGlowPulseRadiusExpansion.value[index] = hotspot.radiusExpansionMultiplier;
      surfaceGlowUniforms.uSurfaceGlowPulseCycles.value[index] = hotspot.pulseCycleSeconds;
      surfaceGlowUniforms.uSurfaceGlowHueDriftEnabled.value[index] = hotspot.hueDriftEnabled ? 1 : 0;
      surfaceGlowUniforms.uSurfaceGlowHueDriftRange.value[index] = hotspot.hueDriftRangeDegrees;
      surfaceGlowUniforms.uSurfaceGlowHueDriftCycles.value[index] = hotspot.hueDriftCycleSeconds;
      surfaceGlowUniforms.uSurfaceGlowPhases.value[index] = hotspot.phase;
    } else {
      surfaceGlowUniforms.uSurfaceGlowUVs.value[index].set(0, 0);
      surfaceGlowUniforms.uSurfaceGlowColors.value[index].set(0, 0, 0);
      surfaceGlowUniforms.uSurfaceGlowRadii.value[index] = 0;
      surfaceGlowUniforms.uSurfaceGlowSoftness.value[index] = 0.65;
      surfaceGlowUniforms.uSurfaceGlowIntensity.value[index] = 0;
      surfaceGlowUniforms.uSurfaceGlowPulseEnabled.value[index] = 0;
      surfaceGlowUniforms.uSurfaceGlowPulseMode.value[index] = 0;
      surfaceGlowUniforms.uSurfaceGlowPulseAmount.value[index] = 0;
      surfaceGlowUniforms.uSurfaceGlowPulseMinIntensity.value[index] = 1;
      surfaceGlowUniforms.uSurfaceGlowPulseMaxIntensity.value[index] = 1;
      surfaceGlowUniforms.uSurfaceGlowPulseRadiusExpansion.value[index] = 1;
      surfaceGlowUniforms.uSurfaceGlowPulseCycles.value[index] = 3.5;
      surfaceGlowUniforms.uSurfaceGlowHueDriftEnabled.value[index] = 0;
      surfaceGlowUniforms.uSurfaceGlowHueDriftRange.value[index] = 0;
      surfaceGlowUniforms.uSurfaceGlowHueDriftCycles.value[index] = 20;
      surfaceGlowUniforms.uSurfaceGlowPhases.value[index] = 0;
    }
  }
}

export function ImageDepthThemeScene({
  isPlaying,
  reducedMotion,
  motionEnabled,
  asset,
  scenePreset,
  className,
}: ImageDepthThemeSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sharedMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const playbackVisualMixRef = useRef(0);
  const visualStateRef = useRef({
    isPlaying,
    reducedMotion,
    motionEnabled,
  });

  const behavior = scenePreset.behavior;

  const profile = useMemo(
    () => ({
      depth: {
        staticDepth: behavior.depth.staticDepth,
        breathingMin: behavior.depth.breathingMin,
        breathingMax: behavior.depth.breathingMax,
        depthStrength: behavior.depth.depthStrength,
        motionIntensity: behavior.depth.motionIntensity,
        breathingCycleSeconds: behavior.depth.breathingCycleSeconds,
        pointerParallaxEnabled: behavior.depth.pointerParallaxEnabled,
        pointerParallaxStrength: behavior.depth.pointerParallaxStrength,
        ambientMotionEnabled: behavior.depth.ambientMotionEnabled,
      },
      color: {
        driftEnabled: behavior.color.driftEnabled,
        hueRangeDegrees: behavior.color.hueRangeDegrees,
        cycleSeconds: behavior.color.cycleSeconds,
        saturation: behavior.color.saturation,
        glowPulseEnabled: behavior.color.glowPulseEnabled,
        glowPulseAmount: behavior.color.glowPulseAmount,
        glowPulseCycleSeconds: behavior.color.glowPulseCycleSeconds,
      },
      saturationPulse: {
        enabled: behavior.saturationPulse.enabled,
        minimumSaturation: behavior.saturationPulse.minimumSaturation,
        maximumSaturation: behavior.saturationPulse.maximumSaturation,
        cycleSeconds: behavior.saturationPulse.cycleSeconds,
        phaseOffset: behavior.saturationPulse.phaseOffset,
        syncToDepthBreathing: behavior.saturationPulse.syncToDepthBreathing,
      },
    }),
    [behavior],
  );

  useEffect(() => {
    visualStateRef.current = {
      isPlaying,
      reducedMotion,
      motionEnabled,
    };
  }, [isPlaying, reducedMotion, motionEnabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08110d);
    scene.fog = new THREE.FogExp2(0x08110d, 0.045);

    const camera = new THREE.PerspectiveCamera(IMAGE_DEPTH_PARITY_FRAMING.cameraFovDegrees, 1, 0.1, 80);
    camera.position.set(0, 0, IMAGE_DEPTH_PARITY_FRAMING.cameraZ);
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x08110d, 1);
    renderer.domElement.style.backgroundColor = "#08110d";
    renderer.domElement.style.opacity = "0";
    renderer.domElement.style.transition = "opacity 520ms ease";
    container.appendChild(renderer.domElement);

    const planeGroup = new THREE.Group();
    scene.add(planeGroup);

    const ambientLight = new THREE.AmbientLight(0xf2ffe7, 1.85);
    const keyLight = new THREE.DirectionalLight(0xf8f6d2, 1.3);
    keyLight.position.set(-2, 2, 3);
    const rimLight = new THREE.DirectionalLight(0x77ffd9, 0.6);
    rimLight.position.set(2, -1, 2);
    scene.add(ambientLight, keyLight, rimLight);

    const material = new THREE.MeshStandardMaterial({
      displacementScale: profile.depth.staticDepth * profile.depth.depthStrength * DISPLACEMENT_SCALE_MULTIPLIER,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const surfaceGlowUniforms = createSurfaceGlowUniformState();

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSurfaceGlowEnabled = surfaceGlowUniforms.uSurfaceGlowEnabled;
      shader.uniforms.uSurfaceGlowCount = surfaceGlowUniforms.uSurfaceGlowCount;
      shader.uniforms.uSurfaceGlowGlobalDim = surfaceGlowUniforms.uSurfaceGlowGlobalDim;
      shader.uniforms.uSurfaceGlowTime = surfaceGlowUniforms.uSurfaceGlowTime;
      shader.uniforms.uSurfaceGlowAspectScale = surfaceGlowUniforms.uSurfaceGlowAspectScale;
      shader.uniforms.uSurfaceGlowUvOffset = surfaceGlowUniforms.uSurfaceGlowUvOffset;
      shader.uniforms.uSurfaceGlowUvScale = surfaceGlowUniforms.uSurfaceGlowUvScale;
      shader.uniforms.uSurfaceGlowUVs = surfaceGlowUniforms.uSurfaceGlowUVs;
      shader.uniforms.uSurfaceGlowColors = surfaceGlowUniforms.uSurfaceGlowColors;
      shader.uniforms.uSurfaceGlowRadii = surfaceGlowUniforms.uSurfaceGlowRadii;
      shader.uniforms.uSurfaceGlowSoftness = surfaceGlowUniforms.uSurfaceGlowSoftness;
      shader.uniforms.uSurfaceGlowIntensity = surfaceGlowUniforms.uSurfaceGlowIntensity;
      shader.uniforms.uSurfaceGlowPulseEnabled = surfaceGlowUniforms.uSurfaceGlowPulseEnabled;
      shader.uniforms.uSurfaceGlowPulseMode = surfaceGlowUniforms.uSurfaceGlowPulseMode;
      shader.uniforms.uSurfaceGlowPulseAmount = surfaceGlowUniforms.uSurfaceGlowPulseAmount;
      shader.uniforms.uSurfaceGlowPulseMinIntensity = surfaceGlowUniforms.uSurfaceGlowPulseMinIntensity;
      shader.uniforms.uSurfaceGlowPulseMaxIntensity = surfaceGlowUniforms.uSurfaceGlowPulseMaxIntensity;
      shader.uniforms.uSurfaceGlowPulseRadiusExpansion = surfaceGlowUniforms.uSurfaceGlowPulseRadiusExpansion;
      shader.uniforms.uSurfaceGlowPulseCycles = surfaceGlowUniforms.uSurfaceGlowPulseCycles;
      shader.uniforms.uSurfaceGlowHueDriftEnabled = surfaceGlowUniforms.uSurfaceGlowHueDriftEnabled;
      shader.uniforms.uSurfaceGlowHueDriftRange = surfaceGlowUniforms.uSurfaceGlowHueDriftRange;
      shader.uniforms.uSurfaceGlowHueDriftCycles = surfaceGlowUniforms.uSurfaceGlowHueDriftCycles;
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
uniform vec2 uSurfaceGlowAspectScale;
uniform vec2 uSurfaceGlowUvOffset;
uniform vec2 uSurfaceGlowUvScale;
uniform vec2 uSurfaceGlowUVs[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform vec3 uSurfaceGlowColors[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowRadii[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowSoftness[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowIntensity[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowPulseEnabled[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowPulseMode[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowPulseAmount[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowPulseMinIntensity[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowPulseMaxIntensity[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowPulseRadiusExpansion[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowPulseCycles[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowHueDriftEnabled[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowHueDriftRange[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowHueDriftCycles[${MAX_SURFACE_GLOW_HOTSPOTS}];
uniform float uSurfaceGlowPhases[${MAX_SURFACE_GLOW_HOTSPOTS}];

vec2 applySurfaceUvTransform(vec2 uv) {
  return uv * uSurfaceGlowUvScale + uSurfaceGlowUvOffset;
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
if (uSurfaceGlowEnabled > 0.5) {
  vec2 uvTransformed = applySurfaceUvTransform(vSurfaceUv);
  vec3 surfaceGlowAccum = vec3(0.0);

  for (int i = 0; i < ${MAX_SURFACE_GLOW_HOTSPOTS}; i++) {
    if (i >= uSurfaceGlowCount) {
      break;
    }

    float pulseWave = 0.5;
    if (uSurfaceGlowPulseEnabled[i] > 0.5) {
      float cycle = max(abs(uSurfaceGlowPulseCycles[i]), 0.0001);
      float phase = (uSurfaceGlowTime / cycle) * 6.28318530718 + uSurfaceGlowPhases[i] * 6.28318530718;
      pulseWave = sin(phase) * 0.5 + 0.5;
    }

    float pulseShape = smoothstep(0.08, 0.92, pulseWave);
    float softBlinkShape = smoothstep(0.2, 0.95, pulseWave);
    float brightnessMix = pulseShape;
    float bloomMix = pulseShape;
    float mode = uSurfaceGlowPulseMode[i];

    if (mode < 0.5) {
      bloomMix = 0.5;
    } else if (mode < 1.5) {
      brightnessMix = 0.55;
    } else if (mode > 2.5) {
      brightnessMix = softBlinkShape;
      bloomMix = softBlinkShape;
    }

    float intensityMultiplier = mix(
      uSurfaceGlowPulseMinIntensity[i],
      uSurfaceGlowPulseMaxIntensity[i],
      brightnessMix
    );

    float baseRadius = max(abs(uSurfaceGlowRadii[i]), 0.0001);
    float expansion = 1.0 + (uSurfaceGlowPulseRadiusExpansion[i] - 1.0) * bloomMix;
    float animatedRadius = max(baseRadius * mix(1.0, expansion, uSurfaceGlowPulseAmount[i]), 0.0001);
    float softness = clamp(uSurfaceGlowSoftness[i], 0.0, 0.999);
    float inner = animatedRadius * (1.0 - softness);

    vec2 hotspotUv = applySurfaceUvTransform(uSurfaceGlowUVs[i]);
    vec2 delta = (uvTransformed - hotspotUv) * uSurfaceGlowAspectScale;
    float distToGlow = length(delta);
    float radialFalloff = 1.0 - smoothstep(inner, animatedRadius, distToGlow);

    vec3 glowColor = uSurfaceGlowColors[i];
    if (uSurfaceGlowHueDriftEnabled[i] > 0.5) {
      float hueCycle = max(abs(uSurfaceGlowHueDriftCycles[i]), 0.0001);
      float hueWave = sin((uSurfaceGlowTime / hueCycle) * 6.28318530718 + uSurfaceGlowPhases[i] * 6.28318530718);
      float hueOffset = (hueWave * uSurfaceGlowHueDriftRange[i]) / 360.0;
      vec3 hsv = rgb2hsv(glowColor);
      hsv.x = fract(hsv.x + hueOffset);
      glowColor = hsv2rgb(hsv);
    }

    surfaceGlowAccum += glowColor * radialFalloff * uSurfaceGlowIntensity[i] * intensityMultiplier;
  }

  vec3 compressed = surfaceGlowAccum / (vec3(1.0) + surfaceGlowAccum);
  diffuseColor.rgb += compressed * uSurfaceGlowGlobalDim;
}`,
      );
    };

    const geometry = new THREE.PlaneGeometry(1, 1, 320, 224);
    const plane = new THREE.Mesh(geometry, material);
    plane.position.z = IMAGE_DEPTH_PARITY_FRAMING.planeZ;
    planeGroup.add(plane);

    const glowGeometry = new THREE.PlaneGeometry(1, 1);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x6de0c0,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial);
    glowPlane.position.z = -0.8;
    planeGroup.add(glowPlane);

    sharedMaterialRef.current = material;

    let disposed = false;
    let frameHandle: number | null = null;
    let readyFrameHandle: number | null = null;
    let readyFallbackTimeoutHandle: number | null = null;
    const animationStartedAt = performance.now();
    const pointerTarget = new THREE.Vector2(0, 0);
    const pointer = new THREE.Vector2(0, 0);
    const blendedPointer = new THREE.Vector2(0, 0);
    const autonomousPointer = new THREE.Vector2(0, 0);
    let elapsedSeconds = 0;
    let pointerInfluence = 0;
    let lastPointerInputAt = -100;

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      pointerTarget.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      pointerTarget.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
      lastPointerInputAt = elapsedSeconds;
    };

    const onPointerLeave = () => {
      pointerTarget.set(0, 0);
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width <= 0 || height <= 0) {
        return;
      }

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const framedScale = computeFramedPlaneScale({
        viewportWidth: width,
        viewportHeight: height,
        cameraFovDegrees: camera.fov,
        cameraZ: camera.position.z,
        planeZ: plane.position.z,
      });

      plane.scale.set(framedScale.width, framedScale.height, 1);
      glowPlane.scale.set(framedScale.width * 1.14, framedScale.height * 1.08, 1);

      const shortAxis = Math.max(0.0001, Math.min(framedScale.width, framedScale.height));
      surfaceGlowUniforms.uSurfaceGlowAspectScale.value.set(
        framedScale.width / shortAxis,
        framedScale.height / shortAxis,
      );
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    readyFallbackTimeoutHandle = window.setTimeout(() => {
      if (!disposed) {
        renderer.domElement.style.opacity = "1";
      }
    }, 350);

    syncSurfaceGlowUniforms(surfaceGlowUniforms, scenePreset, material.map);

    getImageDepthTexturePair(asset)
      .then(({ colorTexture, depthTexture }) => {
        if (disposed) {
          return;
        }

        material.map = colorTexture;
        material.displacementMap = depthTexture;
        material.needsUpdate = true;
        syncSurfaceGlowUniforms(surfaceGlowUniforms, scenePreset, material.map);

        readyFrameHandle = requestAnimationFrame(() => {
          renderer.domElement.style.opacity = "1";
        });
      })
      .catch((error) => {
        console.warn("Image-depth texture loading failed", error);
        renderer.domElement.style.opacity = "1";
      });

    const renderFrame = (timestamp: number) => {
      if (disposed) {
        return;
      }

      try {
        elapsedSeconds = resolveImageDepthElapsedSeconds(timestamp, animationStartedAt);

        const visualState = visualStateRef.current;
        const isPlayingNow = visualState.isPlaying;
        const reducedMotionActive = visualState.reducedMotion;
        const geometryMotionEnabled = visualState.motionEnabled !== false;
        const geometryMotionActive = isPlayingNow && !reducedMotionActive && geometryMotionEnabled;
        const automaticMotionActive = geometryMotionActive && profile.depth.ambientMotionEnabled;

        pointer.lerp(pointerTarget, 0.05);

        const motionAmount = geometryMotionActive
          ? profile.depth.motionIntensity * profile.depth.pointerParallaxStrength
          : 0;
        const autoAmount = automaticMotionActive ? motionAmount : 0;

        autonomousPointer.x = Math.sin(elapsedSeconds * PLAYING_DRIFT_SPEED) * PLAYING_DRIFT_AMOUNT * autoAmount;
        autonomousPointer.y =
          Math.sin(elapsedSeconds * PLAYING_DRIFT_SPEED * 0.65) *
          Math.cos(elapsedSeconds * PLAYING_DRIFT_SPEED * 0.42) *
          PLAYING_DRIFT_AMOUNT *
          autoAmount *
          0.82;

        const pointerIsActive = elapsedSeconds - lastPointerInputAt <= POINTER_IDLE_TIMEOUT_SECONDS;
        const pointerEnabled = geometryMotionActive && profile.depth.pointerParallaxEnabled;
        const pointerInfluenceTarget = pointerEnabled && pointerIsActive ? 1 : 0;
        pointerInfluence = THREE.MathUtils.lerp(pointerInfluence, pointerInfluenceTarget, 0.045);

        blendedPointer.x = THREE.MathUtils.lerp(autonomousPointer.x, pointer.x * motionAmount, pointerInfluence);
        blendedPointer.y = THREE.MathUtils.lerp(autonomousPointer.y, pointer.y * motionAmount, pointerInfluence);

        let breathingMix = 0.5;
        let effectiveDepth = profile.depth.staticDepth;
        const minBreathingDepth = Math.min(profile.depth.breathingMin, profile.depth.breathingMax);
        const maxBreathingDepth = Math.max(profile.depth.breathingMin, profile.depth.breathingMax);

        if (automaticMotionActive) {
          const breathingRange = maxBreathingDepth - minBreathingDepth;
          const safeCycleSeconds = Math.max(profile.depth.breathingCycleSeconds, SATURATION_EPSILON);
          const cycle = Math.sin((elapsedSeconds / safeCycleSeconds) * Math.PI * 2);
          breathingMix = (cycle + 1) * 0.5;
          effectiveDepth = minBreathingDepth + breathingRange * breathingMix;

          material.displacementScale =
            profile.depth.depthStrength *
            DISPLACEMENT_SCALE_MULTIPLIER *
            effectiveDepth;
        } else {
          effectiveDepth = profile.depth.staticDepth;
          material.displacementScale =
            profile.depth.staticDepth * profile.depth.depthStrength * DISPLACEMENT_SCALE_MULTIPLIER;
        }

        material.bumpScale = effectiveDepth * 0.04;

        const hueOffsetDegrees =
          profile.color.driftEnabled && isPlayingNow && !reducedMotionActive
            ? Math.sin((elapsedSeconds / Math.max(profile.color.cycleSeconds, 1)) * Math.PI * 2) *
              profile.color.hueRangeDegrees
            : 0;

        let currentSaturation = profile.color.saturation;
        if (profile.saturationPulse.enabled && isPlayingNow && !reducedMotionActive) {
          if (profile.saturationPulse.syncToDepthBreathing) {
            const syncAngle = breathingMix * Math.PI * 2 + profile.saturationPulse.phaseOffset;
            const pulseProgress = (Math.sin(syncAngle) + 1) * 0.5;
            currentSaturation = lerp(
              profile.saturationPulse.minimumSaturation,
              profile.saturationPulse.maximumSaturation,
              pulseProgress,
            );
          } else {
            const pulsePhase =
              (elapsedSeconds / Math.max(profile.saturationPulse.cycleSeconds, 0.2)) * Math.PI * 2 +
              profile.saturationPulse.phaseOffset;
            const pulseProgress = (Math.sin(pulsePhase) + 1) * 0.5;
            currentSaturation = lerp(
              profile.saturationPulse.minimumSaturation,
              profile.saturationPulse.maximumSaturation,
              pulseProgress,
            );
          }
        }

        const glowPulseAmount = profile.color.glowPulseEnabled && isPlayingNow && !reducedMotionActive
          ? (Math.sin((elapsedSeconds / Math.max(profile.color.glowPulseCycleSeconds, 1)) * Math.PI * 2) * 0.5 +
              0.5) *
            profile.color.glowPulseAmount
          : 0;

        playbackVisualMixRef.current = stepImageDepthPlaybackVisualMix(
          playbackVisualMixRef.current,
          isPlayingNow,
          reducedMotionActive,
        );

        planeGroup.position.x = Math.sin(elapsedSeconds * 0.16) * 0.06 * autoAmount + blendedPointer.x * 0.14;
        planeGroup.position.y = Math.cos(elapsedSeconds * 0.12) * 0.04 * autoAmount - blendedPointer.y * 0.11;
        planeGroup.rotation.y = Math.sin(elapsedSeconds * 0.1) * 0.022 * autoAmount + blendedPointer.x * 0.13;
        planeGroup.rotation.x = Math.cos(elapsedSeconds * 0.085) * 0.016 * autoAmount - blendedPointer.y * 0.1;
        plane.position.z =
          IMAGE_DEPTH_PARITY_FRAMING.planeZ + Math.sin(elapsedSeconds * 0.22) * 0.06 * autoAmount;
        glowPlane.material.opacity = 0.05 + material.displacementScale * 0.18 + glowPulseAmount * 0.8;

        camera.position.x = blendedPointer.x * 0.06;
        camera.position.y = -blendedPointer.y * 0.045;
        camera.lookAt(0, 0, -0.4);

        const filter = formatImageDepthPlaybackFilter({
          playbackVisualMix: playbackVisualMixRef.current,
          hueOffsetDegrees,
          currentSaturation,
          glowPulseAmount,
        });

        surfaceGlowUniforms.uSurfaceGlowEnabled.value =
          scenePreset.surfaceGlows.enabled && scenePreset.surfaceGlows.hotspots.length > 0 ? 1 : 0;
        surfaceGlowUniforms.uSurfaceGlowGlobalDim.value = playbackVisualMixRef.current;
        surfaceGlowUniforms.uSurfaceGlowTime.value =
          isPlayingNow && !reducedMotionActive ? elapsedSeconds : 0;

        renderer.domElement.style.filter = filter;

        writeImageDepthParityStats("production", {
          elapsedSeconds,
          playbackMix: playbackVisualMixRef.current,
          grayscale: 1 - playbackVisualMixRef.current,
          hueOffsetDegrees,
          currentSaturation,
          effectiveSaturation:
            playbackVisualMixRef.current * currentSaturation * (1 + glowPulseAmount * 0.7),
          glowPulseAmount,
          brightness: 1 + glowPulseAmount,
          filter,
        });

        renderer.render(scene, camera);
      } catch (error) {
        const visualState = visualStateRef.current;
        renderer.domElement.style.filter = visualState.isPlaying
          ? "grayscale(0) hue-rotate(0deg) saturate(1) brightness(1)"
          : "grayscale(1) hue-rotate(0deg) saturate(0) brightness(0.85)";
        writeImageDepthParityStats("production-error", {
          message: String(error),
        });
        console.warn("Image-depth render loop error", error);
      }

      frameHandle = requestAnimationFrame(renderFrame);
    };

    frameHandle = requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;

      if (frameHandle !== null) {
        cancelAnimationFrame(frameHandle);
      }

      if (readyFrameHandle !== null) {
        cancelAnimationFrame(readyFrameHandle);
      }

      if (readyFallbackTimeoutHandle !== null) {
        window.clearTimeout(readyFallbackTimeoutHandle);
      }

      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      resizeObserver.disconnect();
      sharedMaterialRef.current = null;
      material.dispose();
      geometry.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      scene.clear();
      renderer.dispose();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [asset, profile, scenePreset]);

  useEffect(() => {
    const material = sharedMaterialRef.current;
    if (!material) {
      return;
    }

    material.displacementScale =
      profile.depth.staticDepth * profile.depth.depthStrength * DISPLACEMENT_SCALE_MULTIPLIER;
  }, [profile.depth.staticDepth, profile.depth.depthStrength]);

  return <div className={className ?? "image-depth-scene"} ref={containerRef} role="presentation" />;
}
