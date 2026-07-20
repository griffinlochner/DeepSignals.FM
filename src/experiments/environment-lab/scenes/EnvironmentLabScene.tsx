import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MAX_SURFACE_GLOW_HOTSPOTS } from "../constants";
import { stepUvJunglePlaybackVisualMix } from "../../../themes/uv-reactive-jungle/uvReactivePlaybackVisuals";
import type {
  EnvironmentDiagnostics,
  EnvironmentLabSceneProps,
  ImageEnvironmentPreset,
  SurfaceGlowHotspot,
  TwinkleHotspot,
} from "../types";

const DIAGNOSTIC_UPDATE_INTERVAL_SECONDS = 0.16;
const DISPLACEMENT_SCALE_MULTIPLIER = 0.36;
const PLAYING_DRIFT_AMOUNT = 0.6;
const PLAYING_DRIFT_SPEED = 0.58;
const POINTER_IDLE_TIMEOUT_SECONDS = 1.25;
const STOPPED_POINTER_PARALLAX_MULTIPLIER = 0.12;
const SURFACE_PICK_TARGET_MIN_SIZE = 2;

const EMPTY_ASSET_DIAGNOSTICS = {
  colorWidth: 0,
  colorHeight: 0,
  depthWidth: 0,
  depthHeight: 0,
  colorAspectRatio: 0,
  depthAspectRatio: 0,
  dimensionsMatch: false,
  aspectMatch: false,
};

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
  onSurfaceGlowCapacityReached?: EnvironmentLabSceneProps["onSurfaceGlowCapacityReached"];
};

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
    uSurfaceGlowSoftness: {
      value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0.65),
    },
    uSurfaceGlowIntensity: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
    uSurfaceGlowPulseEnabled: {
      value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0),
    },
    uSurfaceGlowPulseMode: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
    uSurfaceGlowPulseAmount: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
    uSurfaceGlowPulseMinIntensity: {
      value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 1),
    },
    uSurfaceGlowPulseMaxIntensity: {
      value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 1),
    },
    uSurfaceGlowPulseRadiusExpansion: {
      value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 1),
    },
    uSurfaceGlowPulseCycles: {
      value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 3.5),
    },
    uSurfaceGlowHueDriftEnabled: {
      value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0),
    },
    uSurfaceGlowHueDriftRange: {
      value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0),
    },
    uSurfaceGlowHueDriftCycles: {
      value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 20),
    },
    uSurfaceGlowPhases: { value: Array.from({ length: MAX_SURFACE_GLOW_HOTSPOTS }, () => 0) },
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
        hotspot.pulseMode,
        hotspot.pulseAmount.toFixed(4),
        hotspot.minimumIntensityMultiplier.toFixed(4),
        hotspot.maximumIntensityMultiplier.toFixed(4),
        hotspot.radiusExpansionMultiplier.toFixed(4),
        hotspot.pulseCycleSeconds.toFixed(4),
        hotspot.hueDriftEnabled ? 1 : 0,
        hotspot.hueDriftRangeDegrees.toFixed(4),
        hotspot.hueDriftCycleSeconds.toFixed(4),
        hotspot.phase.toFixed(4),
      ].join("|");
    })
    .join(";");
}

