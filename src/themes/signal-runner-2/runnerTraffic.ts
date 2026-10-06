import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  RUNNER, runnerRandom, createRunnerTraffic, sampleRunnerTraffic,
  type createRunnerJourney, type createRunnerMotion,
} from "./runnerJourney";

export function createRunnerTrafficSpace() {
  const parts = [
    new THREE.ConeGeometry(1, 1, 4).rotateZ(-Math.PI / 2).scale(23, 2.2, 3.6),
    new THREE.BoxGeometry(11, 1.8, 3.4).translate(-2, 0.7, 0),
    new THREE.ConeGeometry(1, 1, 4).rotateZ(-Math.PI / 2).scale(9, 1.2, 2).translate(2, 2, 0),
    new THREE.ConeGeometry(1, 1, 3).rotateZ(-Math.PI / 2).scale(12, 0.65, 19).translate(-3, 0, 0),
    new THREE.BoxGeometry(10, 2.5, 2.6).translate(-6, -0.2, 6.5),
    new THREE.BoxGeometry(10, 2.5, 2.6).translate(-6, -0.2, -6.5),
    new THREE.BoxGeometry(5, 3.4, 0.5).rotateZ(-0.35).translate(-7, 1.6, 0),
  ];
  const color = new THREE.Color();
  parts.forEach((geometry, index) => {
    color.setHex(index === 2 ? 0x152e3d : index >= 4 ? 0x49565e : 0x76868d);
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  });
  const shipGeometry = mergeGeometries(parts);
  for (const geometry of parts) geometry.dispose();
  const shipMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.45, roughness: 0.55, transparent: true, fog: false,
  });
  const ship = new THREE.Mesh(shipGeometry, shipMaterial);
  const lampGeometry = new THREE.BoxGeometry(1, 1, 1);
  const lampMaterial = new THREE.MeshBasicMaterial({ transparent: true, fog: false });
  const lamps = new THREE.InstancedMesh(lampGeometry, lampMaterial, 6);
  const plumeGeometry = new THREE.ConeGeometry(1, 1, 10, 1, true).rotateZ(Math.PI / 2).translate(-0.5, 0, 0);
  const plumeMaterial = new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, forceSinglePass: true, fog: false,
  });
  const plumes = new THREE.InstancedMesh(plumeGeometry, plumeMaterial, 2);
  const instanced = [lamps, plumes];
  for (const mesh of instanced) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.setColorAt(0, color);
  }

  const positions = new Float32Array(RUNNER.exhaustCount * 3);
  const colors = new Float32Array(RUNNER.exhaustCount * 3);
  const sizes = new Float32Array(RUNNER.exhaustCount);
  const exhaustGeometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const tint = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);
  const size = new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage);
  exhaustGeometry.setAttribute("position", position);
  exhaustGeometry.setAttribute("color", tint);
  exhaustGeometry.setAttribute("exhaustSize", size);
  const exhaustMaterial = new THREE.PointsMaterial({
    size: 7, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  });
  exhaustMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>",
      "#include <common>\nattribute float exhaustSize;")
      .replace("gl_PointSize = size;", "gl_PointSize = size * exhaustSize;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.a *= pow(max(0.0, 1.0 - length(gl_PointCoord - 0.5) * 2.0), 2.0);");
  };
  const exhaust = new THREE.Points(exhaustGeometry, exhaustMaterial);
  exhaust.frustumCulled = false;
  const transform = new THREE.Object3D();
  const point = new THREE.Vector3();
  const forward = new THREE.Vector3(1, 0, 0);
  const direction = new THREE.Vector3();
  const bank = new THREE.Quaternion();
  const palette = [new THREE.Color(0x55eeff), new THREE.Color(0xc0ff63), new THREE.Color(0xff897f)];
  const cool = new THREE.Color(0x8babbc);
  const traffic = createRunnerTraffic();
  const objects = [ship, lamps, plumes, exhaust];
  const paint = (phase: number, chroma: boolean, brightness: number) => {
    const cycle = ((phase % 3) + 3) % 3;
    const index = Math.floor(cycle);
    if (chroma) color.copy(palette[index]).lerp(palette[(index + 1) % 3], cycle - index);
    else color.copy(cool);
    color.multiplyScalar(brightness);
  };
  return {
    objects, traffic, ship, lamps, plumes, exhaust,
    update(journey: ReturnType<typeof createRunnerJourney>, motion: ReturnType<typeof createRunnerMotion>, chroma: boolean) {
      sampleRunnerTraffic(journey.distance, traffic, journey.seed);
      for (const object of objects) object.visible = traffic.visible;
      if (!traffic.visible) return;
      ship.position.set(traffic.x, traffic.y, traffic.z);
      direction.set(traffic.dx, traffic.dy, traffic.dz).normalize();
      ship.quaternion.setFromUnitVectors(forward, direction)
        .multiply(bank.setFromAxisAngle(forward, traffic.bank));
      ship.scale.setScalar(1.2);
      ship.updateMatrix();
      shipMaterial.opacity = traffic.fade;
      const clock = motion.animationSeconds;
      const power = 0.85 + motion.highs * 0.25 + motion.surge * 0.45;
      lampMaterial.opacity = plumeMaterial.opacity = exhaustMaterial.opacity = traffic.fade;
      for (let i = 0; i < lamps.count; i += 1) {
        const engine = i < 2;
        transform.position.set(engine ? -11.1 : i < 4 ? -5 : 4, engine ? -0.2 : 1.1,
          (i % 2 ? -1 : 1) * (engine ? 6.5 : i < 4 ? 7.85 : 2.2));
        transform.rotation.set(0, 0, 0);
        transform.scale.set(engine ? 0.22 : 2.5, engine ? 1.5 : 0.18, engine ? 1.7 : 0.25);
        transform.updateMatrix();
        transform.matrix.premultiply(ship.matrix);
        lamps.setMatrixAt(i, transform.matrix);
        paint(clock * 0.3 + i * 0.4, chroma, engine ? 2.2 * power : 0.85);
        lamps.setColorAt(i, color);
      }
      for (let i = 0; i < plumes.count; i += 1) {
        transform.position.set(-11.3, -0.2, i ? -6.5 : 6.5);
        transform.rotation.set(0, 0, 0);
        transform.scale.set(9 + power * 4 + Math.sin(clock * 18 + i) * 0.8, 0.85, 0.95);
        transform.updateMatrix();
        transform.matrix.premultiply(ship.matrix);
        plumes.setMatrixAt(i, transform.matrix);
        paint(clock * 0.3 + i * 0.4, chroma, 0.6 * power);
        plumes.setColorAt(i, color);
      }
      // Analytic lifetimes reuse fixed slots: no emitter, history queue, or wall-clock animation.
      for (let i = 0; i < RUNNER.exhaustCount; i += 1) {
        const age = (i / RUNNER.exhaustCount + clock * 0.8) % 1;
        const spread = 0.3 + age * 3.8;
        const angle = runnerRandom(i * 3) * Math.PI * 2 + clock * 1.4;
        point.set(-12 - age * 48, -0.2 + Math.sin(angle) * spread,
          (i % 2 ? -6.5 : 6.5) + Math.cos(angle) * spread).applyMatrix4(ship.matrix);
        point.toArray(positions, i * 3);
        const fade = (1 - age) ** 2;
        paint(clock * 0.3 + age * 2 + (i % 2) * 0.4, chroma, fade * power * (i % 5 === 0 ? 2 : 0.75));
        color.toArray(colors, i * 3);
        sizes[i] = i % 5 === 0 ? 0.18 : 0.6 + age * 1.3;
      }
      position.needsUpdate = tint.needsUpdate = size.needsUpdate = true;
      for (const mesh of instanced) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      lamps.dispose();
      plumes.dispose();
      for (const object of objects) {
        object.geometry.dispose();
        object.material.dispose();
      }
    },
  };
}
