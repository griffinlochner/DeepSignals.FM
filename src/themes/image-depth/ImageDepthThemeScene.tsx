import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";
import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import type { ThemeSceneProps } from "../themeTypes";
import { formatImageDepthPlaybackFilter, stepImageDepthPlaybackVisualMix } from "./imageDepthPlaybackVisuals";
import { resolveAutonomousParallaxTarget } from "./autonomousParallaxTarget";
import { computeImageDepthFraming, IMAGE_DEPTH_PARITY_FRAMING } from "./framing";
import { getImageDepthTexturePair } from "./imageDepthTextureCache";
import { AmbientParticleField } from "./ambientParticleField";
import { REACTIVE_BEHAVIOR_PROFILES } from "./reactivePreviewProfile";
import {
  decrementImageDepthRendererInstance,
  decrementImageDepthSceneInstance,
  incrementImageDepthRendererInstance,
  incrementImageDepthSceneInstance,
  resolveImageDepthElapsedSeconds,
  writeImageDepthParityStats,
} from "./timing";
import type { ImageDepthAsset, ImageDepthScenePreset } from "./types";

type ImageDepthThemeSceneProps = ThemeSceneProps & {
  sceneId: string;
  sceneBackdrop?: string;
  asset: ImageDepthAsset;
  scenePreset: ImageDepthScenePreset;
  className?: string;
  manualDepthOverride?: number;
  manualHueShiftOverrideDegrees?: number | null;
  manualSaturationOverrideMultiplier?: number | null;
  preserveColorWhenStopped?: boolean;
  onDevSceneCountersChange?: (counters: ImageDepthSceneDevCounters) => void;
  onDevColorDiagnosticsChange?: (diagnostics: ImageDepthSceneColorDiagnostics) => void;
};

export type ImageDepthSceneColorDiagnostics = {
  colorTextureUrl: string;
  depthTextureUrl: string;
  finalFilterString: string;
  finalHueDegrees: number;
  finalSaturationMultiplier: number;
  finalGrayscaleAmount: number;
  finalBrightnessMultiplier: number;
  finalContrastMultiplier: number;
  playbackVisualState: 'playing-color' | 'stopped-color-preserved' | 'stopped-grayscale';
};

export type ImageDepthSceneDevCounters = {
  sceneComponentMountCount: number;
  sceneComponentUnmountCount: number;
  rendererCreationCount: number;
  textureLoadCount: number;
  materialGeometryInitializationCount: number;
  environmentChangeCount: number;
  depthUpdateCount: number;
};

const imageDepthSceneDevCounters: ImageDepthSceneDevCounters = {
  sceneComponentMountCount: 0,
  sceneComponentUnmountCount: 0,
  rendererCreationCount: 0,
  textureLoadCount: 0,
  materialGeometryInitializationCount: 0,
  environmentChangeCount: 0,
  depthUpdateCount: 0,
};

function publishImageDepthSceneDevCounters(
  callback: ImageDepthThemeSceneProps['onDevSceneCountersChange'],
) {
  callback?.({ ...imageDepthSceneDevCounters });
}
const SATURATION_EPSILON = 0.0001;
const DISPLACEMENT_SCALE_MULTIPLIER = 0.36;
const FALLBACK_BEAT_INTERVAL_MS = 420;
const FALLBACK_ACCEPTED_EVENT_MIN_INTERVAL_MS = 300;

const REACTIVE_DEPTH_MIN = 0;
const REACTIVE_DEPTH_MAX = 1.35;
const AUTHORED_DEPTH_MIN = 0;
const AUTHORED_DEPTH_MAX = 2;

function isReactiveIsolationEnabled() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("reactiveIsolation") === "1";
}

function isAmbientParticlesEnabled() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("ambientParticles") === "1";
}

function isParticleDebugEnabled() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("particleDebug") === "1";
}
function isParticlePerfEnabled() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("particlePerf") === "1";
}

function isParityStatsEnabled() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("imageDepthStats") === "1";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function wrapDegrees(value: number) {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = clamp((value - edge0) / Math.max(edge1 - edge0, SATURATION_EPSILON), 0, 1);
  return x * x * (3 - 2 * x);
}

function resolveBeatIntervalMs(sourceBpm: number | null) {
  if (!Number.isFinite(sourceBpm) || sourceBpm === null || sourceBpm <= 0) {
    return null;
  }

  return 60000 / sourceBpm;
}

function resolveAcceptedEventMinimumIntervalMs(sourceBpm: number | null) {
  const beatIntervalMs = resolveBeatIntervalMs(sourceBpm);

  if (!beatIntervalMs) {
    return FALLBACK_ACCEPTED_EVENT_MIN_INTERVAL_MS;
  }

  return clamp(beatIntervalMs * 0.78, beatIntervalMs * 0.72, beatIntervalMs * 0.82);
}

function normalizeWithFloor(value: number, floor: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeFloor = clamp(floor, 0, 0.99);
  return clamp((safeValue - safeFloor) / Math.max(1 - safeFloor, SATURATION_EPSILON), 0, 1);
}

function shapeCurve(value: number, exponent: number) {
  return Math.pow(clamp(value, 0, 1), Math.max(exponent, SATURATION_EPSILON));
}

function stepSmoothedValue(
  current: number,
  target: number,
  deltaSeconds: number,
  attackPerSecond: number,
  releasePerSecond: number,
) {
  const rate = target > current ? attackPerSecond : releasePerSecond;
  const blend = 1 - Math.exp(-Math.max(rate, 0) * Math.max(deltaSeconds, 0));
  return current + (target - current) * blend;
}

