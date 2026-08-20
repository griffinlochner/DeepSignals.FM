import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { AudioReactiveSnapshot } from "../../app/playerTypes";
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
  white: 0xeaffff,
};

const clamp = (value: number) => THREE.MathUtils.clamp(value, 0, 1);

function NeonHyperRacerTheme({
  isPlaying,
  reducedMotion,
  motionEnabled = true,
  chromaEnabled = true,
  getLatestAudioSnapshot,
}: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ isPlaying, reducedMotion, motionEnabled, chromaEnabled, getLatestAudioSnapshot });

  useEffect(() => {
    propsRef.current = { isPlaying, reducedMotion, motionEnabled, chromaEnabled, getLatestAudioSnapshot };
  }, [chromaEnabled, getLatestAudioSnapshot, isPlaying, motionEnabled, reducedMotion]);

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

    const pathGeo = geometry(new THREE.BoxGeometry(0.12, 0.08, 7.4));
    const laneGeo = geometry(new THREE.BoxGeometry(0.025, 0.025, 7.4));
    const pylonGeo = geometry(new THREE.BoxGeometry(0.16, 5, 0.16));
    const archGeo = geometry(new THREE.TorusGeometry(5.5, 0.11, 6, 28, Math.PI));
    const towerGeo = geometry(new THREE.BoxGeometry(1.2, 1, 1.2));
    const tunnelRoofGeo = geometry(new THREE.BoxGeometry(12, 0.2, 7.4));
    const tunnelLightGeo = geometry(new THREE.BoxGeometry(8, 0.1, 0.08));
    const helixGeo = geometry(new THREE.BufferGeometry());
    const helixPoints: THREE.Vector3[] = [];
    for (let point = 0; point < 32; point += 1) {
      const phase = (point / 31) * Math.PI * 4;
      helixPoints.push(new THREE.Vector3(Math.cos(phase) * 1.15, (point / 31 - 0.5) * 5.2, Math.sin(phase) * 1.15));
    }
    helixGeo.setFromPoints(helixPoints);
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
    world.add(new THREE.Points(starGeo, starMaterial));

    const pathBase = trackMaterial(COLORS.cyan, "path", 0.9);
    const laneBase = trackMaterial(COLORS.pink, "path", 0.78);
    const structureBase = trackMaterial(COLORS.indigo, "structure", 0.94);
    const amberBase = trackMaterial(COLORS.amber, "structure", 0.96);
    const greenBase = trackMaterial(COLORS.green, "path", 0.9);
    const helixBase = lineMaterial(COLORS.pink, "path", 0.9);
    const helixAccent = lineMaterial(COLORS.green, "path", 0.9);
    const corridorSegments: THREE.Group[] = [];
    const corridorLength = 32 * 7.5;

    // Five fixed spatial compositions: open night, megastructure, curve, tunnel, open vista.
    for (let index = 0; index < 32; index += 1) {
      const z = -index * 7.5 - 8;
      const progress = index / 31;
      const x = progress < 0.32 ? 0 : progress < 0.62 ? Math.sin((progress - 0.32) * 5.8) * 6 : progress < 0.82 ? 0 : Math.sin(progress * 5) * 1.5;
      const y = progress < 0.28 ? 0 : progress < 0.62 ? Math.sin((progress - 0.28) * 4.6) * 1.3 : progress < 0.82 ? 0.5 : -0.1;
      const segment = new THREE.Group();
      segment.position.set(x, y, z);
      segment.rotation.y = progress < 0.62 ? Math.sin(progress * 5.8) * 0.18 : 0;
      world.add(segment);
      corridorSegments.push(segment);

      const leftRail = new THREE.Mesh(pathGeo, pathBase);
      leftRail.position.set(-3.4, 0, 0);
      const rightRail = new THREE.Mesh(pathGeo, pathBase);
      rightRail.position.set(3.4, 0, 0);
      const leftLane = new THREE.Mesh(laneGeo, laneBase);
      leftLane.position.set(-1.2, 0.04, 0);
      const rightLane = new THREE.Mesh(laneGeo, laneBase);
      rightLane.position.set(1.2, 0.04, 0);
      segment.add(leftRail, rightRail, leftLane, rightLane);

      if (index % 2 === 0) {
        const leftPylon = new THREE.Mesh(pylonGeo, structureBase);
        leftPylon.position.set(-7.4, 2.7, 0);
        const rightPylon = new THREE.Mesh(pylonGeo, structureBase);
        rightPylon.position.set(7.4, 2.7, 0);
        segment.add(leftPylon, rightPylon);
      }

      if (index >= 6 && index <= 9) {
        const arch = new THREE.Mesh(archGeo, amberBase);
        arch.position.set(0, 0.4, 0);
        arch.rotation.x = Math.PI / 2;
        segment.add(arch);
      }
      if (index >= 16 && index <= 23) {
        const roof = new THREE.Mesh(tunnelRoofGeo, structureBase);
        roof.position.y = 6.8;
        segment.add(roof);
        const tunnelLight = new THREE.Mesh(tunnelLightGeo, index % 2 ? greenBase : amberBase);
        tunnelLight.position.y = 6.55;
        segment.add(tunnelLight);
        const tunnelLeft = new THREE.Mesh(pylonGeo, structureBase);
        tunnelLeft.position.set(-5.6, 3.2, 0);
        const tunnelRight = new THREE.Mesh(pylonGeo, structureBase);
        tunnelRight.position.set(5.6, 3.2, 0);
        segment.add(tunnelLeft, tunnelRight);
      }
      if (index >= 24 && index <= 30 && index % 2 === 0) {
        for (let tower = 0; tower < 3; tower += 1) {
          const building = new THREE.Mesh(towerGeo, tower % 2 ? structureBase : amberBase);
          const side = tower < 2 ? -1 : 1;
          building.scale.set(0.78 + tower * 0.18, 1.8 + tower * 0.65, 0.78);
          building.position.set(side * (9.2 + (tower % 2) * 2.2), building.scale.y * 0.5 - 0.2, 1.8);
          segment.add(building);
        }
      }
      if (index >= 10 && index <= 14 && index % 2 === 0) {
        const helixLeft = new THREE.Line(helixGeo, helixBase);
        helixLeft.position.set(-5.2, 3.3, 0);
        helixLeft.rotation.z = Math.PI / 2;
        const helixRight = new THREE.Line(helixGeo, helixAccent);
        helixRight.position.set(5.2, 3.3, 0);
        helixRight.rotation.z = -Math.PI / 2;
        segment.add(helixLeft, helixRight);
      }
    }

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
    const lookTarget = new THREE.Vector3();
    let elapsed = 0;
    let previousSurgeSequence = 0;
    let surgeUntil = 0;
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
      const snapshot: AudioReactiveSnapshot = state.getLatestAudioSnapshot?.() ?? {
        energy: 0, smoothedEnergy: 0, bass: 0, kickPulse: 0, kickPulseAcceptedEvent: false,
        kickPulseAcceptedEventCount: 0, kickPulseAcceptedEventSequence: 0, bassPulse: 0, mids: 0, highs: 0, transient: 0, isActive: false,
      };
      if (snapshot.kickPulseAcceptedEventSequence !== previousSurgeSequence) {
        previousSurgeSequence = snapshot.kickPulseAcceptedEventSequence;
        surgeUntil = elapsed + 2.4;
      }
      const surge = Math.max(0, Math.min(1, (surgeUntil - elapsed) / 2.4));
      const energy = clamp(snapshot.smoothedEnergy || snapshot.energy);
      const bass = clamp(snapshot.bass);
      const mids = clamp(snapshot.mids);
      const highs = clamp(snapshot.highs);
      const transient = clamp(Math.max(snapshot.transient, snapshot.kickPulse));
      const chroma = state.chromaEnabled && state.isPlaying;
      const spatialMotion = state.isPlaying && state.motionEnabled && !state.reducedMotion;

      if (spatialMotion) {
        world.position.z += delta * (10 + energy * 9 + surge * 25);
        corridorSegments.forEach((segment) => {
          if (segment.position.z + world.position.z > 22) {
            segment.position.z -= corridorLength;
          }
        });
        beacons.forEach((beacon) => {
          if (beacon.position.z + world.position.z > 24) {
            beacon.position.z -= beaconLength;
          }
        });
        world.rotation.z = THREE.MathUtils.lerp(world.rotation.z, Math.sin(elapsed * 0.19) * 0.035 + surge * 0.018, 0.035);
      }

      materials.forEach(({ material, base, baseOpacity, family }) => {
        const lift = family === "path" ? bass * 0.32 + transient * 0.5 : family === "structure" ? energy * 0.28 + mids * 0.18 : highs * 0.45;
        material.opacity = THREE.MathUtils.clamp(baseOpacity + lift + surge * 0.24, 0.08, 1);
        if (chroma) {
          const hueShift = family === "path" ? mids * 0.11 + surge * 0.04 : family === "structure" ? highs * 0.16 : highs * 0.06;
          material.color.copy(base).offsetHSL(hueShift, 0.08 + energy * 0.08, lift * 0.18 + surge * 0.14);
        } else {
          material.color.copy(base);
        }
      });
      starMaterial.size = 0.12 + highs * 0.1 + transient * 0.07;
      beacons.forEach((beacon, index) => {
        beacon.scale.setScalar(1 + (index % 3) * 0.16 + transient * 0.4);
      });

      if (spatialMotion) {
        const targetFov = 63 + surge * 7 + energy * 1.5;
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.06);
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, Math.sin(elapsed * 0.17) * 0.22, 0.035);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 2.2 + Math.sin(elapsed * 0.13) * 0.04 + bass * 0.025, 0.04);
        lookTarget.set(Math.sin(elapsed * 0.17) * 1.2, 1.5 + surge * 0.25, -42);
        camera.lookAt(lookTarget);
        camera.updateProjectionMatrix();
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

  return <div ref={mountRef} className="neon-hyper-racer-scene" aria-hidden="true" />;
}

export default NeonHyperRacerTheme;