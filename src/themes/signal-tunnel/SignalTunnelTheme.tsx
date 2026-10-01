import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createRenderFpsSampler } from "../../app/renderFpsTelemetry";
import type { ThemeSceneProps } from "../themeTypes";
import {
  advanceTunnel,
  createChamberPointSampler,
  createTunnelSection,
  createTunnelTravel,
  sampleCenterline,
  sampleDirection,
  sampleTunnelSection,
  TUNNEL,
} from "./tunnelPath";
import { createTunnelMotion, tunnelSurgeActivation, updateTunnelMotion } from "./tunnelMotion";
import { createTunnelDoors } from "./tunnelDoors";

const PANEL_SIDES = 12;
const WAVE_COUNT = 4;

export default function SignalTunnelTheme({
  isPlaying,
  getLatestAudioSnapshot,
  motionEnabled = true,
  chromaEnabled = true,
  reducedMotion,
  onRuntimeTelemetry,
}: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ isPlaying, getLatestAudioSnapshot, motionEnabled, chromaEnabled, reducedMotion, onRuntimeTelemetry });

  useEffect(() => {
    propsRef.current = { isPlaying, getLatestAudioSnapshot, motionEnabled, chromaEnabled, reducedMotion, onRuntimeTelemetry };
  }, [isPlaying, getLatestAudioSnapshot, motionEnabled, chromaEnabled, reducedMotion, onRuntimeTelemetry]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const fog = new THREE.Fog(0x000000, 110, 230);
    scene.fog = fog;
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, TUNNEL.far);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("aria-label", "Signal Tunnel canvas");
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.TorusGeometry(TUNNEL.radius, 0.08, 4, 12);
    const material = new THREE.MeshBasicMaterial();
    const rings = new THREE.InstancedMesh(geometry, material, TUNNEL.segmentCount);
    rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    rings.frustumCulled = false;
    scene.add(rings);

    const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 6);
    const spiralMaterial = new THREE.MeshBasicMaterial();
    const railMaterial = new THREE.MeshBasicMaterial();
    const spirals = new THREE.InstancedMesh(beamGeometry, spiralMaterial, TUNNEL.segmentCount * 6);
    const rails = new THREE.InstancedMesh(beamGeometry, railMaterial, TUNNEL.segmentCount * 4);
    for (const mesh of [spirals, rails]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
    const panelGeometry = new THREE.BoxGeometry(1, 1, 1);
    const gateGeometry = new THREE.TorusGeometry(TUNNEL.radius, 0.48, 4, 12);
    const waveGeometry = new THREE.TorusGeometry(TUNNEL.radius, 0.24, 4, 48);
    const architectureMaterial = new THREE.MeshBasicMaterial();
    const waveMaterial = new THREE.MeshBasicMaterial({ color: 0xb2ff86, transparent: true, opacity: 0, depthWrite: false });
    const panels = new THREE.InstancedMesh(panelGeometry, architectureMaterial, TUNNEL.segmentCount * PANEL_SIDES);
    const strips = new THREE.InstancedMesh(panelGeometry, material, TUNNEL.segmentCount * 4);
    const gates = new THREE.InstancedMesh(gateGeometry, architectureMaterial, TUNNEL.segmentCount);
    const gateTrims = new THREE.InstancedMesh(geometry, material, TUNNEL.segmentCount * 2);
    const packets = new THREE.InstancedMesh(beamGeometry, material, TUNNEL.segmentCount * 6);
    const waves = new THREE.InstancedMesh(waveGeometry, waveMaterial, WAVE_COUNT);
    const doors = createTunnelDoors();
    scene.add(doors.group);
    const torusGeometry = new THREE.TorusGeometry(1, TUNNEL.torusTube / (TUNNEL.chamberRadius * 0.86), 8, 32);
    const torusTrimGeometry = new THREE.TorusGeometry(1, 0.008, 4, 32);
    const portalGeometry = new THREE.TorusGeometry(TUNNEL.radius, 0.18, 5, 64, Math.PI * 1.65);
    const tori = new THREE.InstancedMesh(torusGeometry, architectureMaterial, 5);
    const torusTrims = new THREE.InstancedMesh(torusTrimGeometry, material, 15);
    const portalArms = new THREE.InstancedMesh(portalGeometry, material, TUNNEL.portalLayers * 2);
    const portalRims = new THREE.InstancedMesh(geometry, material, TUNNEL.portalLayers);
    const meshes = [rings, spirals, rails, panels, strips, gates, gateTrims, packets, waves,
      tori, torusTrims, portalArms, portalRims];
    for (const mesh of meshes) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      if (mesh !== waves) mesh.setColorAt(0, new THREE.Color(0xffffff));
      scene.add(mesh);
    }
    const cyan = new THREE.Color(0x74fff0);
    const green = new THREE.Color(0xb2ff86);
    const salmon = new THREE.Color(0xff9eaa);
    const wallColor = new THREE.Color(0x25333b);
    const ringColor = new THREE.Color();
    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(96 * 3);
    for (let index = 0; index < 96; index += 1) {
      const angle = index * 2.399963;
      const radius = 65 + (index * 37 % 85);
      starPositions[index * 3] = Math.cos(angle) * radius;
      starPositions[index * 3 + 1] = Math.sin(angle) * radius;
      starPositions[index * 3 + 2] = (index * 73 % 440) - 220;
    }
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0x94b9bd, size: 0.6, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    const travel = createTunnelTravel();
    const motion = createTunnelMotion();
    const section = createTunnelSection();
    const center = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const origin = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const frame = new THREE.Matrix4();
    const beamAxis = new THREE.Vector3(0, 1, 0);
    const beamStart = new THREE.Vector3();
    const beamEnd = new THREE.Vector3();
    const transform = new THREE.Object3D();
    const segmentCenter = new THREE.Vector3();
    const segmentRotation = new THREE.Quaternion();
    const torusRotation = new THREE.Quaternion();
    const localPoint = new THREE.Vector3();
    const sampleChamberPoint = createChamberPointSampler();
    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    window.addEventListener("resize", resize);
    resize();

    let measuredFps: number | undefined;
    const fpsSampler = createRenderFpsSampler((renderFps) => {
      measuredFps = renderFps;
    });
    let animationFrame = 0;
    let lastFrame = performance.now();
    let lastTelemetry = -Infinity;
    let chromaOn = true;
    let pulse = 0;
    let activation = 0;
    let colorPhase = 0;
    const paint = (accent: number, brightness: number) => {
      if (chromaOn) {
        ringColor.copy(accent === 0 ? cyan : accent === 1 ? green : salmon)
          .lerp(accent === 2 ? cyan : salmon, colorPhase * 0.32)
          .lerp(accent === 1 ? salmon : green, activation * 0.85)
          .multiplyScalar(brightness * (0.8 + pulse * 0.45 + activation * 1.5));
      } else {
        ringColor.copy(cyan).lerp(green, 0.08)
          .multiplyScalar(brightness * (0.43 + activation * 0.48));
      }
    };
    const render = (now: number) => {
      const props = propsRef.current;
      const moving = props.motionEnabled && !props.reducedMotion && props.isPlaying;
      const deltaSeconds = (now - lastFrame) / 1000;
      updateTunnelMotion(motion, deltaSeconds, moving, props.isPlaying, props.getLatestAudioSnapshot?.());
      advanceTunnel(travel, deltaSeconds, moving, direction, motion.speed);
      lastFrame = now;
      sampleCenterline(travel.distance, center);
      sampleDirection(travel.distance, direction).normalize();
      camera.lookAt(direction);
      camera.rotateZ(0.025 * Math.sin(travel.distance * 0.008));
      sampleTunnelSection(travel.distance, section);
      const space = section.archetype === "torus" ? section.openness : 0;
      fog.near = 110 + space * 70;
      fog.far = 230 + space * 30;
      const spaceCycle = 2 + 3 * Math.round((travel.distance / TUNNEL.sectionLength - 2) / 3);
      sampleCenterline(spaceCycle * TUNNEL.sectionLength + 320, stars.position).sub(center);
      starsMaterial.opacity = space * (props.chromaEnabled ? 0.65 : 0.3);
      stars.visible = space > 0;

      let spiralCount = 0;
      let railCount = 0;
      let panelCount = 0;
      let stripCount = 0;
      let gateCount = 0;
      let trimCount = 0;
      let packetCount = 0;
      doors.group.visible = false;
      let torusCount = 0;
      let torusTrimCount = 0;
      let portalCount = 0;
      let portalRimCount = 0;
      const time = motion.animationMs / 1000;
      chromaOn = props.chromaEnabled;
      const surge = motion.surgeEnvelope;
      const surgeAge = Math.max(0, motion.elapsedMs - motion.surgeStartedAt) / 1000;
      for (let index = 0; index < travel.segments.length; index += 1) {
        const distance = travel.segments[index];
        const ahead = distance - travel.distance;
        activation = tunnelSurgeActivation(ahead, surgeAge, surge);
        colorPhase = 0.5 + 0.5 * Math.sin(distance * 0.026 - time * 0.8);
        pulse = motion.energy * Math.pow(0.5 + 0.5 * Math.sin(time * 5 - distance * 0.09), 3);
        sampleTunnelSection(distance, section);
        sampleCenterline(distance, transform.position).sub(center);
        sampleDirection(distance, direction).normalize();
        transform.quaternion.setFromRotationMatrix(frame.lookAt(origin, direction, up));
        segmentCenter.copy(transform.position);
        segmentRotation.copy(transform.quaternion);
        const radiusScale = section.radius / TUNNEL.radius;
        transform.scale.set(radiusScale, radiusScale, 1);
        if (section.archetype === "torus" && section.openness > 0.75) transform.scale.setScalar(0);
        transform.updateMatrix();
        rings.setMatrixAt(index, transform.matrix);
        const ordinal = Math.round(distance / TUNNEL.spacing);
        paint(ordinal % 4 === 0 ? 1 : 0, ordinal % 3 === 0 ? 0.85 : 0.7 * (1 - 0.88 * section.openness));
        rings.setColorAt(index, ringColor);

        if (section.solid) {
          for (let side = 0; side < PANEL_SIDES; side += 1) {
            const angle = (side + 0.5) * Math.PI * 2 / PANEL_SIDES;
            const apothem = section.radius * Math.cos(Math.PI / PANEL_SIDES) + 0.3;
            localPoint.set(Math.cos(angle) * apothem, Math.sin(angle) * apothem, 0);
            transform.position.copy(localPoint).applyQuaternion(segmentRotation).add(segmentCenter);
            transform.quaternion.copy(segmentRotation);
            transform.rotateZ(angle - Math.PI / 2);
            transform.scale.set(2 * section.radius * Math.sin(Math.PI / PANEL_SIDES) * 0.99, 0.36, TUNNEL.spacing + 0.2);
            transform.updateMatrix();
            panels.setMatrixAt(panelCount, transform.matrix);
            ringColor.copy(wallColor).lerp(chromaOn ? salmon : cyan, activation * (chromaOn ? 0.5 : 0.1))
              .multiplyScalar((side % 3 === 0 ? 1.3 : 0.85) * (chromaOn ? 1 : 0.62));
            panels.setColorAt(panelCount++, ringColor);
            if (side % 3 === 0) {
              localPoint.multiplyScalar((apothem - 0.2) / apothem);
              transform.position.copy(localPoint).applyQuaternion(segmentRotation).add(segmentCenter);
              transform.scale.set(0.12 + activation * 0.2, 0.04, TUNNEL.spacing * 0.83);
              transform.updateMatrix();
              strips.setMatrixAt(stripCount, transform.matrix);
              paint(side % 2 ? 2 : 0, 0.8);
              strips.setColorAt(stripCount++, ringColor);
            }
          }
        }
        if (section.gateway) {
          transform.position.copy(segmentCenter);
          transform.quaternion.copy(segmentRotation);
          transform.scale.set(radiusScale + 0.05, radiusScale + 0.05, 2.8);
          transform.updateMatrix();
          gates.setMatrixAt(gateCount, transform.matrix);
          ringColor.copy(wallColor).lerp(chromaOn ? green : cyan, activation * (chromaOn ? 0.6 : 0.15))
            .multiplyScalar(chromaOn ? 2.4 : 1.5);
          gates.setColorAt(gateCount++, ringColor);
          for (let face = -1; face <= 1; face += 2) {
            localPoint.set(0, 0, face * 1.35).applyQuaternion(segmentRotation);
            transform.position.copy(segmentCenter).add(localPoint);
            transform.scale.set(radiusScale, radiusScale, 2);
            transform.updateMatrix();
            gateTrims.setMatrixAt(trimCount, transform.matrix);
            paint(face === 1 ? 2 : 0, 0.95);
            gateTrims.setColorAt(trimCount++, ringColor);
          }
        }

        if (section.door) {
          doors.group.visible = true;
          doors.group.position.copy(segmentCenter);
          doors.group.quaternion.copy(segmentRotation);
          doors.update(distance, section.radius, ahead, time, motion.energy, chromaOn, activation);
        }

        if (section.torus) {
          const radius = section.radius * 0.86;
          transform.position.copy(segmentCenter);
          transform.quaternion.copy(segmentRotation);
          transform.rotateX(TUNNEL.torusTilt * Math.sin(time * 0.38 + ordinal));
          transform.rotateY(TUNNEL.torusTilt * Math.cos(time * 0.31 + ordinal));
          transform.rotateZ(time * 0.17 + ordinal * 0.4);
          torusRotation.copy(transform.quaternion);
          transform.scale.setScalar(radius);
          transform.updateMatrix();
          tori.setMatrixAt(torusCount, transform.matrix);
          paint(torusCount % 3, 0.28);
          tori.setColorAt(torusCount++, ringColor);
          for (let contour = -1; contour <= 1; contour += 1) {
            localPoint.set(0, 0, contour * (TUNNEL.torusTube + 0.06));
            transform.position.copy(localPoint).applyQuaternion(torusRotation).add(segmentCenter);
            transform.scale.setScalar(radius + (contour === 0 ? TUNNEL.torusTube + 0.06 : 0));
            transform.updateMatrix();
            torusTrims.setMatrixAt(torusTrimCount, transform.matrix);
            paint((ordinal + contour + 3) % 3, 0.95);
            torusTrims.setColorAt(torusTrimCount++, ringColor);
          }
        }

        if (section.reentry) {
          for (let layer = 0; layer < TUNNEL.portalLayers; layer += 1) {
            localPoint.set(0, 0, layer * 2.4);
            transform.position.copy(localPoint).applyQuaternion(segmentRotation).add(segmentCenter);
            transform.quaternion.copy(segmentRotation);
            transform.rotateZ(layer * 0.32 - time * 0.28);
            const scale = radiusScale * (1 + layer * 0.115);
            transform.scale.set(scale, scale, 1.8);
            transform.updateMatrix();
            portalRims.setMatrixAt(portalRimCount, transform.matrix);
            paint(layer % 3, 0.4);
            portalRims.setColorAt(portalRimCount++, ringColor);
            for (let arm = 0; arm < 2; arm += 1) {
              transform.rotateZ(Math.PI);
              transform.scale.set(scale * (1 + arm * 0.045), scale * (1 + arm * 0.045), 1.8);
              transform.updateMatrix();
              portalArms.setMatrixAt(portalCount, transform.matrix);
              paint((layer + arm) % 3, 1.1);
              portalArms.setColorAt(portalCount++, ringColor);
            }
          }
        }

        if (section.openness <= 0 || section.archetype === "torus") continue;
        const spiral = section.archetype === "spiral";
        const laneCount = spiral ? 6 : 4;
        const mesh = spiral ? spirals : rails;
        const halfSpacing = TUNNEL.spacing / 2;
        for (let lane = 0; lane < laneCount; lane += 1) {
          const layer = spiral && lane >= 3 ? 1 : 0;
          const strand = spiral ? lane % 3 : lane;
          sampleChamberPoint(distance - halfSpacing, strand, section.archetype, beamStart, layer).sub(center);
          sampleChamberPoint(distance + halfSpacing, strand, section.archetype, beamEnd, layer).sub(center);
          transform.position.copy(beamStart).add(beamEnd).multiplyScalar(0.5);
          direction.subVectors(beamEnd, beamStart);
          const length = direction.length();
          transform.quaternion.setFromUnitVectors(beamAxis, direction.normalize());
          const thickness = (spiral ? 0.2 : 0.32) * section.openness;
          transform.scale.set(thickness, length + 0.04, thickness);
          transform.updateMatrix();
          const instance = spiral ? spiralCount++ : railCount++;
          mesh.setMatrixAt(instance, transform.matrix);
          paint(spiral ? (layer === 0 ? 2 : 0) : 1, 0.6);
          mesh.setColorAt(instance, ringColor);

          const packetPhase = ((distance / 64 - time * (0.65 + surge) + lane * 0.13) % 1 + 1) % 1;
          const packetStrength = Math.pow(Math.max(0, 1 - packetPhase * 3), 2);
          if (packetStrength > 0.01) {
            transform.scale.set(thickness * 1.8, length * 0.5, thickness * 1.8);
            transform.updateMatrix();
            packets.setMatrixAt(packetCount, transform.matrix);
            paint(spiral ? 0 : 2, packetStrength * (chromaOn ? 1.4 : 0.3));
            packets.setColorAt(packetCount++, ringColor);
          }
        }
      }
      spirals.count = spiralCount;
      rails.count = railCount;
      panels.count = panelCount;
      strips.count = stripCount;
      gates.count = gateCount;
      gateTrims.count = trimCount;
      packets.count = packetCount;
      tori.count = torusCount;
      torusTrims.count = torusTrimCount;
      portalArms.count = portalCount;
      portalRims.count = portalRimCount;
      waves.visible = surge > 0.001;
      waveMaterial.opacity = surge * (chromaOn ? 0.95 : 0.5);
      waveMaterial.color.copy(cyan).lerp(salmon, chromaOn ? 0.65 : 0);
      for (let wave = 0; wave < WAVE_COUNT; wave += 1) {
        const offset = 150 + wave * 28 - surgeAge * 145;
        if (!Number.isFinite(offset) || offset < -20) {
          transform.scale.setScalar(0);
        } else {
          const distance = travel.distance + offset;
          sampleTunnelSection(distance, section);
          sampleCenterline(distance, transform.position).sub(center);
          sampleDirection(distance, direction).normalize();
          transform.quaternion.setFromRotationMatrix(frame.lookAt(origin, direction, up));
          const scale = section.radius * 0.92 / TUNNEL.radius;
          transform.scale.set(scale, scale, 4.5);
        }
        transform.updateMatrix();
        waves.setMatrixAt(wave, transform.matrix);
      }
      for (const mesh of meshes) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      renderer.render(scene, camera);
      fpsSampler.sample(performance.now());
      if (now - lastTelemetry >= 100) {
        props.onRuntimeTelemetry?.({
          renderFps: measuredFps,
          motionTargetSpeed: moving ? motion.targetSpeed : 0,
          motionSpeed: moving ? motion.speed : 0,
          travelPosition: travel.distance,
          surgeCount: motion.surgeCount,
          lastSurgeAt: Number.isFinite(motion.surgeStartedAt) ? motion.surgeStartedAt : undefined,
        });
        lastTelemetry = now;
      }
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      fpsSampler.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      doors.dispose();
      for (const mesh of meshes) {
        scene.remove(mesh);
        mesh.dispose();
      }
      geometry.dispose();
      material.dispose();
      beamGeometry.dispose();
      spiralMaterial.dispose();
      railMaterial.dispose();
      panelGeometry.dispose();
      gateGeometry.dispose();
      waveGeometry.dispose();
      torusGeometry.dispose();
      torusTrimGeometry.dispose();
      portalGeometry.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
      scene.remove(stars);
      architectureMaterial.dispose();
      waveMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-label="Signal Tunnel environment"
    />
  );
}