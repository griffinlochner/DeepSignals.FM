import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import {
  mapSignalRunnerChromaHue,
  SIGNAL_RUNNER_CHROMA_HUE_RESPONSE,
} from "../../experiments/signal-runner/signalRunnerChroma";
import type { ThemeSceneProps } from "../themeTypes";
import "./neonHyperRacer.css";

type ReactiveMaterial = {
  material: THREE.MeshBasicMaterial | THREE.LineBasicMaterial | THREE.PointsMaterial;
  base: THREE.Color;
  baseOpacity: number;
  family: "path" | "structure" | "sky";
};

const COLORS = {
  void: 0x02030d,
  cyan: 0x39e8ff,
  green: 0x6dff5a,
  pink: 0xff3fbd,
  amber: 0xffb84d,
  blue: 0x3f6dff,
  indigo: 0x765cff,
  violet: 0x8b35ff,
  roadway: 0x171b3d,
  roadwayEdge: 0x1d2850,
  white: 0xeaffff,
};

const clamp = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
const TRACK_SEGMENT_COUNT = 52;
const TRACK_SEGMENT_SPACING = 7.5;
const TRACK_SEGMENT_DEPTH = 8.9;
// Roadway must start behind the camera so the near-field never opens onto empty space.
const TRACK_SEGMENT_START_Z = 12;
const TRACK_SEGMENT_RECYCLE_Z = TRACK_SEGMENT_START_Z + TRACK_SEGMENT_SPACING;

function getTrackCenter(index: number) {
  const phase = (index / TRACK_SEGMENT_COUNT) * Math.PI * 2;
  return {
    x:
      Math.sin(phase) * 2.7 +
      Math.sin(phase * 2 + 0.72) * 1.15 +
      Math.sin(phase * 3 - 0.55) * 0.48,
    y: 0,
  };
}

