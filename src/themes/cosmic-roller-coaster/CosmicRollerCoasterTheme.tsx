import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RollerCoasterGeometry } from "three/examples/jsm/misc/RollerCoaster.js";
import { createRenderFpsSampler } from "../../app/renderFpsTelemetry";
import type { ThemeSceneProps } from "../themeTypes";

const STAR_COUNT = 2400;
const TRACK_DIVISIONS = 1500;
const HERO_GATE_PROGRESS = [0.22, 0.285];
const HERO_GATE_RADIUS = 10.5;
const HERO_GATE_DEPTH = 11.2;
const HERO_GATE_ROTATION_SPEED = 0.2;
const TUNNEL_RING_COUNT = 6;
const TUNNEL_RING_STEP_SECONDS = 0.5;
const SLOGAN_BILLBOARD_SPECS = [
  { text: "Tune in.", progress: 0.36, color: "#74fff0", glow: "#b2ff86" },
  { text: "Transmit.", progress: 0.48, color: "#ff9eaa", glow: "#74fff0" },
  { text: "Transcend.", progress: 0.56, color: "#b2ff86", glow: "#ff9eaa" },
  { text: "Tune in.", progress: 0.72, color: "#74fff0", glow: "#b2ff86" },
  { text: "Transmit.", progress: 0.76, color: "#ff9eaa", glow: "#74fff0" },
  { text: "Transcend.", progress: 0.84, color: "#b2ff86", glow: "#ff9eaa" },
] as const;
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
  rails: new THREE.Color(0x74fff0), // cyan/aqua
  spine: new THREE.Color(0xff9eaa), // salmon/pink
  ties: new THREE.Color(0xb2ff86), // neon green
};

// RollerCoasterGeometry vertex structure per division: 114 vertices
// - ties (cross ties, step shape): 12 vertices (0-11)
// - spine (center tube1): 30 vertices (12-41)
// - rails (tube2 left + tube2 right): 72 vertices (42-113)
const VERTICES_PER_DIVISION = 114;
const TIES_VERTICES_PER_DIV = 12; // 2 * step.length (step has 6 elements)
const SPINE_VERTICES_PER_DIV = 30; // 5 * 6 (tube1 has 5 elements)

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
  const palette = [0x74fff0, 0xb2ff86, 0xff9eaa, 0xb5c9ff].map(
    (color) => new THREE.Color(color),
  );
  for (let index = 0; index < STAR_COUNT; index += 1) {
    const radius = 48 + Math.random() * 105;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi);
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = palette[index % palette.length]
      .clone()
      .multiplyScalar(0.42 + Math.random() * 0.45);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.15,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
}

