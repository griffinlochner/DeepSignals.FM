import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createRenderFpsSampler } from "../../app/renderFpsTelemetry";
import type { ThemeSceneProps } from "../themeTypes";
import { RUNNER, createRunnerJourney, createRunnerMotion, updateRunnerMotion, advanceRunnerJourney,
  createRunnerFlight, sampleRunnerFlight } from "./runnerJourney";
import { createRunnerSpace } from "./runnerSpace";

export default function SignalRunner2Theme(props: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; }, [props]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 1200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("aria-label", "Asteroid Runner canvas");
    mount.appendChild(renderer.domElement);
    const journey = createRunnerJourney();
    const motion = createRunnerMotion();
    const flight = createRunnerFlight();
    const space = createRunnerSpace();
    scene.background = space.background;
    const fog = new THREE.Fog(space.background, 210, RUNNER.far);
    scene.fog = fog;
    scene.add(...space.objects);
    scene.add(new THREE.AmbientLight(0xa6c4db, 1.6));
    const light = new THREE.DirectionalLight(0xe7ffff, 2.4);
    light.position.set(-30, 45, 20);
    scene.add(light);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    window.addEventListener("resize", resize);
    resize();
    let measuredFps: number | undefined;
    const fps = createRenderFpsSampler((value) => { measuredFps = value; });
    let lastFrame = performance.now();
    let lastTelemetry = -Infinity;
    let frame = 0;
    const render = (now: number) => {
      const current = propsRef.current;
      const moving = current.isPlaying && (current.motionEnabled ?? true) && !current.reducedMotion;
      const delta = (now - lastFrame) / 1000;
      lastFrame = now;
      const snapshot = current.getLatestAudioSnapshot?.();
      const travel = updateRunnerMotion(motion, delta, current.isPlaying,
        current.motionEnabled ?? true, current.reducedMotion, snapshot);
      advanceRunnerJourney(journey, travel);
      sampleRunnerFlight(journey.distance, journey.seed, flight);
      camera.position.set(flight.x, flight.y, 0);
      camera.rotation.set(flight.pitch, flight.yaw, flight.roll);
      space.update(journey, motion, current.chromaEnabled ?? true);
      fog.color.copy(space.background);
      renderer.render(scene, camera);
      fps.sample(performance.now());
      if (now - lastTelemetry >= 100) {
        current.onRuntimeTelemetry?.({
          renderFps: measuredFps,
          motionSpeed: moving ? motion.speed : 0,
          motionTargetSpeed: moving ? motion.targetSpeed : 0,
          travelPosition: journey.distance,
          surgeCount: motion.surgeCount,
          lastSurgeAt: Number.isFinite(motion.surgeStartedAt) ? motion.surgeStartedAt : undefined,
        });
        lastTelemetry = now;
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      fps.dispose();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      space.dispose();
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} aria-label="Asteroid Runner environment"
    style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />;
}
