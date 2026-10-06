import * as THREE from "three";
import {
  RUNNER, runnerGateActivation, runnerPathX, runnerPathY, runnerUnit,
  type createRunnerJourney, type createRunnerMotion,
} from "./runnerJourney";

export function createRunnerGateSpace() {
  // Only one gate region can overlap the visible range, including a sleeve's trailing frame.
  const capacity = RUNNER.gatesPerRegion;
  const geometries = [
    new THREE.TorusGeometry(15.5, 2.2, 6, 6, Math.PI * 2 / 16 * 0.87),
    new THREE.TorusGeometry(13.5, 0.55, 6, 64),
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.TorusGeometry(1, 0.012, 4, 24, Math.PI * 0.44),
    new THREE.PlaneGeometry(2, 2),
  ];
  const shell = new THREE.MeshStandardMaterial({ metalness: 0.6, roughness: 0.62 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x76818a, metalness: 0.7, roughness: 0.4 });
  const light = new THREE.MeshBasicMaterial();
  const arc = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const membrane = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
    blending: THREE.AdditiveBlending,
    uniforms: { clock: { value: 0 }, activity: { value: 0 }, kick: { value: 0 } },
    vertexShader: `
      varying vec2 aperture;
      varying vec3 tint;
      void main() {
        aperture = uv * 2.0 - 1.0;
        tint = instanceColor;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float clock;
      uniform float activity;
      uniform float kick;
      varying vec2 aperture;
      varying vec3 tint;
      void main() {
        float radius = length(aperture);
        float edge = smoothstep(0.38, 0.88, radius);
        float fade = 1.0 - smoothstep(0.9, 1.0, radius);
        float band = pow(0.5 + 0.5 * sin(radius * 24.0 - clock * 0.7), 8.0) * edge;
        float sweep = pow(0.5 + 0.5 * cos(aperture.x * 3.0 + aperture.y * 1.8 - clock * 0.8), 10.0);
        float alpha = (0.012 + edge * 0.065 + band * 0.024 + sweep * 0.018)
          * fade * (0.65 + activity * 0.2 + kick * 0.15);
        gl_FragColor = vec4(tint, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const materials = [shell, trim, light, arc, membrane];
  const gates = new THREE.InstancedMesh(geometries[0], shell, capacity * 32);
  const trims = new THREE.InstancedMesh(geometries[1], trim, capacity * 5);
  const pylons = new THREE.InstancedMesh(geometries[2], shell, capacity * 24);
  const panels = new THREE.InstancedMesh(geometries[2], light, capacity * 56);
  const arcs = new THREE.InstancedMesh(geometries[3], arc, capacity * 15);
  const membranes = new THREE.InstancedMesh(geometries[4], membrane, capacity);
  const meshes = [gates, trims, pylons, panels, arcs, membranes];
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [new THREE.Color(0x55dfff), new THREE.Color(0xa8ffd0), new THREE.Color(0xc99aff)];
  const cool = new THREE.Color(0x709aa9);
  for (const mesh of meshes) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.setColorAt(0, color);
  }
  const instance = (mesh: THREE.InstancedMesh) => {
    transform.updateMatrix();
    mesh.setMatrixAt(mesh.count, transform.matrix);
    mesh.setColorAt(mesh.count++, color);
  };
  const paint = (accent: number, brightness: number, chroma: boolean) => {
    color.copy(chroma ? palette[accent] : cool).multiplyScalar(brightness * (chroma ? 1 : 0.32));
  };

  return {
    gates, trims, pylons, panels, arcs, membranes, meshes,
    update(journey: ReturnType<typeof createRunnerJourney>, motion: ReturnType<typeof createRunnerMotion>, chroma: boolean) {
      for (const mesh of meshes) mesh.count = 0;
      const time = motion.animationSeconds;
      membrane.uniforms.clock.value = time;
      membrane.uniforms.activity.value = chroma ? motion.gateActivity : 0;
      membrane.uniforms.kick.value = chroma ? motion.gateKick : 0;
      for (const region of journey.regions) {
        if (region.kind !== "signal-gates") continue;
        for (const gate of region.gates) {
          const ahead = gate.distance - journey.distance;
          if (!gate.active || ahead < -gate.depth - 20 || ahead > RUNNER.far) continue;
          const x = runnerPathX(gate.distance, journey.seed);
          const y = runnerPathY(gate.distance, journey.seed);
          const scale = gate.radius / RUNNER.gateRadius;
          const sleeve = gate.family === "sleeve";
          const portal = gate.family === "portal";
          const approach = runnerUnit(1 - Math.abs(ahead - 18) / 230);
          const activation = runnerGateActivation(ahead, motion.elapsedMs - motion.surgeStartedAt, motion.surge);
          const fade = runnerUnit((RUNNER.far - ahead) / 65);
          const breathing = 0.5 + Math.sin(time * 1.3 + gate.phase) * 0.5;
          const music = chroma ? motion.gateActivity * (0.08 + breathing * 0.08) + motion.gateKick * 0.24 : 0;
          const glow = (0.22 + approach * 0.48 + music) * fade;
          for (let frame = 0; frame < (sleeve ? 2 : 1); frame += 1) {
            for (let segment = 0; segment < 16; segment += 1) {
              const angle = segment * Math.PI / 8 + gate.phase + frame * Math.PI / 16;
              const lobe = !portal && segment % 4 === 0 ? 1.1 : 1;
              transform.position.set(x, y, -ahead - frame * gate.depth);
              transform.rotation.set(0, 0, angle);
              transform.scale.set(scale * lobe, scale * lobe, gate.thickness * (portal ? 1.1 : 2.5));
              color.setHex(segment % 2 ? 0x48515c : 0x72767b);
              instance(gates);
            }
          }
          const frames = sleeve ? 5 : 2;
          for (let rim = 0; rim < frames; rim += 1) {
            const depth = sleeve ? rim * gate.depth / (frames - 1) : (rim ? -3.4 : 3.4) * gate.thickness;
            transform.position.set(x, y, -ahead - depth);
            transform.rotation.set(0, 0, gate.phase);
            transform.scale.set(scale, scale, sleeve ? 1.5 : gate.thickness * 1.6);
            color.setHex(0x69717a);
            instance(trims);
            if (!sleeve && rim === 1) continue;
            for (let segment = 0; segment < (sleeve ? 8 : 16); segment += 1) {
              const angle = segment * Math.PI / (sleeve ? 4 : 8) + gate.phase + rim * 0.16;
              const radius = 14.4 * scale;
              transform.position.set(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius,
                -ahead - depth + 0.9);
              transform.rotation.z = angle;
              transform.scale.set(0.6 * scale, (sleeve ? 2.1 : 1.5) * scale, 0.2);
              const sequence = runnerUnit(activation * 1.7 - segment / 20);
              paint(gate.accent, (0.12 + sequence * (0.9 + motion.mids * 0.5) + motion.surge + music) * fade, chroma);
              instance(panels);
            }
          }
          const pylonCount = portal ? 4 : 8;
          for (let pylon = 0; pylon < pylonCount; pylon += 1) {
            const angle = pylon * Math.PI * 2 / pylonCount + gate.phase;
            for (let part = 0; part < 3; part += 1) {
              const radius = (part === 0 ? 17.6 : part === 1 ? 20 : 22) * scale;
              transform.position.set(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius,
                -ahead - (sleeve && part === 0 ? gate.depth / 2 : 0));
              transform.rotation.set(0, 0, angle);
              transform.scale.set((part === 2 ? (portal ? 2.5 : 5) : 1.6) * scale,
                (part === 2 ? 0.18 : 0.7) * scale, part === 0 ? (sleeve ? gate.depth : 11 * gate.thickness) : 2);
              color.setHex(part === 0 ? 0x81868b : 0x454b51);
              instance(pylons);
            }
          }
          for (let layer = 0; layer < (sleeve ? 5 : portal ? 2 : 1); layer += 1) {
            const radius = gate.radius * (sleeve ? 0.97 : 0.93 - layer * 0.075)
              * (1 + Math.sin(time * 0.8 + gate.phase + layer) * 0.008);
            const depth = sleeve ? layer * gate.depth / 4 : -2 - layer * 1.8;
            for (let fragment = 0; fragment < 3; fragment += 1) {
              transform.position.set(x, y, -ahead - depth);
              transform.rotation.set(0, 0, gate.phase + fragment * Math.PI * 2 / 3 + layer * 0.42
                + time * (layer % 2 ? -0.09 : 0.07));
              transform.scale.set(radius, radius, 0.65);
              paint((gate.accent + layer % 2) % 3, glow * (layer ? 0.8 : 1.2), chroma);
              instance(arcs);
            }
          }
          if (portal) {
            transform.position.set(x, y, -ahead - 0.5);
            transform.rotation.set(0, 0, gate.phase);
            transform.scale.set(gate.radius * 0.94, gate.radius * 0.94, 1);
            // Fade before crossing so the aperture never becomes a full-screen flash.
            paint(gate.accent, (0.45 + approach * 0.4) * fade * runnerUnit((ahead - 8) / 24), chroma);
            instance(membranes);
          }
        }
      }
      for (const mesh of meshes) {
        mesh.visible = mesh.count > 0;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of meshes) mesh.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