function NeonHyperRacerTheme({
  isPlaying,
  volume,
  reducedMotion,
  motionEnabled = true,
  chromaEnabled = true,
  getLatestAudioSnapshot,
}: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ isPlaying, volume, reducedMotion, motionEnabled, chromaEnabled, getLatestAudioSnapshot });

  useEffect(() => {
    propsRef.current = { isPlaying, volume, reducedMotion, motionEnabled, chromaEnabled, getLatestAudioSnapshot };
  }, [chromaEnabled, getLatestAudioSnapshot, isPlaying, motionEnabled, reducedMotion, volume]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.void);
    scene.fog = new THREE.FogExp2(COLORS.void, 0.0085);
    const camera = new THREE.PerspectiveCamera(63, 1, 0.1, 280);
    camera.position.set(0, 1.2, 5.2);
    camera.lookAt(0, 0.8, -28);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const world = new THREE.Group();
    scene.add(world);
    const skyLayer = new THREE.Group();
    scene.add(skyLayer);
    const materials: ReactiveMaterial[] = [];
    const geometries = new Set<THREE.BufferGeometry>();
    const trackMaterial = (color: number, family: ReactiveMaterial["family"], opacity = 1) => {
      const isStructure = family === "structure";
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: !isStructure && opacity < 1,
        opacity,
        depthWrite: isStructure,
        blending: isStructure ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      materials.push({ material, base: new THREE.Color(color), baseOpacity: opacity, family });
      return material;
    };
    const lineMaterial = (color: number, family: ReactiveMaterial["family"], opacity = 1) => {
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: family === "structure",
        blending: family === "structure" ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      materials.push({ material, base: new THREE.Color(color), baseOpacity: opacity, family });
      return material;
    };
    const geometry = <T extends THREE.BufferGeometry>(value: T) => {
      geometries.add(value);
      return value;
    };

    const pathGeo = geometry(new THREE.BoxGeometry(0.12, 0.08, TRACK_SEGMENT_DEPTH));
    const laneGeo = geometry(new THREE.BoxGeometry(0.07, 0.035, 1.65));
    const roadGeo = geometry(new THREE.BoxGeometry(15.8, 0.2, TRACK_SEGMENT_DEPTH));
    const roadEdgeGeo = geometry(new THREE.BoxGeometry(0.18, 0.08, TRACK_SEGMENT_DEPTH));
    const barrierGeo = geometry(new THREE.BoxGeometry(0.3, 0.48, 2.4));
    const towerGeo = geometry(new THREE.BoxGeometry(1.2, 1, 1.2));
    const nexusCoreGeo = geometry(new THREE.IcosahedronGeometry(0.92, 2));
    const nexusInnerGeo = geometry(new THREE.SphereGeometry(0.2, 12, 8));
    const nexusGlowGeo = geometry(new THREE.SphereGeometry(1.9, 20, 14));
    const nexusShellGeo = geometry(new THREE.IcosahedronGeometry(1.22, 1));
    const nexusShellAccentGeo = geometry(new THREE.OctahedronGeometry(1.46, 1));
    const nexusRingGeos = [
      geometry(new THREE.TorusGeometry(2.15, 0.035, 8, 64)),
      geometry(new THREE.TorusGeometry(2.45, 0.028, 8, 64)),
      geometry(new THREE.TorusGeometry(2.75, 0.022, 8, 64)),
    ];
    // Half of each layer clusters around a tilted band so the sky reads as a milky way rather than uniform noise.
    const STAR_BAND_TILT = 0.42;
    const starLayers = [
      { count: 4800, size: 1.35, opacity: 0.62, color: COLORS.white, sizeVariance: 0.52 },
      { count: 1500, size: 2.2, opacity: 0.8, color: COLORS.white, sizeVariance: 0.9 },
      { count: 420, size: 4.1, opacity: 0.96, color: COLORS.cyan, sizeVariance: 1.2 },
      { count: 80, size: 8.0, opacity: 1, color: COLORS.white, sizeVariance: 1.2 },
    ];
    const starSystems: Array<{
      points: THREE.Points;
      material: THREE.ShaderMaterial;
      baseColor: THREE.Color;
    }> = [];
    starLayers.forEach(({ count, size, opacity, color, sizeVariance }) => {
      const starGeo = geometry(new THREE.BufferGeometry());
      const starPositions = new Float32Array(count * 3);
      const baseColor = new THREE.Color(color);
      const starColors = new Float32Array(count * 3);
      const starSizes = new Float32Array(count);
      const twinklePhases = new Float32Array(count);
      const twinkleSpeed = new Float32Array(count);
      const twinkleAmplitude = new Float32Array(count);
      for (let index = 0; index < count; index += 1) {
        const scattersTowardEdges = size > 4 ? 0.75 : 0.22;
        const radius = 74 + Math.random() * 170 + scattersTowardEdges * (30 + Math.random() * 80);
        const azimuth = Math.random() * Math.PI * 2;
        const edgeBias = size > 4 ? (Math.random() > 0.5 ? 0.8 : -0.6) : (Math.random() > 0.5 ? 0.3 : -0.2);
        // Sampling in sine space keeps angular density even instead of banding at the extremes.
        const elevation = index % 2 === 0
          ? 0.12 + Math.sin(azimuth) * STAR_BAND_TILT + (Math.random() - 0.5) * 0.22 + edgeBias * 0.52
          : Math.asin(THREE.MathUtils.lerp(-0.45, 0.95, Math.random())) + edgeBias * 0.28;
        const horizontal = Math.cos(elevation) * radius;
        const xi = index * 3;
        starPositions[xi] = Math.sin(azimuth) * horizontal;
        starPositions[xi + 1] = Math.sin(elevation) * radius;
        starPositions[xi + 2] = Math.cos(azimuth) * horizontal;

        const authoredSize = size * (0.9 + Math.random() * sizeVariance);
        starSizes[index] = Math.min(authoredSize, size * (size > 4 ? 1.15 : 1.8));
        twinklePhases[index] = Math.random() * Math.PI * 2;
        twinkleSpeed[index] = (size > 4 ? 0.22 : 0.35) + Math.random() * (size > 4 ? 0.48 : 0.8);
        twinkleAmplitude[index] = (size > 4 ? 0.45 : 0.3) + Math.random() * (size > 4 ? 0.62 : 0.7);

        starColors[xi] = baseColor.r;
        starColors[xi + 1] = baseColor.g;
        starColors[xi + 2] = baseColor.b;
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
      starGeo.setAttribute("aBaseColor", new THREE.BufferAttribute(starColors, 3));
      starGeo.setAttribute("aSize", new THREE.BufferAttribute(starSizes, 1));
      starGeo.setAttribute("aPhase", new THREE.BufferAttribute(twinklePhases, 1));
      starGeo.setAttribute("aSpeed", new THREE.BufferAttribute(twinkleSpeed, 1));
      starGeo.setAttribute("aAmplitude", new THREE.BufferAttribute(twinkleAmplitude, 1));

      const starMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uTwinkleActive: { value: 0 },
          uHueActive: { value: 0 },
          uHueShift: { value: 0 },
          uOpacity: { value: opacity },
        },
        vertexShader: `
          attribute vec3 aBaseColor;
          attribute float aSize;
          attribute float aPhase;
          attribute float aSpeed;
          attribute float aAmplitude;
          uniform float uTime;
          uniform float uTwinkleActive;
          uniform float uHueActive;
          uniform float uHueShift;
          varying vec3 vColor;

          void main() {
            vec3 color = aBaseColor;
            float brightness = 1.0;
            float sizeScale = 1.0;

            if (uTwinkleActive > 0.5) {
              brightness = 0.58 + aAmplitude * (0.5 + 0.5 * sin(uTime * (0.7 + aSpeed) + aPhase));
              sizeScale = 0.9 + aAmplitude * 0.25 + 0.14 * sin(uTime * (0.5 + aSpeed) + aPhase);
            }

            if (uHueActive > 0.5) {
              vec3 hueTint = vec3(
                0.5 + 0.5 * sin(uTime * 0.8 + aPhase + uHueShift * 8.0),
                0.5 + 0.5 * sin(uTime * 0.8 + aPhase + uHueShift * 8.0 + 2.0),
                0.5 + 0.5 * sin(uTime * 0.8 + aPhase + uHueShift * 8.0 + 4.0)
              );
              color = mix(color, hueTint, 0.24 + 0.2 * sin(uTime * 1.15 + aPhase));
            }

            vColor = color * brightness;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = aSize * sizeScale;
          }
        `,
        fragmentShader: `
          uniform float uOpacity;
          varying vec3 vColor;
          void main() {
            vec2 uv = gl_PointCoord - vec2(0.5);
            float dist = dot(uv, uv);
            float alpha = smoothstep(0.25, 0.0, dist);
            gl_FragColor = vec4(vColor, alpha * uOpacity);
          }
        `,
      });

      const points = new THREE.Points(starGeo, starMaterial);
      skyLayer.add(points);
      starSystems.push({ points, material: starMaterial, baseColor });
    });

    const pathBase = trackMaterial(COLORS.cyan, "path", 0.9);
    const laneBase = trackMaterial(COLORS.pink, "path", 0.78);
    const structureBase = trackMaterial(COLORS.indigo, "structure", 0.94);
    const amberBase = trackMaterial(COLORS.amber, "structure", 0.96);
    const greenBase = trackMaterial(COLORS.green, "path", 0.9);
    const roadwayBase = trackMaterial(COLORS.roadway, "structure", 1);
    const nexusShellBase = new THREE.MeshBasicMaterial({ color: COLORS.violet, wireframe: true, transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending });
    const nexusShellAccentBase = new THREE.MeshBasicMaterial({ color: COLORS.indigo, wireframe: true, transparent: true, opacity: 0.52, depthWrite: false, blending: THREE.AdditiveBlending });
    materials.push({ material: nexusShellBase, base: new THREE.Color(COLORS.violet), baseOpacity: 0.78, family: "path" });
    materials.push({ material: nexusShellAccentBase, base: new THREE.Color(COLORS.indigo), baseOpacity: 0.52, family: "path" });
    const nexusCyanBase = lineMaterial(COLORS.cyan, "path", 0.9);
    const nexusGreenBase = lineMaterial(COLORS.green, "path", 0.86);
    const nexusPinkBase = lineMaterial(COLORS.pink, "path", 0.84);
    const nexusAmberBase = lineMaterial(COLORS.amber, "path", 0.78);
    const corridorSegments: THREE.Group[] = [];
    const corridorLength = TRACK_SEGMENT_COUNT * TRACK_SEGMENT_SPACING;

    // A continuous periodic centerline keeps the recycled corridor cohesive.
    for (let index = 0; index < TRACK_SEGMENT_COUNT; index += 1) {
      const z = TRACK_SEGMENT_START_Z - index * TRACK_SEGMENT_SPACING;
      const progress = index / TRACK_SEGMENT_COUNT;
      const center = getTrackCenter(index);
      const previousCenter = getTrackCenter(index - 1);
      const nextCenter = getTrackCenter(index + 1);
      const segment = new THREE.Group();
      segment.position.set(center.x, center.y, z);
      segment.rotation.y = -Math.atan2(
        nextCenter.x - previousCenter.x,
        TRACK_SEGMENT_SPACING * 2,
      );
      world.add(segment);
      corridorSegments.push(segment);

      const road = new THREE.Mesh(roadGeo, roadwayBase);
      road.scale.x = 0.98 + Math.sin(progress * Math.PI * 2 * 5 + 0.45) * 0.04;
      road.position.set(0, -0.16, 0);
      const leftEdge = new THREE.Mesh(roadEdgeGeo, pathBase);
      leftEdge.position.set(-7.45 * road.scale.x, -0.01, 0);
      const rightEdge = new THREE.Mesh(roadEdgeGeo, index % 3 === 0 ? amberBase : pathBase);
      rightEdge.position.set(7.45 * road.scale.x, -0.01, 0);
      segment.add(road, leftEdge, rightEdge);

      const leftRail = new THREE.Mesh(pathGeo, pathBase);
      leftRail.position.set(-3.4, 0, 0);
      const rightRail = new THREE.Mesh(pathGeo, pathBase);
      rightRail.position.set(3.4, 0, 0);
      const laneOffsets = index % 4 === 1 ? [-4.4, -1.5, 1.5, 4.4] : [-3.8, -1.25, 1.25, 3.8];
      const laneMaterials = [laneBase, greenBase, laneBase, index % 3 === 0 ? amberBase : laneBase];
      const laneMarkers = laneOffsets.map((offset, markerIndex) => {
        const marker = new THREE.Mesh(laneGeo, laneMaterials[markerIndex]);
        marker.position.set(offset * road.scale.x, 0.04, markerIndex % 2 === index % 2 ? -1.2 : 1.2);
        return marker;
      });
      segment.add(leftRail, rightRail, ...laneMarkers);

      if (index % 5 === 1 || index % 5 === 3) {
        const leftBarrier = new THREE.Mesh(barrierGeo, index % 2 ? amberBase : structureBase);
        leftBarrier.position.set(-7.7 * road.scale.x, 0.12, index % 2 ? -1 : 1);
        const rightBarrier = new THREE.Mesh(barrierGeo, index % 2 ? structureBase : amberBase);
        rightBarrier.position.set(7.7 * road.scale.x, 0.12, index % 2 ? 1 : -1);
        segment.add(leftBarrier, rightBarrier);
      }

      if (index >= 23 && index <= 30 && index % 2 === 0) {
        for (let tower = 0; tower < 2 + (index % 4 === 0 ? 1 : 0); tower += 1) {
          const building = new THREE.Mesh(towerGeo, tower % 2 ? structureBase : amberBase);
          const side = tower % 2 ? 1 : -1;
          building.scale.set(0.9 + ((index + tower) % 3) * 0.28, 0.55 + ((index + tower) % 3) * 0.28, 1.1);
          building.position.set(side * (8.8 + ((index + tower) % 3) * 1.5), building.scale.y * 0.5 - 0.2, (tower - 1) * 1.8);
          segment.add(building);
        }
      }
    }

    const nexus = new THREE.Group();
    nexus.position.set(12, 11.5, -72);
    nexus.scale.setScalar(3.6);

    const nexusCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0x0b0314,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const nexusInnerMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.pink,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const nexusGlowMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.violet,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const nexusCore = new THREE.Mesh(nexusCoreGeo, nexusCoreMaterial);
    const nexusInner = new THREE.Mesh(nexusInnerGeo, nexusInnerMaterial);
    const nexusGlow = new THREE.Mesh(nexusGlowGeo, nexusGlowMaterial);
    nexusGlow.scale.setScalar(0.62);
    const nexusShell = new THREE.Mesh(nexusShellGeo, new THREE.MeshBasicMaterial({
      color: COLORS.violet,
      wireframe: true,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const nexusShellAccent = new THREE.Mesh(nexusShellAccentGeo, new THREE.MeshBasicMaterial({
      color: COLORS.indigo,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    nexusShell.rotation.set(0.3, 0.5, 0.1);
    nexusShellAccent.rotation.set(1.05, 0.15, 0.65);
    nexus.add(nexusGlow, nexusCore, nexusInner, nexusShell, nexusShellAccent);

    const nexusRings = nexusRingGeos.map((ringGeometry, index) => {
      const ring = new THREE.Mesh(ringGeometry, [nexusCyanBase, nexusPinkBase, nexusAmberBase][index]);
      ring.rotation.copy([
        new THREE.Euler(0.3, 0.15, 0.44),
        new THREE.Euler(1.05, 0.2, 0.2),
        new THREE.Euler(0.8, 0.62, 0.95),
      ][index]);
      nexus.add(ring);
      return ring;
    });

    const nexusPulseGeo = geometry(new THREE.SphereGeometry(0.09, 10, 8));
    const nexusPulseGlowGeo = geometry(new THREE.SphereGeometry(0.18, 10, 8));
    const nexusPulses: Array<{ pulse: THREE.Mesh; glow: THREE.Mesh; curve: THREE.Curve<THREE.Vector3>; progress: number; speed: number; offset: number }> = [];
    const createNexusWave = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      turns: number,
      radius: number,
      material: THREE.LineBasicMaterial,
      pulseMaterial: THREE.Material,
      speed: number,
      offset: number,
      style: "helix" | "arc" = "helix",
    ) => {
      const forward = end.clone().sub(start).normalize();
      const reference = Math.abs(forward.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const side = new THREE.Vector3().crossVectors(forward, reference).normalize();
      const up = new THREE.Vector3().crossVectors(side, forward).normalize();
      const points: THREE.Vector3[] = [];
      const samples = 72;
      for (let point = 0; point <= samples; point += 1) {
        const progress = point / samples;
        const position = start.clone().lerp(end, progress);
        const phase = progress * Math.PI * 2 * turns;
        const waveRadius = style === "arc"
          ? THREE.MathUtils.lerp(radius, radius * 0.14, Math.pow(progress, 1.7))
          : THREE.MathUtils.lerp(radius, radius * 0.2, progress);

        const drift = style === "arc"
          ? Math.sin(progress * Math.PI * 1.3 + offset * 2.1)
          : Math.sin(phase + offset * 1.9);

        position.addScaledVector(side, Math.cos(phase) * waveRadius + drift * radius * 0.18);
        position.addScaledVector(up, Math.sin(phase) * waveRadius * (style === "arc" ? 0.8 : 1.0));
        points.push(position);
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const wave = new THREE.Line(geometry(new THREE.BufferGeometry().setFromPoints(points)), material);
      nexus.add(wave);

      const pulseProgress = (offset % 1 + 0.12) % 1;
      const pulse = new THREE.Mesh(nexusPulseGeo, pulseMaterial);
      const glow = new THREE.Mesh(nexusPulseGlowGeo, pulseMaterial);
      nexus.add(pulse, glow);
      nexusPulses.push({ pulse, glow, curve, progress: pulseProgress, speed, offset });
    };

    createNexusWave(new THREE.Vector3(-8.5, 4.5, -3.5), new THREE.Vector3(-0.7, 0.7, 0), 4.8, 0.56, nexusCyanBase, nexusCyanBase, 0.085, 0.12, "helix");
    createNexusWave(new THREE.Vector3(-8.8, 2.4, -3.5), new THREE.Vector3(-0.75, 0.35, 0), 5.2, 0.46, nexusPinkBase, nexusPinkBase, 0.077, 0.66, "arc");
    createNexusWave(new THREE.Vector3(8.2, 4.0, -3.5), new THREE.Vector3(0.75, 0.7, 0), 4.6, 0.5, nexusGreenBase, nexusGreenBase, 0.09, 0.28, "helix");
    createNexusWave(new THREE.Vector3(7.8, 2.6, -3.5), new THREE.Vector3(0.72, 0.35, 0), 5.0, 0.44, nexusAmberBase, nexusAmberBase, 0.071, 0.85, "arc");
    skyLayer.add(nexus);

    const timer = new THREE.Timer();
    timer.connect(document);
    let elapsed = 0;
    let previousSurgeSequence = 0;
    let currentTravelSpeed = 0;
    let accumulatedTravel = 0;
    let animationFrame = 0;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const render = () => {
      timer.update();
      const delta = Math.min(timer.getDelta(), 0.05);
      elapsed += delta;
      const state = propsRef.current;
      const defaultSnapshot: AudioReactiveSnapshot = {
        energy: 0,
        smoothedEnergy: 0,
        bass: 0,
        kickPulse: 0,
        kickPulseAcceptedEvent: false,
        kickPulseAcceptedEventCount: 0,
        kickPulseAcceptedEventSequence: 0,
        bassPulse: 0,
        mids: 0,
        highs: 0,
        transient: 0,
        isActive: false,
      };
      const snapshot: AudioReactiveSnapshot = state.getLatestAudioSnapshot?.() ?? defaultSnapshot;
      const smoothedEnergy = clamp(snapshot.smoothedEnergy || snapshot.energy || 0);
      const highs = clamp(snapshot.highs);
      const motionActive = state.isPlaying && state.motionEnabled && !state.reducedMotion;
      const chromaActive = state.chromaEnabled && state.isPlaying;

      if (snapshot.kickPulseAcceptedEventSequence !== previousSurgeSequence) {
        previousSurgeSequence = snapshot.kickPulseAcceptedEventSequence;
      }
      const travelEnergy = clamp((smoothedEnergy - 0.04) / (0.72 - 0.04));
      const targetTravelSpeed = motionActive ? clamp(state.volume * travelEnergy) * 92 : 0;
      const travelEase = 1 - Math.exp(-delta * 2.2);
      currentTravelSpeed = THREE.MathUtils.lerp(currentTravelSpeed, targetTravelSpeed, travelEase);
      accumulatedTravel += currentTravelSpeed * delta;

      if (motionActive) {
        corridorSegments.forEach((segment) => {
          segment.position.z += delta * currentTravelSpeed;
          if (segment.position.z > TRACK_SEGMENT_RECYCLE_Z) {
            segment.position.z -= corridorLength;
          }
        });
      } else {
        currentTravelSpeed = 0;
        accumulatedTravel = 0;
      }

      const targetHueDegrees = chromaActive ? mapSignalRunnerChromaHue(smoothedEnergy) : 0;
      const hueOffset = chromaActive
        ? THREE.MathUtils.lerp(0, targetHueDegrees / 360, SIGNAL_RUNNER_CHROMA_HUE_RESPONSE)
        : 0;
      const starChromaEnabled = state.chromaEnabled;
      starSystems.forEach(({ material }) => {
        material.uniforms.uTime.value = elapsed;
        material.uniforms.uTwinkleActive.value = starChromaEnabled ? 1 : 0;
        material.uniforms.uHueActive.value = starChromaEnabled ? 1 : 0;
        material.uniforms.uHueShift.value = starChromaEnabled ? hueOffset : 0;
      });
      if (motionActive) {
        nexus.rotation.y += delta * (0.08 + highs * 0.12);
        nexus.rotation.x = THREE.MathUtils.lerp(nexus.rotation.x, Math.sin(elapsed * 0.11) * 0.08, 0.025);
        nexusRings.forEach((ring, index) => {
          ring.rotation.x += delta * [0.08, -0.11, 0.05][index];
          ring.rotation.y += delta * [0.15, 0.06, -0.09][index];
        });
        nexusShell.rotation.y += delta * 0.1;
        nexusShellAccent.rotation.x -= delta * 0.08;
      }

      nexusPulses.forEach(({ pulse, glow, curve, progress, speed, offset }, index) => {
        if (!motionActive) {
          const frozen = curve.getPointAt(progress);
          pulse.position.copy(frozen);
          glow.position.copy(frozen);
          glow.scale.setScalar(1.0);
          return;
        }
        const nextProgress = (progress + delta * (speed * (0.8 + (index % 3) * 0.35)) + offset * 0.002) % 1;
        nexusPulses[index].progress = nextProgress;
        const position = curve.getPointAt(nextProgress);
        pulse.position.copy(position);
        glow.position.copy(position);
        const pulseVariance = 0.9 + Math.sin(elapsed * (4 + index * 0.7) + offset * 17) * 0.18;
        glow.scale.setScalar(pulseVariance * 1.18);
        pulse.scale.setScalar(Math.max(0.65, pulseVariance));
      });

      materials.forEach(({ material, base, baseOpacity, family }) => {
        material.opacity = baseOpacity;
        if (chromaActive) {
          const hueShift = family === "path"
            ? hueOffset * 0.42
            : family === "structure"
              ? hueOffset * 0.24
              : hueOffset * 0.18;
          const saturationShift = family === "sky" ? 0.12 : 0.08;
          const lightnessShift = family === "structure" ? 0.04 : 0.02;
          material.color.copy(base).offsetHSL(hueShift, saturationShift, lightnessShift);
        } else {
          material.color.copy(base);
        }
      });

      camera.position.set(0, 1.2, 5.2);
      camera.rotation.set(0, 0, 0);
      camera.lookAt(0, 0.8, -28);
      camera.updateProjectionMatrix();
      if (motionActive && state.isPlaying && snapshot.kickPulseAcceptedEventSequence !== previousSurgeSequence) {
        previousSurgeSequence = snapshot.kickPulseAcceptedEventSequence;
      }
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      timer.disconnect();
      resizeObserver.disconnect();
      geometries.forEach((value) => value.dispose());
      materials.forEach(({ material }) => material.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={mountRef} className="neon-hyper-racer-scene" aria-hidden="true" />
  );
}

export default NeonHyperRacerTheme;