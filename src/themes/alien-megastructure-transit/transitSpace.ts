import * as THREE from "three";
import { createTransitLighting, createTransitWorld, sampleTransitPath } from "./transitWorld";
import { createTransitMotion } from "./transitMotion";

export const TRANSIT_STAR_CLASSES = [
  { count: 800, size: 1, brightness: 0.32, bandCount: 480 },
  { count: 86, size: 1.8, brightness: 0.58, bandCount: 0 },
  { count: 14, size: 3, brightness: 0.85, bandCount: 0 },
] as const;

export function generateTransitStars(seed = 0x5df031) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const tilt = 0.55;
  return TRANSIT_STAR_CLASSES.map(({ count, size, brightness, bandCount }) => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const inBand = index < bandCount;
      let angle = random() * Math.PI * 2;
      angle += inBand ? Math.sin(angle * 3) * 0.18 : 0;
      const width = 0.045 + (0.5 + 0.5 * Math.sin(angle * 3)) * 0.065;
      const vertical = inBand
        ? THREE.MathUtils.clamp(Math.sqrt(-2 * Math.log(Math.max(random(), 0.000001)))
          * Math.cos(random() * Math.PI * 2) * width + Math.sin(angle * 2) * 0.035, -0.4, 0.4)
        : random() * 2 - 1;
      const radial = Math.sqrt(1 - vertical * vertical);
      const distance = 8500 + random() * 1500;
      const horizontal = Math.cos(angle) * radial;
      positions[index * 3] = (horizontal * Math.cos(tilt) - vertical * Math.sin(tilt)) * distance;
      positions[index * 3 + 1] = (horizontal * Math.sin(tilt) + vertical * Math.cos(tilt)) * distance;
      positions[index * 3 + 2] = Math.sin(angle) * radial * distance;
      const luminance = brightness * (0.3 + random() * 0.7) * (inBand ? 0.65 : 1);
      colors[index * 3] = luminance * (0.88 + random() * 0.12);
      colors[index * 3 + 1] = luminance;
      colors[index * 3 + 2] = luminance * (0.88 + random() * 0.12);
    }
    return { positions, colors, size, count };
  });
}

export function createTransitSpace() {
  const stars = generateTransitStars().map((batch) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(batch.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(batch.colors, 3));
    const material = new THREE.PointsMaterial({
      vertexColors: true, size: batch.size, sizeAttenuation: false, fog: false, toneMapped: false,
    });
    return new THREE.Points(geometry, material);
  });
  const waveGeometry = new THREE.TorusGeometry(1, 0.009, 4, 96);
  const waveMaterial = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
  });
  const waves = new THREE.InstancedMesh(waveGeometry, waveMaterial, 3);
  waves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  waves.frustumCulled = false;
  const streakGeometry = new THREE.BoxGeometry(1, 1, 1);
  const streakMaterial = new THREE.MeshBasicMaterial({
    color: 0x74fff0, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  });
  const streaks = new THREE.InstancedMesh(streakGeometry, streakMaterial, 24);
  streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  streaks.frustumCulled = false;
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const black = new THREE.Color(0x030405);
  const teal = new THREE.Color(0x063b3a);
  const violet = new THREE.Color(0x261337);
  const cyan = new THREE.Color(0x74fff0);
  const green = new THREE.Color(0xb2ff86);
  const salmon = new THREE.Color(0xff9eaa);
  const background = black.clone();
  waves.setColorAt(0, cyan);
  waves.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  const objects = [...stars, waves, streaks];

  const update = (
    world: ReturnType<typeof createTransitWorld>, motion: ReturnType<typeof createTransitMotion>,
    lighting: ReturnType<typeof createTransitLighting>, chroma: boolean, center: THREE.Vector3,
  ) => {
    const surge = motion.surgeEnvelope;
    const ageSeconds = (motion.elapsedMs - motion.surgeStartedAt) / 1000;
    background.copy(black);
    if (surge > 0) {
      color.copy(teal).lerp(violet, chroma ? Math.min(1, ageSeconds / 3) : 0);
      background.lerp(color, surge * (chroma ? 0.85 : 0.4));
    }
    for (let index = 0; index < stars.length; index += 1) {
      const star = stars[index];
      star.material.color.setHex(0xffffff);
      if (chroma && index === 2) star.material.color.lerp(cyan, lighting.highs * 0.3);
      star.material.color.multiplyScalar(1 + surge * 0.5 + (chroma && index === 2 ? lighting.highs * 0.35 : 0));
    }
    waves.visible = surge > 0;
    streaks.visible = surge > 0;
    waveMaterial.opacity = surge * (chroma ? 0.72 : 0.38);
    streakMaterial.opacity = surge * (chroma ? 0.35 : 0.16);
    if (surge <= 0) return;
    for (let index = 0; index < 3; index += 1) {
      const distance = motion.surgeOrigin + 7200 + index * 1050 - ageSeconds * 2300;
      sampleTransitPath(distance, transform.position).sub(center);
      transform.rotation.set(0, 0, index * 0.4);
      transform.scale.setScalar(1100 + index * 140);
      transform.updateMatrix();
      waves.setMatrixAt(index, transform.matrix);
      waves.setColorAt(index, chroma ? index === 0 ? cyan : index === 1 ? green : salmon : cyan);
    }
    for (let index = 0; index < 24; index += 1) {
      const phase = index * 2.399963;
      const distance = world.distance + 3500 - ((index * 173 + ageSeconds * 2600) % 4400);
      sampleTransitPath(distance, transform.position).sub(center);
      const radius = 650 + index % 5 * 190;
      transform.position.x += Math.cos(phase) * radius;
      transform.position.y += Math.sin(phase) * radius;
      transform.scale.set(2, 2, 90 + surge * 250);
      transform.rotation.set(0, 0, 0);
      transform.updateMatrix();
      streaks.setMatrixAt(index, transform.matrix);
    }
    waves.instanceMatrix.needsUpdate = true;
    waves.instanceColor!.needsUpdate = true;
    streaks.instanceMatrix.needsUpdate = true;
  };
  return {
    objects, background, update,
    dispose: () => {
      for (const star of stars) { star.geometry.dispose(); star.material.dispose(); }
      waves.dispose();
      streaks.dispose();
      waveGeometry.dispose();
      waveMaterial.dispose();
      streakGeometry.dispose();
      streakMaterial.dispose();
    },
  };
}