import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ThemeSceneProps } from "../themeTypes";
import {
  formatUvJunglePlaybackFilter,
  stepUvJunglePlaybackVisualMix,
} from "./uvReactivePlaybackVisuals";
import { getImageDepthTexturePair } from "../image-depth/imageDepthTextureCache";
import { UV_JUNGLE_PRODUCTION_ASSET } from "../image-depth/productionScenePresets";
import { resolveAutonomousParallaxTarget } from "../image-depth/autonomousParallaxTarget";
import { writeImageDepthParityStats } from "../image-depth/timing";
import "./uvReactiveJungle.css";

type DepthImageBreathingPreset = {
  minimumDepth: number;
  maximumDepth: number;
  cycleDurationSeconds: number;
};

type DepthImageThemeProfile = {
  breathing: DepthImageBreathingPreset;
  staticDepth: number;
  pointerParallaxStrength: number;
  displacementScaleMultiplier: number;
};

const UV_JUNGLE_PROFILE: DepthImageThemeProfile = {
  breathing: {
    minimumDepth: 0,
    maximumDepth: 1,
    cycleDurationSeconds: 4.9,
  },
  staticDepth: 0.42,
  pointerParallaxStrength: 0.085,
  displacementScaleMultiplier: 0.36,
};

function UvReactiveJungleTheme({
  isPlaying,
  reducedMotion,
  motionEnabled = true,
  reactiveBehavior = "chill",
}: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const visualStateRef = useRef({ isPlaying, reducedMotion, motionEnabled, reactiveBehavior });
  const [sceneReady, setSceneReady] = useState(false);
  const [loadingState, setLoadingState] = useState<"loading" | "ready" | "error">("loading");
  const [showCalibratingMessage, setShowCalibratingMessage] = useState(false);

  useEffect(() => {
    visualStateRef.current = { isPlaying, reducedMotion, motionEnabled, reactiveBehavior };
  }, [isPlaying, motionEnabled, reactiveBehavior, reducedMotion]);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    let animationFrameId = 0;
    let disposed = false;
    let planeSized = false;
    let readySignaled = false;

    setSceneReady(false);
    setLoadingState("loading");
    setShowCalibratingMessage(false);

    const calibratingMessageTimeout = window.setTimeout(() => {
      if (!disposed && !readySignaled) {
        setShowCalibratingMessage(true);
      }
    }, 320);

    const pointer = new THREE.Vector2(0, 0);
    const pointerTarget = new THREE.Vector2(0, 0);
    const planeScale = new THREE.Vector2(1, 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08110d);
    scene.fog = new THREE.FogExp2(0x08110d, 0.045);

    const camera = new THREE.PerspectiveCamera(
      46,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      50,
    );
    camera.position.z = 3.15;
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x08110d, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.className = "uv-reactive-jungle-scene__canvas";
    renderer.domElement.style.backgroundColor = "#08110d";
    renderer.domElement.style.opacity = "0";
    renderer.domElement.style.transition =
      visualStateRef.current.reducedMotion ? "none" : "opacity 280ms ease";
    mount.appendChild(renderer.domElement);

    const planeGroup = new THREE.Group();
    scene.add(planeGroup);

    const ambientLight = new THREE.AmbientLight(0xf2ffe7, 1.85);
    const keyLight = new THREE.DirectionalLight(0xf8f6d2, 1.3);
    keyLight.position.set(-2, 2, 3);
    const rimLight = new THREE.DirectionalLight(0x77ffd9, 0.6);
    rimLight.position.set(2, -1, 2);
    scene.add(ambientLight, keyLight, rimLight);

    const planeGeometry = new THREE.PlaneGeometry(1, 1, 320, 224);
    const planeMaterial = new THREE.MeshStandardMaterial({
      displacementScale:
        UV_JUNGLE_PROFILE.staticDepth *
        UV_JUNGLE_PROFILE.displacementScaleMultiplier,
      roughness: 1,
      metalness: 0,
    });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.z = -0.16;
    planeGroup.add(plane);

    const glowGeometry = new THREE.PlaneGeometry(1, 1);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x63ffe6,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    });
    const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial);
    glowPlane.position.z = -0.95;
    planeGroup.add(glowPlane);

    const handleTextureError = () => {
      if (!disposed) {
        setLoadingState("error");
        setShowCalibratingMessage(false);
      }
    };

    void getImageDepthTexturePair(UV_JUNGLE_PRODUCTION_ASSET)
      .then(({ colorTexture, depthTexture }) => {
        if (disposed) {
          return;
        }

        planeMaterial.map = colorTexture;
        planeMaterial.displacementMap = depthTexture;
        planeMaterial.needsUpdate = true;
      })
      .catch(handleTextureError);

    const fitPlane = () => {
      const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      const viewHeight =
        2 *
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
        Math.abs(camera.position.z - plane.position.z);
      const viewWidth = viewHeight * aspect;
      planeScale.set(viewWidth * 1.18, viewHeight * 1.28);
      plane.scale.set(planeScale.x, planeScale.y, 1);
      glowPlane.scale.set(planeScale.x * 1.12, planeScale.y * 1.08, 1);
      planeSized = true;
    };

    const handleResize = () => {
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      fitPlane();
    };

    const timer = new THREE.Timer();
    timer.connect(document);

    let playbackVisualMix = 0;

    window.addEventListener("resize", handleResize);
    fitPlane();

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate);
      timer.update();

      const elapsed = timer.getElapsed();
      const state = visualStateRef.current;

      const playing = state.isPlaying;
      const parallaxEnabled = state.motionEnabled && !state.reducedMotion;
      const breathingAllowed =
        playing && state.motionEnabled && !state.reducedMotion;

      const autonomousBehavior = state.reactiveBehavior === "fullon" ? "fullon" : "chill";
      const autonomousTarget = resolveAutonomousParallaxTarget(elapsed, autonomousBehavior);
      pointerTarget.x = parallaxEnabled ? autonomousTarget.targetX : 0;
      pointerTarget.y = parallaxEnabled ? autonomousTarget.targetY : 0;

      const breathingFrequency =
        (Math.PI * 2) / UV_JUNGLE_PROFILE.breathing.cycleDurationSeconds;
      const breathProgress = breathingAllowed
        ? (Math.sin(elapsed * breathingFrequency) + 1) / 2
        : 0;
      const effectiveDepth = breathingAllowed
        ? THREE.MathUtils.lerp(
            UV_JUNGLE_PROFILE.breathing.minimumDepth,
            UV_JUNGLE_PROFILE.breathing.maximumDepth,
            breathProgress,
          )
        : UV_JUNGLE_PROFILE.staticDepth;

      playbackVisualMix = stepUvJunglePlaybackVisualMix(
        playbackVisualMix,
        playing,
        state.reducedMotion,
      );
      renderer.domElement.style.filter =
        formatUvJunglePlaybackFilter(playbackVisualMix);

      planeMaterial.displacementScale =
        effectiveDepth * UV_JUNGLE_PROFILE.displacementScaleMultiplier;
      planeMaterial.bumpScale = effectiveDepth * 0.04;

      pointer.lerp(pointerTarget, parallaxEnabled ? 0.05 : 0.08);
      const parallaxFactor = parallaxEnabled
        ? UV_JUNGLE_PROFILE.pointerParallaxStrength
        : 0;

      planeGroup.position.x = pointer.x * parallaxFactor;
      planeGroup.position.y = -pointer.y * parallaxFactor * 0.75;
      planeGroup.rotation.y = pointer.x * parallaxFactor * 0.75;
      planeGroup.rotation.x = -pointer.y * parallaxFactor * 0.58;

      camera.position.x = pointer.x * parallaxFactor * 0.34;
      camera.position.y = -pointer.y * parallaxFactor * 0.24;
      camera.lookAt(0, 0, -0.42);

      writeImageDepthParityStats("uv-jungle-production", {
        supportsParallax: true,
        pointerInputMode: "autonomous-virtual-pointer",
        pointerMotionAllowed: parallaxEnabled,
        autonomousBehavior,
        autonomousCircuitSeconds: autonomousTarget.profile.circuitSeconds,
        autonomousExcursion: autonomousTarget.profile.horizontalExcursion,
        pointerTargetX: pointerTarget.x,
        pointerTargetY: pointerTarget.y,
        pointerSmoothedX: pointer.x,
        pointerSmoothedY: pointer.y,
        parallaxFactor,
        appliedPlanePositionX: planeGroup.position.x,
        appliedPlanePositionY: planeGroup.position.y,
        appliedPlaneRotationX: planeGroup.rotation.x,
        appliedPlaneRotationY: planeGroup.rotation.y,
        appliedCameraPositionX: camera.position.x,
        appliedCameraPositionY: camera.position.y,
      });

      glowMaterial.opacity = 0.045 + effectiveDepth * 0.06;

      renderer.render(scene, camera);

      if (!readySignaled && planeSized) {
        readySignaled = true;
        setSceneReady(true);
        setLoadingState("ready");
        setShowCalibratingMessage(false);
        renderer.domElement.style.opacity = "1";
      }
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
      timer.disconnect();
      window.clearTimeout(calibratingMessageTimeout);
      renderer.domElement.style.filter = "";
      renderer.domElement.style.opacity = "";

      window.removeEventListener("resize", handleResize);

      planeGeometry.dispose();
      planeMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="uv-reactive-jungle-scene"
      data-scene-ready={sceneReady ? "true" : "false"}
      data-loading-state={loadingState}
    >
      {showCalibratingMessage && !sceneReady && loadingState !== "error" ? (
        <p className="uv-reactive-jungle-scene__status">CALIBRATING ENVIRONMENT...</p>
      ) : null}
    </div>
  );
}

export default UvReactiveJungleTheme;
