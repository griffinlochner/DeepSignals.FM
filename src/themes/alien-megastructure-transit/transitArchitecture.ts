import * as THREE from "three";
import { createTransitLighting, createTransitWorld, TRANSIT, type TransitBody } from "./transitWorld";
import { createTransitMotion, transitSurgeActivation } from "./transitMotion";

const SIDES = [-1, 1] as const;

export function createTransitArchitecture(world: ReturnType<typeof createTransitWorld>) {
  const bodyCount = world.encounters.reduce((count, encounter) => count + encounter.bodies.length, 0);
  const ringCount = world.encounters.filter((encounter) => encounter.kind === "ring").length;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const torus = new THREE.TorusGeometry(TRANSIT.ringRadius, TRANSIT.ringTube, 6, 64);
  const arc = new THREE.TorusGeometry(1, 0.036, 4, 16, Math.PI * 0.235);
  const arcTrim = new THREE.TorusGeometry(1, 0.004, 4, 16, Math.PI * 0.235);
  const rim = new THREE.TorusGeometry(1, 0.006, 4, 96);
  const metal = new THREE.MeshLambertMaterial({ color: 0x18282b, flatShading: true });
  const graphite = new THREE.MeshLambertMaterial({ color: 0x344449, flatShading: true });
  const neon = new THREE.MeshBasicMaterial({ toneMapped: false });
  const structures = new THREE.InstancedMesh(box, metal, bodyCount);
  const rings = new THREE.InstancedMesh(torus, graphite, ringCount);
  const machinery = new THREE.InstancedMesh(arc, graphite, ringCount * 18);
  const arcLights = new THREE.InstancedMesh(arcTrim, neon, ringCount * 18);
  const details = new THREE.InstancedMesh(box, graphite, bodyCount * 8);
  const signals = new THREE.InstancedMesh(box, neon, bodyCount * 10);
  const rims = new THREE.InstancedMesh(rim, neon, ringCount * 2);
  const meshes = [structures, rings, machinery, arcLights, details, signals, rims];
  const colors = [new THREE.Color(0x74fff0), new THREE.Color(0xb2ff86), new THREE.Color(0xff9eaa)];
  const authored = new THREE.Color(0x549e9a);
  const color = new THREE.Color();
  const transform = new THREE.Object3D();
  const relative = new THREE.Vector3();
  let signalIndex = 0;
  let detailIndex = 0;
  let clock = 0;
  let chroma = false;
  let intensity = 0.48;
  let interplay = 0;
  let bass = 0;
  let mids = 0;
  let highs = 0;
  let activation = 0;

  for (const mesh of meshes) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
  }
  for (const mesh of [signals, arcLights, rims, machinery, rings, structures]) {
    mesh.setColorAt(0, color);
    mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  }

  const paint = (
    mesh: THREE.InstancedMesh, index: number, family: number, phase: number, strength = 1,
    band: "bass" | "mids" | "highs" = "mids",
  ) => {
    const wave = Math.pow(0.5 + 0.5 * Math.sin(phase - clock * 2.2), 5);
    const response = band === "bass" ? bass : band === "mids" ? mids : highs;
    color.copy(chroma ? colors[family % 3] : authored);
    if (chroma) color.lerp(colors[(family + 1) % 3], Math.min(0.85, wave * interplay * 0.55 + activation * 0.6));
    color.multiplyScalar(strength * (intensity * (chroma ? 0.35 + wave * 0.65 + response * (0.7 + wave * 1.8) : 1)
      + activation * (chroma ? 3.2 : 1.6)));
    mesh.setColorAt(index, color);
  };

  const paintSurface = (mesh: THREE.InstancedMesh, index: number, family: number, response: number) => {
    color.setHex(0xffffff);
    if (chroma) color.lerp(colors[family % 3], 0.25 + response * 0.6 + activation * 0.15);
    color.multiplyScalar(chroma ? 0.8 + response * 1.5 + activation * 3 : 0.5 + activation * 1.8);
    mesh.setColorAt(index, color);
  };

  const bodyBox = (
    mesh: THREE.InstancedMesh, index: number, body: TransitBody,
    offsetX: number, offsetY: number, offsetZ: number,
    width: number, height: number, depth: number,
  ) => {
    const cosine = Math.cos(body.angle);
    const sine = Math.sin(body.angle);
    transform.position.set(
      body.position.x - relative.x + offsetX * cosine - offsetY * sine,
      body.position.y - relative.y + offsetX * sine + offsetY * cosine,
      body.position.z - relative.z + offsetZ,
    );
    transform.rotation.set(0, 0, body.angle);
    transform.scale.set(width, height, depth);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  };

  const signal = (
    body: TransitBody, offsetX: number, offsetY: number, offsetZ: number,
    width: number, height: number, depth: number, family: number, phase: number, strength = 1,
    band: "bass" | "mids" | "highs" = "mids",
  ) => {
    bodyBox(signals, signalIndex, body, offsetX, offsetY, offsetZ, width, height, depth);
    paint(signals, signalIndex++, family, phase, strength, band);
  };

  const update = (
    center: THREE.Vector3, lighting: ReturnType<typeof createTransitLighting>, chromaEnabled: boolean,
    motion?: ReturnType<typeof createTransitMotion>,
  ) => {
    relative.copy(center);
    clock = world.animationSeconds;
    chroma = chromaEnabled;
    intensity = lighting.intensity;
    interplay = lighting.interplay;
    bass = lighting.bass;
    mids = lighting.mids;
    highs = lighting.highs;
    metal.color.setHex(chroma ? 0x233c3d : 0x142426);
    graphite.color.setHex(chroma ? 0x446069 : 0x243237);
    signalIndex = 0;
    detailIndex = 0;
    let bodyIndex = 0;
    let ringIndex = 0;
    let arcIndex = 0;
    let rimIndex = 0;
    for (const encounter of world.encounters) {
      const encounterPhase = encounter.distance * 0.002;
      activation = motion ? transitSurgeActivation(encounter.distance - motion.surgeOrigin,
        motion.elapsedMs - motion.surgeStartedAt, motion.surgeEnvelope) : 0;
      for (let index = 0; index < encounter.bodies.length; index += 1) {
        const body = encounter.bodies[index];
        const family = index % 3;
        const phase = encounterPhase + index * 0.8;
        const front = body.size.z / 2 + 3;
        bodyBox(structures, bodyIndex, body, 0, 0, 0, body.size.x, body.size.y, body.size.z);
        paintSurface(structures, bodyIndex++, family, bass * 0.35);
        if (encounter.kind === "ring") {
          for (const side of SIDES) {
            bodyBox(details, detailIndex++, body, 0, side * 54, 0, 270, 18, body.size.z + 20);
            signal(body, 0, side * 54, front + 12, 230, 8, 8, family, phase);
          }
          signal(body, 80, 0, front, 18, 76, 8, 1, phase, 1.2, "highs");
          for (let rib = 0; rib < 3; rib += 1) {
            bodyBox(details, detailIndex++, body, -75 + rib * 55, 0, front, 14, 90, 16);
          }
        } else if (encounter.kind === "pylons") {
          for (const side of SIDES) {
            bodyBox(details, detailIndex++, body, side * 99, 0, 0, 38, body.size.y + 80, body.size.z + 36);
            signal(body, side * 77, 0, front + 20, 10, body.size.y * 0.94, 9, side < 0 ? 1 : 0, phase, 0.85, "bass");
            signal(body, side * 119, 0, 0, 7, body.size.y * 0.85, body.size.z * 0.65, family, phase, 0.5, "bass");
          }
          for (let rib = 0; rib < 5; rib += 1) {
            const height = (rib - 2) * body.size.y / 5.7;
            bodyBox(details, detailIndex++, body, 0, height, front, 155, 58, 32);
            signal(body, 0, height + 21, front + 18, 130, 7, 6, family, phase + rib * 1.1, 0.7, "highs");
          }
          const packet = ((clock * 0.035 + index * 0.17) % 1 - 0.5) * body.size.y * 0.84;
          signal(body, 0, packet, front + 20, 28, 100, 9, 2, phase, chroma ? 1.5 : 0.25);
          bodyBox(details, detailIndex++, body, 0, body.size.y * 0.37, -30, 130, body.size.y * 0.38, 330);
        } else {
          for (const side of SIDES) {
            bodyBox(details, detailIndex++, body, 0, -body.size.y / 2 - 15, side * 100, body.size.x * 0.96, 26, 25);
            signal(body, 0, -body.size.y / 2 - 30, side * 100, body.size.x * 0.95, 8, 12, side < 0 ? 2 : 0, phase);
          }
          for (let rib = 0; rib < 5; rib += 1) {
            const offset = (rib - 2) * body.size.x / 5.5;
            const suspension = -body.size.y / 2 - 50 + Math.sin(clock * 0.16 + rib + index) * 12;
            bodyBox(details, detailIndex++, body, offset, suspension, 0, 70, 30, 245);
            signal(body, offset, suspension - 17, 0, 46, 6, 210, family, phase + rib, 0.85, "highs");
          }
          const packet = ((clock * 0.04 + index * 0.21) % 1 - 0.5) * body.size.x * 0.9;
          signal(body, packet, -body.size.y / 2 - 4, 0, 150, 6, 34, 1, phase, chroma ? 1.4 : 0.2);
        }
      }
      if (encounter.kind !== "ring") continue;
      transform.position.copy(encounter.center).sub(center);
      transform.scale.set(1, 1, TRANSIT.ringDepthScale);
      transform.rotation.set(0, 0, clock * 0.018);
      transform.updateMatrix();
      rings.setMatrixAt(ringIndex, transform.matrix);
      paintSurface(rings, ringIndex++, 0, bass);
      for (const side of SIDES) {
        transform.position.copy(encounter.center).sub(center);
        transform.position.z += side * 180;
        transform.scale.set(822, 822, 822);
        transform.rotation.set(0, 0, 0);
        transform.updateMatrix();
        rims.setMatrixAt(rimIndex, transform.matrix);
        paint(rims, rimIndex++, side < 0 ? 2 : 0, encounterPhase, 1.1, "bass");
      }
      for (let layer = 0; layer < 3; layer += 1) {
        const radius = 990 + layer * 175;
        const turning = clock * (layer === 1 ? -0.035 : 0.025) + layer * 0.48 + encounterPhase;
        for (let segment = 0; segment < 6; segment += 1) {
          transform.position.copy(encounter.center).sub(center);
          transform.position.z += (layer - 1) * 240;
          transform.scale.set(radius, radius, 1800);
          transform.rotation.set(0, 0, turning + segment * Math.PI / 3);
          transform.updateMatrix();
          machinery.setMatrixAt(arcIndex, transform.matrix);
          paintSurface(machinery, arcIndex, layer, mids * (0.5 + 0.5 * Math.sin(segment * 1.1 - clock * 2.2)));
          transform.position.z += 67;
          transform.scale.z = radius;
          transform.updateMatrix();
          arcLights.setMatrixAt(arcIndex, transform.matrix);
          paint(arcLights, arcIndex++, layer, segment * 0.9 + encounterPhase, 1.2);
        }
      }
    }
    structures.count = bodyIndex;
    rings.count = ringIndex;
    machinery.count = arcIndex;
    arcLights.count = arcIndex;
    details.count = detailIndex;
    signals.count = signalIndex;
    rims.count = rimIndex;
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };

  return {
    meshes,
    update,
    dispose: () => {
      for (const mesh of meshes) mesh.dispose();
      for (const geometry of [box, torus, arc, arcTrim, rim]) geometry.dispose();
      for (const material of [metal, graphite, neon]) material.dispose();
    },
  };
}