function getPulseModeIndex(hotspot: SurfaceGlowHotspot): number {
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

function describeAnimationStatus(params: {
  enabled: boolean;
  isPlaying: boolean;
  ambientMotionEnabled: boolean;
  reducedMotionActive: boolean;
}) {
  if (!params.enabled) {
    return "Disabled";
  }

  if (params.reducedMotionActive) {
    return "Paused because reduced motion is enabled";
  }

  if (!params.isPlaying) {
    return "Paused because Stopped";
  }

  if (!params.ambientMotionEnabled) {
    return "Paused because Ambient Motion is off";
  }

  return "Active";
}

function EnvironmentLabScene({
  playbackState,
  twinklePlacementModeEnabled,
  surfaceGlowPlacementModeEnabled,
  hazeMotionPreview4xEnabled,
  preset,
  asset,
  reducedMotionActive,
  onLoadingStateChange,
  onDiagnosticsChange,
  onCreateTwinkleHotspot,
  onRemoveNearestTwinkleHotspot,
  onCreateSurfaceGlowHotspot,
  onRemoveNearestSurfaceGlowHotspot,
  onSurfaceGlowCapacityReached,
}: EnvironmentLabSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const hazeRef = useRef<HTMLDivElement | null>(null);
  const clickMarkerRef = useRef<HTMLDivElement | null>(null);
  const uvMarkerRef = useRef<HTMLDivElement | null>(null);
  const placementFlashRef = useRef<HTMLDivElement | null>(null);
  const configRef = useRef({
    playbackState,
    twinklePlacementModeEnabled,
    surfaceGlowPlacementModeEnabled,
    hazeMotionPreview4xEnabled,
    reducedMotionActive,
    preset,
    asset,
  });
  const callbackRef = useRef<SceneCallbacks>({
    onLoadingStateChange,
    onDiagnosticsChange,
    onCreateTwinkleHotspot,
    onRemoveNearestTwinkleHotspot,
    onCreateSurfaceGlowHotspot,
    onRemoveNearestSurfaceGlowHotspot,
    onSurfaceGlowCapacityReached,
  });

  const placementNote = useMemo(() => {
    if (surfaceGlowPlacementModeEnabled && twinklePlacementModeEnabled) {
      return `Surface Glow and Twinkle placement enabled: click to place Surface Glow, Shift/Alt-click removes nearest Surface Glow. Capacity ${MAX_SURFACE_GLOW_HOTSPOTS}.`;
    }

    if (surfaceGlowPlacementModeEnabled) {
      return `Surface Glow placement enabled: click to add glow, Shift/Alt-click removes nearest glow. Capacity ${MAX_SURFACE_GLOW_HOTSPOTS}.`;
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
      hazeMotionPreview4xEnabled,
      reducedMotionActive,
      preset,
      asset,
    };
  }, [
    playbackState,
    twinklePlacementModeEnabled,
    surfaceGlowPlacementModeEnabled,
    hazeMotionPreview4xEnabled,
    reducedMotionActive,
    preset,
    asset,
  ]);

  useEffect(() => {
    callbackRef.current = {
      onLoadingStateChange,
      onDiagnosticsChange,
      onCreateTwinkleHotspot,
      onRemoveNearestTwinkleHotspot,
      onCreateSurfaceGlowHotspot,
      onRemoveNearestSurfaceGlowHotspot,
      onSurfaceGlowCapacityReached,
    };
  }, [
    onLoadingStateChange,
    onDiagnosticsChange,
    onCreateTwinkleHotspot,
    onRemoveNearestTwinkleHotspot,
    onCreateSurfaceGlowHotspot,
    onRemoveNearestSurfaceGlowHotspot,
    onSurfaceGlowCapacityReached,
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
    let currentEffectiveDepth = 0;
    let currentDisplacementScale = 0;

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
      shader.uniforms.uSurfaceGlowPulseMinIntensity =
        surfaceGlowUniforms.uSurfaceGlowPulseMinIntensity;
      shader.uniforms.uSurfaceGlowPulseMaxIntensity =
        surfaceGlowUniforms.uSurfaceGlowPulseMaxIntensity;
      shader.uniforms.uSurfaceGlowPulseRadiusExpansion =
        surfaceGlowUniforms.uSurfaceGlowPulseRadiusExpansion;
      shader.uniforms.uSurfaceGlowPulseCycles = surfaceGlowUniforms.uSurfaceGlowPulseCycles;
      shader.uniforms.uSurfaceGlowHueDriftEnabled =
        surfaceGlowUniforms.uSurfaceGlowHueDriftEnabled;
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
      float cycle = max(uSurfaceGlowPulseCycles[i], 0.2);
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

    float minIntensity = uSurfaceGlowPulseMinIntensity[i];
    float maxIntensity = max(minIntensity, uSurfaceGlowPulseMaxIntensity[i]);
    float intensityMultiplier = mix(minIntensity, maxIntensity, brightnessMix);

    float expansion = 1.0 + (max(uSurfaceGlowPulseRadiusExpansion[i], 1.0) - 1.0) * bloomMix;

    float baseRadius = max(uSurfaceGlowRadii[i], 0.0001);
    float animatedRadius = baseRadius * mix(1.0, expansion, uSurfaceGlowPulseAmount[i]);
    float softness = clamp(uSurfaceGlowSoftness[i], 0.05, 0.98);
    float inner = animatedRadius * (1.0 - softness);

    vec2 hotspotUv = applySurfaceUvTransform(uSurfaceGlowUVs[i]);
    vec2 delta = (uvTransformed - hotspotUv) * uSurfaceGlowAspectScale;
    float distToGlow = length(delta);
    float radialFalloff = 1.0 - smoothstep(inner, animatedRadius, distToGlow);

    vec3 glowColor = uSurfaceGlowColors[i];
    if (uSurfaceGlowHueDriftEnabled[i] > 0.5) {
      float hueCycle = max(uSurfaceGlowHueDriftCycles[i], 0.4);
      float hueWave = sin((uSurfaceGlowTime / hueCycle) * 6.28318530718 + uSurfaceGlowPhases[i] * 6.28318530718);
      float hueOffset = (hueWave * uSurfaceGlowHueDriftRange[i]) / 360.0;
      vec3 hsv = rgb2hsv(glowColor);
      hsv.x = fract(hsv.x + hueOffset);
      glowColor = hsv2rgb(hsv);
    }

    surfaceGlowAccum += glowColor * radialFalloff * uSurfaceGlowIntensity[i] * intensityMultiplier;
  }

  // Soft compression avoids clipped flat color at high intensities while preserving pulse contrast.
  vec3 compressed = surfaceGlowAccum / (vec3(1.0) + surfaceGlowAccum);
  diffuseColor.rgb += compressed * uSurfaceGlowGlobalDim;
}`,
      );
    };
    planeMaterial.needsUpdate = true;

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.z = -0.15;
    planeGroup.add(plane);

    const pickingScene = new THREE.Scene();
    const pickingMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uDisplacementMap: { value: null as THREE.Texture | null },
        uDisplacementScale: { value: 0 },
      },
      vertexShader: `
varying vec2 vPickUv;
uniform sampler2D uDisplacementMap;
uniform float uDisplacementScale;

void main() {
  vPickUv = uv;
  vec3 transformed = position;
  float sampledDepth = texture2D(uDisplacementMap, uv).x;
  transformed += normalize(normal) * ((sampledDepth - 0.5) * uDisplacementScale);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`,
      fragmentShader: `
varying vec2 vPickUv;

void main() {
  gl_FragColor = vec4(vPickUv, 0.0, 1.0);
}
`,
      depthWrite: true,
      depthTest: true,
      transparent: false,
    });
    const pickingPlane = new THREE.Mesh(planeGeometry, pickingMaterial);
    pickingPlane.matrixAutoUpdate = false;
    pickingScene.add(pickingPlane);

    let pickRenderTarget: THREE.WebGLRenderTarget | null = null;
    const pickPixel = new Uint8Array(4);

    const hidePlacementMarkers = () => {
      if (clickMarkerRef.current) {
        clickMarkerRef.current.style.opacity = "0";
      }
      if (uvMarkerRef.current) {
        uvMarkerRef.current.style.opacity = "0";
      }
    };

    const setMarkerPosition = (marker: HTMLDivElement | null, x: number, y: number) => {
      if (!marker) {
        return;
      }

      marker.style.left = `${x.toFixed(2)}px`;
      marker.style.top = `${y.toFixed(2)}px`;
      marker.style.opacity = "1";
    };

    const flashPlacementMarker = (x: number, y: number) => {
      const marker = placementFlashRef.current;
      if (!marker) {
        return;
      }

      marker.style.left = `${x.toFixed(2)}px`;
      marker.style.top = `${y.toFixed(2)}px`;
      marker.classList.remove("environment-lab__placement-flash--active");
      window.requestAnimationFrame(() => {
        marker.classList.add("environment-lab__placement-flash--active");
      });
    };

    const updatePlacementDebugDiagnostics = (
      diagnostics: EnvironmentDiagnostics,
      details: {
        normalizedX: number;
        normalizedY: number;
        decodedU: number;
        decodedV: number;
        foundPlane: boolean;
      },
    ) => {
      if (!import.meta.env.DEV) {
        return;
      }

      diagnostics.surfaceGlowPickCanvasX = details.normalizedX;
      diagnostics.surfaceGlowPickCanvasY = details.normalizedY;
      diagnostics.surfaceGlowPickU = details.decodedU;
      diagnostics.surfaceGlowPickV = details.decodedV;
      diagnostics.surfaceGlowPickFoundPlane = details.foundPlane;
      diagnostics.surfaceGlowPickEffectiveDepth = currentEffectiveDepth;
      callbackRef.current.onDiagnosticsChange?.({ ...diagnostics });
    };

    const ensurePickRenderTarget = () => {
      const drawingBufferSize = new THREE.Vector2();
      renderer.getDrawingBufferSize(drawingBufferSize);

      const width = Math.max(SURFACE_PICK_TARGET_MIN_SIZE, Math.floor(drawingBufferSize.x));
      const height = Math.max(SURFACE_PICK_TARGET_MIN_SIZE, Math.floor(drawingBufferSize.y));

      if (!pickRenderTarget || pickRenderTarget.width !== width || pickRenderTarget.height !== height) {
        pickRenderTarget?.dispose();
        pickRenderTarget = new THREE.WebGLRenderTarget(width, height, {
          depthBuffer: true,
          stencilBuffer: false,
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          generateMipmaps: false,
          format: THREE.RGBAFormat,
          type: THREE.UnsignedByteType,
        });
      }

      return pickRenderTarget;
    };

    const tryPickSurfaceUv = (event: PointerEvent, diagnostics: EnvironmentDiagnostics) => {
      if (!depthTexture) {
        updatePlacementDebugDiagnostics(diagnostics, {
          normalizedX: -1,
          normalizedY: -1,
          decodedU: -1,
          decodedV: -1,
          foundPlane: false,
        });
        hidePlacementMarkers();
        return null;
      }

      const canvas = renderer.domElement;
      const rect = canvas.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        updatePlacementDebugDiagnostics(diagnostics, {
          normalizedX: -1,
          normalizedY: -1,
          decodedU: -1,
          decodedV: -1,
          foundPlane: false,
        });
        hidePlacementMarkers();
        return null;
      }

      const normalizedX = (event.clientX - rect.left) / rect.width;
      const normalizedY = (event.clientY - rect.top) / rect.height;

      if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
        updatePlacementDebugDiagnostics(diagnostics, {
          normalizedX,
          normalizedY,
          decodedU: -1,
          decodedV: -1,
          foundPlane: false,
        });
        hidePlacementMarkers();
        return null;
      }

      const ndcX = normalizedX * 2 - 1;
      const ndcY = -(normalizedY * 2 - 1);
      ndcPointer.set(ndcX, ndcY);

      const target = ensurePickRenderTarget();
      const width = target.width;
      const height = target.height;
      const pixelX = Math.max(0, Math.min(width - 1, Math.floor(normalizedX * width)));
      const pixelY = Math.max(0, Math.min(height - 1, Math.floor((1 - normalizedY) * height)));

      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);

      pickingPlane.matrix.copy(plane.matrixWorld);
      pickingMaterial.uniforms.uDisplacementMap.value = depthTexture;
      pickingMaterial.uniforms.uDisplacementScale.value = currentDisplacementScale;

      const previousRenderTarget = renderer.getRenderTarget();
      const previousToneMapping = renderer.toneMapping;
      const previousOutputColorSpace = renderer.outputColorSpace;
      const previousClearColor = renderer.getClearColor(new THREE.Color());
      const previousClearAlpha = renderer.getClearAlpha();
      const previousAutoClear = renderer.autoClear;
      const previousXrState = renderer.xr.enabled;

      renderer.xr.enabled = false;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.autoClear = true;
      renderer.setRenderTarget(target);
      renderer.setClearColor(new THREE.Color(0x000000), 0);
      renderer.clear(true, true, true);
      renderer.render(pickingScene, camera);
      renderer.readRenderTargetPixels(target, pixelX, pixelY, 1, 1, pickPixel);
      renderer.setRenderTarget(previousRenderTarget);
      renderer.setClearColor(previousClearColor, previousClearAlpha);
      renderer.autoClear = previousAutoClear;
      renderer.outputColorSpace = previousOutputColorSpace;
      renderer.toneMapping = previousToneMapping;
      renderer.xr.enabled = previousXrState;

      const foundPlane = pickPixel[3] > 0;

      if (!foundPlane) {
        updatePlacementDebugDiagnostics(diagnostics, {
          normalizedX,
          normalizedY,
          decodedU: -1,
          decodedV: -1,
          foundPlane: false,
        });

        if (import.meta.env.DEV) {
          setMarkerPosition(clickMarkerRef.current, normalizedX * rect.width, normalizedY * rect.height);
          if (uvMarkerRef.current) {
            uvMarkerRef.current.style.opacity = "0";
          }
        }

        return null;
      }

      const decodedU = THREE.MathUtils.clamp(pickPixel[0] / 255, 0, 1);
      const decodedV = THREE.MathUtils.clamp(pickPixel[1] / 255, 0, 1);

      updatePlacementDebugDiagnostics(diagnostics, {
        normalizedX,
        normalizedY,
        decodedU,
        decodedV,
        foundPlane: true,
      });

      flashPlacementMarker(normalizedX * rect.width, normalizedY * rect.height);

      if (import.meta.env.DEV) {
        setMarkerPosition(clickMarkerRef.current, normalizedX * rect.width, normalizedY * rect.height);

        raycaster.setFromCamera(ndcPointer, camera);
        const debugHit = raycaster.intersectObject(plane, false)[0];

        if (debugHit?.point) {
          const projected = debugHit.point.clone().project(camera);
          const markerX = ((projected.x + 1) / 2) * rect.width;
          const markerY = ((1 - projected.y) / 2) * rect.height;
          setMarkerPosition(uvMarkerRef.current, markerX, markerY);
        } else {
          setMarkerPosition(uvMarkerRef.current, normalizedX * rect.width, normalizedY * rect.height);
        }
      }

      return {
        u: decodedU,
        v: decodedV,
      };
    };

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

      const shortAxis = Math.max(0.0001, Math.min(planeScale.x, planeScale.y));
      surfaceGlowUniforms.uSurfaceGlowAspectScale.value.set(
        planeScale.x / shortAxis,
        planeScale.y / shortAxis,
      );
    };

    const toPlanePosition = (u: number, v: number) => {
      const x = (u - 0.5) * planeScale.x;
      const y = (0.5 - v) * planeScale.y;
      return new THREE.Vector3(x, y, 0);
    };

    const syncSurfaceGlowUniforms = (activePreset: ImageEnvironmentPreset) => {
      const activeHotspots = activePreset.surfaceGlows.hotspots.slice(0, MAX_SURFACE_GLOW_HOTSPOTS);
      surfaceGlowUniforms.uSurfaceGlowCount.value = activeHotspots.length;

      const map = planeMaterial.map;
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
          surfaceGlowUniforms.uSurfaceGlowPulseMinIntensity.value[index] =
            hotspot.minimumIntensityMultiplier;
          surfaceGlowUniforms.uSurfaceGlowPulseMaxIntensity.value[index] =
            hotspot.maximumIntensityMultiplier;
          surfaceGlowUniforms.uSurfaceGlowPulseRadiusExpansion.value[index] =
            hotspot.radiusExpansionMultiplier;
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

    const rebuildTwinkles = (activePreset: ImageEnvironmentPreset) => {
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

    const rebuildParticles = (activePreset: ImageEnvironmentPreset) => {
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
      const rect = renderer.domElement.getBoundingClientRect();
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

      if (currentConfig.surfaceGlowPlacementModeEnabled) {
        const pickedSurfaceUv = tryPickSurfaceUv(event, diagnostics);

        if (!pickedSurfaceUv) {
          return;
        }

        if (event.shiftKey || event.altKey) {
          callbackRef.current.onRemoveNearestSurfaceGlowHotspot?.(pickedSurfaceUv.u, pickedSurfaceUv.v);
          return;
        }

        if (currentConfig.preset.surfaceGlows.hotspots.length >= MAX_SURFACE_GLOW_HOTSPOTS) {
          callbackRef.current.onSurfaceGlowCapacityReached?.();
          return;
        }

        callbackRef.current.onCreateSurfaceGlowHotspot?.(pickedSurfaceUv.u, pickedSurfaceUv.v, Math.random());
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
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
    const initialAsset = configRef.current.asset;

    let colorDimensions = { width: 0, height: 0 };
    let depthDimensions = { width: 0, height: 0 };

    const updateAssetDiagnostics = () => {
      const colorAspect = colorDimensions.height > 0 ? colorDimensions.width / colorDimensions.height : 0;
      const depthAspect = depthDimensions.height > 0 ? depthDimensions.width / depthDimensions.height : 0;
      const dimensionsMatch =
        colorDimensions.width > 0 &&
        colorDimensions.height > 0 &&
        depthDimensions.width > 0 &&
        depthDimensions.height > 0 &&
        colorDimensions.width === depthDimensions.width &&
        colorDimensions.height === depthDimensions.height;
      const aspectMatch =
        colorAspect > 0 && depthAspect > 0
          ? Math.abs(colorAspect - depthAspect) < 0.005
          : false;

      diagnostics.assetDiagnostics = {
        colorWidth: colorDimensions.width,
        colorHeight: colorDimensions.height,
        depthWidth: depthDimensions.width,
        depthHeight: depthDimensions.height,
        colorAspectRatio: colorAspect,
        depthAspectRatio: depthAspect,
        dimensionsMatch,
        aspectMatch,
      };
    };

    textureLoader.load(
      initialAsset.colorImageUrl,
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

        const image = texture.image as { width?: number; height?: number };
        colorDimensions = {
          width: Number(image.width ?? 0),
          height: Number(image.height ?? 0),
        };
        updateAssetDiagnostics();
      },
      undefined,
      () => callbackRef.current.onLoadingStateChange?.("error"),
    );

    textureLoader.load(
      initialAsset.depthMapUrl,
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

        const depthImage = texture.image as { width?: number; height?: number };
        depthDimensions = {
          width: Number(depthImage.width ?? 0),
          height: Number(depthImage.height ?? 0),
        };
        updateAssetDiagnostics();

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
      shaderSurfaceGlowCapacity: MAX_SURFACE_GLOW_HOTSPOTS,
      surfaceGlowDefaultIntensity: currentPresetAtMount.surfaceGlows.defaultIntensity,
      surfaceGlowAnimationActive: false,
      automaticMotionActive: false,
      surfaceGlowAnimationStatus: "Disabled",
      surfaceGlowPulseFactor: 1,
      hazeAnimationStatus: "Disabled",
      hazeOffsetX: 0,
      hazeOffsetY: 0,
      assetDiagnostics: EMPTY_ASSET_DIAGNOSTICS,
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

      const hazeAnimationSpeed = current.hazeMotionPreview4xEnabled ? 4 : 1;
      if (automaticMotionActive && activePreset.haze.enabled) {
        hazePhase +=
          (deltaSeconds / Math.max(activePreset.haze.driftCycleSeconds, 2)) *
          Math.PI *
          2 *
          hazeAnimationSpeed;
      }

      if (activePreset.surfaceGlows.enabled && !current.reducedMotionActive) {
        if (automaticMotionActive) {
          surfaceGlowPulseTimeSeconds += deltaSeconds;
        }
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
      surfaceGlowUniforms.uSurfaceGlowGlobalDim.value = isPlaying ? 1 : 0.3;
      surfaceGlowUniforms.uSurfaceGlowTime.value = surfaceGlowPulseTimeSeconds;

      planeMaterial.displacementScale =
        effectiveDepth * activePreset.depth.depthStrength * DISPLACEMENT_SCALE_MULTIPLIER;
      currentEffectiveDepth = effectiveDepth;
      currentDisplacementScale = planeMaterial.displacementScale;
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
      const hazeDistance = activePreset.haze.driftDistance;
      const biasX = activePreset.haze.driftBiasX;
      const biasY = activePreset.haze.driftBiasY;
      const baseX = Math.sin(hazePhase) * hazeDistance;
      const baseY = Math.cos(hazePhase * 0.72) * hazeDistance;
      const hazeOffsetX = baseX * (0.25 + Math.abs(biasX)) * Math.sign(biasX || 1);
      const hazeOffsetY = baseY * (0.25 + Math.abs(biasY)) * Math.sign(biasY || 1);

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
        diagnostics.shaderSurfaceGlowCapacity = MAX_SURFACE_GLOW_HOTSPOTS;
        diagnostics.surfaceGlowDefaultIntensity = activePreset.surfaceGlows.defaultIntensity;
        diagnostics.surfaceGlowAnimationActive =
          automaticMotionActive && activePreset.surfaceGlows.enabled;
        diagnostics.automaticMotionActive = automaticMotionActive;
        diagnostics.surfaceGlowAnimationStatus = describeAnimationStatus({
          enabled: activePreset.surfaceGlows.enabled,
          isPlaying,
          ambientMotionEnabled: activePreset.depth.ambientMotionEnabled,
          reducedMotionActive: current.reducedMotionActive,
        });
        diagnostics.hazeAnimationStatus = describeAnimationStatus({
          enabled: activePreset.haze.enabled,
          isPlaying,
          ambientMotionEnabled: activePreset.depth.ambientMotionEnabled,
          reducedMotionActive: current.reducedMotionActive,
        });
        diagnostics.hazeOffsetX = hazeOffsetX;
        diagnostics.hazeOffsetY = hazeOffsetY;

        const firstGlow = activePreset.surfaceGlows.hotspots[0];
        if (!firstGlow || !firstGlow.pulseEnabled) {
          diagnostics.surfaceGlowPulseFactor = 1;
        } else {
          const cycle = Math.max(firstGlow.pulseCycleSeconds, 0.2);
          const wave =
            Math.sin(
              (surfaceGlowPulseTimeSeconds / cycle) * Math.PI * 2 +
                firstGlow.phase * Math.PI * 2,
            ) *
              0.5 +
            0.5;
          const pulseShape = THREE.MathUtils.smoothstep(wave, 0.08, 0.92);
          diagnostics.surfaceGlowPulseFactor = THREE.MathUtils.lerp(
            firstGlow.minimumIntensityMultiplier,
            firstGlow.maximumIntensityMultiplier,
            pulseShape,
          );
        }

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
      pickingMaterial.dispose();
      pickRenderTarget?.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();

      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [asset.id]);

  return (
    <>
      <div ref={mountRef} className="environment-lab__scene-root" />
      <div ref={hazeRef} className="environment-lab__haze" aria-hidden="true" />
      <div ref={placementFlashRef} className="environment-lab__placement-flash" aria-hidden="true" />
      {import.meta.env.DEV && (
        <>
          <div ref={clickMarkerRef} className="environment-lab__debug-marker" aria-hidden="true" />
          <div
            ref={uvMarkerRef}
            className="environment-lab__debug-marker environment-lab__debug-marker--uv"
            aria-hidden="true"
          />
        </>
      )}
      {placementNote && (
        <p className="environment-lab__placement-note" aria-live="polite">
          {placementNote}
        </p>
      )}
    </>
  );
}

export default EnvironmentLabScene;
