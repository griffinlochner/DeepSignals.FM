import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createRenderFpsSampler } from "../../app/renderFpsTelemetry";
import type { ThemeSceneProps } from "../themeTypes";
import { createToxicOcean } from "./toxicOcean";
import { createToxicState, TOXIC_CAMERA, toxicQuality, updateToxicState } from "./toxicRuntime";

export default function ToxicHorizonTheme({
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
    const quality = toxicQuality(mount.clientWidth, mount.clientHeight, window.devicePixelRatio, constrained);
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power" });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("aria-label", "Toxic Horizon canvas");
    mount.appendChild(renderer.domElement);
    // Twilight Tides' fixed camera and horizon, unchanged.
    const camera = new THREE.PerspectiveCamera(TOXIC_CAMERA.fov, 1, 0.5, 16000);
    camera.position.set(...TOXIC_CAMERA.position);
    camera.lookAt(...TOXIC_CAMERA.target);
    const ocean = createToxicOcean(renderer, quality);
    const state = createToxicState();
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setPixelRatio(toxicQuality(width, height, window.devicePixelRatio, constrained).pixelRatio);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      ocean.setAspect(camera.aspect);
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
      updateToxicState(state, (now - lastFrame) / 1000, props, snapshot);
      lastFrame = now;
      ocean.update(state, props.chromaEnabled);
      ocean.render(camera);
      fpsSampler.sample(performance.now());
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      fpsSampler.dispose();
      ocean.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-label="Toxic Horizon environment" />;
}
