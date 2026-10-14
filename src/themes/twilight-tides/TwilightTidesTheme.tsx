import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createRenderFpsSampler } from "../../app/renderFpsTelemetry";
import type { ThemeSceneProps } from "../themeTypes";
import { createTwilightOcean } from "./twilightOcean";
import { createTwilightState, twilightQuality, updateTwilightState } from "./twilightRuntime";

export default function TwilightTidesTheme({
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
    const constrained = window.matchMedia("(pointer: coarse)").matches || navigator.hardwareConcurrency <= 4;
    const quality = twilightQuality(mount.clientWidth, mount.clientHeight, window.devicePixelRatio, constrained);
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power" });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("aria-label", "Twilight Tides canvas");
    mount.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 16000);
    camera.position.set(0, 6, 0);
    camera.lookAt(0, -3, -140);
    const ocean = createTwilightOcean(renderer, quality);
    renderer.domElement.addEventListener("webglcontextrestored", ocean.restoreSky);
    const state = createTwilightState();
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setPixelRatio(twilightQuality(width, height, window.devicePixelRatio, constrained).pixelRatio);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    window.addEventListener("resize", resize);
    resize();
    const fpsSampler = createRenderFpsSampler((renderFps) => propsRef.current.onRuntimeTelemetry?.({
      renderFps,
      surgeCount: state.surge.count,
      lastSurgeAt: Number.isFinite(state.surge.startedAt) ? state.surge.startedAt : undefined,
    }));
    let frame = 0;
    let lastFrame = performance.now();
    const render = (now: number) => {
      if (renderer.getContext().isContextLost()) {
        lastFrame = now;
        fpsSampler.reset();
        frame = requestAnimationFrame(render);
        return;
      }
      const props = propsRef.current;
      const snapshot = props.getLatestAudioSnapshot?.();
      updateTwilightState(state, (now - lastFrame) / 1000, props, snapshot);
      lastFrame = now;
      ocean.update(state, props.chromaEnabled);
      renderer.render(ocean.scene, camera);
      fpsSampler.sample(performance.now());
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      fpsSampler.dispose();
      renderer.domElement.removeEventListener("webglcontextrestored", ocean.restoreSky);
      ocean.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-label="Twilight Tides environment" />;
}
