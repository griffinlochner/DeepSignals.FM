import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createRenderFpsSampler } from "../../app/renderFpsTelemetry";
import type { ThemeSceneProps } from "../themeTypes";
import {
  advanceTransitWorld, createTransitLighting, createTransitWorld, sampleTransitDirection,
  sampleTransitPath, TRANSIT, updateTransitLighting,
} from "./transitWorld";
import { createTransitArchitecture } from "./transitArchitecture";

export default function AlienMegastructureTransitTheme({
  isPlaying, motionEnabled = true, chromaEnabled = true, getLatestAudioSnapshot, reducedMotion, onRuntimeTelemetry,
}: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ isPlaying, motionEnabled, chromaEnabled, getLatestAudioSnapshot, reducedMotion, onRuntimeTelemetry });

  useEffect(() => {
    propsRef.current = { isPlaying, motionEnabled, chromaEnabled, getLatestAudioSnapshot, reducedMotion, onRuntimeTelemetry };
  }, [isPlaying, motionEnabled, chromaEnabled, getLatestAudioSnapshot, reducedMotion, onRuntimeTelemetry]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030405);
    scene.fog = new THREE.Fog(0x030405, 7000, TRANSIT.far);
    const camera = new THREE.PerspectiveCamera(64, 1, 2, TRANSIT.far);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("aria-label", "Alien Megastructure Transit canvas");
    mount.appendChild(renderer.domElement);

    const world = createTransitWorld();
    const lighting = createTransitLighting();
    const architecture = createTransitArchitecture(world);
    scene.add(...architecture.meshes);

    const ambient = new THREE.AmbientLight(0x93bdc1, 1.5);
    const light = new THREE.DirectionalLight(0xdbfff2, 2.5);
    light.position.set(-1500, 2400, 1800);
    scene.add(ambient, light);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(TRANSIT.starCount * 3);
    const starColors = new Float32Array(TRANSIT.starCount * 3);
    const starColor = new THREE.Color();
    for (let index = 0; index < TRANSIT.starCount; index += 1) {
      const vertical = 1 - 2 * (index + 0.5) / TRANSIT.starCount;
      const radius = Math.sqrt(1 - vertical * vertical);
      const angle = index * 2.399963;
      starPositions[index * 3] = Math.cos(angle) * radius * 10000;
      starPositions[index * 3 + 1] = vertical * 10000;
      starPositions[index * 3 + 2] = Math.sin(angle) * radius * 10000;
      starColor.setHex(index % 7 === 0 ? 0xff9eaa : index % 5 === 0 ? 0xb2ff86 : 0x9cbfc4);
      starColor.multiplyScalar(0.35 + (index % 11) * 0.055).toArray(starColors, index * 3);
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const starMaterial = new THREE.PointsMaterial({
      vertexColors: true, size: 1.5, sizeAttenuation: false, fog: false,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const center = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    window.addEventListener("resize", resize);
    resize();

    let measuredFps: number | undefined;
    const fpsSampler = createRenderFpsSampler((renderFps) => { measuredFps = renderFps; });
    let lastFrame = performance.now();
    let lastTelemetry = -Infinity;
    let animationFrame = 0;
    const render = (now: number) => {
      const props = propsRef.current;
      const moving = props.isPlaying && props.motionEnabled && !props.reducedMotion;
      const deltaSeconds = (now - lastFrame) / 1000;
      updateTransitLighting(lighting, deltaSeconds, props.isPlaying, props.chromaEnabled, props.getLatestAudioSnapshot?.());
      advanceTransitWorld(world, deltaSeconds,
        props.isPlaying, props.motionEnabled, props.reducedMotion, direction);
      lastFrame = now;
      sampleTransitPath(world.distance, center);
      sampleTransitDirection(world.distance + 160, direction).normalize();
      camera.lookAt(direction);
      architecture.update(center, lighting, props.chromaEnabled);
      renderer.render(scene, camera);
      fpsSampler.sample(performance.now());
      if (now - lastTelemetry >= 100) {
        props.onRuntimeTelemetry?.({
          renderFps: measuredFps,
          motionTargetSpeed: moving ? TRANSIT.speed : 0,
          motionSpeed: moving ? TRANSIT.speed : 0,
          travelPosition: world.distance,
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
      architecture.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={mountRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-label="Alien Megastructure Transit environment" />
  );
}