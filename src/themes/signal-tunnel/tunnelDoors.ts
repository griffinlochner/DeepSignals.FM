import * as THREE from "three";
import { tunnelDoorOpening, TUNNEL } from "./tunnelPath";

export const TUNNEL_DOORS = [
  { id: "iris", color: 0xb2ff86, apertureScale: 0.84, maxAperture: 6.25, leaves: 8 },
  { id: "split", color: 0x74fff0, apertureScale: 0.92, maxAperture: 6.8, leaves: 2 },
  { id: "bay", color: 0xff9eaa, apertureScale: 0.98, maxAperture: 9, leaves: 6 },
] as const;

export function tunnelDoorVariant(distance: number) {
  const encounter = Math.floor(distance / TUNNEL.sectionLength);
  return TUNNEL_DOORS[((encounter % TUNNEL_DOORS.length) + TUNNEL_DOORS.length) % TUNNEL_DOORS.length];
}

export function tunnelDoorLayout(distance: number, radius: number) {
  const variant = tunnelDoorVariant(distance);
  const aperture = Math.min(radius * variant.apertureScale, variant.maxAperture);
  return {
    variant,
    aperture,
    pocketRadius: radius * 1.1,
    outerRadius: radius * 1.14,
  };
}

export function tunnelDoorLeafOpening(distanceAhead: number, leaf: number, variant: typeof TUNNEL_DOORS[number]) {
  const opening = tunnelDoorOpening(distanceAhead);
  const delay = variant.id === "bay" ? Math.floor(leaf / 2) * 0.12 : 0;
  return Math.min(1, Math.max(0, (opening - delay) / (1 - delay)));
}

export function tunnelDoorLeafClearance(distanceAhead: number, leaf: number, layout: ReturnType<typeof tunnelDoorLayout>) {
  return tunnelDoorLeafOpening(distanceAhead, leaf, layout.variant) * (layout.aperture + 0.4);
}

