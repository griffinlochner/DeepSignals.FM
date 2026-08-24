import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import {
  mapSignalRunnerChromaHue,
  SIGNAL_RUNNER_CHROMA_HUE_RESPONSE,
} from "../../app/sharedChroma";
import { createRenderFpsSampler } from "../../app/renderFpsTelemetry";

export type SignalRunnerControlMode = "manual" | "audio";

export type SignalRunnerDriveTelemetry = {
  controlMode: SignalRunnerControlMode;
  smoothedEnergy: number;
  targetSpeed: number;
  actualSpeed: number;
  travelVelocity: number;
  hue: number;
};

type SignalRunnerSceneProps = {
  controlMode: SignalRunnerControlMode;
  flightSpeed: number;
  isPlaying: boolean;
  volume: number;
  signalId: string | null;
  motionEnabled: boolean;
  chromaEnabled: boolean;
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
  onDriveTelemetry?: (telemetry: SignalRunnerDriveTelemetry) => void;
  onRenderFps?: (fps: number) => void;
};

const STAR_COUNT = 900;
const FLIGHT_DEPTH = 110;
const NEAR_PLANE = 1.5;
const AUDIO_ENERGY_FLOOR = 0.04;
const AUDIO_ENERGY_CEILING = 0.72;
const SPEED_EASING_PER_SECOND = 2.8;
const TELEMETRY_INTERVAL_MS = 100;
const GATE_SPAWN_DEPTH = 88;
const GATE_RECYCLE_DEPTH = 430;
const GATE_RECYCLE_VARIANCE = 180;
const PHENOMENON_POINT_COUNT = 96;
const PHENOMENON_NODE_COUNT = 6;
const PHENOMENON_ARC_COUNT = 3;
const STEERING_MIN_DURATION = 6;
const STEERING_DURATION_VARIANCE = 4;
const SIGNAL_ORB_SPAWN_DEPTH = 940;
const SIGNAL_ORB_RECYCLE_VARIANCE = 620;
const SIGNAL_ORB_MIN_SCALE = 0.55;
const SIGNAL_ORB_MAX_SCALE = 1.72;

function mapSmoothedEnergyToSpeed(smoothedEnergy: number) {
  const normalized = THREE.MathUtils.clamp(
    (smoothedEnergy - AUDIO_ENERGY_FLOOR) /
      (AUDIO_ENERGY_CEILING - AUDIO_ENERGY_FLOOR),
    0,
    1,
  );

  return normalized * 100;
}

