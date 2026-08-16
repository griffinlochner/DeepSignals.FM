import { useEffect, useRef } from "react";
import * as THREE from "three";

type SignalRunnerSceneProps = {
  flightSpeed: number;
};

const STAR_COUNT = 900;
const FLIGHT_DEPTH = 110;
const NEAR_PLANE = 1.5;

function SignalRunnerScene({ flightSpeed }: SignalRunnerSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const targetSpeedRef = useRef(flightSpeed);

  useEffect(() => {
    targetSpeedRef.current = flightSpeed;
  }, [flightSpeed]);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010104);
    scene.fog = new THREE.FogExp2(0x010104, 0.009);

    const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 130);
    camera.position.set(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const pointPositions = new Float32Array(STAR_COUNT * 3);
    const pointColors = new Float32Array(STAR_COUNT * 3);
    const streakPositions = new Float32Array(STAR_COUNT * 6);
    const streakColors = new Float32Array(STAR_COUNT * 6);
    const brandColors = [
      new THREE.Color(0x47f7ff),
      new THREE.Color(0x9cff57),
      new THREE.Color(0xff7fa1),
    ];

    const resetStar = (index: number, depth?: number) => {
      const offset = index * 3;
      const starDepth = depth ?? 28 + Math.random() * (FLIGHT_DEPTH - 28);
      const horizontalSpread = starDepth * 0.72;
      const verticalSpread = starDepth * 0.42;

      pointPositions[offset] = (Math.random() - 0.5) * horizontalSpread;
      pointPositions[offset + 1] = (Math.random() - 0.5) * verticalSpread;
      pointPositions[offset + 2] = -starDepth;
    };

    for (let index = 0; index < STAR_COUNT; index += 1) {
      resetStar(index, NEAR_PLANE + Math.random() * (FLIGHT_DEPTH - NEAR_PLANE));

      const colorRoll = Math.random();
      const color = brandColors[colorRoll > 0.88 ? 2 : colorRoll > 0.68 ? 1 : 0];
      const pointOffset = index * 3;
      const streakOffset = index * 6;

      pointColors[pointOffset] = color.r;
      pointColors[pointOffset + 1] = color.g;
      pointColors[pointOffset + 2] = color.b;

      streakColors[streakOffset] = color.r;
      streakColors[streakOffset + 1] = color.g;
      streakColors[streakOffset + 2] = color.b;
      streakColors[streakOffset + 3] = color.r;
      streakColors[streakOffset + 4] = color.g;
      streakColors[streakOffset + 5] = color.b;
    }

    const pointGeometry = new THREE.BufferGeometry();
    const pointPositionAttribute = new THREE.BufferAttribute(pointPositions, 3);
    pointPositionAttribute.setUsage(THREE.DynamicDrawUsage);
    pointGeometry.setAttribute("position", pointPositionAttribute);
    pointGeometry.setAttribute("color", new THREE.BufferAttribute(pointColors, 3));

    const pointMaterial = new THREE.PointsMaterial({
      size: 0.12,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const stars = new THREE.Points(pointGeometry, pointMaterial);
    scene.add(stars);

    const streakGeometry = new THREE.BufferGeometry();
    const streakPositionAttribute = new THREE.BufferAttribute(streakPositions, 3);
    streakPositionAttribute.setUsage(THREE.DynamicDrawUsage);
    streakGeometry.setAttribute("position", streakPositionAttribute);
    streakGeometry.setAttribute("color", new THREE.BufferAttribute(streakColors, 3));

    const streakMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const streaks = new THREE.LineSegments(streakGeometry, streakMaterial);
    scene.add(streaks);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;

      if (width <= 0 || height <= 0) {
        return;
      }

      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    let frameId = 0;
    let lastFrameTime = performance.now();
    let smoothedSpeed = targetSpeedRef.current;

    const animate = (frameTime: number) => {
      const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
      lastFrameTime = frameTime;
      const smoothing = 1 - Math.exp(-delta * 2.8);
      smoothedSpeed += (targetSpeedRef.current - smoothedSpeed) * smoothing;

      const normalizedSpeed = smoothedSpeed / 100;
      const travelVelocity = 2.2 + normalizedSpeed * normalizedSpeed * 86;
      const streakMix = THREE.MathUtils.smoothstep(normalizedSpeed, 0.28, 0.82);
      const streakLength = 0.08 + streakMix * streakMix * 9;

      for (let index = 0; index < STAR_COUNT; index += 1) {
        const pointOffset = index * 3;
        const streakOffset = index * 6;
        let z = pointPositions[pointOffset + 2] + travelVelocity * delta;

        if (z > -NEAR_PLANE) {
          resetStar(index);
          z = pointPositions[pointOffset + 2];
        } else {
          pointPositions[pointOffset + 2] = z;
        }

        const x = pointPositions[pointOffset];
        const y = pointPositions[pointOffset + 1];
        streakPositions[streakOffset] = x;
        streakPositions[streakOffset + 1] = y;
        streakPositions[streakOffset + 2] = z;
        streakPositions[streakOffset + 3] = x;
        streakPositions[streakOffset + 4] = y;
        streakPositions[streakOffset + 5] = z - streakLength;
      }

      pointMaterial.opacity = THREE.MathUtils.lerp(0.95, 0.48, streakMix);
      pointMaterial.size = THREE.MathUtils.lerp(0.12, 0.075, streakMix);
      streakMaterial.opacity = streakMix * 0.9;
      pointPositionAttribute.needsUpdate = true;
      streakPositionAttribute.needsUpdate = true;

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      pointGeometry.dispose();
      pointMaterial.dispose();
      streakGeometry.dispose();
      streakMaterial.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="signal-runner__space" ref={mountRef} aria-hidden="true" />;
}

export default SignalRunnerScene;