export function createTunnelDoors() {
  const group = new THREE.Group();
  group.name = "Signal Tunnel gateway";
  const pocket = { value: 1 };
  const clipToPocket = (material: THREE.MeshBasicMaterial) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.doorPocketRadius = pocket;
      shader.vertexShader = `varying vec2 doorLocalPosition;\n${shader.vertexShader}`
        .replace("#include <project_vertex>", "doorLocalPosition = (instanceMatrix * vec4(transformed, 1.0)).xy;\n#include <project_vertex>");
      shader.fragmentShader = `varying vec2 doorLocalPosition;\nuniform float doorPocketRadius;\n${shader.fragmentShader}`
        .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (length(doorLocalPosition) > doorPocketRadius) discard;");
    };
    material.customProgramCacheKey = () => "signal-tunnel-door-pocket-v1";
    return material;
  };
  const structureMaterial = new THREE.MeshBasicMaterial();
  const leafMaterial = clipToPocket(new THREE.MeshBasicMaterial());
  const leafLightMaterial = clipToPocket(new THREE.MeshBasicMaterial());
  const accentMaterial = new THREE.MeshBasicMaterial();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  bladeShape.lineTo(1, -1);
  bladeShape.lineTo(1, 1);
  bladeShape.closePath();
  const blade = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.5, bevelEnabled: false });
  blade.translate(0, 0, -0.25);
  const housings = TUNNEL_DOORS.map((variant) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 1.14, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, variant.apertureScale, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.24, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, steps: 1, curveSegments: 24,
    });
    geometry.translate(0, 0, -0.12);
    return geometry;
  });
  const housingPositions = housings.map((geometry) => geometry.getAttribute("position").array.slice());
  const housing = new THREE.Mesh(housings[0], structureMaterial);
  const iris = new THREE.InstancedMesh(blade, leafMaterial, 8);
  const shutters = new THREE.InstancedMesh(box, leafMaterial, 6);
  const leafLights = new THREE.InstancedMesh(box, leafLightMaterial, 8);
  const accents = new THREE.InstancedMesh(box, accentMaterial, 24);
  const hardware = new THREE.InstancedMesh(box, structureMaterial, 12);
  const meshes = [iris, shutters, leafLights, accents, hardware];
  const white = new THREE.Color(0xffffff);
  for (const mesh of meshes) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.setColorAt(0, white);
    group.add(mesh);
  }
  group.add(housing);
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const base = new THREE.Color(0x25333b);
  const accent = new THREE.Color();
  const secondary = new THREE.Color();
  let encounter = NaN;
  let layout = tunnelDoorLayout(112, TUNNEL.radius);
  const place = (mesh: THREE.InstancedMesh, instance: number, horizontal: number, vertical: number, depth: number,
    width: number, height: number, thickness: number, rotation = 0) => {
    transform.position.set(horizontal, vertical, depth);
    transform.rotation.set(0, 0, rotation);
    transform.scale.set(width, height, thickness);
    transform.updateMatrix();
    mesh.setMatrixAt(instance, transform.matrix);
    mesh.setColorAt(instance, color);
  };

  return {
    group, meshes, housing, pocket,
    update(distance: number, radius: number, ahead: number, time: number, energy: number, chroma: boolean, surge: number) {
      if (encounter !== distance) {
        encounter = distance;
        layout = tunnelDoorLayout(distance, radius);
        const index = TUNNEL_DOORS.indexOf(layout.variant);
        housing.geometry = housings[index];
        housing.scale.setScalar(radius);
        const positions = housing.geometry.getAttribute("position");
        const original = housingPositions[index];
        for (let vertex = 0; vertex < positions.count; vertex += 1) {
          const horizontal = original[vertex * 3];
          const vertical = original[vertex * 3 + 1];
          const radial = Math.hypot(horizontal, vertical);
          if (radial < 1.07) {
            const scale = (layout.aperture / radius + radial - layout.variant.apertureScale) / radial;
            positions.setXY(vertex, horizontal * scale, vertical * scale);
          }
        }
        positions.needsUpdate = true;
        pocket.value = layout.pocketRadius;
      }
      const { variant, aperture } = layout;
      const opening = tunnelDoorOpening(ahead);
      const approach = Math.max(0, 1 - Math.abs(ahead - 42) / 100);
      accent.setHex(variant.color);
      secondary.setHex(TUNNEL_DOORS[(TUNNEL_DOORS.indexOf(variant) + 1) % 3].color);
      if (!chroma) accent.lerp(base, 0.65);
      const pulse = chroma ? energy * approach * (0.5 + 0.5 * Math.sin(time * 3.2)) : 0;
      structureMaterial.color.copy(base).lerp(accent, chroma ? 0.035 + surge * 0.15 : 0.015).multiplyScalar(chroma ? 1.3 : 0.7);
      iris.count = variant.id === "iris" ? variant.leaves : 0;
      shutters.count = variant.id === "iris" ? 0 : variant.leaves;
      leafLights.count = variant.leaves;
      const face = radius * 0.14;
      for (let leaf = 0; leaf < variant.leaves; leaf += 1) {
        const progress = tunnelDoorLeafOpening(ahead, leaf, variant);
        const clearance = tunnelDoorLeafClearance(ahead, leaf, layout);
        color.copy(base).lerp(accent, chroma ? 0.06 + surge * 0.1 : 0.025).multiplyScalar(leaf % 2 ? 1.15 : 0.8);
        if (variant.id === "iris") {
          const angle = leaf * Math.PI / 4 + progress * 0.32;
          const horizontal = Math.cos(angle) * clearance;
          const vertical = Math.sin(angle) * clearance;
          const length = layout.pocketRadius + 0.5;
          place(iris, leaf, horizontal, vertical, -leaf * 0.06, length, length, 0.08, angle);
          color.copy(accent).multiplyScalar(chroma ? 0.5 + pulse * 0.35 + surge : 0.22);
          const seam = angle + Math.PI / 4;
          place(leafLights, leaf, horizontal + Math.cos(seam) * length / 2, vertical + Math.sin(seam) * length / 2,
            0.035 - leaf * 0.06, length, 0.045, 0.025, seam);
        } else {
          const side = leaf % 2 ? 1 : -1;
          const row = Math.floor(leaf / 2);
          const height = variant.id === "bay" ? aperture * 2 / 3 : aperture * 2;
          const vertical = variant.id === "bay" ? (row - 1) * height : 0;
          const horizontal = side * (clearance + layout.pocketRadius / 2);
          place(shutters, leaf, horizontal, vertical, -row * 0.06, layout.pocketRadius, height - 0.025, 0.5);
          color.copy(accent).lerp(secondary, chroma ? row * 0.16 : 0).multiplyScalar(chroma ? 0.65 + pulse * 0.4 + surge : 0.22);
          place(leafLights, leaf, side * (clearance + 0.1), vertical, 0.29,
            0.065, height * 0.86, 0.025);
        }
      }
      let accentCount = 0;
      let hardwareCount = 0;
      for (let index = 0; index < 24; index += 1) {
        const angle = index * Math.PI / 12;
        const track = Math.min(aperture + (layout.outerRadius - aperture) * 0.38, radius * 0.985);
        const sweep = Math.max(0, 1 - Math.abs(opening * 24 - index) / 3) * approach;
        color.copy(accent).lerp(secondary, chroma ? sweep * 0.65 : 0)
          .multiplyScalar(chroma ? 0.45 + pulse * 0.3 + sweep * 1.2 + surge * 1.4 : 0.24);
        place(accents, accentCount++, Math.cos(angle) * track, Math.sin(angle) * track, face,
          index % 3 ? 0.48 : 0.85, 0.1, 0.06, angle + Math.PI / 2);
        if (index % 2 === 0) {
          color.copy(white).multiplyScalar(index % 4 ? 1 : 1.6);
          const rim = (aperture + layout.outerRadius) / 2;
          place(hardware, hardwareCount++, Math.cos(angle) * rim, Math.sin(angle) * rim, face - 0.03,
            layout.outerRadius - aperture - 0.08, 0.22, 0.13, angle);
        }
      }
      accents.count = accentCount;
      hardware.count = hardwareCount;
      for (const mesh of meshes) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor!.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of meshes) mesh.dispose();
      for (const geometry of [box, blade, ...housings]) geometry.dispose();
      for (const material of [structureMaterial, leafMaterial, leafLightMaterial, accentMaterial]) material.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}