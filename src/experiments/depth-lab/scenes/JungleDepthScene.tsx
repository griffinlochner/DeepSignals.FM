import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { DepthLabSceneProps } from "../types";
import {
  formatUvJunglePlaybackFilter,
  stepUvJunglePlaybackVisualMix,
} from "../../../themes/uv-reactive-jungle/uvReactivePlaybackVisuals";

const JUNGLE_IMAGE_PATH = "/experiments/depth-lab/jungle-color.png";
const JUNGLE_DEPTH_MAP_PATH = "/experiments/depth-lab/jungle-depth.png";

const POINTER_IDLE_TIMEOUT_SECONDS = 1.25;
const DIAGNOSTIC_UPDATE_INTERVAL_SECONDS = 0.14;
const DISPLACEMENT_SCALE_MULTIPLIER = 0.36;
const PLAYING_MOTION_MULTIPLIER = 0.42;
const PLAYING_DRIFT_AMOUNT = 0.6;
const PLAYING_DRIFT_SPEED = 0.58;
const STOPPED_POINTER_PARALLAX_MULTIPLIER = 0.12;
const STATIC_DEPTH_RATIO = 0.56;

function JungleDepthScene({
  playbackState,
  motionIntensity,
  depthStrength,
  minimumBreathingDepth,
  maximumBreathingDepth,
  breathingCycleDurationSeconds,
  pointerParallaxEnabled,
  autoMotionEnabled,
  onEffectiveDepthDiagnosticChange,
  onLoadingStateChange,
}: DepthLabSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const configRef = useRef({
    playbackState,
    motionIntensity,
    depthStrength,
    minimumBreathingDepth,
    maximumBreathingDepth,
    breathingCycleDurationSeconds,
    pointerParallaxEnabled,
    autoMotionEnabled,
  });

  useEffect(() => {
    configRef.current = {
      playbackState,
      motionIntensity,
      depthStrength,
      minimumBreathingDepth,
      maximumBreathingDepth,
      breathingCycleDurationSeconds,
      pointerParallaxEnabled,
      autoMotionEnabled,
    };
  }, [
    autoMotionEnabled,
    breathingCycleDurationSeconds,
    depthStrength,
    maximumBreathingDepth,
    minimumBreathingDepth,
    motionIntensity,
    playbackState,
    pointerParallaxEnabled,
  ]);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    onLoadingStateChange?.("loading");

    let animationFrameId = 0;
    let disposed = false;
    let colorTexture: THREE.Texture | null = null;
    let depthTexture: THREE.Texture | null = null;

    const pointer = new THREE.Vector2(0, 0);
    const pointerTarget = new THREE.Vector2(0, 0);
    const blendedPointer = new THREE.Vector2(0, 0);
    const autonomousPointer = new THREE.Vector2(0, 0);
    const planeScale = new THREE.Vector2(1, 1);
    let pointerInfluence = 0;
    let lastPointerInputAt = -100;
    let lastDiagnosticUpdateAt = -100;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08110d);
    scene.fog = new THREE.FogExp2(0x08110d, 0.045);

    const camera = new THREE.PerspectiveCamera(
      46,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      50,
    );
    camera.position.z = 3.2;
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.domElement.className = "depth-lab__scene";
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
      displacementScale: 0.18,
      roughness: 1,
      metalness: 0,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.z = -0.15;
    planeGroup.add(plane);

    const glowGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x6de0c0,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial);
    glowPlane.position.z = -0.8;
    planeGroup.add(glowPlane);

    const loadingManager = new THREE.LoadingManager();
    const textureLoader = new THREE.TextureLoader(loadingManager);

    loadingManager.onLoad = () => {
      if (!disposed) {
        onLoadingStateChange?.("ready");
      }
    };

    loadingManager.onError = () => {
      if (!disposed) {
        onLoadingStateChange?.("error");
      }
    };

    textureLoader.load(
      JUNGLE_IMAGE_PATH,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }

        colorTexture = texture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        planeMaterial.map = texture;
        planeMaterial.needsUpdate = true;
      },
      undefined,
      () => onLoadingStateChange?.("error"),
    );

    textureLoader.load(
      JUNGLE_DEPTH_MAP_PATH,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }

        depthTexture = texture;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        planeMaterial.displacementMap = texture;
        planeMaterial.needsUpdate = true;
      },
      undefined,
      () => onLoadingStateChange?.("error"),
    );

    const fitPlane = () => {
      const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      const viewHeight =
        2 *
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
        Math.abs(camera.position.z - plane.position.z);
      const viewWidth = viewHeight * aspect;
      planeScale.set(viewWidth * 1.18, viewHeight * 1.28);
      plane.scale.set(planeScale.x, planeScale.y, 1);
      glowPlane.scale.set(planeScale.x * 1.14, planeScale.y * 1.08, 1);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointerTarget.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerTarget.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      lastPointerInputAt = timer.getElapsed();
    };

    const handlePointerLeave = () => {
      pointerTarget.set(0, 0);
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
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    let playbackVisualMix = 0;

    mount.addEventListener("pointermove", handlePointerMove);
    mount.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("resize", handleResize);
    fitPlane();

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate);

      timer.update();

      const elapsed = timer.getElapsed();
      const isPlaying = configRef.current.playbackState === "playing";
      const motionAmount =
        isPlaying && !reducedMotionQuery.matches
          ? configRef.current.motionIntensity * PLAYING_MOTION_MULTIPLIER
          : 0;
      const ambientEnabled =
        isPlaying &&
        configRef.current.autoMotionEnabled &&
        !reducedMotionQuery.matches;
      const pointerEnabled =
        configRef.current.pointerParallaxEnabled && !reducedMotionQuery.matches;
      const autoAmount = ambientEnabled ? motionAmount : 0;

      const minBreathingDepth = THREE.MathUtils.clamp(
        Math.min(
          configRef.current.minimumBreathingDepth,
          configRef.current.maximumBreathingDepth,
        ),
        0,
        1,
      );
      const maxBreathingDepth = THREE.MathUtils.clamp(
        Math.max(
          configRef.current.minimumBreathingDepth,
          configRef.current.maximumBreathingDepth,
        ),
        0,
        1,
      );
      const breathingCycleDurationSeconds = Math.max(
        configRef.current.breathingCycleDurationSeconds,
        0.4,
      );
      const breathingFrequency = (Math.PI * 2) / breathingCycleDurationSeconds;

      pointer.lerp(pointerTarget, 0.05);

      autonomousPointer.x =
        Math.sin(elapsed * PLAYING_DRIFT_SPEED) *
        PLAYING_DRIFT_AMOUNT *
        autoAmount;
      autonomousPointer.y =
        Math.sin(elapsed * PLAYING_DRIFT_SPEED * 0.65) *
        Math.cos(elapsed * PLAYING_DRIFT_SPEED * 0.42) *
        PLAYING_DRIFT_AMOUNT *
        autoAmount *
        0.82;

      const pointerIsActive =
        elapsed - lastPointerInputAt <= POINTER_IDLE_TIMEOUT_SECONDS;
      const pointerInfluenceTarget = pointerEnabled && pointerIsActive ? 1 : 0;
      pointerInfluence = THREE.MathUtils.lerp(
        pointerInfluence,
        pointerInfluenceTarget,
        0.045,
      );

      const pointerMotionAmount = pointerEnabled
        ? isPlaying
          ? motionAmount
          : STOPPED_POINTER_PARALLAX_MULTIPLIER
        : 0;

      blendedPointer.x = THREE.MathUtils.lerp(
        autonomousPointer.x,
        pointer.x * pointerMotionAmount,
        pointerInfluence,
      );
      blendedPointer.y = THREE.MathUtils.lerp(
        autonomousPointer.y,
        pointer.y * pointerMotionAmount,
        pointerInfluence,
      );

      const staticDepth = THREE.MathUtils.lerp(
        minBreathingDepth,
        maxBreathingDepth,
        STATIC_DEPTH_RATIO,
      );
      const breathProgress = ambientEnabled
        ? (Math.sin(elapsed * breathingFrequency) + 1) / 2
        : 0;
      const breathingDepth = ambientEnabled
        ? THREE.MathUtils.lerp(
            minBreathingDepth,
            maxBreathingDepth,
            breathProgress,
          )
        : staticDepth;
      const effectiveDepth = isPlaying ? breathingDepth : staticDepth;

      playbackVisualMix = stepUvJunglePlaybackVisualMix(
        playbackVisualMix,
        isPlaying,
        reducedMotionQuery.matches,
      );
      renderer.domElement.style.filter =
        formatUvJunglePlaybackFilter(playbackVisualMix);

      if (
        elapsed - lastDiagnosticUpdateAt >=
        DIAGNOSTIC_UPDATE_INTERVAL_SECONDS
      ) {
        lastDiagnosticUpdateAt = elapsed;
        onEffectiveDepthDiagnosticChange?.(effectiveDepth);
      }

      planeMaterial.displacementScale =
        effectiveDepth * DISPLACEMENT_SCALE_MULTIPLIER;
      planeMaterial.bumpScale = effectiveDepth * 0.04;

      planeGroup.position.x =
        Math.sin(elapsed * 0.16) * 0.06 * autoAmount + blendedPointer.x * 0.14;
      planeGroup.position.y =
        Math.cos(elapsed * 0.12) * 0.04 * autoAmount - blendedPointer.y * 0.11;
      planeGroup.rotation.y =
        Math.sin(elapsed * 0.1) * 0.022 * autoAmount + blendedPointer.x * 0.13;
      planeGroup.rotation.x =
        Math.cos(elapsed * 0.085) * 0.016 * autoAmount - blendedPointer.y * 0.1;
      plane.position.z = -0.15 + Math.sin(elapsed * 0.22) * 0.06 * autoAmount;
      glowPlane.material.opacity = 0.05 + effectiveDepth * 0.06;

      camera.position.x = blendedPointer.x * 0.06;
      camera.position.y = -blendedPointer.y * 0.045;
      camera.lookAt(0, 0, -0.4);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      disposed = true;
      onEffectiveDepthDiagnosticChange?.(0);
      window.cancelAnimationFrame(animationFrameId);
      timer.disconnect();
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", handleResize);

      colorTexture?.dispose();
      depthTexture?.dispose();
      renderer.domElement.style.filter = "";
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
  }, [onEffectiveDepthDiagnosticChange, onLoadingStateChange]);

  return <div ref={mountRef} className="depth-lab__scene" />;
}

export default JungleDepthScene;