function createGateLabelTexture(
  text: string,
  primaryColor = "#ffffff",
  glowColor = "#ff9eaa",
) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "900 320px Chakra Petch, sans-serif";
  context.shadowColor = glowColor;
  context.shadowBlur = 34;
  context.fillStyle = primaryColor;
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  context.shadowBlur = 12;
  context.shadowColor = primaryColor;
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTunnelBodyGeometry() {
  const outerRadius = HERO_GATE_RADIUS;
  const innerRadius = HERO_GATE_RADIUS - 2.2;
  const outer = new THREE.Shape();
  const inner = new THREE.Path();
  const sides = 12;
  for (let index = 0; index < sides; index += 1) {
    const angle = (index / sides) * Math.PI * 2 + Math.PI / 12;
    const outerPoint = new THREE.Vector2(
      Math.cos(angle) * outerRadius,
      Math.sin(angle) * outerRadius,
    );
    const innerPoint = new THREE.Vector2(
      Math.cos(-angle) * innerRadius,
      Math.sin(-angle) * innerRadius,
    );
    if (index === 0) {
      outer.moveTo(outerPoint.x, outerPoint.y);
      inner.moveTo(innerPoint.x, innerPoint.y);
    } else {
      outer.lineTo(outerPoint.x, outerPoint.y);
      inner.lineTo(innerPoint.x, innerPoint.y);
    }
  }
  outer.closePath();
  inner.closePath();
  outer.holes.push(inner);
  const geometry = new THREE.ExtrudeGeometry(outer, {
    depth: HERO_GATE_DEPTH * 2,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.28,
    bevelThickness: 0.2,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -HERO_GATE_DEPTH);
  return geometry;
}

function CosmicRollerCoasterTheme({
  isPlaying,
  reducedMotion,
  motionEnabled = true,
  chromaEnabled = true,
  getLatestAudioSnapshot,
  onRuntimeTelemetry,
}: ThemeSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({
    isPlaying,
    reducedMotion,
    motionEnabled,
    chromaEnabled,
    getLatestAudioSnapshot,
    onRuntimeTelemetry,
  });
  useEffect(() => {
    propsRef.current = {
      isPlaying,
      reducedMotion,
      motionEnabled,
      chromaEnabled,
      getLatestAudioSnapshot,
      onRuntimeTelemetry,
    };
  }, [
    chromaEnabled,
    getLatestAudioSnapshot,
    isPlaying,
    motionEnabled,
    onRuntimeTelemetry,
    reducedMotion,
  ]);

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
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);
    const stars = createStarfield();
    scene.add(stars);
    const gateFrameMaterial = new THREE.MeshBasicMaterial({
      color: 0x24404d,
      side: THREE.DoubleSide,
    });
    const gateStripeMaterials = [
      new THREE.MeshBasicMaterial({
        color: DSFM_COLORS.rails,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshBasicMaterial({
        color: DSFM_COLORS.spine,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshBasicMaterial({
        color: DSFM_COLORS.ties,
        side: THREE.DoubleSide,
      }),
    ];
    const gateStripeGeometry = new THREE.BoxGeometry(
      0.5,
      0.5,
      HERO_GATE_DEPTH * 1.65,
    );
    const gateInnerStripeGeometry = new THREE.TorusGeometry(
      HERO_GATE_RADIUS - 3.2,
      0.2,
      8,
      64,
    );
    const tunnelRingMaterials = [
      DSFM_COLORS.ties,
      DSFM_COLORS.rails,
      DSFM_COLORS.spine,
      DSFM_COLORS.ties,
      DSFM_COLORS.rails,
      DSFM_COLORS.spine,
    ].map(
      (color) =>
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.18,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
    );
    const gateBodyGeometry = createTunnelBodyGeometry();
    const gateNormal = new THREE.Vector3(0, 0, 1);
    const gatePosition = new THREE.Vector3();
    const gateTangent = new THREE.Vector3();
    const gateOrientation = new THREE.Quaternion();
    const sloganTextures = SLOGAN_BILLBOARD_SPECS.map(({ text, color, glow }) =>
      createGateLabelTexture(text, color, glow),
    );
    const sloganMaterials = sloganTextures.map(
      (texture) =>
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
    );
    const sloganGeometry = new THREE.PlaneGeometry(18, 4.5);
    const sloganPoint = new THREE.Vector3();
    const sloganTangent = new THREE.Vector3();
    const sloganLateral = new THREE.Vector3();
    const sloganNormal = new THREE.Vector3();
    const sloganOffset = new THREE.Vector3();
    const sloganOrientation = new THREE.Quaternion();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const gates = HERO_GATE_PROGRESS.map((progress, index) => {
      const gate = new THREE.Group();
      curve.getPointAt(progress, gatePosition);
      curve.getTangentAt(progress, gateTangent);
      gateOrientation.setFromUnitVectors(gateNormal, gateTangent);
      gate.position.copy(gatePosition);
      gate.quaternion.copy(gateOrientation);
      gate.scale.setScalar(1 - index * 0.05);
      gate.add(new THREE.Mesh(gateBodyGeometry, gateFrameMaterial));
      for (let stripeIndex = 0; stripeIndex < 8; stripeIndex += 1) {
        const stripe = new THREE.Mesh(
          gateStripeGeometry,
          gateStripeMaterials[stripeIndex % gateStripeMaterials.length],
        );
        const angle = (stripeIndex / 8) * Math.PI * 2;
        stripe.position.set(
          Math.cos(angle) * (HERO_GATE_RADIUS + 0.3),
          Math.sin(angle) * (HERO_GATE_RADIUS + 0.3),
          0,
        );
        stripe.rotation.z = angle;
        gate.add(stripe);
      }
      for (let ringIndex = 0; ringIndex < TUNNEL_RING_COUNT; ringIndex += 1) {
        const innerStripe = new THREE.Mesh(
          gateInnerStripeGeometry,
          tunnelRingMaterials[ringIndex],
        );
        innerStripe.position.z =
          -HERO_GATE_DEPTH * 0.78 +
          (ringIndex / (TUNNEL_RING_COUNT - 1)) * HERO_GATE_DEPTH * 1.56;
        gate.add(innerStripe);
      }
      scene.add(gate);
      return gate;
    });
    const sloganSigns = SLOGAN_BILLBOARD_SPECS.map(({ progress }, index) => {
      curve.getPointAt(progress, sloganPoint);
      curve.getTangentAt(progress, sloganTangent);
      sloganLateral.crossVectors(sloganTangent, worldUp).normalize();
      sloganOffset
        .copy(sloganLateral)
        .multiplyScalar(index % 2 === 0 ? 16 : -16);
      sloganOffset.y = 7 + (index === 1 ? 2 : 0);
      sloganPoint.add(sloganOffset);
      sloganNormal.copy(sloganTangent).negate();
      sloganOrientation.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        sloganNormal,
      );
      const sign = new THREE.Mesh(sloganGeometry, sloganMaterials[index]);
      sign.position.copy(sloganPoint);
      sign.quaternion.copy(sloganOrientation);
      scene.add(sign);
      return sign;
    });
    const trackMaterial = new THREE.MeshBasicMaterial({
      color: 0xb6d7d5,
      vertexColors: true,
    });
    const track = new THREE.Mesh(
      new RollerCoasterGeometry(curve, TRACK_DIVISIONS),
      trackMaterial,
    );
    scene.add(track);

    // Initialize vertex colors: assign DSFM base palette by structural zone
    const colorAttribute = track.geometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;
    const colorArray = colorAttribute.array as Float32Array;

    // Assign DSFM colors to each vertex based on zone (within each division)
    for (let div = 0; div < TRACK_DIVISIONS; div++) {
      const divBaseIndex = div * VERTICES_PER_DIVISION;

      // Ties: vertices 0-11 of this division
      for (let v = 0; v < TIES_VERTICES_PER_DIV; v++) {
        const colorIndex = (divBaseIndex + v) * 3;
        colorArray[colorIndex] = DSFM_COLORS.ties.r;
        colorArray[colorIndex + 1] = DSFM_COLORS.ties.g;
        colorArray[colorIndex + 2] = DSFM_COLORS.ties.b;
      }

      // Spine: vertices 12-41 of this division
      for (
        let v = TIES_VERTICES_PER_DIV;
        v < TIES_VERTICES_PER_DIV + SPINE_VERTICES_PER_DIV;
        v++
      ) {
        const colorIndex = (divBaseIndex + v) * 3;
        colorArray[colorIndex] = DSFM_COLORS.spine.r;
        colorArray[colorIndex + 1] = DSFM_COLORS.spine.g;
        colorArray[colorIndex + 2] = DSFM_COLORS.spine.b;
      }

      // Rails: vertices 42-113 of this division (both left and right rails)
      for (
        let v = TIES_VERTICES_PER_DIV + SPINE_VERTICES_PER_DIV;
        v < VERTICES_PER_DIVISION;
        v++
      ) {
        const colorIndex = (divBaseIndex + v) * 3;
        colorArray[colorIndex] = DSFM_COLORS.rails.r;
        colorArray[colorIndex + 1] = DSFM_COLORS.rails.g;
        colorArray[colorIndex + 2] = DSFM_COLORS.rails.b;
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
    let tunnelLightTime = 0;
    let lastTelemetry = 0;
    let animationFrame = 0;
    const renderFpsSampler = createRenderFpsSampler((renderFps) => {
      propsRef.current.onRuntimeTelemetry?.({ renderFps });
    });
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
      const snapshot = props.getLatestAudioSnapshot?.() ?? {
        energy: 0,
        smoothedEnergy: 0,
        bass: 0,
        kickPulse: 0,
      };
      const smoothedEnergy = clamp(snapshot.smoothedEnergy);

      const normalizedSmoothedEnergy = clamp(
        (smoothedEnergy - AUDIO_ENERGY_FLOOR) /
          (AUDIO_ENERGY_CEILING - AUDIO_ENERGY_FLOOR),
      );

      // Target speed interpolates between SPEED_MIN and SPEED_MAX based on normalized energy
      const targetSpeed =
        props.isPlaying && props.motionEnabled && !props.reducedMotion
          ? SPEED_MIN + normalizedSmoothedEnergy * (SPEED_MAX - SPEED_MIN)
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
      let headingChange =
        Math.atan2(tangent2.x, tangent2.z) - Math.atan2(tangent1.x, tangent1.z);
      if (headingChange > Math.PI) headingChange -= Math.PI * 2;
      if (headingChange < -Math.PI) headingChange += Math.PI * 2;
      train.up.set(0, 1, 0);
      bankQuaternion.setFromAxisAngle(
        tangent,
        -Math.atan(headingChange * 8) * 0.5,
      );
      train.up.applyQuaternion(bankQuaternion);
      train.lookAt(lookAt.copy(position).sub(tangent));

      if (props.isPlaying && props.motionEnabled && !props.reducedMotion) {
        for (const gate of gates) {
          gate.rotateZ(delta * HERO_GATE_ROTATION_SPEED);
        }
        tunnelLightTime += delta;
      }
      const activeTunnelRing = Math.floor(
        tunnelLightTime / TUNNEL_RING_STEP_SECONDS,
      ) % TUNNEL_RING_COUNT;
      for (const [ringIndex, material] of tunnelRingMaterials.entries()) {
        material.opacity = ringIndex === activeTunnelRing ? 1 : 0.18;
      }
      (stars.material as THREE.PointsMaterial).opacity =
        0.7 + smoothedEnergy * 0.16;
      if (
        props.onRuntimeTelemetry &&
        performance.now() - lastTelemetry > TELEMETRY_INTERVAL_MS
      ) {
        lastTelemetry = performance.now();
        props.onRuntimeTelemetry({
          motionTargetSpeed: targetSpeed,
          motionSpeed: rideSpeed,
          travelPosition: progress,
        });
      }
      renderer.render(scene, camera);
      renderFpsSampler.sample(performance.now());
      animationFrame = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(animationFrame);
      renderFpsSampler.dispose();
      resizeObserver.disconnect();
      scene.traverse((object) => {
        const disposable = object as THREE.Mesh;
        disposable.geometry?.dispose();
        if (Array.isArray(disposable.material))
          disposable.material.forEach((material) => material.dispose());
        else disposable.material?.dispose();
      });
      for (const material of tunnelRingMaterials) material.dispose();
      for (const texture of sloganTextures) texture?.dispose();
      for (const sign of sloganSigns) sign.removeFromParent();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div
      ref={mountRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-label="Cosmic Roller Coaster environment"
    />
  );
}

export default CosmicRollerCoasterTheme;
