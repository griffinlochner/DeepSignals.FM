import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  RUNNER, runnerRandom, runnerRegionWeight, runnerEncounter, createRunnerTraffic, sampleRunnerTraffic,
  type createRunnerJourney, type createRunnerMotion,
} from "./runnerJourney";

export function createRunnerScenery() {
  const planetGeometry = new THREE.SphereGeometry(105, 40, 24);
  const planetMaterial = new THREE.MeshStandardMaterial({
    color: 0x665747, roughness: 0.95, transparent: true, opacity: 0, fog: false,
  });
  planetMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>",
      "#include <common>\nvarying vec3 planetLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nplanetLocal = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>",
      "#include <common>\nvarying vec3 planetLocal;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float band = sin(planetLocal.y * 0.15 + sin(planetLocal.x * 0.035) * 2.0);
        diffuseColor.rgb *= 0.65 + band * 0.16;`);
  };
  const planet = new THREE.Mesh(planetGeometry, planetMaterial);
  planet.position.set(240, 125, -760);
  const ringGeometry = new THREE.RingGeometry(133, 170, 80);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x847b6c, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false, fog: false,
    forceSinglePass: true,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.copy(planet.position);
  ring.rotation.set(1.08, -0.28, 0.35);
  const cloudGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(280 * 3);
  const colors = new Float32Array(280 * 3);
  const color = new THREE.Color();
  for (let i = 0; i < 280; i += 1) {
    const t = runnerRandom(i * 5);
    positions[i * 3] = -360 + t * 700;
    positions[i * 3 + 1] = 120 + Math.sin(t * 5) * 120 + (runnerRandom(i * 5 + 1) - 0.5) * 135;
    positions[i * 3 + 2] = -650 - runnerRandom(i * 5 + 2) * 240;
    color.setHex(i % 3 === 0 ? 0x5f7986 : i % 3 === 1 ? 0x563e70 : 0x804e5c);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  cloudGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  cloudGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const cloudMaterial = new THREE.PointsMaterial({
    size: 180, vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  });
  cloudMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.a *= pow(max(0.0, 1.0 - length(gl_PointCoord - 0.5) * 2.0), 3.0);");
  };
  const cloud = new THREE.Points(cloudGeometry, cloudMaterial);

  const fuselage = new THREE.ConeGeometry(1, 1, 4).rotateZ(-Math.PI / 2).scale(19, 2.1, 4.5);
  const wings = new THREE.BoxGeometry(9, 0.6, 18).translate(-3, 0, 0);
  const engine = new THREE.BoxGeometry(8, 2, 2).translate(-5, 0, 7);
  const engine2 = engine.clone().translate(0, 0, -14);
  const shipGeometry = mergeGeometries([fuselage, wings, engine, engine2]);
  for (const geometry of [fuselage, wings, engine, engine2]) geometry.dispose();
  const shipMaterial = new THREE.MeshStandardMaterial({
    color: 0x616c72, metalness: 0.45, roughness: 0.55, transparent: true, fog: false,
  });
  const ship = new THREE.Mesh(shipGeometry, shipMaterial);
  const lampGeometry = new THREE.BoxGeometry(3, 0.4, 0.25);
  const lampMaterial = new THREE.MeshBasicMaterial({ color: 0x70eaff, transparent: true, fog: false });
  const lamps = new THREE.InstancedMesh(lampGeometry, lampMaterial, 4);
  lamps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lamps.frustumCulled = false;
  const transform = new THREE.Object3D();
  const traffic = createRunnerTraffic();
  const objects = [planet, ring, cloud, ship, lamps];
  return {
    objects, traffic, lamps,
    update(journey: ReturnType<typeof createRunnerJourney>, motion: ReturnType<typeof createRunnerMotion>, chroma: boolean) {
      let planetWeight = 0, nebulaWeight = 0;
      const current = Math.floor(journey.distance / RUNNER.regionLength);
      // Backdrop crossfades outlive the near-field slot's recycle boundary.
      for (let index = Math.max(0, current - 1); index <= current + 1; index += 1) {
        const weight = runnerRegionWeight(journey.distance, index);
        const kind = runnerEncounter(index, journey.seed);
        if (kind === "asteroid-field") planetWeight = Math.max(planetWeight, weight);
        if (kind === "signal-gates") nebulaWeight = Math.max(nebulaWeight, weight);
      }
      planet.visible = ring.visible = planetWeight > 0.001;
      planetMaterial.opacity = planetWeight;
      ringMaterial.opacity = planetWeight * 0.24;
      planetMaterial.color.setHex(chroma ? 0x716454 : 0x53545a);
      cloud.visible = nebulaWeight > 0.001;
      cloudMaterial.opacity = nebulaWeight * (chroma ? 0.13 : 0.035) * (1 + motion.surge * 0.7);
      sampleRunnerTraffic(journey.distance, traffic);
      ship.visible = lamps.visible = traffic.visible;
      ship.position.set(traffic.x, traffic.y, traffic.z);
      ship.rotation.set(0.3, 0, -0.12);
      ship.scale.setScalar(1.2);
      ship.updateMatrix();
      shipMaterial.opacity = traffic.fade;
      lampMaterial.opacity = traffic.fade * (0.7 + motion.highs * 0.3);
      lampMaterial.color.setHex(chroma ? 0x70eaff : 0x8b9caa);
      for (let i = 0; i < 4; i += 1) {
        transform.position.set(i < 2 ? -6 : -2, 0, i % 2 ? -8.15 : 8.15).applyMatrix4(ship.matrix);
        transform.rotation.copy(ship.rotation);
        transform.scale.setScalar(1.2);
        transform.updateMatrix();
        lamps.setMatrixAt(i, transform.matrix);
      }
      lamps.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      lamps.dispose();
      for (const object of objects) {
        object.geometry.dispose();
        object.material.dispose();
      }
    },
  };
}