function SignalRunnerScene(props: SignalRunnerSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const visualStateRef = useRef(props);

  useEffect(() => {
    visualStateRef.current = props;
  }, [props]);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010104);
    scene.fog = new THREE.FogExp2(0x010104, 0.009);

    const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 130);
    camera.position.set(0, 0, 0);

    const flightWorld = new THREE.Group();
    scene.add(flightWorld);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    const renderFpsSampler = createRenderFpsSampler((renderFps) => {
      visualStateRef.current.onRenderFps?.(renderFps);
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const pointPositions = new Float32Array(STAR_COUNT * 3);
    const pointColors = new Float32Array(STAR_COUNT * 3);
    const streakPositions = new Float32Array(STAR_COUNT * 6);
    const streakColors = new Float32Array(STAR_COUNT * 6);
    const starColors = [
      new THREE.Color(0x47f7ff),
      new THREE.Color(0x9cff57),
      new THREE.Color(0xff7fa1),
      new THREE.Color(0xb9d7e5),
    ];
    const starColorIndices = new Uint8Array(STAR_COUNT);

    const resetStar = (index: number, depth?: number) => {
      const offset = index * 3;
      const starDepth = depth ?? 28 + Math.random() * (FLIGHT_DEPTH - 28);
      const horizontalSpread = starDepth * 0.72;
      const verticalSpread = starDepth * 0.42;

      pointPositions[offset] = (Math.random() - 0.5) * horizontalSpread;
      pointPositions[offset + 1] = (Math.random() - 0.5) * verticalSpread;
      pointPositions[offset + 2] = -starDepth;
    };

    for (let index = 0; index < STAR_COUNT; index += 1) {
      const spawnDepth = 28 + Math.random() * (FLIGHT_DEPTH - 28);
      resetStar(index, spawnDepth);
      pointPositions[index * 3 + 2] = -(8 + Math.random() * (spawnDepth - 8));

      const colorRoll = Math.random();
      starColorIndices[index] =
        colorRoll > 0.86 ? 2 : colorRoll > 0.66 ? 1 : colorRoll > 0.48 ? 3 : 0;
    }

    const starColorScratch = new THREE.Color();
    const updateStarColors = (
      chromaEnabled: boolean,
      hueOffsetDegrees: number,
      energy: number,
    ) => {
      const hueOffset = hueOffsetDegrees / 360;
      const saturationLift = chromaEnabled ? energy * 0.08 : 0;
      const brightness = chromaEnabled ? 1 + energy * 0.08 : 1;

      for (let index = 0; index < STAR_COUNT; index += 1) {
        const color = starColorScratch
          .copy(starColors[starColorIndices[index]])
          .offsetHSL(
            hueOffset,
            saturationLift,
            chromaEnabled ? energy * 0.04 : 0,
          )
          .multiplyScalar(brightness);
        const pointOffset = index * 3;
        const streakOffset = index * 6;

        pointColors[pointOffset] = color.r;
        pointColors[pointOffset + 1] = color.g;
        pointColors[pointOffset + 2] = color.b;
        streakColors[streakOffset] = color.r;
        streakColors[streakOffset + 1] = color.g;
        streakColors[streakOffset + 2] = color.b;
        streakColors[streakOffset + 3] = color.r;
        streakColors[streakOffset + 4] = color.g;
        streakColors[streakOffset + 5] = color.b;
      }
    };

    updateStarColors(false, 0, 0);

    const pointGeometry = new THREE.BufferGeometry();
    const pointPositionAttribute = new THREE.BufferAttribute(pointPositions, 3);
    pointPositionAttribute.setUsage(THREE.DynamicDrawUsage);
    pointGeometry.setAttribute("position", pointPositionAttribute);
    const pointColorAttribute = new THREE.BufferAttribute(pointColors, 3);
    pointColorAttribute.setUsage(THREE.DynamicDrawUsage);
    pointGeometry.setAttribute("color", pointColorAttribute);

    const pointMaterial = new THREE.PointsMaterial({
      size: 0.12,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const stars = new THREE.Points(pointGeometry, pointMaterial);
    flightWorld.add(stars);

    const streakGeometry = new THREE.BufferGeometry();
    const streakPositionAttribute = new THREE.BufferAttribute(
      streakPositions,
      3,
    );
    streakPositionAttribute.setUsage(THREE.DynamicDrawUsage);
    streakGeometry.setAttribute("position", streakPositionAttribute);
    const streakColorAttribute = new THREE.BufferAttribute(streakColors, 3);
    streakColorAttribute.setUsage(THREE.DynamicDrawUsage);
    streakGeometry.setAttribute("color", streakColorAttribute);

    const streakMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const streaks = new THREE.LineSegments(streakGeometry, streakMaterial);
    flightWorld.add(streaks);

    const createHelixPositions = (phase: number, radius: number) => {
      const positions = new Float32Array(PHENOMENON_POINT_COUNT * 3);
      for (let index = 0; index < PHENOMENON_POINT_COUNT; index += 1) {
        const progress = index / (PHENOMENON_POINT_COUNT - 1);
        const angle = progress * Math.PI * 4.4 + phase;
        const offset = index * 3;
        positions[offset] = Math.cos(angle) * radius * (0.72 + progress * 0.28);
        positions[offset + 1] =
          Math.sin(angle) * radius * (0.72 + progress * 0.28);
        positions[offset + 2] = -24 + progress * 48;
      }
      return positions;
    };

    const createPhenomenonRail = (positions: Float32Array, color: number) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      const glowMaterial = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const coreMaterial = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glow = new THREE.Line(geometry, glowMaterial);
      const core = new THREE.Line(geometry, coreMaterial);
      return { geometry, glowMaterial, coreMaterial, glow, core };
    };

    const railGreen = createPhenomenonRail(
      createHelixPositions(0, 4.2),
      0x9cff57,
    );
    const railCyan = createPhenomenonRail(
      createHelixPositions(Math.PI, 3.6),
      0x47f7ff,
    );
    const railGroup = new THREE.Group();
    railGroup.add(railGreen.glow, railGreen.core, railCyan.glow, railCyan.core);

    const nodePositions = new Float32Array(PHENOMENON_NODE_COUNT * 3);
    for (let index = 0; index < PHENOMENON_NODE_COUNT; index += 1) {
      const progress = (index + 1) / (PHENOMENON_NODE_COUNT + 1);
      const angle = progress * Math.PI * 4.4 + 0.22;
      const offset = index * 3;
      nodePositions[offset] = Math.cos(angle) * 4.35 * (0.72 + progress * 0.28);
      nodePositions[offset + 1] =
        Math.sin(angle) * 4.35 * (0.72 + progress * 0.28);
      nodePositions[offset + 2] = -24 + progress * 48;
    }
    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(nodePositions, 3),
    );
    const nodeMaterial = new THREE.PointsMaterial({
      color: 0xff7fa1,
      size: 0.62,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const nodes = new THREE.Points(nodeGeometry, nodeMaterial);

    const arcPositions = new Float32Array(PHENOMENON_ARC_COUNT * 4 * 3);
    for (let index = 0; index < PHENOMENON_ARC_COUNT; index += 1) {
      const progress = (index + 1) / (PHENOMENON_ARC_COUNT + 1);
      const angle = progress * Math.PI * 4.4 + 0.8;
      const centerX = Math.cos(angle) * 4.1;
      const centerY = Math.sin(angle) * 4.1;
      const offset = index * 12;
      arcPositions[offset] = centerX - 0.5;
      arcPositions[offset + 1] = centerY - 0.35;
      arcPositions[offset + 2] = -24 + progress * 48;
      arcPositions[offset + 3] = centerX - 0.1;
      arcPositions[offset + 4] = centerY + 0.32;
      arcPositions[offset + 5] = -24 + progress * 48;
      arcPositions[offset + 6] = centerX + 0.18;
      arcPositions[offset + 7] = centerY - 0.18;
      arcPositions[offset + 8] = -24 + progress * 48;
      arcPositions[offset + 9] = centerX + 0.58;
      arcPositions[offset + 10] = centerY + 0.18;
      arcPositions[offset + 11] = -24 + progress * 48;
    }
    const arcGeometry = new THREE.BufferGeometry();
    arcGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(arcPositions, 3),
    );
    const arcMaterial = new THREE.LineBasicMaterial({
      color: 0xff7fa1,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const arcs = new THREE.LineSegments(arcGeometry, arcMaterial);

    const frequencyGate = new THREE.Group();
    frequencyGate.add(railGroup, nodes, arcs);
    frequencyGate.name = "signal-phenomena-v1";
    frequencyGate.position.set(0, 0, -GATE_SPAWN_DEPTH);
    flightWorld.add(frequencyGate);

    const orbCoreGeometry = new THREE.SphereGeometry(2.2, 16, 12);
    const orbCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0x47f7ff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const orbCore = new THREE.Mesh(orbCoreGeometry, orbCoreMaterial);
    const orbShellGeometry = new THREE.SphereGeometry(3.05, 12, 8);
    const orbShellMaterial = new THREE.MeshBasicMaterial({
      color: 0x9cff57,
      transparent: true,
      opacity: 0.28,
      wireframe: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const orbShell = new THREE.Mesh(orbShellGeometry, orbShellMaterial);
    const signalOrb = new THREE.Group();
    signalOrb.add(orbCore, orbShell);
    signalOrb.name = "signal-orb-v1";
    flightWorld.add(signalOrb);

    const orbCoreBaseColor = new THREE.Color(0x47f7ff);
    const orbShellBaseColor = new THREE.Color(0x9cff57);
    let orbSpinY = 0.18;
    let orbSpinZ = -0.08;

    const resetSignalOrb = () => {
      const side = Math.random() < 0.5 ? -1 : 1;
      signalOrb.position.set(
        side * (14 + Math.random() * 10),
        (Math.random() - 0.5) * 14,
        -(SIGNAL_ORB_SPAWN_DEPTH + Math.random() * SIGNAL_ORB_RECYCLE_VARIANCE),
      );
      signalOrb.rotation.set(0, 0, 0);
      signalOrb.scale.setScalar(
        SIGNAL_ORB_MIN_SCALE +
          Math.random() * (SIGNAL_ORB_MAX_SCALE - SIGNAL_ORB_MIN_SCALE),
      );

      const coreIndex = Math.floor(Math.random() * starColors.length);
      const shellIndex =
        (coreIndex + 1 + Math.floor(Math.random() * (starColors.length - 1))) %
        starColors.length;
      orbCoreBaseColor.copy(starColors[coreIndex]);
      orbShellBaseColor.copy(starColors[shellIndex]);
      orbCoreMaterial.color.copy(orbCoreBaseColor);
      orbShellMaterial.color.copy(orbShellBaseColor);

      orbSpinY = (Math.random() < 0.5 ? -1 : 1) * (0.09 + Math.random() * 0.2);
      orbSpinZ = (Math.random() < 0.5 ? -1 : 1) * (0.04 + Math.random() * 0.11);
    };
    resetSignalOrb();

    const gateCyan = new THREE.Color(0x47f7ff);
    const gateGreen = new THREE.Color(0x9cff57);
    const gateSalmon = new THREE.Color(0xff7fa1);
    const restrainedCyan = new THREE.Color(0x67cbd4);
    const restrainedGreen = new THREE.Color(0x78b998);
    const restrainedIce = new THREE.Color(0xa4dce2);
    const phenomenonColorScratch = new THREE.Color();

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;

      if (width <= 0 || height <= 0) {
        return;
      }

      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    let frameId = 0;
    let lastFrameTime = performance.now();
    const initialState = visualStateRef.current;
    let smoothedSpeed =
      initialState.controlMode === "manual" ? initialState.flightSpeed : 0;
    let visualSpeed = smoothedSpeed;
    let previousSignalId = initialState.signalId;
    let lastTelemetryPublishedAt = 0;
    let previousPhenomenonZ = frequencyGate.position.z;
    let steeringElapsed = STEERING_MIN_DURATION;
    let steeringDuration = STEERING_MIN_DURATION;
    let steeringYaw = 0;
    let steeringPitch = 0;
    let steeringRoll = 0;
    let previousChromaEnabled: boolean | null = null;
    let smoothedChromaHueOffset = 0;
    let previousRenderedHueOffset = Number.NaN;
    let previousRenderedEnergy = Number.NaN;

    const animate = (frameTime: number) => {
      const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
      lastFrameTime = frameTime;
      const state = visualStateRef.current;
      const snapshot = state.getLatestAudioSnapshot?.() ?? null;
      const smoothedEnergy = snapshot?.smoothedEnergy ?? 0;
      const requestedSpeed =
        state.controlMode === "audio"
          ? mapSmoothedEnergyToSpeed(smoothedEnergy)
          : state.flightSpeed;
      const targetSpeed =
        state.isPlaying && state.motionEnabled ? requestedSpeed : 0;

      if (state.signalId !== previousSignalId) {
        previousSignalId = state.signalId;
        smoothedSpeed = 0;
      }

      const smoothing = 1 - Math.exp(-delta * SPEED_EASING_PER_SECOND);
      smoothedSpeed += (targetSpeed - smoothedSpeed) * smoothing;

      if (state.motionEnabled) {
        visualSpeed = smoothedSpeed;
      }

      const normalizedSpeed = visualSpeed / 100;
      const travelVelocity =
        state.isPlaying && state.motionEnabled
          ? 2.2 + normalizedSpeed * normalizedSpeed * 86
          : 0;
      const streakMix = THREE.MathUtils.smoothstep(normalizedSpeed, 0.28, 0.82);
      const streakLength = 0.08 + streakMix * streakMix * 9;

      if (state.motionEnabled) {
        frequencyGate.position.z += travelVelocity * delta;
        frequencyGate.rotation.z += delta * 0.032;
        signalOrb.position.z += travelVelocity * delta;
        signalOrb.rotation.y += delta * orbSpinY;
        signalOrb.rotation.z += delta * orbSpinZ;
      }

      if (previousPhenomenonZ < -0.8 && frequencyGate.position.z >= -0.8) {
        if (Math.random() < 0.72) {
          steeringElapsed = 0;
          steeringDuration =
            STEERING_MIN_DURATION + Math.random() * STEERING_DURATION_VARIANCE;
          const direction = Math.random() < 0.5 ? -1 : 1;
          steeringYaw = direction * (0.072 + Math.random() * 0.042);
          steeringPitch =
            Math.random() < 0.32
              ? (Math.random() < 0.5 ? -1 : 1) * (0.014 + Math.random() * 0.012)
              : 0;
          steeringRoll = direction * (0.022 + Math.random() * 0.014);
        } else {
          steeringElapsed = steeringDuration;
        }
      }
      previousPhenomenonZ = frequencyGate.position.z;

      if (frequencyGate.position.z > NEAR_PLANE) {
        frequencyGate.position.z = -(
          GATE_RECYCLE_DEPTH +
          Math.random() * GATE_RECYCLE_VARIANCE
        );
        previousPhenomenonZ = frequencyGate.position.z;
      }

      if (signalOrb.position.z > NEAR_PLANE + 4) {
        resetSignalOrb();
      }

      if (state.motionEnabled) {
        steeringElapsed = Math.min(steeringDuration, steeringElapsed + delta);
        const steeringProgress = steeringElapsed / steeringDuration;
        const steeringBuild = THREE.MathUtils.smoothstep(
          steeringProgress,
          0,
          0.72,
        );
        const steeringRelease =
          1 - THREE.MathUtils.smoothstep(steeringProgress, 0.84, 1);
        const steeringWeight = Math.min(steeringBuild, steeringRelease);
        const steeringSmoothing = 1 - Math.exp(-delta * 1.8);
        flightWorld.rotation.y +=
          (steeringYaw * steeringWeight - flightWorld.rotation.y) *
          steeringSmoothing;
        flightWorld.rotation.x +=
          (steeringPitch * steeringWeight - flightWorld.rotation.x) *
          steeringSmoothing;
        flightWorld.rotation.z +=
          (steeringRoll * steeringWeight - flightWorld.rotation.z) *
          steeringSmoothing;
      }

      const targetChromaHueOffset = state.chromaEnabled
        ? mapSignalRunnerChromaHue(smoothedEnergy)
        : 0;
      smoothedChromaHueOffset +=
        (targetChromaHueOffset - smoothedChromaHueOffset) *
        SIGNAL_RUNNER_CHROMA_HUE_RESPONSE;

      const chromaAmount = state.chromaEnabled
        ? THREE.MathUtils.clamp(
            smoothedEnergy * 0.58 + (snapshot?.kickPulse ?? 0) * 0.22,
            0,
            1,
          )
        : 0;
      if (
        state.chromaEnabled !== previousChromaEnabled ||
        Math.abs(smoothedChromaHueOffset - previousRenderedHueOffset) > 0.001 ||
        Math.abs(smoothedEnergy - previousRenderedEnergy) > 0.001
      ) {
        updateStarColors(
          state.chromaEnabled,
          smoothedChromaHueOffset,
          smoothedEnergy,
        );
        pointColorAttribute.needsUpdate = true;
        streakColorAttribute.needsUpdate = true;
        previousChromaEnabled = state.chromaEnabled;
        previousRenderedHueOffset = smoothedChromaHueOffset;
        previousRenderedEnergy = smoothedEnergy;
      }
      const approachVisibility = THREE.MathUtils.clamp(
        (frequencyGate.position.z + 85) / 55,
        0,
        1,
      );
      const exitVisibility = THREE.MathUtils.clamp(
        (14 - frequencyGate.position.z) / 32,
        0,
        1,
      );
      const phenomenonVisibility = approachVisibility * exitVisibility;
      const arcBurst = state.chromaEnabled
        ? Math.pow(Math.max(0, Math.sin(frameTime * 0.0024 + 0.8)), 12) *
          phenomenonVisibility
        : 0;

      if (state.chromaEnabled) {
        phenomenonColorScratch
          .copy(gateGreen)
          .lerp(gateCyan, chromaAmount * 0.28);
        railGreen.coreMaterial.color.copy(phenomenonColorScratch);
        phenomenonColorScratch
          .copy(gateGreen)
          .lerp(gateCyan, chromaAmount * 0.24);
        railGreen.glowMaterial.color.copy(phenomenonColorScratch);
        phenomenonColorScratch
          .copy(gateCyan)
          .lerp(gateSalmon, chromaAmount * 0.22);
        railCyan.coreMaterial.color.copy(phenomenonColorScratch);
        phenomenonColorScratch
          .copy(gateCyan)
          .lerp(gateSalmon, chromaAmount * 0.16);
        railCyan.glowMaterial.color.copy(phenomenonColorScratch);
        phenomenonColorScratch
          .copy(gateSalmon)
          .lerp(gateCyan, chromaAmount * 0.24);
        nodeMaterial.color.copy(phenomenonColorScratch);
        arcMaterial.color.copy(phenomenonColorScratch);
        phenomenonColorScratch
          .copy(orbCoreBaseColor)
          .lerp(gateSalmon, chromaAmount * 0.22);
        orbCoreMaterial.color.copy(phenomenonColorScratch);
        phenomenonColorScratch
          .copy(orbShellBaseColor)
          .lerp(gateCyan, chromaAmount * 0.2);
        orbShellMaterial.color.copy(phenomenonColorScratch);
      } else {
        railGreen.coreMaterial.color.copy(restrainedGreen);
        railGreen.glowMaterial.color.copy(restrainedGreen);
        railCyan.coreMaterial.color.copy(restrainedCyan);
        railCyan.glowMaterial.color.copy(restrainedCyan);
        nodeMaterial.color.copy(restrainedIce);
        arcMaterial.color.copy(restrainedCyan);
        orbCoreMaterial.color.copy(restrainedCyan);
        orbShellMaterial.color.copy(restrainedGreen);
      }

      railGreen.coreMaterial.opacity = 0.46 + chromaAmount * 0.08;
      railGreen.glowMaterial.opacity = 0.08 + chromaAmount * 0.04;
      railCyan.coreMaterial.opacity = 0.48 + chromaAmount * 0.08;
      railCyan.glowMaterial.opacity = 0.08 + chromaAmount * 0.04;
      nodeMaterial.opacity = 0.62 + arcBurst * 0.16 + chromaAmount * 0.1;
      arcMaterial.opacity = 0.06 + arcBurst * 0.34 + chromaAmount * 0.08;
      orbCoreMaterial.opacity = 0.68 + chromaAmount * 0.12;
      orbShellMaterial.opacity = 0.24 + chromaAmount * 0.1;

      for (let index = 0; index < STAR_COUNT; index += 1) {
        const pointOffset = index * 3;
        const streakOffset = index * 6;
        let z = pointPositions[pointOffset + 2] + travelVelocity * delta;

        if (z > -NEAR_PLANE) {
          resetStar(index);
          z = pointPositions[pointOffset + 2];
        } else {
          pointPositions[pointOffset + 2] = z;
        }

        const x = pointPositions[pointOffset];
        const y = pointPositions[pointOffset + 1];
        streakPositions[streakOffset] = x;
        streakPositions[streakOffset + 1] = y;
        streakPositions[streakOffset + 2] = z;
        streakPositions[streakOffset + 3] = x;
        streakPositions[streakOffset + 4] = y;
        streakPositions[streakOffset + 5] = z - streakLength;
      }

      pointMaterial.opacity = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(
          state.chromaEnabled ? 1 : 0.72,
          state.chromaEnabled ? 0.54 : 0.42,
          streakMix,
        ),
        0,
        1,
      );
      pointMaterial.size = THREE.MathUtils.lerp(0.12, 0.075, streakMix);
      streakMaterial.opacity = streakMix * (state.chromaEnabled ? 0.94 : 0.66);
      pointPositionAttribute.needsUpdate = true;
      streakPositionAttribute.needsUpdate = true;

      if (
        state.onDriveTelemetry &&
        frameTime - lastTelemetryPublishedAt >= TELEMETRY_INTERVAL_MS
      ) {
        lastTelemetryPublishedAt = frameTime;
        state.onDriveTelemetry({
          controlMode: state.controlMode,
          smoothedEnergy,
          targetSpeed,
          actualSpeed: smoothedSpeed,
          travelVelocity,
          hue: smoothedChromaHueOffset,
        });
      }

      renderer.render(scene, camera);
      renderFpsSampler.sample(frameTime);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      renderFpsSampler.dispose();
      resizeObserver.disconnect();
      pointGeometry.dispose();
      pointMaterial.dispose();
      streakGeometry.dispose();
      streakMaterial.dispose();
      railGreen.geometry.dispose();
      railGreen.glowMaterial.dispose();
      railGreen.coreMaterial.dispose();
      railCyan.geometry.dispose();
      railCyan.glowMaterial.dispose();
      railCyan.coreMaterial.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      arcGeometry.dispose();
      arcMaterial.dispose();
      orbCoreGeometry.dispose();
      orbCoreMaterial.dispose();
      orbShellGeometry.dispose();
      orbShellMaterial.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="signal-runner__space" ref={mountRef} aria-hidden="true" />
  );
}

export default SignalRunnerScene;
