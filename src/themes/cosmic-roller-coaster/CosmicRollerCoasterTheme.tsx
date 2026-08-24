import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RollerCoasterGeometry } from "three/examples/jsm/misc/RollerCoaster.js";
import { mapSmoothedEnergyToHue } from "../../app/sharedChroma";
import type { ThemeSceneProps } from "../themeTypes";

const STAR_COUNT = 1400;
const TRACK_DIVISIONS = 1500;
// Traversal speed range (progress units per second along coaster spline)
const SPEED_MIN = 0; // complete stop for silence/zero analyzer energy
const SPEED_MAX = 0.012; // high-energy peak for comfortable viewing through sharp turns/dips
// Audio energy normalization thresholds (matching DeepSignals.FM conventions)
const AUDIO_ENERGY_FLOOR = 0.04;
const AUDIO_ENERGY_CEILING = 0.72;
// Speed smoothing responsiveness (exponential decay rate per second)
const SPEED_EASING_PER_SECOND = 1.8;
const TELEMETRY_INTERVAL_MS = 100;

// DSFM brand colors for track zones (CHROMA OFF baseline)
const DSFM_COLORS = {
  rails: new THREE.Color(0x74fff0),    // cyan/aqua
  spine: new THREE.Color(0xff9eaa),    // salmon/pink
  ties: new THREE.Color(0xb2ff86),     // neon green
};

// RollerCoasterGeometry vertex structure per division: 114 vertices
// - ties (cross ties, step shape): 12 vertices (0-11)
// - spine (center tube1): 30 vertices (12-41)
// - rails (tube2 left + tube2 right): 72 vertices (42-113)
const VERTICES_PER_DIVISION = 114;
const TIES_VERTICES_PER_DIV = 12;      // 2 * step.length (step has 6 elements)
const SPINE_VERTICES_PER_DIV = 30;     // 5 * 6 (tube1 has 5 elements)

function clamp(value: number) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

class CosmicRollerCoasterCurve extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }

  getPoint(t: number, target = new THREE.Vector3()) {
    const phase = t * Math.PI * 2;
    return target.set(
      Math.sin(phase * 3) * Math.cos(phase * 4) * 100,
      (Math.sin(phase * 10) * 2 + Math.cos(phase * 17) * 2 + 5) * 2,
      Math.sin(phase) * Math.sin(phase * 4) * 100,
    );
  }
}

function createStarfield() {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const palette = [0x74fff0, 0xb2ff86, 0xff9eaa, 0xb5c9ff].map((color) => new THREE.Color(color));
  for (let index = 0; index < STAR_COUNT; index += 1) {
    const radius = 48 + Math.random() * 105;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi);
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = palette[index % palette.length].clone().multiplyScalar(0.42 + Math.random() * 0.45);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.11, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }));
}

