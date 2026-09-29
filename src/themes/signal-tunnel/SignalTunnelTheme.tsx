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
import { createTunnelMotion, updateTunnelMotion } from "./tunnelMotion";

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
    scene.fog = new THREE.Fog(0x000000, 110, 230);
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
    const waveGeometry = new THREE.TorusGeometry(TUNNEL.radius, 0.13, 4, 48);
    const architectureMaterial = new THREE.MeshBasicMaterial();
    const waveMaterial = new THREE.MeshBasicMaterial({ color: 0xb2ff86, transparent: true, opacity: 0, depthWrite: false });
    const panels = new THREE.InstancedMesh(panelGeometry, architectureMaterial, TUNNEL.segmentCount * PANEL_SIDES);
    const strips = new THREE.InstancedMesh(panelGeometry, material, TUNNEL.segmentCount * 4);
    const gates = new THREE.InstancedMesh(gateGeometry, architectureMaterial, TUNNEL.segmentCount);
    const gateTrims = new THREE.InstancedMesh(geometry, material, TUNNEL.segmentCount * 2);
    const packets = new THREE.InstancedMesh(beamGeometry, material, TUNNEL.segmentCount * 6);
    const waves = new THREE.InstancedMesh(waveGeometry, waveMaterial, WAVE_COUNT);
    const meshes = [rings, spirals, rails, panels, strips, gates, gateTrims, packets, waves];
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
    const render = (now: number) => {
      const props = propsRef.current;
      const moving = props.motionEnabled && !props.reducedMotion;
      const deltaSeconds = (now - lastFrame) / 1000;
      updateTunnelMotion(motion, deltaSeconds, moving, props.isPlaying, props.getLatestAudioSnapshot?.());
      advanceTunnel(travel, deltaSeconds, moving, direction, motion.speed);
      lastFrame = now;
      sampleCenterline(travel.distance, center);
      sampleDirection(travel.distance, direction).normalize();
      camera.lookAt(direction);
      camera.rotateZ(0.025 * Math.sin(travel.distance * 0.008));

      let spiralCount = 0;
      let railCount = 0;
      let panelCount = 0;
      let stripCount = 0;
      let gateCount = 0;
      let trimCount = 0;
      let packetCount = 0;
      const time = motion.elapsedMs / 1000;
      const chroma = props.chromaEnabled ? motion.energy : 0;
      const surge = motion.surgeEnvelope;
      for (let index = 0; index < travel.segments.length; index += 1) {
        const distance = travel.segments[index];
        sampleTunnelSection(distance, section);
        sampleCenterline(distance, transform.position).sub(center);
        sampleDirection(distance, direction).normalize();
        transform.quaternion.setFromRotationMatrix(frame.lookAt(origin, direction, up));
        segmentCenter.copy(transform.position);
        segmentRotation.copy(transform.quaternion);
        const radiusScale = section.radius / TUNNEL.radius;
        transform.scale.set(radiusScale, radiusScale, 1);
        transform.updateMatrix();
        rings.setMatrixAt(index, transform.matrix);
        const ordinal = Math.round(distance / TUNNEL.spacing);
        ringColor.copy(ordinal % 4 === 0 ? green : cyan);
        if (props.chromaEnabled) ringColor.lerp(salmon, chroma * 0.35 * (0.5 + 0.5 * Math.sin(distance * 0.026 - time)));
        ringColor.multiplyScalar(ordinal % 3 === 0 ? 0.85 : 0.7 * (1 - 0.88 * section.openness));
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
            ringColor.copy(wallColor).lerp(cyan, 0.04 * chroma + 0.12 * surge)
              .multiplyScalar(side % 3 === 0 ? 1.3 : 0.85);
            panels.setColorAt(panelCount++, ringColor);
            if (side % 3 === 0) {
              localPoint.multiplyScalar((apothem - 0.2) / apothem);
              transform.position.copy(localPoint).applyQuaternion(segmentRotation).add(segmentCenter);
              transform.scale.set(0.10 + surge * 0.08, 0.04, TUNNEL.spacing * 0.83);
              transform.updateMatrix();
              strips.setMatrixAt(stripCount, transform.matrix);
              ringColor.copy(cyan).lerp(salmon, chroma * 0.35).multiplyScalar(0.6 + 0.4 * surge);
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
          ringColor.copy(wallColor).multiplyScalar(2.4);
          gates.setColorAt(gateCount++, ringColor);
          for (let face = -1; face <= 1; face += 2) {
            localPoint.set(0, 0, face * 1.35).applyQuaternion(segmentRotation);
            transform.position.copy(segmentCenter).add(localPoint);
            transform.scale.set(radiusScale, radiusScale, 2);
            transform.updateMatrix();
            gateTrims.setMatrixAt(trimCount, transform.matrix);
            ringColor.copy(face === 1 ? salmon : cyan).lerp(green, surge * 0.8);
            gateTrims.setColorAt(trimCount++, ringColor);
          }
        }

        if (section.openness <= 0) continue;
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
          ringColor.copy(spiral ? (layer === 0 ? salmon : cyan) : green);
          if (props.chromaEnabled) ringColor.lerp(spiral ? green : cyan, chroma * (0.25 + 0.2 * Math.sin(time + distance * 0.04)));
          ringColor.multiplyScalar(0.48 + 0.25 * surge);
          mesh.setColorAt(instance, ringColor);

          const packetPhase = ((distance / 64 - time * (0.65 + surge) + lane * 0.13) % 1 + 1) % 1;
          const packetStrength = Math.pow(Math.max(0, 1 - packetPhase * 3), 2);
          if (packetStrength > 0.01) {
            transform.scale.set(thickness * 1.8, length * 0.5, thickness * 1.8);
            transform.updateMatrix();
            packets.setMatrixAt(packetCount, transform.matrix);
            ringColor.copy(spiral ? cyan : salmon).lerp(green, surge).multiplyScalar(packetStrength * (0.65 + 0.35 * motion.energy));
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
      waves.visible = surge > 0.001;
      waveMaterial.opacity = surge * 0.85;
      waveMaterial.color.copy(cyan).lerp(green, props.chromaEnabled ? 0.5 + 0.5 * surge : 0);
      for (let wave = 0; wave < WAVE_COUNT; wave += 1) {
        const age = Math.max(0, motion.elapsedMs - motion.surgeStartedAt) / 1000;
        const offset = 150 + wave * 28 - age * 145;
        if (!Number.isFinite(offset) || offset < -20) {
          transform.scale.setScalar(0);
        } else {
          const distance = travel.distance + offset;
          sampleTunnelSection(distance, section);
          sampleCenterline(distance, transform.position).sub(center);
          sampleDirection(distance, direction).normalize();
          transform.quaternion.setFromRotationMatrix(frame.lookAt(origin, direction, up));
          const scale = section.radius * 0.92 / TUNNEL.radius;
          transform.scale.set(scale, scale, 2.2);
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