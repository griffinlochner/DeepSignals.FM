import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThemeSceneProps } from "../themeTypes";
import { formatImageDepthPlaybackFilter, stepImageDepthPlaybackVisualMix } from "./imageDepthPlaybackVisuals";
import { computeFramedPlaneScale, IMAGE_DEPTH_PARITY_FRAMING } from "./framing";
import { getImageDepthTexturePair } from "./imageDepthTextureCache";
import type { ImageDepthAsset, ImageDepthScenePreset } from "./types";

type ImageDepthThemeSceneProps = ThemeSceneProps & {
  asset: ImageDepthAsset;
  scenePreset: ImageDepthScenePreset;
  className?: string;
};

const SATURATION_EPSILON = 0.0001;
const DISPLACEMENT_SCALE_MULTIPLIER = 0.36;
const PLAYING_DRIFT_AMOUNT = 0.6;
const PLAYING_DRIFT_SPEED = 0.58;
const POINTER_IDLE_TIMEOUT_SECONDS = 1.25;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

export function ImageDepthThemeScene({
  isPlaying,
  reducedMotion,
  motionEnabled,
  asset,
  scenePreset,
  className,
}: ImageDepthThemeSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sharedShaderRef = useRef<THREE.ShaderMaterial | null>(null);
  const playbackVisualMixRef = useRef(0);
  const visualStateRef = useRef({
    isPlaying,
    reducedMotion,
    motionEnabled,
  });

  const behavior = scenePreset.behavior;

  const profile = useMemo(
    () => ({
      depth: {
        staticDepth: behavior.depth.staticDepth,
        breathingMin: behavior.depth.breathingMin,
        breathingMax: behavior.depth.breathingMax,
        depthStrength: behavior.depth.depthStrength,
        motionIntensity: behavior.depth.motionIntensity,
        breathingCycleSeconds: behavior.depth.breathingCycleSeconds,
        pointerParallaxEnabled: behavior.depth.pointerParallaxEnabled,
        pointerParallaxStrength: behavior.depth.pointerParallaxStrength,
        ambientMotionEnabled: behavior.depth.ambientMotionEnabled,
      },
      color: {
        driftEnabled: behavior.color.driftEnabled,
        hueRangeDegrees: behavior.color.hueRangeDegrees,
        cycleSeconds: behavior.color.cycleSeconds,
        saturation: behavior.color.saturation,
        glowPulseEnabled: behavior.color.glowPulseEnabled,
        glowPulseAmount: behavior.color.glowPulseAmount,
        glowPulseCycleSeconds: behavior.color.glowPulseCycleSeconds,
      },
      saturationPulse: {
        enabled: behavior.saturationPulse.enabled,
        minimumSaturation: behavior.saturationPulse.minimumSaturation,
        maximumSaturation: behavior.saturationPulse.maximumSaturation,
        cycleSeconds: behavior.saturationPulse.cycleSeconds,
        phaseOffset: behavior.saturationPulse.phaseOffset,
        syncToDepthBreathing: behavior.saturationPulse.syncToDepthBreathing,
      },
    }),
    [behavior],
  );

  useEffect(() => {
    visualStateRef.current = {
      isPlaying,
      reducedMotion,
      motionEnabled,
    };
  }, [isPlaying, reducedMotion, motionEnabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08110d);
    scene.fog = new THREE.FogExp2(0x08110d, 0.045);

    const camera = new THREE.PerspectiveCamera(IMAGE_DEPTH_PARITY_FRAMING.cameraFovDegrees, 1, 0.1, 80);
    camera.position.set(0, 0, IMAGE_DEPTH_PARITY_FRAMING.cameraZ);
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x08110d, 1);
    renderer.domElement.style.backgroundColor = "#08110d";
    renderer.domElement.style.opacity = "0";
    renderer.domElement.style.transition = "opacity 520ms ease";
    container.appendChild(renderer.domElement);

    const planeGroup = new THREE.Group();
    scene.add(planeGroup);

    const uniforms = {
      uColorMap: { value: null as THREE.Texture | null },
      uDepthMap: { value: null as THREE.Texture | null },
      uDepthScale: { value: profile.depth.staticDepth },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        uniform sampler2D uDepthMap;
        uniform float uDepthScale;

        void main() {
          vUv = uv;
          float depthValue = texture2D(uDepthMap, uv).r;
          vec3 displaced = position;
          displaced.z += (depthValue - 0.5) * uDepthScale;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uColorMap;

        void main() {
          gl_FragColor = texture2D(uColorMap, vUv);
        }
      `,
      transparent: false,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const geometry = new THREE.PlaneGeometry(1, 1, 320, 224);
    const plane = new THREE.Mesh(geometry, material);
    plane.position.z = IMAGE_DEPTH_PARITY_FRAMING.planeZ;
    planeGroup.add(plane);

    const glowGeometry = new THREE.PlaneGeometry(1, 1);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x6de0c0,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const glowPlane = new THREE.Mesh(glowGeometry, glowMaterial);
    glowPlane.position.z = -0.8;
    planeGroup.add(glowPlane);

    sharedShaderRef.current = material;

    let disposed = false;
    let frameHandle: number | null = null;
    let readyFrameHandle: number | null = null;
    let readyFallbackTimeoutHandle: number | null = null;
    const pointerTarget = new THREE.Vector2(0, 0);
    const pointer = new THREE.Vector2(0, 0);
    const blendedPointer = new THREE.Vector2(0, 0);
    const autonomousPointer = new THREE.Vector2(0, 0);
    let lastTimestamp = performance.now();
    let elapsedSeconds = 0;
    let pointerInfluence = 0;
    let lastPointerInputAt = -100;
    let huePhase = 0;
    let glowPhase = 0;
    let saturationPulsePhase = 0;

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      pointerTarget.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      pointerTarget.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
      lastPointerInputAt = elapsedSeconds;
    };

    const onPointerLeave = () => {
      pointerTarget.set(0, 0);
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width <= 0 || height <= 0) {
        return;
      }

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const framedScale = computeFramedPlaneScale({
        viewportWidth: width,
        viewportHeight: height,
        cameraFovDegrees: camera.fov,
        cameraZ: camera.position.z,
        planeZ: plane.position.z,
      });

      plane.scale.set(framedScale.width, framedScale.height, 1);
      glowPlane.scale.set(framedScale.width * 1.14, framedScale.height * 1.08, 1);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    readyFallbackTimeoutHandle = window.setTimeout(() => {
      if (!disposed) {
        renderer.domElement.style.opacity = "1";
      }
    }, 350);

    getImageDepthTexturePair(asset)
      .then(({ colorTexture, depthTexture }) => {
        if (disposed) {
          return;
        }

        uniforms.uColorMap.value = colorTexture;
        uniforms.uDepthMap.value = depthTexture;

        readyFrameHandle = requestAnimationFrame(() => {
          renderer.domElement.style.opacity = "1";
        });
      })
      .catch((error) => {
        console.warn("Image-depth texture loading failed", error);
        renderer.domElement.style.opacity = "1";
      });

    const renderFrame = (timestamp: number) => {
      if (disposed) {
        return;
      }

      try {
        const deltaSeconds = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;
        elapsedSeconds += Math.max(deltaSeconds, 0);

        const visualState = visualStateRef.current;
        const isPlayingNow = visualState.isPlaying;
        const reducedMotionActive = visualState.reducedMotion;
        const geometryMotionEnabled = visualState.motionEnabled !== false;
        const geometryMotionActive = isPlayingNow && !reducedMotionActive && geometryMotionEnabled;
        const automaticMotionActive = geometryMotionActive && profile.depth.ambientMotionEnabled;

        pointer.lerp(pointerTarget, 0.05);

        const motionAmount = geometryMotionActive
          ? profile.depth.motionIntensity * profile.depth.pointerParallaxStrength
          : 0;
        const autoAmount = automaticMotionActive ? motionAmount : 0;

        autonomousPointer.x = Math.sin(elapsedSeconds * PLAYING_DRIFT_SPEED) * PLAYING_DRIFT_AMOUNT * autoAmount;
        autonomousPointer.y =
          Math.sin(elapsedSeconds * PLAYING_DRIFT_SPEED * 0.65) *
          Math.cos(elapsedSeconds * PLAYING_DRIFT_SPEED * 0.42) *
          PLAYING_DRIFT_AMOUNT *
          autoAmount *
          0.82;

        const pointerIsActive = elapsedSeconds - lastPointerInputAt <= POINTER_IDLE_TIMEOUT_SECONDS;
        const pointerEnabled = geometryMotionActive && profile.depth.pointerParallaxEnabled;
        const pointerInfluenceTarget = pointerEnabled && pointerIsActive ? 1 : 0;
        pointerInfluence = THREE.MathUtils.lerp(pointerInfluence, pointerInfluenceTarget, 0.045);

        blendedPointer.x = THREE.MathUtils.lerp(autonomousPointer.x, pointer.x * motionAmount, pointerInfluence);
        blendedPointer.y = THREE.MathUtils.lerp(autonomousPointer.y, pointer.y * motionAmount, pointerInfluence);

        let breathingMix = 0.5;
        const minBreathingDepth = Math.min(profile.depth.breathingMin, profile.depth.breathingMax);
        const maxBreathingDepth = Math.max(profile.depth.breathingMin, profile.depth.breathingMax);

        if (automaticMotionActive) {
          const breathingRange = maxBreathingDepth - minBreathingDepth;
          const safeCycleSeconds = Math.max(profile.depth.breathingCycleSeconds, SATURATION_EPSILON);
          const cycle = Math.sin((elapsedSeconds / safeCycleSeconds) * Math.PI * 2);
          breathingMix = (cycle + 1) * 0.5;

          uniforms.uDepthScale.value =
            profile.depth.depthStrength *
            DISPLACEMENT_SCALE_MULTIPLIER *
            (minBreathingDepth + breathingRange * breathingMix);
        } else {
          uniforms.uDepthScale.value =
            profile.depth.staticDepth * profile.depth.depthStrength * DISPLACEMENT_SCALE_MULTIPLIER;
        }

        const hueOffsetDegrees =
          profile.color.driftEnabled && isPlayingNow && !reducedMotionActive
            ? Math.sin(huePhase) * profile.color.hueRangeDegrees
            : 0;

        let currentSaturation = profile.color.saturation;
        if (profile.saturationPulse.enabled && isPlayingNow && !reducedMotionActive) {
          if (profile.saturationPulse.syncToDepthBreathing) {
            const syncAngle = breathingMix * Math.PI * 2 + profile.saturationPulse.phaseOffset;
            const pulseProgress = (Math.sin(syncAngle) + 1) * 0.5;
            currentSaturation = lerp(
              profile.saturationPulse.minimumSaturation,
              profile.saturationPulse.maximumSaturation,
              pulseProgress,
            );
          } else {
            const pulseProgress =
              (Math.sin(saturationPulsePhase + profile.saturationPulse.phaseOffset) + 1) * 0.5;
            currentSaturation = lerp(
              profile.saturationPulse.minimumSaturation,
              profile.saturationPulse.maximumSaturation,
              pulseProgress,
            );
          }
        }

        const glowPulseAmount = profile.color.glowPulseEnabled && isPlayingNow && !reducedMotionActive
          ? (Math.sin(glowPhase) * 0.5 + 0.5) * profile.color.glowPulseAmount
          : 0;

        playbackVisualMixRef.current = stepImageDepthPlaybackVisualMix(
          playbackVisualMixRef.current,
          isPlayingNow,
          reducedMotionActive,
        );

        if (profile.color.driftEnabled && isPlayingNow && !reducedMotionActive) {
          huePhase += (deltaSeconds / Math.max(profile.color.cycleSeconds, 1)) * Math.PI * 2;
        }

        if (profile.color.glowPulseEnabled && isPlayingNow && !reducedMotionActive) {
          glowPhase += (deltaSeconds / Math.max(profile.color.glowPulseCycleSeconds, 1)) * Math.PI * 2;
        }

        if (
          profile.saturationPulse.enabled &&
          isPlayingNow &&
          !reducedMotionActive &&
          !profile.saturationPulse.syncToDepthBreathing
        ) {
          saturationPulsePhase +=
            (deltaSeconds / Math.max(profile.saturationPulse.cycleSeconds, 0.2)) * Math.PI * 2;
        }

        planeGroup.position.x = Math.sin(elapsedSeconds * 0.16) * 0.06 * autoAmount + blendedPointer.x * 0.14;
        planeGroup.position.y = Math.cos(elapsedSeconds * 0.12) * 0.04 * autoAmount - blendedPointer.y * 0.11;
        planeGroup.rotation.y = Math.sin(elapsedSeconds * 0.1) * 0.022 * autoAmount + blendedPointer.x * 0.13;
        planeGroup.rotation.x = Math.cos(elapsedSeconds * 0.085) * 0.016 * autoAmount - blendedPointer.y * 0.1;
        plane.position.z =
          IMAGE_DEPTH_PARITY_FRAMING.planeZ + Math.sin(elapsedSeconds * 0.22) * 0.06 * autoAmount;
        glowPlane.material.opacity = 0.05 + uniforms.uDepthScale.value * 0.18 + glowPulseAmount * 0.8;

        camera.position.x = blendedPointer.x * 0.06;
        camera.position.y = -blendedPointer.y * 0.045;
        camera.lookAt(0, 0, -0.4);

        const filter = formatImageDepthPlaybackFilter({
          playbackVisualMix: playbackVisualMixRef.current,
          hueOffsetDegrees,
          currentSaturation,
          glowPulseAmount,
        });

        renderer.domElement.style.filter = filter;
        renderer.render(scene, camera);
      } catch (error) {
        const visualState = visualStateRef.current;
        renderer.domElement.style.filter = visualState.isPlaying
          ? "grayscale(0) hue-rotate(0deg) saturate(1) brightness(1)"
          : "grayscale(1) hue-rotate(0deg) saturate(0) brightness(0.85)";
        console.warn("Image-depth render loop error", error);
      }

      frameHandle = requestAnimationFrame(renderFrame);
    };

    frameHandle = requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;

      if (frameHandle !== null) {
        cancelAnimationFrame(frameHandle);
      }

      if (readyFrameHandle !== null) {
        cancelAnimationFrame(readyFrameHandle);
      }

      if (readyFallbackTimeoutHandle !== null) {
        window.clearTimeout(readyFallbackTimeoutHandle);
      }

      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      resizeObserver.disconnect();
      sharedShaderRef.current = null;
      material.dispose();
      geometry.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      renderer.dispose();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [asset, profile]);

  useEffect(() => {
    const shader = sharedShaderRef.current;
    if (!shader) {
      return;
    }

    shader.uniforms.uDepthScale.value =
      profile.depth.staticDepth * profile.depth.depthStrength * DISPLACEMENT_SCALE_MULTIPLIER;
  }, [profile.depth.staticDepth, profile.depth.depthStrength]);

  return <div className={className ?? "image-depth-scene"} ref={containerRef} role="presentation" />;
}
