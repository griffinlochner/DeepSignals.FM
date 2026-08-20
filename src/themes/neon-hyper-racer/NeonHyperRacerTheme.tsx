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
    camera.position.set(0, 2.2, 8);
    camera.lookAt(0, 1.4, -42);

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
    const starGeo = geometry(new THREE.BufferGeometry());
    const starPositions = new Float32Array(240 * 3);
    for (let index = 0; index < 240; index += 1) {
      starPositions[index * 3] = (Math.random() - 0.5) * 150;
      starPositions[index * 3 + 1] = 8 + Math.random() * 55;
      starPositions[index * 3 + 2] = -10 - Math.random() * 250;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: COLORS.white, size: 0.16, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    materials.push({ material: starMaterial, base: new THREE.Color(COLORS.white), baseOpacity: 0.55, family: "sky" });
    skyLayer.add(new THREE.Points(starGeo, starMaterial));

    const pathBase = trackMaterial(COLORS.cyan, "path", 0.9);
    const laneBase = trackMaterial(COLORS.pink, "path", 0.78);
    const structureBase = trackMaterial(COLORS.indigo, "structure", 0.94);
    const amberBase = trackMaterial(COLORS.amber, "structure", 0.96);
    const greenBase = trackMaterial(COLORS.green, "path", 0.9);
    const roadwayBase = trackMaterial(COLORS.roadway, "structure", 1);
    const nexusCoreBase = trackMaterial(0x05020f, "structure", 0.96);
    const nexusInnerBase = trackMaterial(COLORS.pink, "path", 1);
    const nexusGlowBase = trackMaterial(COLORS.pink, "path", 0.18);
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
      const z = -index * TRACK_SEGMENT_SPACING - 8;
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
    const nexusCore = new THREE.Mesh(nexusCoreGeo, nexusCoreBase);
    const nexusInner = new THREE.Mesh(nexusInnerGeo, nexusInnerBase);
    const nexusGlow = new THREE.Mesh(nexusGlowGeo, nexusGlowBase);
    nexusGlow.scale.setScalar(0.82);
    const nexusShell = new THREE.Mesh(nexusShellGeo, nexusShellBase);
    const nexusShellAccent = new THREE.Mesh(nexusShellAccentGeo, nexusShellAccentBase);
    nexusShell.rotation.set(0.3, 0.5, 0.1);
    nexusShellAccent.rotation.set(1.05, 0.15, 0.65);
    nexus.add(nexusGlow, nexusCore, nexusInner, nexusShell, nexusShellAccent);

    const nexusRings = nexusRingGeos.map((ringGeometry, index) => {
      const ring = new THREE.Mesh(ringGeometry, [nexusCyanBase, nexusPinkBase, nexusAmberBase][index]);
      ring.rotation.copy([
        new THREE.Euler(0.3, 0.15, 0.44),
        new THREE.Euler(1.0, 0.2, 0.2),
        new THREE.Euler(0.8, 0.62, 0.95),
      ][index]);
      nexus.add(ring);
      return ring;
    });

    const nexusPulseGeo = geometry(new THREE.SphereGeometry(0.11, 8, 6));
    const nexusPulseGlowGeo = geometry(new THREE.SphereGeometry(0.25, 8, 6));
    const nexusPulses: Array<{ pulse: THREE.Mesh; glow: THREE.Mesh; curve: THREE.Curve<THREE.Vector3>; progress: number; speed: number }> = [];
    const createNexusWave = (start: THREE.Vector3, end: THREE.Vector3, turns: number, radius: number, material: THREE.LineBasicMaterial, pulseMaterial: THREE.Material) => {
      const forward = end.clone().sub(start).normalize();
      const reference = Math.abs(forward.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const side = new THREE.Vector3().crossVectors(forward, reference).normalize();
      const up = new THREE.Vector3().crossVectors(side, forward).normalize();
      const points: THREE.Vector3[] = [];
      for (let point = 0; point <= 36; point += 1) {
        const progress = point / 36;
        const position = start.clone().lerp(end, progress);
        const phase = progress * Math.PI * 2 * turns;
        const taperedRadius = THREE.MathUtils.lerp(radius, radius * 0.18, progress);
        position.addScaledVector(side, Math.cos(phase) * taperedRadius);
        position.addScaledVector(up, Math.sin(phase) * taperedRadius);
        points.push(position);
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const wave = new THREE.Line(geometry(new THREE.BufferGeometry().setFromPoints(points)), material);
      nexus.add(wave);
      [0.08, 0.54].forEach((progress) => {
        const pulse = new THREE.Mesh(nexusPulseGeo, pulseMaterial);
        const glow = new THREE.Mesh(nexusPulseGlowGeo, pulseMaterial);
        nexus.add(pulse, glow);
        nexusPulses.push({ pulse, glow, curve, progress, speed: 0.075 + (progress * 0.025) });
      });
    };

    createNexusWave(new THREE.Vector3(-8.5, 4.5, -3.5), new THREE.Vector3(-0.7, 0.7, 0), 4.8, 0.5, nexusCyanBase, nexusCyanBase);
    createNexusWave(new THREE.Vector3(-8.8, 2.4, -3.5), new THREE.Vector3(-0.75, 0.35, 0), 5.2, 0.46, nexusPinkBase, nexusPinkBase);
    createNexusWave(new THREE.Vector3(8.2, 4.0, -3.5), new THREE.Vector3(0.75, 0.7, 0), 4.6, 0.44, nexusGreenBase, nexusGreenBase);
    createNexusWave(new THREE.Vector3(7.8, 2.6, -3.5), new THREE.Vector3(0.72, 0.35, 0), 5.0, 0.42, nexusAmberBase, nexusAmberBase);
    skyLayer.add(nexus);

    const beaconGeo = geometry(new THREE.SphereGeometry(0.12, 6, 4));
    const beacons: THREE.Mesh[] = [];
    const beaconSpacing = 8;
    const beaconLength = 28 * beaconSpacing;
    for (let index = 0; index < 28; index += 1) {
      const beacon = new THREE.Mesh(beaconGeo, index % 3 ? pathBase : amberBase);
      beacon.position.set(index % 2 ? 4.9 : -4.9, 1.15, -index * 8 - 12);
      world.add(beacon);
      beacons.push(beacon);
    }

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
          if (segment.position.z > 18) {
            segment.position.z -= corridorLength;
          }
        });
        beacons.forEach((beacon) => {
          beacon.position.z += delta * currentTravelSpeed;
          if (beacon.position.z > 32) {
            beacon.position.z -= beaconLength;
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

      nexusPulses.forEach(({ pulse, glow, curve, progress, speed }, index) => {
        if (!motionActive) {
          pulse.position.copy(curve.getPointAt(progress));
          glow.position.copy(curve.getPointAt(progress));
          glow.scale.setScalar(1.15);
          return;
        }
        const nextProgress = (progress + delta * speed) % 1;
        nexusPulses[index].progress = nextProgress;
        const position = curve.getPointAt(nextProgress);
        pulse.position.copy(position);
        glow.position.copy(position);
        glow.scale.setScalar(1.5 + Math.sin(elapsed * 8 + index) * 0.18);
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
      starMaterial.size = 0.16;
      beacons.forEach((beacon, index) => {
        beacon.scale.setScalar(1 + (index % 3) * 0.16);
      });

      camera.position.set(0, 2.2, 8);
      camera.rotation.set(0, 0, 0);
      camera.lookAt(0, 1.4, -42);
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