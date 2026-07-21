import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MAX_SURFACE_GLOW_HOTSPOTS } from "../constants";
import { stepUvJunglePlaybackVisualMix } from "../../../themes/uv-reactive-jungle/uvReactivePlaybackVisuals";
import { computeFramedPlaneScale, IMAGE_DEPTH_PARITY_FRAMING } from "../../../themes/image-depth/framing";
import type {
  EnvironmentDiagnostics,
  EnvironmentLabSceneProps,
  ImageEnvironmentScenePreset,
  SurfaceGlowHotspot,
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

type SceneCallbacks = {
  onLoadingStateChange?: EnvironmentLabSceneProps["onLoadingStateChange"];
  onDiagnosticsChange?: EnvironmentLabSceneProps["onDiagnosticsChange"];
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
  surfaceGlowPlacementModeEnabled,
  preset,
  asset,
  reducedMotionActive,
  onLoadingStateChange,
  onDiagnosticsChange,
  onCreateSurfaceGlowHotspot,
  onRemoveNearestSurfaceGlowHotspot,
  onSurfaceGlowCapacityReached,
}: EnvironmentLabSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const clickMarkerRef = useRef<HTMLDivElement | null>(null);
  const uvMarkerRef = useRef<HTMLDivElement | null>(null);
  const placementFlashRef = useRef<HTMLDivElement | null>(null);
  const configRef = useRef({
    playbackState,
    surfaceGlowPlacementModeEnabled,
    reducedMotionActive,
    preset,
    asset,
  });
  const callbackRef = useRef<SceneCallbacks>({
    onLoadingStateChange,
    onDiagnosticsChange,
    onCreateSurfaceGlowHotspot,
    onRemoveNearestSurfaceGlowHotspot,
    onSurfaceGlowCapacityReached,
  });

  const placementNote = useMemo(() => {
    if (surfaceGlowPlacementModeEnabled) {
      return `Surface Glow placement enabled: click to add glow, Shift/Alt-click removes nearest glow. Capacity ${MAX_SURFACE_GLOW_HOTSPOTS}.`;
    }

    return "";
  }, [surfaceGlowPlacementModeEnabled]);

  useEffect(() => {
    configRef.current = {
      playbackState,
      surfaceGlowPlacementModeEnabled,
      reducedMotionActive,
      preset,
      asset,
    };
  }, [playbackState, surfaceGlowPlacementModeEnabled, reducedMotionActive, preset, asset]);

  useEffect(() => {
    callbackRef.current = {
      onLoadingStateChange,
      onDiagnosticsChange,
      onCreateSurfaceGlowHotspot,
      onRemoveNearestSurfaceGlowHotspot,
      onSurfaceGlowCapacityReached,
    };
  }, [
    onLoadingStateChange,
    onDiagnosticsChange,
    onCreateSurfaceGlowHotspot,
    onRemoveNearestSurfaceGlowHotspot,
    onSurfaceGlowCapacityReached,
  ]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    callbackRef.current.onLoadingStateChange?.("loading");

    let animationFrameId = 0;
    let disposed = false;
    let colorTexture: THREE.Texture | null = null;
    let depthTexture: THREE.Texture | null = null;

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
    let saturationPulsePhase = 0;
    let surfaceGlowPulseTimeSeconds = 0;
    let currentHueOffset = 0;
    let currentGlowOffset = 0;
    let currentSaturation = configRef.current.preset.behavior.color.saturation;
    let currentEffectiveDepth = 0;
    let currentDisplacementScale = 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08110d);
    scene.fog = new THREE.FogExp2(0x08110d, 0.045);

    const camera = new THREE.PerspectiveCamera(
      IMAGE_DEPTH_PARITY_FRAMING.cameraFovDegrees,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      80,
    );
    camera.position.z = IMAGE_DEPTH_PARITY_FRAMING.cameraZ;
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

  vec3 compressed = surfaceGlowAccum / (vec3(1.0) + surfaceGlowAccum);
  diffuseColor.rgb += compressed * uSurfaceGlowGlobalDim;
}`,
      );
    };
    planeMaterial.needsUpdate = true;

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.z = IMAGE_DEPTH_PARITY_FRAMING.planeZ;
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

    let lastSurfaceGlowSignature = "";

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
      const framedScale = computeFramedPlaneScale({
        viewportWidth: mount.clientWidth,
        viewportHeight: mount.clientHeight,
        cameraFovDegrees: camera.fov,
        cameraZ: camera.position.z,
        planeZ: plane.position.z,
      });

      planeScale.set(framedScale.width, framedScale.height);
      plane.scale.set(planeScale.x, planeScale.y, 1);
      glowPlane.scale.set(planeScale.x * 1.14, planeScale.y * 1.08, 1);

      const shortAxis = Math.max(0.0001, Math.min(planeScale.x, planeScale.y));
      surfaceGlowUniforms.uSurfaceGlowAspectScale.value.set(
        planeScale.x / shortAxis,
        planeScale.y / shortAxis,
      );
    };

    const syncSurfaceGlowUniforms = (activePreset: ImageEnvironmentScenePreset) => {
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
      syncSurfaceGlowUniforms(currentPreset);
      lastSurfaceGlowSignature = surfaceGlowSignature(currentPreset.surfaceGlows.hotspots);
    };

    const handlePlacementClick = (event: PointerEvent) => {
      const currentConfig = configRef.current;

      if (!currentConfig.surfaceGlowPlacementModeEnabled) {
        return;
      }

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
      const aspectMatch = colorAspect > 0 && depthAspect > 0 ? Math.abs(colorAspect - depthAspect) < 0.005 : false;

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

        const depthImage = texture.image as { width?: number; height?: number };
        depthDimensions = {
          width: Number(depthImage.width ?? 0),
          height: Number(depthImage.height ?? 0),
        };
        updateAssetDiagnostics();
      },
      undefined,
      () => callbackRef.current.onLoadingStateChange?.("error"),
    );

    syncSurfaceGlowUniforms(currentPresetAtMount);
    lastSurfaceGlowSignature = surfaceGlowSignature(currentPresetAtMount.surfaceGlows.hotspots);

    const diagnostics: EnvironmentDiagnostics = {
      fps: 0,
      effectiveDepth: 0,
      surfaceGlowCount: currentPresetAtMount.surfaceGlows.hotspots.length,
      hueOffsetDegrees: 0,
      currentSaturation: currentPresetAtMount.behavior.color.saturation,
      shaderSurfaceGlowCapacity: MAX_SURFACE_GLOW_HOTSPOTS,
      surfaceGlowDefaultIntensity: currentPresetAtMount.surfaceGlows.defaults.intensity,
      surfaceGlowAnimationActive: false,
      automaticMotionActive: false,
      surfaceGlowAnimationStatus: "Disabled",
      surfaceGlowPulseFactor: 1,
      assetDiagnostics: EMPTY_ASSET_DIAGNOSTICS,
      mostRecentSurfaceGlowU:
        currentPresetAtMount.surfaceGlows.hotspots[currentPresetAtMount.surfaceGlows.hotspots.length - 1]?.u,
      mostRecentSurfaceGlowV:
        currentPresetAtMount.surfaceGlows.hotspots[currentPresetAtMount.surfaceGlows.hotspots.length - 1]?.v,
    };

    const animate = (now: number) => {
      animationFrameId = window.requestAnimationFrame(animate);

      const deltaSeconds = Math.min(0.2, Math.max(0.001, (now - lastFrameAt) / 1000));
      elapsedSeconds = now / 1000;
      lastFrameAt = now;

      const current = configRef.current;
      const activePreset = current.preset;
      const behavior = activePreset.behavior;
      const isPlaying = current.playbackState === "playing";
      const automaticMotionActive =
        isPlaying && behavior.depth.ambientMotionEnabled && !current.reducedMotionActive;

      const currentSurfaceSignature = surfaceGlowSignature(activePreset.surfaceGlows.hotspots);
      if (currentSurfaceSignature !== lastSurfaceGlowSignature) {
        syncSurfaceGlowUniforms(activePreset);
        lastSurfaceGlowSignature = currentSurfaceSignature;
      }

      pointer.lerp(pointerTarget, 0.05);

      const motionAmount =
        isPlaying && !current.reducedMotionActive
          ? behavior.depth.motionIntensity * behavior.depth.pointerParallaxStrength
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
      const pointerEnabled = behavior.depth.pointerParallaxEnabled && !current.reducedMotionActive;
      const pointerInfluenceTarget = pointerEnabled && pointerIsActive ? 1 : 0;
      pointerInfluence = THREE.MathUtils.lerp(pointerInfluence, pointerInfluenceTarget, 0.045);

      const pointerMotionAmount = pointerEnabled
        ? isPlaying
          ? motionAmount
          : STOPPED_POINTER_PARALLAX_MULTIPLIER
        : 0;

      blendedPointer.x = THREE.MathUtils.lerp(autonomousPointer.x, pointer.x * pointerMotionAmount, pointerInfluence);
      blendedPointer.y = THREE.MathUtils.lerp(autonomousPointer.y, pointer.y * pointerMotionAmount, pointerInfluence);

      const minBreathingDepth = Math.min(behavior.depth.breathingMin, behavior.depth.breathingMax);
      const maxBreathingDepth = Math.max(behavior.depth.breathingMin, behavior.depth.breathingMax);
      const breathingFrequency = (Math.PI * 2) / Math.max(behavior.depth.breathingCycleSeconds, 0.4);

      const breathingWave = Math.sin(elapsedSeconds * breathingFrequency);
      const breathingProgress = (breathingWave + 1) / 2;
      const breathingDepth = automaticMotionActive
        ? THREE.MathUtils.lerp(minBreathingDepth, maxBreathingDepth, breathingProgress)
        : THREE.MathUtils.lerp(minBreathingDepth, maxBreathingDepth, behavior.depth.staticDepth);

      const effectiveDepth = isPlaying ? breathingDepth : behavior.depth.staticDepth;

      playbackVisualMix = stepUvJunglePlaybackVisualMix(
        playbackVisualMix,
        isPlaying,
        current.reducedMotionActive,
      );

      if (automaticMotionActive && behavior.color.driftEnabled) {
        huePhase += (deltaSeconds / Math.max(behavior.color.cycleSeconds, 1)) * Math.PI * 2;
      }

      if (automaticMotionActive && behavior.color.glowPulseEnabled) {
        glowPhase += (deltaSeconds / Math.max(behavior.color.glowPulseCycleSeconds, 1)) * Math.PI * 2;
      }

      if (activePreset.surfaceGlows.enabled && !current.reducedMotionActive && automaticMotionActive) {
        surfaceGlowPulseTimeSeconds += deltaSeconds;
      }

      if (behavior.saturationPulse.enabled && automaticMotionActive) {
        if (behavior.saturationPulse.syncToDepthBreathing) {
          const syncAngle = breathingProgress * Math.PI * 2 + behavior.saturationPulse.phaseOffset;
          const pulseProgress = (Math.sin(syncAngle) + 1) / 2;
          currentSaturation = THREE.MathUtils.lerp(
            behavior.saturationPulse.minimumSaturation,
            behavior.saturationPulse.maximumSaturation,
            pulseProgress,
          );
        } else {
          saturationPulsePhase += (deltaSeconds / Math.max(behavior.saturationPulse.cycleSeconds, 0.2)) * Math.PI * 2;
          const pulseProgress = (Math.sin(saturationPulsePhase + behavior.saturationPulse.phaseOffset) + 1) / 2;
          currentSaturation = THREE.MathUtils.lerp(
            behavior.saturationPulse.minimumSaturation,
            behavior.saturationPulse.maximumSaturation,
            pulseProgress,
          );
        }
      } else if (!behavior.saturationPulse.enabled) {
        currentSaturation = behavior.color.saturation;
      }

      currentHueOffset = behavior.color.driftEnabled ? Math.sin(huePhase) * behavior.color.hueRangeDegrees : 0;
      currentGlowOffset = behavior.color.glowPulseEnabled
        ? (Math.sin(glowPhase) * 0.5 + 0.5) * behavior.color.glowPulseAmount
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

      planeMaterial.displacementScale = effectiveDepth * behavior.depth.depthStrength * DISPLACEMENT_SCALE_MULTIPLIER;
      currentEffectiveDepth = effectiveDepth;
      currentDisplacementScale = planeMaterial.displacementScale;
      planeMaterial.bumpScale = effectiveDepth * 0.04;

      planeGroup.position.x = Math.sin(elapsedSeconds * 0.16) * 0.06 * autoAmount + blendedPointer.x * 0.14;
      planeGroup.position.y = Math.cos(elapsedSeconds * 0.12) * 0.04 * autoAmount - blendedPointer.y * 0.11;
      planeGroup.rotation.y = Math.sin(elapsedSeconds * 0.1) * 0.022 * autoAmount + blendedPointer.x * 0.13;
      planeGroup.rotation.x = Math.cos(elapsedSeconds * 0.085) * 0.016 * autoAmount - blendedPointer.y * 0.1;
      plane.position.z = -0.15 + Math.sin(elapsedSeconds * 0.22) * 0.06 * autoAmount;
      glowPlane.material.opacity = 0.05 + effectiveDepth * 0.06 + currentGlowOffset * 0.8;

      camera.position.x = blendedPointer.x * 0.06;
      camera.position.y = -blendedPointer.y * 0.045;
      camera.lookAt(0, 0, -0.4);

      renderer.render(scene, camera);

      if (elapsedSeconds - lastDiagnosticUpdateAt >= DIAGNOSTIC_UPDATE_INTERVAL_SECONDS) {
        lastDiagnosticUpdateAt = elapsedSeconds;
        diagnostics.fps = diagnostics.fps === 0 ? 1 / deltaSeconds : diagnostics.fps * 0.65 + (1 / deltaSeconds) * 0.35;
        diagnostics.effectiveDepth = effectiveDepth;
        diagnostics.surfaceGlowCount = activePreset.surfaceGlows.hotspots.length;
        diagnostics.hueOffsetDegrees = currentHueOffset;
        diagnostics.currentSaturation = currentSaturation;
        diagnostics.shaderSurfaceGlowCapacity = MAX_SURFACE_GLOW_HOTSPOTS;
        diagnostics.surfaceGlowDefaultIntensity = activePreset.surfaceGlows.defaults.intensity;
        diagnostics.surfaceGlowAnimationActive = automaticMotionActive && activePreset.surfaceGlows.enabled;
        diagnostics.automaticMotionActive = automaticMotionActive;
        diagnostics.surfaceGlowAnimationStatus = describeAnimationStatus({
          enabled: activePreset.surfaceGlows.enabled,
          isPlaying,
          ambientMotionEnabled: behavior.depth.ambientMotionEnabled,
          reducedMotionActive: current.reducedMotionActive,
        });

        const firstGlow = activePreset.surfaceGlows.hotspots[0];
        if (!firstGlow || !firstGlow.pulseEnabled) {
          diagnostics.surfaceGlowPulseFactor = 1;
        } else {
          const cycle = Math.max(firstGlow.pulseCycleSeconds, 0.2);
          const wave = Math.sin((surfaceGlowPulseTimeSeconds / cycle) * Math.PI * 2 + firstGlow.phase * Math.PI * 2) * 0.5 + 0.5;
          const pulseShape = THREE.MathUtils.smoothstep(wave, 0.08, 0.92);
          diagnostics.surfaceGlowPulseFactor = THREE.MathUtils.lerp(
            firstGlow.minimumIntensityMultiplier,
            firstGlow.maximumIntensityMultiplier,
            pulseShape,
          );
        }

        diagnostics.mostRecentSurfaceGlowU = activePreset.surfaceGlows.hotspots[activePreset.surfaceGlows.hotspots.length - 1]?.u;
        diagnostics.mostRecentSurfaceGlowV = activePreset.surfaceGlows.hotspots[activePreset.surfaceGlows.hotspots.length - 1]?.v;
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