function CosmicRollerCoasterTheme({ isPlaying, reducedMotion, motionEnabled = true, chromaEnabled = true, getLatestAudioSnapshot, onRuntimeTelemetry }: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ isPlaying, reducedMotion, motionEnabled, chromaEnabled, getLatestAudioSnapshot, onRuntimeTelemetry });
  useEffect(() => {
    propsRef.current = { isPlaying, reducedMotion, motionEnabled, chromaEnabled, getLatestAudioSnapshot, onRuntimeTelemetry };
  }, [chromaEnabled, getLatestAudioSnapshot, isPlaying, motionEnabled, onRuntimeTelemetry, reducedMotion]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const curve = new CosmicRollerCoasterCurve();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010207);
    scene.fog = new THREE.FogExp2(0x010207, 0.003);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    const train = new THREE.Object3D();
    train.add(camera);
    scene.add(train);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);
    const stars = createStarfield();
    scene.add(stars);
    const trackMaterial = new THREE.MeshBasicMaterial({ color: 0xb6d7d5, vertexColors: true });
    const track = new THREE.Mesh(new RollerCoasterGeometry(curve, TRACK_DIVISIONS), trackMaterial);
    scene.add(track);
    
    // Initialize vertex colors: assign DSFM base palette by structural zone
    const colorAttribute = track.geometry.getAttribute('color') as THREE.BufferAttribute;
    const colorArray = colorAttribute.array as Float32Array;
    
    // Create immutable copy of base colors for CHROMA reactivity calculations
    const baseColorArray = new Float32Array(colorArray.length);
    
    // Assign DSFM colors to each vertex based on zone (within each division)
    for (let div = 0; div < TRACK_DIVISIONS; div++) {
      const divBaseIndex = div * VERTICES_PER_DIVISION;
      
      // Ties: vertices 0-11 of this division
      for (let v = 0; v < TIES_VERTICES_PER_DIV; v++) {
        const colorIndex = (divBaseIndex + v) * 3;
        colorArray[colorIndex] = DSFM_COLORS.ties.r;
        colorArray[colorIndex + 1] = DSFM_COLORS.ties.g;
        colorArray[colorIndex + 2] = DSFM_COLORS.ties.b;
        baseColorArray[colorIndex] = DSFM_COLORS.ties.r;
        baseColorArray[colorIndex + 1] = DSFM_COLORS.ties.g;
        baseColorArray[colorIndex + 2] = DSFM_COLORS.ties.b;
      }
      
      // Spine: vertices 12-41 of this division
      for (let v = TIES_VERTICES_PER_DIV; v < TIES_VERTICES_PER_DIV + SPINE_VERTICES_PER_DIV; v++) {
        const colorIndex = (divBaseIndex + v) * 3;
        colorArray[colorIndex] = DSFM_COLORS.spine.r;
        colorArray[colorIndex + 1] = DSFM_COLORS.spine.g;
        colorArray[colorIndex + 2] = DSFM_COLORS.spine.b;
        baseColorArray[colorIndex] = DSFM_COLORS.spine.r;
        baseColorArray[colorIndex + 1] = DSFM_COLORS.spine.g;
        baseColorArray[colorIndex + 2] = DSFM_COLORS.spine.b;
      }
      
      // Rails: vertices 42-113 of this division (both left and right rails)
      for (let v = TIES_VERTICES_PER_DIV + SPINE_VERTICES_PER_DIV; v < VERTICES_PER_DIVISION; v++) {
        const colorIndex = (divBaseIndex + v) * 3;
        colorArray[colorIndex] = DSFM_COLORS.rails.r;
        colorArray[colorIndex + 1] = DSFM_COLORS.rails.g;
        colorArray[colorIndex + 2] = DSFM_COLORS.rails.b;
        baseColorArray[colorIndex] = DSFM_COLORS.rails.r;
        baseColorArray[colorIndex + 1] = DSFM_COLORS.rails.g;
        baseColorArray[colorIndex + 2] = DSFM_COLORS.rails.b;
      }
    }
    
    colorAttribute.needsUpdate = true;
    const timer = new THREE.Timer();
    timer.connect(document);
    const position = new THREE.Vector3();
    const lookAt = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const tangent1 = new THREE.Vector3();
    const tangent2 = new THREE.Vector3();
    const bankQuaternion = new THREE.Quaternion();
    let progress = 0;
    let rideSpeed = 0;
    let lastTelemetry = 0;
    let animationFrame = 0;
    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    const render = () => {
      timer.update();
      const delta = Math.min(timer.getDelta(), 0.05);
      const props = propsRef.current;
      const snapshot = props.getLatestAudioSnapshot?.() ?? { smoothedEnergy: 0 };
      const energy = clamp(snapshot.smoothedEnergy);
      
      // Normalize energy between floor and ceiling to 0-1 range
      const normalizedEnergy = clamp(
        (energy - AUDIO_ENERGY_FLOOR) / (AUDIO_ENERGY_CEILING - AUDIO_ENERGY_FLOOR)
      );
      
      // Target speed interpolates between SPEED_MIN and SPEED_MAX based on normalized energy
      const targetSpeed = props.isPlaying && props.motionEnabled && !props.reducedMotion
        ? SPEED_MIN + normalizedEnergy * (SPEED_MAX - SPEED_MIN)
        : 0;
      
      // Smooth speed transitions with exponential easing
      const speedEase = 1 - Math.exp(-delta * SPEED_EASING_PER_SECOND);
      rideSpeed = THREE.MathUtils.lerp(rideSpeed, targetSpeed, speedEase);
      
      // Update spline progress only when motion is active
      if (props.isPlaying && props.motionEnabled && !props.reducedMotion) {
        progress = (progress + rideSpeed * delta) % 1;
      }
      
      position.copy(curve.getPointAt(progress));
      position.y += 0.3;
      train.position.copy(position);
      tangent.copy(curve.getTangentAt(progress));
      const bankDelta = 0.01;
      tangent1.copy(curve.getTangentAt((progress - bankDelta + 1) % 1));
      tangent2.copy(curve.getTangentAt((progress + bankDelta) % 1));
      let headingChange = Math.atan2(tangent2.x, tangent2.z) - Math.atan2(tangent1.x, tangent1.z);
      if (headingChange > Math.PI) headingChange -= Math.PI * 2;
      if (headingChange < -Math.PI) headingChange += Math.PI * 2;
      train.up.set(0, 1, 0);
      bankQuaternion.setFromAxisAngle(tangent, -Math.atan(headingChange * 8) * 0.5);
      train.up.applyQuaternion(bankQuaternion);
      train.lookAt(lookAt.copy(position).sub(tangent));
      
      // Apply CHROMA reactivity: hue shift base colors or restore them
      const hueOffset = props.chromaEnabled && energy > 0 ? mapSmoothedEnergyToHue(energy) / 360 : 0;
      const chromaActive = props.chromaEnabled && energy > 0;
      
      if (chromaActive) {
        // Apply hue rotation + enhanced saturation/lightness to immutable base colors each frame
        const tempColor = new THREE.Color();
        for (let i = 0; i < baseColorArray.length; i += 3) {
          tempColor.setRGB(baseColorArray[i], baseColorArray[i + 1], baseColorArray[i + 2]);
          tempColor.offsetHSL(hueOffset, 0.10, 0.02);  // hue + saturation boost + lightness boost
          colorArray[i] = tempColor.r;
          colorArray[i + 1] = tempColor.g;
          colorArray[i + 2] = tempColor.b;
        }
      } else {
        // Restore stable DSFM base colors
        colorArray.set(baseColorArray);
      }
      colorAttribute.needsUpdate = true;
      
      (stars.material as THREE.PointsMaterial).opacity = 0.7 + energy * 0.16;
      if (props.onRuntimeTelemetry && performance.now() - lastTelemetry > TELEMETRY_INTERVAL_MS) {
        lastTelemetry = performance.now();
        props.onRuntimeTelemetry({ motionTargetSpeed: targetSpeed, motionSpeed: rideSpeed, travelPosition: progress, hue: hueOffset * 360 });
      }
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      scene.traverse((object) => {
        const disposable = object as THREE.Mesh;
        disposable.geometry?.dispose();
        if (Array.isArray(disposable.material)) disposable.material.forEach((material) => material.dispose());
        else disposable.material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return <div ref={mountRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-label="Cosmic Roller Coaster environment" />;
}

export default CosmicRollerCoasterTheme;