import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createRenderFpsSampler } from "../../app/renderFpsTelemetry";
import type { ThemeSceneProps } from "../themeTypes";
import {
  advanceTransitWorld, createTransitLighting, createTransitWorld, sampleTransitDirection,
  sampleTransitPath, TRANSIT, updateTransitLighting,
} from "./transitWorld";
import { createTransitArchitecture } from "./transitArchitecture";
import { createTransitMotion, updateTransitMotion } from "./transitMotion";
import { createTransitSpace } from "./transitSpace";
import { createTransitSignAtlas, createTransitSigns } from "./transitSigns";

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
    scene.fog = new THREE.Fog(0x030405, 7000, TRANSIT.far);
    const camera = new THREE.PerspectiveCamera(64, 1, 20, TRANSIT.far);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("aria-label", "Alien Megastructure Transit canvas");
    mount.appendChild(renderer.domElement);

    const world = createTransitWorld();
    const lighting = createTransitLighting();
    const motion = createTransitMotion();
    const space = createTransitSpace();
    scene.background = space.background;
    scene.add(...space.objects);
    const architecture = createTransitArchitecture(world);
    scene.add(...architecture.meshes);
    const signAtlas = createTransitSignAtlas();
    signAtlas.texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const signs = createTransitSigns(world, signAtlas.texture);
    scene.add(...signs.objects);
    let disposed = false;
    void document.fonts.load('900 140px "Chakra Petch"').then(() => {
      if (!disposed) signAtlas.redraw();
    }, () => undefined);

    const ambient = new THREE.AmbientLight(0x93bdc1, 1.5);
    const light = new THREE.DirectionalLight(0xdbfff2, 2.5);
    light.position.set(-1500, 2400, 1800);
    scene.add(ambient, light);

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
      const deltaSeconds = (now - lastFrame) / 1000;
      const snapshot = props.getLatestAudioSnapshot?.();
      updateTransitLighting(lighting, deltaSeconds, props.isPlaying, props.chromaEnabled, snapshot);
      updateTransitMotion(motion, deltaSeconds, props.isPlaying, props.motionEnabled, props.reducedMotion, world.distance, snapshot);
      advanceTransitWorld(world, deltaSeconds,
        props.isPlaying, props.motionEnabled, props.reducedMotion, direction, motion.speed);
      lastFrame = now;
      sampleTransitPath(world.distance, center);
      sampleTransitDirection(world.distance + 160, direction).normalize();
      camera.lookAt(direction);
      architecture.update(center, lighting, props.chromaEnabled, motion);
      signs.update(center, props.chromaEnabled);
      space.update(world, motion, lighting, props.chromaEnabled, center);
      scene.fog!.color.copy(space.background);
      renderer.render(scene, camera);
      fpsSampler.sample(performance.now());
      if (now - lastTelemetry >= 100) {
        props.onRuntimeTelemetry?.({
          renderFps: measuredFps,
          motionTargetSpeed: motion.targetSpeed,
          motionSpeed: motion.speed,
          travelPosition: world.distance,
          surgeCount: motion.surgeCount,
          lastSurgeAt: Number.isFinite(motion.surgeStartedAt) ? motion.surgeStartedAt : undefined,
        });
        lastTelemetry = now;
      }
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      fpsSampler.dispose();
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      architecture.dispose();
      signs.dispose();
      space.dispose();
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