export function ImageDepthThemeScene({
  isPlaying,
  signalId,
  reducedMotion,
  motionEnabled,
  sourceBpm,
  getLatestAudioSnapshot,
  reactivePreviewEnabled,
  reactiveBehavior = 'chill',
  reactiveDepthMode = 'default',
  onReactivePreviewTelemetry,
  sceneId,
  sceneBackdrop,
  asset,
  scenePreset,
  className,
  manualDepthOverride,
  manualHueShiftOverrideDegrees,
  manualSaturationOverrideMultiplier,
  preserveColorWhenStopped = false,
  onDevSceneCountersChange,
  onDevColorDiagnosticsChange,
}: ImageDepthThemeSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sharedMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const playbackVisualMixRef = useRef(0);
  const reactiveHueOffsetDegreesRef = useRef(0);
  const reactiveHueTargetDegreesRef = useRef(0);
  const visualStateRef = useRef({
    isPlaying,
    signalId,
    reducedMotion,
    motionEnabled,
    sourceBpm,
    getLatestAudioSnapshot,
    reactivePreviewEnabled,
    reactiveBehavior,
    reactiveDepthMode,
    onReactivePreviewTelemetry,
    manualHueShiftOverrideDegrees,
    manualSaturationOverrideMultiplier,
    preserveColorWhenStopped,
    onDevColorDiagnosticsChange,
  });
  const depthOverrideRef = useRef<number | null>(
    typeof manualDepthOverride === "number" && Number.isFinite(manualDepthOverride)
      ? clamp(manualDepthOverride, 0, 1)
      : null,
  );
  const devCountersCallbackRef = useRef<ImageDepthThemeSceneProps['onDevSceneCountersChange']>(
    onDevSceneCountersChange,
  );
  const lastEnvironmentKeyRef = useRef<string | null>(null);
  const lastDepthValueRef = useRef<number | null>(
    typeof manualDepthOverride === "number" && Number.isFinite(manualDepthOverride)
      ? clamp(manualDepthOverride, 0, 1)
      : null,
  );

  const behavior = scenePreset.behavior;
  const reactiveBehaviorProfile = reactiveBehavior === 'fullon' ? REACTIVE_BEHAVIOR_PROFILES.fullon : REACTIVE_BEHAVIOR_PROFILES.chill;

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
    const reducedMotionMatches =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    visualStateRef.current = {
      isPlaying,
      signalId,
      reducedMotion: reducedMotion || reducedMotionMatches,
      motionEnabled,
      sourceBpm,
      getLatestAudioSnapshot,
      reactivePreviewEnabled,
      reactiveBehavior,
      reactiveDepthMode,
      onReactivePreviewTelemetry,
      manualHueShiftOverrideDegrees,
      manualSaturationOverrideMultiplier,
      preserveColorWhenStopped,
      onDevColorDiagnosticsChange,
    };
  }, [
    getLatestAudioSnapshot,
    isPlaying,
    signalId,
    motionEnabled,
    onReactivePreviewTelemetry,
    reactivePreviewEnabled,
    reactiveBehavior,
    reactiveDepthMode,
    sourceBpm,
    reducedMotion,
    manualHueShiftOverrideDegrees,
    manualSaturationOverrideMultiplier,
    preserveColorWhenStopped,
    onDevColorDiagnosticsChange,
  ]);

  useEffect(() => {
    devCountersCallbackRef.current = onDevSceneCountersChange;
    publishImageDepthSceneDevCounters(onDevSceneCountersChange);
  }, [onDevSceneCountersChange]);

  useEffect(() => {
    imageDepthSceneDevCounters.sceneComponentMountCount += 1;
    publishImageDepthSceneDevCounters(devCountersCallbackRef.current);

    return () => {
      imageDepthSceneDevCounters.sceneComponentUnmountCount += 1;
      publishImageDepthSceneDevCounters(devCountersCallbackRef.current);
    };
  }, []);

  useEffect(() => {
    const environmentKey = `${sceneId}|${asset.id}|${scenePreset.id}`;

    if (lastEnvironmentKeyRef.current === environmentKey) {
      return;
    }

    lastEnvironmentKeyRef.current = environmentKey;
    imageDepthSceneDevCounters.environmentChangeCount += 1;
    publishImageDepthSceneDevCounters(devCountersCallbackRef.current);
  }, [asset.id, sceneId, scenePreset.id]);

  useEffect(() => {
    const nextDepthValue =
      typeof manualDepthOverride === "number" && Number.isFinite(manualDepthOverride)
        ? clamp(manualDepthOverride, 0, 1)
        : null;

    depthOverrideRef.current = nextDepthValue;

    if (lastDepthValueRef.current === nextDepthValue) {
      return;
    }

    lastDepthValueRef.current = nextDepthValue;
    imageDepthSceneDevCounters.depthUpdateCount += 1;
    publishImageDepthSceneDevCounters(devCountersCallbackRef.current);
  }, [manualDepthOverride]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    incrementImageDepthSceneInstance();
    scene.background = new THREE.Color(0x08110d);
    scene.fog = new THREE.FogExp2(0x08110d, 0.045);

    const camera = new THREE.PerspectiveCamera(IMAGE_DEPTH_PARITY_FRAMING.cameraFovDegrees, 1, 0.1, 80);
    camera.position.set(0, 0, IMAGE_DEPTH_PARITY_FRAMING.cameraZ);
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    incrementImageDepthRendererInstance();
    imageDepthSceneDevCounters.rendererCreationCount += 1;
    publishImageDepthSceneDevCounters(devCountersCallbackRef.current);
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
      displacementScale:
        (depthOverrideRef.current ?? profile.depth.staticDepth) *
        profile.depth.depthStrength *
        DISPLACEMENT_SCALE_MULTIPLIER,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    imageDepthSceneDevCounters.materialGeometryInitializationCount += 1;
    publishImageDepthSceneDevCounters(devCountersCallbackRef.current);

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

    let ambientParticleField: AmbientParticleField | null = null;
    const ambientParticlesEnabled = isAmbientParticlesEnabled();
    const particleDebugEnabled = isParticleDebugEnabled();
    const parityStatsEnabled = isParityStatsEnabled();

    sharedMaterialRef.current = material;

    let disposed = false;
    let frameHandle: number | null = null;
    let readyFrameHandle: number | null = null;
    let readyFallbackTimeoutHandle: number | null = null;
    const animationStartedAt = performance.now();
    const blendedPointer = new THREE.Vector2(0, 0);
    const autonomousPointer = new THREE.Vector2(0, 0);
    let elapsedSeconds = 0;
    let lastRenderTimestampSeconds = 0;
    let reactiveDepthSustained = 0;
    let reactiveDepthPulse = 0;
    let reactiveSaturationBoost = 0;
    let reactiveGlobalLightBoost = 0;
    let reactiveTransientAccent = 0;
    let fullOnCurrentDepth = 0;
    let fullOnCurrentPhase: 'low' | 'high' = 'low';
    let fullOnLowTargetDepth = reactiveBehaviorProfile.fullOnLowDepthTarget;
    let fullOnHighTargetDepth = reactiveBehaviorProfile.fullOnHighDepthTarget;
    let fullOnLastAcceptedKickAtMs = 0;
    let fullOnLastSeenKickEventCount = 0;
    let fullOnLastSeenKickEventSequence = 0;
    let fullOnPreviousAcceptedKickAtMs = 0;
    const fullOnAcceptedKickTimestampsMs: number[] = [];
    let fullOnMillisecondsSincePreviousAcceptedEvent = 0;
    let fullOnRecentAcceptedEventRate = 0;
    let fullOnKickBreathEnvelope = 0;
    let fullOnKickBreathTriggerAtMs = -Infinity;
    let fullOnAttackDurationMs = 34;
    let fullOnReleaseDurationMs = 300;
    let fullOnHueEventStepAppliedDegrees = 0;
    let fullOnKickBloomEnvelope = 0;
    let fullOnKickBloomStrength = 0;
    let chillKickBreathEnvelope = 0;
    let chillKickBreathTriggerAtMs = -Infinity;
    let chillKickBreathStrength = 0;
    let chillKickAttackDurationMs = 70;
    let chillKickReleaseDurationMs = 520;
    let chillKickTargetDepth = 0;
    const autonomousSmoothedPointer = new THREE.Vector2(0, 0);
    let lastReactiveTelemetryPublishAt = 0;
    let lastSignalId = visualStateRef.current.signalId ?? null;
    let activeAssetAspectRatio = 1;
    let lastFramedScaleWidth = 1;
    let lastFramedScaleHeight = 1;
    const particlePerfEnabled = isParticlePerfEnabled();
    let particleFrameIntervalMsAverage = 0;
    let particleRenderCpuMsAverage = 0;
    let particleFrameCount = 0;
    let viewportWidth = 0;
    let viewportHeight = 0;

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      viewportWidth = width;
      viewportHeight = height;

      if (width <= 0 || height <= 0) {
        return;
      }

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const framedScale = computeImageDepthFraming({
        viewportWidth: width,
        viewportHeight: height,
        assetAspectRatio: activeAssetAspectRatio,
        mode: "cover-safe-overscan",
        motionProfile: {
          pointerParallaxEnabled: profile.depth.pointerParallaxEnabled,
          motionIntensity: profile.depth.motionIntensity,
          pointerParallaxStrength: profile.depth.pointerParallaxStrength,
        },
        cameraFovDegrees: camera.fov,
        cameraZ: camera.position.z,
        planeZ: plane.position.z,
      });

      plane.scale.set(framedScale.width, framedScale.height, 1);
      glowPlane.scale.set(framedScale.width * 1.14, framedScale.height * 1.08, 1);
      lastFramedScaleWidth = framedScale.width;
      lastFramedScaleHeight = framedScale.height;

      ambientParticleField?.setPlaneScale(framedScale.width, framedScale.height);
      ambientParticleField?.setViewport(width, height);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    readyFallbackTimeoutHandle = window.setTimeout(() => {
      if (!disposed) {
        renderer.domElement.style.opacity = "1";
      }
    }, 350);

    imageDepthSceneDevCounters.textureLoadCount += 1;
    publishImageDepthSceneDevCounters(devCountersCallbackRef.current);

    getImageDepthTexturePair(asset)
      .then(({ colorTexture, depthTexture }) => {
        if (disposed) {
          return;
        }

        material.map = colorTexture;
        material.displacementMap = depthTexture;
        material.needsUpdate = true;

        const image = colorTexture.image as { width?: number; height?: number };
        const textureWidth = Number(image.width ?? 0);
        const textureHeight = Number(image.height ?? 0);
        if (textureWidth > 0 && textureHeight > 0) {
          activeAssetAspectRatio = textureWidth / textureHeight;
          resize();
        }

        if (ambientParticlesEnabled && scenePreset.ambientParticles) {
          try {
            ambientParticleField = new AmbientParticleField(
              asset,
              scenePreset.ambientParticles,
              colorTexture,
              depthTexture,
            );
            ambientParticleField.setPlaneScale(lastFramedScaleWidth, lastFramedScaleHeight);
            ambientParticleField.setViewport(viewportWidth || container.clientWidth, viewportHeight || container.clientHeight);
            planeGroup.add(ambientParticleField.points);
          } catch (error) {
            console.warn("Image-depth ambient particle initialization failed", error);
            ambientParticleField = null;
          }
        }

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
        const renderTimestampSeconds = timestamp / 1000;
        const deltaSeconds = clamp(renderTimestampSeconds - lastRenderTimestampSeconds, 1 / 240, 0.2);
        lastRenderTimestampSeconds = renderTimestampSeconds;

        const visualState = visualStateRef.current;
        const isPlayingNow = visualState.isPlaying;
        const preserveColorWhileStopped = visualState.preserveColorWhenStopped === true;
        const colorPresentationActive = isPlayingNow || preserveColorWhileStopped;
        const reducedMotionActive = visualState.reducedMotion;
        const geometryMotionEnabled = visualState.motionEnabled !== false;
        const spatialMotionActive = geometryMotionEnabled && !reducedMotionActive;
        const geometryMotionActive = spatialMotionActive && isPlayingNow;
        const automaticMotionActive = geometryMotionActive && profile.depth.ambientMotionEnabled;
        const reactiveBehaviorEnabled =
          visualState.reactivePreviewEnabled === true &&
          typeof visualState.getLatestAudioSnapshot === "function";
        const reactiveIsolationEnabled = reactiveBehaviorEnabled && isReactiveIsolationEnabled();

        const currentSignalId = visualState.signalId ?? null;
        if (currentSignalId !== lastSignalId) {
          lastSignalId = currentSignalId;
          reactiveDepthSustained = 0;
          reactiveDepthPulse = 0;
          reactiveSaturationBoost = 0;
          reactiveGlobalLightBoost = 0;
          reactiveTransientAccent = 0;
          fullOnCurrentDepth = reactiveBehaviorProfile.fullOnRestDepthTarget;
          fullOnCurrentPhase = 'low';
          fullOnLastAcceptedKickAtMs = 0;
          fullOnPreviousAcceptedKickAtMs = 0;
          fullOnAcceptedKickTimestampsMs.length = 0;
          fullOnMillisecondsSincePreviousAcceptedEvent = 0;
          fullOnRecentAcceptedEventRate = 0;
          fullOnKickBreathEnvelope = 0;
          fullOnKickBreathTriggerAtMs = -Infinity;
          fullOnHueEventStepAppliedDegrees = 0;
          fullOnKickBloomEnvelope = 0;
          fullOnKickBloomStrength = 0;
          chillKickBreathEnvelope = 0;
          chillKickBreathTriggerAtMs = -Infinity;
          chillKickBreathStrength = 0;
          chillKickTargetDepth = 0;
          reactiveHueTargetDegreesRef.current = 0;
          reactiveHueOffsetDegreesRef.current = 0;
        }

        let latestSnapshot: AudioReactiveSnapshot | null = null;
        if (reactiveBehaviorEnabled) {
          latestSnapshot = visualState.getLatestAudioSnapshot?.() ?? null;
        }

        const analysisSignalAvailable = latestSnapshot?.isActive === true;
        const allowReactiveLighting = reactiveBehaviorEnabled && isPlayingNow && analysisSignalAvailable;
        const depthMode = visualState.reactiveDepthMode ?? 'default';
        const allowReactiveGeometry = allowReactiveLighting && geometryMotionActive && depthMode !== 'lighting-only';
        const reactiveTimingAuthorityActive = allowReactiveGeometry;
        const fullOnBehaviorActive = reactiveBehaviorEnabled && visualState.reactiveBehavior === 'fullon';
        const autonomousBehavior = visualState.reactiveBehavior === 'fullon' ? 'fullon' : 'chill';
        const autonomousParallaxProfile = resolveAutonomousParallaxTarget(elapsedSeconds, autonomousBehavior).profile;
        const fullOnAuthoringSuppressionActive = fullOnBehaviorActive && (reactiveTimingAuthorityActive || reactiveIsolationEnabled);
        const sourceBpm = Number.isFinite(visualState.sourceBpm) ? visualState.sourceBpm ?? null : null;
        const beatIntervalMs = resolveBeatIntervalMs(sourceBpm);
        const acceptedEventMinimumIntervalMs = resolveAcceptedEventMinimumIntervalMs(sourceBpm);
        const currentKickPulse = latestSnapshot?.kickPulse ?? 0;
        const acceptedKickEventCount = latestSnapshot?.kickPulseAcceptedEventCount ?? 0;
        const acceptedKickEventSequence = latestSnapshot?.kickPulseAcceptedEventSequence;
        const hasAcceptedKickEventSequence = typeof acceptedKickEventSequence === 'number' && Number.isFinite(acceptedKickEventSequence);
        const acceptedKickEventCountDelta = Math.max(0, acceptedKickEventCount - fullOnLastSeenKickEventCount);
        const acceptedKickEventSequenceDelta = hasAcceptedKickEventSequence
          ? Math.max(0, acceptedKickEventSequence - fullOnLastSeenKickEventSequence)
          : 0;
        const acceptedKickEventEdge = allowReactiveLighting && (
          hasAcceptedKickEventSequence
            ? acceptedKickEventSequenceDelta > 0
            : acceptedKickEventCountDelta > 0
        );
        const smoothedEnergyRaw = latestSnapshot?.smoothedEnergy ?? 0;
        const sectionIntensity = allowReactiveLighting
          ? smoothstep(
              reactiveBehaviorProfile.sectionIntensityQuietFloor,
              reactiveBehaviorProfile.sectionIntensityFullLevel,
              smoothedEnergyRaw,
            )
          : 0;

        const hasExternalStabilizedDepth =
          depthMode === 'stabilized-depth' &&
          typeof latestSnapshot?.stabilizedDepth === 'number' &&
          Number.isFinite(latestSnapshot.stabilizedDepth);
        const externalStabilizedDepth = hasExternalStabilizedDepth
          ? clamp(latestSnapshot?.stabilizedDepth ?? 0, 0, 1)
          : null;

        const bassNormalized = allowReactiveGeometry
          ? externalStabilizedDepth !== null
            ? externalStabilizedDepth
            : shapeCurve(
                normalizeWithFloor(latestSnapshot?.bass ?? 0, reactiveBehaviorProfile.bassFloor),
                reactiveBehaviorProfile.bassCurve,
              )
          : 0;
        const kickPulseNormalized = allowReactiveLighting
          ? shapeCurve(
              normalizeWithFloor(currentKickPulse, reactiveBehaviorProfile.kickPulseFloor),
              reactiveBehaviorProfile.kickPulseCurve,
            )
          : 0;
        const smoothedEnergyNormalized = allowReactiveLighting
          ? normalizeWithFloor(latestSnapshot?.smoothedEnergy ?? 0, 0.06)
          : 0;
        const transientNormalized = allowReactiveLighting
          ? normalizeWithFloor(latestSnapshot?.transient ?? 0, 0.03)
          : 0;

        const depthSustainedTarget =
          bassNormalized * reactiveBehaviorProfile.sustainedDepthMaxContribution;
        const depthPulseTarget =
          externalStabilizedDepth !== null
            ? 0
            : fullOnBehaviorActive
            ? kickPulseNormalized * reactiveBehaviorProfile.kickDepthMaxContribution
            : chillKickTargetDepth;
        const saturationBoostTarget = smoothedEnergyNormalized * reactiveBehaviorProfile.saturationMaxBoost;
        const transientAccentTarget = transientNormalized * reactiveBehaviorProfile.transientGlowMaxBoost;
        const globalLightBoostTarget =
          Math.max(smoothedEnergyNormalized, kickPulseNormalized) * reactiveBehaviorProfile.globalLightMaxBoost;

        if (acceptedKickEventEdge) {
          fullOnLastSeenKickEventCount = acceptedKickEventCount;
          if (hasAcceptedKickEventSequence) {
            fullOnLastSeenKickEventSequence = acceptedKickEventSequence;
          }
          fullOnPreviousAcceptedKickAtMs = fullOnLastAcceptedKickAtMs;
          fullOnLastAcceptedKickAtMs = timestamp;

          const eventWindowMs = 8000;
          fullOnAcceptedKickTimestampsMs.push(timestamp);
          while (
            fullOnAcceptedKickTimestampsMs.length > 0 &&
            timestamp - (fullOnAcceptedKickTimestampsMs[0] ?? timestamp) > eventWindowMs
          ) {
            fullOnAcceptedKickTimestampsMs.shift();
          }
          fullOnRecentAcceptedEventRate =
            fullOnAcceptedKickTimestampsMs.length > 1
              ? fullOnAcceptedKickTimestampsMs.length / (eventWindowMs / 1000)
              : 0;

          if (fullOnPreviousAcceptedKickAtMs > 0) {
            fullOnMillisecondsSincePreviousAcceptedEvent = Math.max(
              0,
              fullOnLastAcceptedKickAtMs - fullOnPreviousAcceptedKickAtMs,
            );
          }

          if (fullOnBehaviorActive) {
            fullOnCurrentPhase = 'high';
            fullOnKickBreathTriggerAtMs = timestamp;
            fullOnHueEventStepAppliedDegrees = 0;

            const beatForEnvelopeMs = beatIntervalMs ?? FALLBACK_BEAT_INTERVAL_MS;
            fullOnAttackDurationMs = clamp(beatForEnvelopeMs * 0.08, 20, 50);
            fullOnReleaseDurationMs = clamp(beatForEnvelopeMs * 0.72, 260, 320);

            const hueStride = Math.max(1, reactiveBehaviorProfile.hueEventStride);
            const hueStepEventOrdinal = hasAcceptedKickEventSequence
              ? acceptedKickEventSequence
              : acceptedKickEventCount;
            const shouldApplyHueStep = hueStepEventOrdinal % hueStride === 0;
            if (shouldApplyHueStep) {
              const baseHueStep = reactiveBehaviorProfile.kickHueStepDegrees * (0.2 + sectionIntensity * 0.8);
              const hueVariance =
                Math.sin(hueStepEventOrdinal * 1.61803398875) *
                reactiveBehaviorProfile.kickHueVariationDegrees *
                sectionIntensity;
              fullOnHueEventStepAppliedDegrees = baseHueStep + hueVariance;
              reactiveHueTargetDegreesRef.current = wrapDegrees(
                reactiveHueTargetDegreesRef.current + fullOnHueEventStepAppliedDegrees,
              );
            }

            fullOnKickBloomStrength = clamp(
              (0.2 + sectionIntensity * 0.8) *
                (1 - reactiveBehaviorProfile.fullOnKickAmplitudeDepthInfluence +
                  reactiveBehaviorProfile.fullOnKickAmplitudeDepthInfluence * kickPulseNormalized),
              0,
              1,
            );
          } else {
            chillKickBreathTriggerAtMs = timestamp;
            const beatForEnvelopeMs = beatIntervalMs ?? FALLBACK_BEAT_INTERVAL_MS;
            chillKickAttackDurationMs = clamp(beatForEnvelopeMs * 0.14, 42, 95);
            chillKickReleaseDurationMs = clamp(beatForEnvelopeMs * 0.95, 380, 640);
            chillKickBreathStrength = clamp(0.56 + kickPulseNormalized * 0.44, 0.56, 1);
          }
        }

        if (!fullOnBehaviorActive) {
          fullOnLastSeenKickEventCount = acceptedKickEventCount;
          if (hasAcceptedKickEventSequence) {
            fullOnLastSeenKickEventSequence = acceptedKickEventSequence;
          }
        }

        const eventWindowMs = 8000;
        while (
          fullOnAcceptedKickTimestampsMs.length > 0 &&
          timestamp - (fullOnAcceptedKickTimestampsMs[0] ?? timestamp) > eventWindowMs
        ) {
          fullOnAcceptedKickTimestampsMs.shift();
        }
        fullOnRecentAcceptedEventRate =
          fullOnAcceptedKickTimestampsMs.length > 0
            ? fullOnAcceptedKickTimestampsMs.length / (eventWindowMs / 1000)
            : 0;

        const millisecondsSinceKickBreathTrigger = Math.max(0, timestamp - fullOnKickBreathTriggerAtMs);
        const kickBreathAttackActive = millisecondsSinceKickBreathTrigger <= fullOnAttackDurationMs;
        const kickBreathTarget = fullOnBehaviorActive && allowReactiveGeometry && kickBreathAttackActive ? 1 : 0;
        const fullOnKickBreathAttackRate = 3 / Math.max(fullOnAttackDurationMs / 1000, 0.001);
        const fullOnKickBreathReleaseRate = 3 / Math.max(fullOnReleaseDurationMs / 1000, 0.001);
        fullOnKickBreathEnvelope = stepSmoothedValue(
          fullOnKickBreathEnvelope,
          kickBreathTarget,
          deltaSeconds,
          fullOnKickBreathAttackRate,
          fullOnKickBreathReleaseRate,
        );

        const kickBloomTarget =
          fullOnBehaviorActive && allowReactiveLighting
            ? fullOnKickBreathEnvelope * fullOnKickBloomStrength
            : 0;
        fullOnKickBloomEnvelope = stepSmoothedValue(
          fullOnKickBloomEnvelope,
          kickBloomTarget,
          deltaSeconds,
          reactiveBehaviorProfile.kickBloomAttackPerSecond,
          reactiveBehaviorProfile.kickBloomReleasePerSecond,
        );

        const millisecondsSinceChillKickTrigger = Math.max(0, timestamp - chillKickBreathTriggerAtMs);
        const chillKickAttackActive = millisecondsSinceChillKickTrigger <= chillKickAttackDurationMs;
        const chillKickTargetEnvelope =
          !fullOnBehaviorActive && allowReactiveGeometry && chillKickAttackActive ? 1 : 0;
        const chillKickAttackRate = 3 / Math.max(chillKickAttackDurationMs / 1000, 0.001);
        const chillKickReleaseRate = 3 / Math.max(chillKickReleaseDurationMs / 1000, 0.001);
        chillKickBreathEnvelope = stepSmoothedValue(
          chillKickBreathEnvelope,
          chillKickTargetEnvelope,
          deltaSeconds,
          chillKickAttackRate,
          chillKickReleaseRate,
        );
        chillKickTargetDepth =
          chillKickBreathEnvelope * chillKickBreathStrength * reactiveBehaviorProfile.kickDepthMaxContribution;

        const millisecondsSinceAcceptedKickEvent =
          fullOnLastAcceptedKickAtMs > 0 ? Math.max(0, timestamp - fullOnLastAcceptedKickAtMs) : Number.POSITIVE_INFINITY;
        const inactivityReturnActive =
          fullOnBehaviorActive && millisecondsSinceAcceptedKickEvent > reactiveBehaviorProfile.fullOnInactivityTimeoutMs;

        if (fullOnBehaviorActive && (inactivityReturnActive || !allowReactiveGeometry)) {
          fullOnCurrentPhase = 'low';
        }

        const fullOnDepthTravelReleasePerSecond = inactivityReturnActive
          ? reactiveBehaviorProfile.fullOnInactivityReturnPerSecond
          : reactiveBehaviorProfile.fullOnDepthTravelReleasePerSecond;

        const fullOnDynamicRangeScale = clamp(0.15 + sectionIntensity * 0.85, 0.1, 1);
        const fullOnKickAmplitudeScale = clamp(
          1 - reactiveBehaviorProfile.fullOnKickAmplitudeDepthInfluence +
            reactiveBehaviorProfile.fullOnKickAmplitudeDepthInfluence * kickPulseNormalized,
          0.68,
          1,
        );
        const fullOnBreathScale = fullOnDynamicRangeScale * fullOnKickAmplitudeScale;
        fullOnLowTargetDepth = reactiveBehaviorProfile.fullOnLowDepthTarget;
        fullOnHighTargetDepth = reactiveBehaviorProfile.fullOnHighDepthTarget;
        const fullOnBreathTargetDepth =
          fullOnLowTargetDepth +
          (fullOnHighTargetDepth - fullOnLowTargetDepth) * fullOnKickBreathEnvelope * fullOnBreathScale;
        const fullOnAppliedTargetDepth =
          fullOnBehaviorActive && allowReactiveGeometry
            ? fullOnBreathTargetDepth
            : reactiveBehaviorProfile.fullOnRestDepthTarget;
        fullOnCurrentPhase = fullOnKickBreathEnvelope >= 0.45 ? 'high' : 'low';

        fullOnCurrentDepth = stepSmoothedValue(
          fullOnCurrentDepth,
          fullOnAppliedTargetDepth,
          deltaSeconds,
          reactiveBehaviorProfile.fullOnDepthTravelAttackPerSecond,
          fullOnDepthTravelReleasePerSecond,
        );

        reactiveHueOffsetDegreesRef.current = stepSmoothedValue(
          reactiveHueOffsetDegreesRef.current,
          reactiveHueTargetDegreesRef.current,
          deltaSeconds,
          reactiveBehaviorProfile.hueEasingAttackPerSecond,
          reactiveBehaviorProfile.hueEasingReleasePerSecond,
        );

        reactiveDepthSustained = stepSmoothedValue(
          reactiveDepthSustained,
          depthSustainedTarget,
          deltaSeconds,
          reactiveBehaviorProfile.sustainedAttackPerSecond,
          reactiveBehaviorProfile.sustainedReleasePerSecond,
        );
        reactiveDepthPulse = stepSmoothedValue(
          reactiveDepthPulse,
          depthPulseTarget,
          deltaSeconds,
          reactiveBehaviorProfile.kickAttackPerSecond,
          reactiveBehaviorProfile.kickReleasePerSecond,
        );
        reactiveSaturationBoost = stepSmoothedValue(
          reactiveSaturationBoost,
          saturationBoostTarget,
          deltaSeconds,
          reactiveBehaviorProfile.lightingAttackPerSecond,
          reactiveBehaviorProfile.lightingReleasePerSecond,
        );
        reactiveTransientAccent = stepSmoothedValue(
          reactiveTransientAccent,
          transientAccentTarget,
          deltaSeconds,
          reactiveBehaviorProfile.transientAttackPerSecond,
          reactiveBehaviorProfile.transientReleasePerSecond,
        );
        reactiveGlobalLightBoost = stepSmoothedValue(
          reactiveGlobalLightBoost,
          globalLightBoostTarget,
          deltaSeconds,
          reactiveBehaviorProfile.lightingAttackPerSecond,
          reactiveBehaviorProfile.lightingReleasePerSecond,
        );

        const depthReactiveContribution = allowReactiveGeometry
          ? fullOnBehaviorActive
            ? clamp(fullOnCurrentDepth, 0, reactiveBehaviorProfile.finalDepthCapContribution)
            : clamp(
                reactiveDepthSustained + reactiveDepthPulse,
                0,
                reactiveBehaviorProfile.finalDepthCapContribution,
              )
          : 0;
        const scenePulseDepthContributionNormalized = fullOnBehaviorActive
          ? clamp(
              (fullOnCurrentDepth - fullOnLowTargetDepth) /
                Math.max(fullOnHighTargetDepth - fullOnLowTargetDepth, SATURATION_EPSILON),
              0,
              1,
            )
          : clamp(
              reactiveDepthPulse / Math.max(reactiveBehaviorProfile.kickDepthMaxContribution, SATURATION_EPSILON),
              0,
              1,
            );
        const scenePulseEnvelope = fullOnBehaviorActive
          ? clamp(fullOnKickBreathEnvelope, 0, 1)
          : clamp(chillKickBreathEnvelope, 0, 1);

        const motionAmount = spatialMotionActive
          ? profile.depth.motionIntensity * profile.depth.pointerParallaxStrength
          : 0;
        const autonomousParallaxEnabled = spatialMotionActive && profile.depth.pointerParallaxEnabled && !reactiveIsolationEnabled;
        const autoAmountBase = autonomousParallaxEnabled
          ? clamp(0.18 + motionAmount * 0.32, 0.18, 0.52)
          : 0;
        const autonomousTarget = resolveAutonomousParallaxTarget(elapsedSeconds, autonomousBehavior);
        autonomousPointer.x = autonomousParallaxEnabled ? autonomousTarget.targetX : 0;
        autonomousPointer.y = autonomousParallaxEnabled ? autonomousTarget.targetY : 0;

        autonomousSmoothedPointer.x = stepSmoothedValue(
          autonomousSmoothedPointer.x,
          autonomousPointer.x,
          deltaSeconds,
          1.35,
          1.35,
        );
        autonomousSmoothedPointer.y = stepSmoothedValue(
          autonomousSmoothedPointer.y,
          autonomousPointer.y,
          deltaSeconds,
          1.35,
          1.35,
        );

        blendedPointer.x = autonomousSmoothedPointer.x;
        blendedPointer.y = autonomousSmoothedPointer.y;

        const manualDepth = depthOverrideRef.current;
        let breathingMix = 0.5;
        let authoredDepthContribution = manualDepth ?? profile.depth.staticDepth;
        const minBreathingDepth = Math.min(profile.depth.breathingMin, profile.depth.breathingMax);
        const maxBreathingDepth = Math.max(profile.depth.breathingMin, profile.depth.breathingMax);
        const authoredCyclicBreathingEnabled =
          manualDepth === null && automaticMotionActive && !reactiveTimingAuthorityActive && !reactiveBehaviorEnabled;

        if (authoredCyclicBreathingEnabled) {
          const breathingRange = maxBreathingDepth - minBreathingDepth;
          const safeCycleSeconds = Math.max(profile.depth.breathingCycleSeconds, SATURATION_EPSILON);
          const cycle = Math.sin((elapsedSeconds / safeCycleSeconds) * Math.PI * 2);
          breathingMix = (cycle + 1) * 0.5;
          authoredDepthContribution = minBreathingDepth + breathingRange * breathingMix;
        } else {
          authoredDepthContribution = manualDepth ?? profile.depth.staticDepth;
        }

        const combinedDepthBeforeClamp = reactiveTimingAuthorityActive
          ? fullOnBehaviorActive
            ? depthReactiveContribution
            : (manualDepth ?? profile.depth.staticDepth) + depthReactiveContribution
          : authoredDepthContribution + depthReactiveContribution;
        const configuredDepthMinimum = reactiveTimingAuthorityActive ? REACTIVE_DEPTH_MIN : AUTHORED_DEPTH_MIN;
        const configuredDepthMaximum = reactiveTimingAuthorityActive ? REACTIVE_DEPTH_MAX : AUTHORED_DEPTH_MAX;
        const depthFinalAfterClamp = clamp(
          combinedDepthBeforeClamp,
          configuredDepthMinimum,
          configuredDepthMaximum,
        );

        const finalDisplacementScale =
          profile.depth.depthStrength *
          DISPLACEMENT_SCALE_MULTIPLIER *
          depthFinalAfterClamp;
        material.displacementScale = finalDisplacementScale;
        material.bumpScale = depthFinalAfterClamp * 0.04;

        const manualHueOverrideDegrees = visualState.manualHueShiftOverrideDegrees;
        const sharedChillHueOffsetDegrees =
          reactiveBehaviorEnabled && !fullOnBehaviorActive && isPlayingNow && !reducedMotionActive
            ? Math.sin(
                (elapsedSeconds / Math.max(reactiveBehaviorProfile.chillHueDriftCycleSeconds, 1)) *
                  Math.PI * 2,
              ) *
              reactiveBehaviorProfile.chillHueDriftRangeDegrees
            : 0;
        const authoredSaturationCycleSuppressed = allowReactiveLighting;
        const authoredOrReactiveHueOffsetDegrees =
          fullOnAuthoringSuppressionActive && allowReactiveLighting
            ? reactiveHueOffsetDegreesRef.current
            : reactiveBehaviorEnabled && !fullOnBehaviorActive
              ? sharedChillHueOffsetDegrees
              : profile.color.driftEnabled && isPlayingNow && !reducedMotionActive
              ? Math.sin((elapsedSeconds / Math.max(profile.color.cycleSeconds, 1)) * Math.PI * 2) *
                profile.color.hueRangeDegrees
              : 0;
        const hueOffsetDegrees =
          typeof manualHueOverrideDegrees === "number" && Number.isFinite(manualHueOverrideDegrees)
            ? manualHueOverrideDegrees
            : authoredOrReactiveHueOffsetDegrees;
        const manualSaturationOverrideMultiplier = visualState.manualSaturationOverrideMultiplier;

        const authoredBaseSaturation = profile.saturationPulse.enabled
          ? Math.max(profile.color.saturation, (profile.saturationPulse.minimumSaturation + profile.saturationPulse.maximumSaturation) * 0.5)
          : Math.max(profile.color.saturation, 1);
        let authoredPeriodicSaturationContribution = 0;
        let currentSaturation = authoredBaseSaturation;
        if (profile.saturationPulse.enabled && isPlayingNow && !reducedMotionActive) {
          const saturationCycleScale = authoredSaturationCycleSuppressed
            ? 0
            : 1;

          if (profile.saturationPulse.syncToDepthBreathing) {
            const syncAngle = breathingMix * Math.PI * 2 + profile.saturationPulse.phaseOffset;
            const pulseProgress = (Math.sin(syncAngle) + 1) * 0.5;
            const authoredPulseSaturation = lerp(
              profile.saturationPulse.minimumSaturation,
              profile.saturationPulse.maximumSaturation,
              pulseProgress,
            );
            authoredPeriodicSaturationContribution = (authoredPulseSaturation - authoredBaseSaturation) * saturationCycleScale;
          } else {
            const pulsePhase =
              (elapsedSeconds / Math.max(profile.saturationPulse.cycleSeconds, 0.2)) * Math.PI * 2 +
              profile.saturationPulse.phaseOffset;
            const pulseProgress = (Math.sin(pulsePhase) + 1) * 0.5;
            const authoredPulseSaturation = lerp(
              profile.saturationPulse.minimumSaturation,
              profile.saturationPulse.maximumSaturation,
              pulseProgress,
            );
            authoredPeriodicSaturationContribution = (authoredPulseSaturation - authoredBaseSaturation) * saturationCycleScale;
          }
        }

        currentSaturation = authoredBaseSaturation + authoredPeriodicSaturationContribution;

        const reactiveSaturationMultiplier = 1 + reactiveSaturationBoost;
        const saturationBloomMultiplier =
          1 + (fullOnBehaviorActive ? fullOnKickBloomEnvelope * reactiveBehaviorProfile.kickSaturationBloomMaxBoost : 0);
        const rawFinalSaturation = currentSaturation * reactiveSaturationMultiplier * saturationBloomMultiplier;
        const computedFinalSaturation = clamp(rawFinalSaturation, 0, reactiveBehaviorProfile.saturationCap);
        const finalSaturation =
          typeof manualSaturationOverrideMultiplier === "number" && Number.isFinite(manualSaturationOverrideMultiplier)
            ? Math.max(0, manualSaturationOverrideMultiplier)
            : computedFinalSaturation;
        currentSaturation = finalSaturation;

        const authoredGlowPulseAmountBase =
          profile.color.glowPulseEnabled && isPlayingNow && !reducedMotionActive
            ? (Math.sin((elapsedSeconds / Math.max(profile.color.glowPulseCycleSeconds, 1)) * Math.PI * 2) *
                0.5 +
                0.5) *
              profile.color.glowPulseAmount
            : 0;
        const authoredGlowPulseAmount = Math.max(
          profile.color.glowPulseAmount * (fullOnAuthoringSuppressionActive ? 0.36 : 0.22),
          authoredGlowPulseAmountBase *
            (fullOnAuthoringSuppressionActive ? reactiveBehaviorProfile.authoredGlobalGlowCycleScale : 1),
        );
        const reactiveGlowPulseAmount = allowReactiveLighting
          ? clamp(reactiveTransientAccent, 0, 1)
          : 0;
        const glowPulseAmount = clamp(authoredGlowPulseAmount + reactiveGlowPulseAmount, 0, 1.2);

        playbackVisualMixRef.current = stepImageDepthPlaybackVisualMix(
          playbackVisualMixRef.current,
          colorPresentationActive,
          reducedMotionActive,
        );

        const authoredAmbientGeometryContribution =
          reactiveTimingAuthorityActive && reactiveIsolationEnabled
            ? 0
            : reactiveTimingAuthorityActive
              ? autoAmountBase * reactiveBehaviorProfile.ambientSwayScaleWhenReactive
              : autoAmountBase;

        planeGroup.position.x =
          Math.sin(elapsedSeconds * 0.16) * 0.06 * authoredAmbientGeometryContribution +
          blendedPointer.x * 0.14;
        planeGroup.position.y =
          Math.cos(elapsedSeconds * 0.12) * 0.04 * authoredAmbientGeometryContribution -
          blendedPointer.y * 0.11;
        planeGroup.rotation.y =
          Math.sin(elapsedSeconds * 0.1) * 0.022 * authoredAmbientGeometryContribution +
          blendedPointer.x * 0.13;
        planeGroup.rotation.x =
          Math.cos(elapsedSeconds * 0.085) * 0.016 * authoredAmbientGeometryContribution -
          blendedPointer.y * 0.1;
        plane.position.z =
          IMAGE_DEPTH_PARITY_FRAMING.planeZ +
          Math.sin(elapsedSeconds * 0.22) * 0.06 * authoredAmbientGeometryContribution;
        glowPlane.material.opacity = 0.05 + material.displacementScale * 0.18 + glowPulseAmount * 0.8;

        camera.position.x = blendedPointer.x * 0.06;
        camera.position.y = -blendedPointer.y * 0.045;
        camera.lookAt(0, 0, -0.4);

        const defaultGrayscaleAmount = 1 - playbackVisualMixRef.current;
        const defaultSaturationMultiplier =
          playbackVisualMixRef.current * currentSaturation * (1 + glowPulseAmount * 0.7);
        const defaultBrightnessMultiplier = 1 + glowPulseAmount;
        const finalGrayscaleAmount = preserveColorWhileStopped && !isPlayingNow
          ? 0
          : defaultGrayscaleAmount;
        const finalSaturationMultiplier = preserveColorWhileStopped && !isPlayingNow
          ? Math.max(currentSaturation, 0)
          : defaultSaturationMultiplier;
        const finalBrightnessMultiplier = preserveColorWhileStopped && !isPlayingNow
          ? 1
          : defaultBrightnessMultiplier;
        const finalContrastMultiplier = 1;
        const filter = preserveColorWhileStopped && !isPlayingNow
          ? [
              `grayscale(${finalGrayscaleAmount.toFixed(3)})`,
              `hue-rotate(${hueOffsetDegrees.toFixed(3)}deg)`,
              `saturate(${Math.max(finalSaturationMultiplier, 0).toFixed(3)})`,
              `brightness(${Math.max(finalBrightnessMultiplier, 0).toFixed(3)})`,
              `contrast(${finalContrastMultiplier.toFixed(3)})`,
            ].join(" ")
          : formatImageDepthPlaybackFilter({
              playbackVisualMix: playbackVisualMixRef.current,
              hueOffsetDegrees,
              currentSaturation,
              glowPulseAmount,
            });
        const grayscaleFilterActive = playbackVisualMixRef.current < 0.995;

        visualState.onDevColorDiagnosticsChange?.({
          colorTextureUrl: asset.colorImageUrl,
          depthTextureUrl: asset.depthMapUrl,
          finalFilterString: filter,
          finalHueDegrees: hueOffsetDegrees,
          finalSaturationMultiplier,
          finalGrayscaleAmount,
          finalBrightnessMultiplier,
          finalContrastMultiplier,
          playbackVisualState: isPlayingNow
            ? 'playing-color'
            : preserveColorWhileStopped
              ? 'stopped-color-preserved'
              : 'stopped-grayscale',
        });
        const reactiveKickBloom =
          fullOnBehaviorActive ? fullOnKickBloomEnvelope * reactiveBehaviorProfile.kickGlobalGlowBloomMaxBoost : 0;
        const globalGlowMultiplier = 1 + reactiveGlobalLightBoost + reactiveKickBloom;
        ambientLight.intensity = 1.85 * globalGlowMultiplier;
        keyLight.intensity = 1.3 * (globalGlowMultiplier + reactiveTransientAccent * 0.1);
        rimLight.intensity = 0.6 * (globalGlowMultiplier + reactiveTransientAccent * 0.22);

        if (ambientParticleField) {
          ambientParticleField.update({
            elapsedSeconds,
            audioSnapshot: latestSnapshot,
            isPlaying: isPlayingNow,
            motionEnabled: visualState.motionEnabled !== false,
            reducedMotion: reducedMotionActive,
            reactiveIsolationEnabled,
            reactiveBehavior: visualState.reactiveBehavior,
            scenePulseEnvelope,
            scenePulseDepthContributionNormalized,
          });

          if (particleDebugEnabled) {
            writeImageDepthParityStats("production-particles", ambientParticleField.getDiagnostics());
          }
        } else if (particleDebugEnabled) {
          writeImageDepthParityStats("production-particles", {
            active: false,
            count: 0,
            visibleCountEstimate: 0,
            allocationCount: 0,
            drawCallCount: 0,
            behavior: visualState.reactiveBehavior,
            motionEnabled: visualState.motionEnabled !== false,
            reducedMotion: reducedMotionActive,
            reactiveIsolationEnabled,
            averageVisibility: 0,
            depthSamplingActive: false,
            colorSamplingActive: false,
            generatedUvMinU: 0,
            generatedUvMaxU: 0,
            generatedUvMinV: 0,
            generatedUvMaxV: 0,
            generatedLocalMinX: 0,
            generatedLocalMaxX: 0,
            generatedLocalMinY: 0,
            generatedLocalMaxY: 0,
            planeWidth: 0,
            planeHeight: 0,
            scenePulseEnvelope: 0,
            scenePulseDepthContributionNormalized: 0,
            pulseParticipation: 0,
            pulseAmplitude: 0,
          });
        }

        const frameRenderStartedAtMs = typeof performance !== "undefined" ? performance.now() : Date.now();

        if (
          visualState.onReactivePreviewTelemetry &&
          (elapsedSeconds - lastReactiveTelemetryPublishAt >= 0.05 || lastReactiveTelemetryPublishAt === 0)
        ) {
          const fullOnPhase: 'low' | 'high' | 'n/a' = fullOnBehaviorActive
            ? fullOnCurrentPhase
            : 'n/a';

          visualState.onReactivePreviewTelemetry({
            selectedReactiveBehavior: reactiveBehaviorProfile.label,
            selectedDepthSignalField: fullOnBehaviorActive ? 'energy' : 'bass',
            selectedHueSignalField: fullOnBehaviorActive ? 'energy' : 'kickPulse',
            selectedSaturationSignalField: fullOnBehaviorActive ? 'bass' : 'smoothedEnergy',
            reactivePreviewEnabled: reactiveBehaviorEnabled,
            reactiveIsolationEnabled,
            reactiveTimingAuthorityActive,
            musicAuthorityActive: reactiveTimingAuthorityActive,
            motionGateOpen: geometryMotionActive,
            authoredCyclicBreathingEnabled,
            authoredDepthContribution,
            authoredAmbientGeometryContribution,
            depthSustainedContribution: reactiveDepthSustained,
            kickDrivenDepthContribution: fullOnBehaviorActive ? fullOnCurrentDepth : reactiveDepthPulse,
            depthPulseContribution: reactiveDepthPulse,
            depthCombinedBeforeClamp: combinedDepthBeforeClamp,
            configuredDepthMinimum,
            configuredDepthMaximum,
            depthFinalAfterClamp,
            finalDisplacementScale,
            kickPulse: currentKickPulse,
            kickPulseAcceptedEvent: acceptedKickEventEdge,
            kickPulseAcceptedEventCount: acceptedKickEventCount,
            kickPulseAcceptedEventSequence: hasAcceptedKickEventSequence ? acceptedKickEventSequence : 0,
            rendererKickEventCountLastSeen: fullOnLastSeenKickEventCount,
            rendererKickEventSequenceLastSeen: fullOnLastSeenKickEventSequence,
            sourceBpm,
            beatIntervalMs,
            acceptedEventMinimumIntervalMs,
            millisecondsSincePreviousAcceptedEvent: fullOnMillisecondsSincePreviousAcceptedEvent,
            acceptedEventRatePerSecondRecent: fullOnRecentAcceptedEventRate,
            smoothedEnergy: smoothedEnergyRaw,
            sectionIntensity,
            fullOnPhase,
            fullOnTargetDepth: fullOnBehaviorActive ? fullOnAppliedTargetDepth : depthFinalAfterClamp,
            fullOnCurrentDepth: fullOnBehaviorActive ? fullOnCurrentDepth : depthFinalAfterClamp,
            fullOnTargetSaturation: computedFinalSaturation,
            fullOnCurrentSaturation: finalSaturation,
            millisecondsSinceAcceptedKickEvent: Number.isFinite(millisecondsSinceAcceptedKickEvent)
              ? millisecondsSinceAcceptedKickEvent
              : 0,
            inactivityReturnActive,
            kickBreathEnvelope: fullOnKickBreathEnvelope,
            fullOnLowTargetDepth: fullOnLowTargetDepth,
            fullOnHighTargetDepth: fullOnHighTargetDepth,
            fullOnAttackDurationMs,
            fullOnReleaseDurationMs,
            kickBloomEnvelope: fullOnKickBloomEnvelope,
            hueEventStride: reactiveBehaviorProfile.hueEventStride,
            hueEventStepAppliedDegrees: fullOnHueEventStepAppliedDegrees,
            reactiveHueTargetDegrees: reactiveHueTargetDegreesRef.current,
            reactiveHueOffsetDegrees: reactiveHueOffsetDegreesRef.current,
            finalHueShiftDegrees: hueOffsetDegrees,
            authoredBaseSaturation,
            authoredPeriodicSaturationContribution,
            reactiveSaturationMultiplier,
            finalSaturation,
            grayscaleFilterActive,
            saturationBloomMultiplier,
            saturationCap: reactiveBehaviorProfile.saturationCap,
            authoredBaseGlow: authoredGlowPulseAmount,
            reactiveKickBloom,
            globalGlowMultiplier,
            saturationMultiplier: reactiveSaturationMultiplier,
            globalLightMultiplier: globalGlowMultiplier,
            finalGlobalGlowMultiplier: globalGlowMultiplier,
            authoredHueCycleSuppressed: fullOnAuthoringSuppressionActive,
            authoredSaturationCycleSuppressed: fullOnAuthoringSuppressionActive,
            authoredGlobalGlowCycleSuppressed: fullOnAuthoringSuppressionActive,
            transientAccent: reactiveTransientAccent,
            geometryMotionActive,
          });
          lastReactiveTelemetryPublishAt = elapsedSeconds;
        }

        renderer.domElement.style.filter = filter;

        const frameRenderEndedAtMs = typeof performance !== "undefined" ? performance.now() : Date.now();
        const renderCpuMs = frameRenderEndedAtMs - frameRenderStartedAtMs;
        const frameIntervalMs = deltaSeconds * 1000;
        particleFrameCount += 1;
        particleFrameIntervalMsAverage =
          particleFrameIntervalMsAverage === 0
            ? frameIntervalMs
            : particleFrameIntervalMsAverage * 0.88 + frameIntervalMs * 0.12;
        particleRenderCpuMsAverage =
          particleRenderCpuMsAverage === 0
            ? renderCpuMs
            : particleRenderCpuMsAverage * 0.88 + renderCpuMs * 0.12;

        if (particlePerfEnabled) {
          const particlePerfDiagnostics = ambientParticleField?.getPerfDiagnostics() ?? {
            active: false,
            initMs: 0,
            updateCpuMsLast: 0,
            updateCpuMsAverage: 0,
            allocationCount: 0,
            drawCallCount: 0,
            particleCount: 0,
            sampledArtworkCacheHit: false,
            sampledArtworkCacheKey: "",
            sampledColorWidth: 0,
            sampledColorHeight: 0,
            sampledDepthWidth: 0,
            sampledDepthHeight: 0,
            sampleCacheEntries: 0,
          };

          writeImageDepthParityStats("production-particle-perf", {
            active: particlePerfDiagnostics.active,
            ambientParticlesEnabled,
            particleCount: particlePerfDiagnostics.particleCount,
            allocationCount: particlePerfDiagnostics.allocationCount,
            drawCallCount: particlePerfDiagnostics.drawCallCount,
            initMs: particlePerfDiagnostics.initMs,
            updateCpuMsLast: particlePerfDiagnostics.updateCpuMsLast,
            updateCpuMsAverage: particlePerfDiagnostics.updateCpuMsAverage,
            frameIntervalMsLast: frameIntervalMs,
            frameIntervalMsAverage: particleFrameIntervalMsAverage,
            renderCpuMsLast: renderCpuMs,
            renderCpuMsAverage: particleRenderCpuMsAverage,
            sampledArtworkCacheHit: particlePerfDiagnostics.sampledArtworkCacheHit,
            sampledArtworkCacheKey: particlePerfDiagnostics.sampledArtworkCacheKey,
            sampledColorWidth: particlePerfDiagnostics.sampledColorWidth,
            sampledColorHeight: particlePerfDiagnostics.sampledColorHeight,
            sampledDepthWidth: particlePerfDiagnostics.sampledDepthWidth,
            sampledDepthHeight: particlePerfDiagnostics.sampledDepthHeight,
            sampleCacheEntries: particlePerfDiagnostics.sampleCacheEntries,
            particleFrameCount,
          });
        }

        if (parityStatsEnabled) {
          writeImageDepthParityStats("production", {
            elapsedSeconds,
            playbackMix: playbackVisualMixRef.current,
            grayscale: 1 - playbackVisualMixRef.current,
            hueOffsetDegrees,
            currentSaturation,
            effectiveSaturation:
              playbackVisualMixRef.current * currentSaturation * (1 + glowPulseAmount * 0.7),
            glowPulseAmount,
            reactivePreviewEnabled: reactiveBehaviorEnabled,
            analysisSignalAvailable,
            reactiveIsolationEnabled,
            reactiveTimingAuthorityActive,
            musicAuthorityActive: reactiveTimingAuthorityActive,
            fullOnBehaviorActive,
            fullOnCurrentPhase,
            fullOnLowTargetDepth,
            fullOnHighTargetDepth,
            fullOnCurrentDepth,
            fullOnKickBreathEnvelope,
            fullOnAttackDurationMs,
            fullOnReleaseDurationMs,
            sourceBpm,
            beatIntervalMs,
            acceptedEventMinimumIntervalMs,
            fullOnMillisecondsSincePreviousAcceptedEvent,
            fullOnRecentAcceptedEventRate,
            sectionIntensity,
            acceptedKickEventCount,
            acceptedKickEventEdge,
            millisecondsSinceAcceptedKickEvent,
            inactivityReturnActive,
            grayscaleFilterActive,
            finalSaturation,
            reactiveSaturationMultiplier,
            saturationBloomMultiplier,
            authoredBaseSaturation,
            authoredPeriodicSaturationContribution,
            kickBloomEnvelope: fullOnKickBloomEnvelope,
            hueEventStride: reactiveBehaviorProfile.hueEventStride,
            hueEventStepAppliedDegrees: fullOnHueEventStepAppliedDegrees,
            authoredBaseGlow: authoredGlowPulseAmount,
            reactiveKickBloom,
            authoredCyclicBreathingEnabled,
            authoredDepthContribution,
            authoredAmbientGeometryContribution,
            chillKickBreathEnvelope,
            chillKickTargetDepth,
            depthReactiveContribution,
            depthSustainedContribution: reactiveDepthSustained,
            depthPulseContribution: reactiveDepthPulse,
            combinedDepthBeforeClamp,
            configuredDepthMinimum,
            configuredDepthMaximum,
            depthFinalAfterClamp,
            finalDisplacementScale,
            parallaxEnabled: autonomousParallaxEnabled,
            parallaxCapabilityEnabled: profile.depth.pointerParallaxEnabled,
            parallaxAmplitudeScale: autonomousParallaxProfile.horizontalExcursion,
            autonomousTargetX: autonomousPointer.x,
            autonomousTargetY: autonomousPointer.y,
            autonomousPointerX: autonomousSmoothedPointer.x,
            autonomousPointerY: autonomousSmoothedPointer.y,
            cameraPositionX: blendedPointer.x * 0.06,
            cameraPositionY: -blendedPointer.y * 0.045,
            saturationReactiveBoost: reactiveSaturationBoost,
            globalLightReactiveBoost: reactiveGlobalLightBoost,
            transientReactiveAccent: reactiveTransientAccent,
            brightness: 1 + glowPulseAmount,
            filter,
          });
        }

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

      resizeObserver.disconnect();
      ambientParticleField?.points.removeFromParent();
      ambientParticleField?.dispose();
      sharedMaterialRef.current = null;
      material.dispose();
      geometry.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      scene.clear();
      renderer.dispose();
      decrementImageDepthRendererInstance();
      decrementImageDepthSceneInstance();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [asset, profile, reactiveBehaviorProfile, scenePreset]);

  useEffect(() => {
    const material = sharedMaterialRef.current;
    if (!material) {
      return;
    }

    const effectiveStaticDepth =
      typeof manualDepthOverride === "number" && Number.isFinite(manualDepthOverride)
        ? clamp(manualDepthOverride, 0, 1)
        : profile.depth.staticDepth;

    material.displacementScale =
      effectiveStaticDepth * profile.depth.depthStrength * DISPLACEMENT_SCALE_MULTIPLIER;
  }, [manualDepthOverride, profile.depth.staticDepth, profile.depth.depthStrength]);

  const containerStyle = useMemo<CSSProperties | undefined>(() => {
    if (!sceneBackdrop) {
      return undefined;
    }

    return { background: sceneBackdrop };
  }, [sceneBackdrop]);

  return (
    <div
      className={className ?? "image-depth-scene"}
      data-scene-id={sceneId}
      style={containerStyle}
      ref={containerRef}
      role="presentation"
    />
  );
}
