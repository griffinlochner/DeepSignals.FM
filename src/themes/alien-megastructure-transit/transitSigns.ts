import * as THREE from "three";
import { createTransitWorld, sampleTransitPath, TRANSIT } from "./transitWorld";

export const TRANSIT_SLOGANS = [
  { text: "TUNE IN.", color: "#b2ff86", glow: "#74fff0" },
  { text: "TRANSMIT.", color: "#74fff0", glow: "#ff9eaa" },
  { text: "TRANSCEND.", color: "#ff9eaa", glow: "#b2ff86" },
] as const;

export const TRANSIT_SIGN = { width: 1120, height: 280, depth: 32, faceOffset: 28, offset: -900, heightOffset: -420 } as const;

export function transitSignIntensity(phrase: number, seconds: number, chroma: boolean) {
  if (!chroma) return 0.16;
  const clock = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  if (phrase === 0) return 0.04 + 1.21 * (0.5 + 0.5 * Math.sin(clock * Math.PI / 3));
  if (phrase === 1) {
    const phase = clock % 7.3;
    const dip = (center: number, width: number) => Math.exp(-(((phase - center) / width) ** 2));
    return 0.96 - 0.65 * dip(1.1, 0.22) - 0.42 * dip(1.85, 0.3) - 0.7 * dip(4.6, 0.4);
  }
  const pulse = (0.5 + 0.5 * Math.sin(clock * Math.PI * 2 / 1.6)) ** 4;
  const burst = (0.5 + 0.5 * Math.sin(clock * Math.PI * 2 / 6.4)) ** 12;
  return 0.18 + 0.85 * pulse + 0.8 * burst;
}

export function createTransitSignAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const redraw = () => {
    if (!context) return;
    for (const [index, slogan] of TRANSIT_SLOGANS.entries()) {
      context.save();
      context.translate(0, index * 256);
      context.fillStyle = "#061113";
      context.fillRect(0, 0, 1024, 256);
      context.strokeStyle = slogan.glow;
      context.lineWidth = 3;
      context.strokeRect(14, 14, 996, 228);
      context.globalAlpha = 0.3;
      context.strokeRect(24, 24, 976, 208);
      context.globalAlpha = 1;
      context.fillStyle = slogan.glow;
      for (let segment = 0; segment < 24; segment += 1) {
        context.fillRect(48 + segment * 39, 221, segment % 3 === 0 ? 26 : 12, 5);
      }
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.font = '600 18px "Chakra Petch", sans-serif';
      context.fillText("DEEPSIGNALS.FM", 48, 42);
      context.textAlign = "right";
      context.fillText(`0${index + 1}`, 976, 42);
      context.textAlign = "center";
      context.font = '900 140px "Chakra Petch", sans-serif';
      const fontSize = Math.min(140, 140 * 880 / context.measureText(slogan.text).width);
      context.font = `900 ${fontSize}px "Chakra Petch", sans-serif`;
      context.fillStyle = slogan.color;
      context.shadowColor = slogan.glow;
      context.shadowBlur = 14;
      context.fillText(slogan.text, 512, 137);
      context.shadowBlur = 0;
      context.fillText(slogan.text, 512, 137);
      context.restore();
    }
    texture.needsUpdate = true;
  };
  redraw();
  return { texture, redraw };
}

export function createTransitSigns(world: ReturnType<typeof createTransitWorld>, texture: THREE.Texture) {
  const slots = world.encounters.slice(TRANSIT_SLOGANS.length).filter((encounter) => encounter.kind === "bridge");
  const panelGeometry = new THREE.BoxGeometry(1, 1, 1);
  const faceGeometry = new THREE.PlaneGeometry(1, 1);
  const rows = new THREE.InstancedBufferAttribute(new Float32Array(slots.length), 1).setUsage(THREE.DynamicDrawUsage);
  faceGeometry.setAttribute("signRow", rows);
  const intensities = new THREE.InstancedBufferAttribute(new Float32Array(slots.length), 1).setUsage(THREE.DynamicDrawUsage);
  faceGeometry.setAttribute("signIntensity", intensities);
  const panelMaterial = new THREE.MeshLambertMaterial({ color: 0x1a3438 });
  const faceMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const chromaEnabled = { value: 1 };
  faceMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.signChroma = chromaEnabled;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `
      #include <common>
      attribute float signRow;
      attribute float signIntensity;
      varying float vSignIntensity;
    `).replace("#include <uv_vertex>", `
      #include <uv_vertex>
      vSignIntensity = signIntensity;
      vMapUv.y = (vMapUv.y + signRow) / 3.0;
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `
      #include <common>
      uniform float signChroma;
      varying float vSignIntensity;
    `).replace("#include <map_fragment>", `
      #include <map_fragment>
      if (signChroma < 0.5) {
        float ink = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(vec3(ink), diffuseColor.rgb, 0.18);
      }
      diffuseColor.rgb *= vSignIntensity;
    `);
  };
  const panels = new THREE.InstancedMesh(panelGeometry, panelMaterial, slots.length * 3);
  const faces = new THREE.InstancedMesh(faceGeometry, faceMaterial, slots.length);
  const objects = [panels, faces];
  for (const object of objects) {
    object.frustumCulled = false;
    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  const transform = new THREE.Object3D();
  const position = new THREE.Vector3();
  const update = (center: THREE.Vector3, chroma: boolean) => {
    chromaEnabled.value = chroma ? 1 : 0;
    let panelIndex = 0;
    for (const [index, encounter] of slots.entries()) {
      const phrase = Math.floor((encounter.distance - TRANSIT.firstEncounter) / (TRANSIT.spacing * TRANSIT.poolSize)) % TRANSIT_SLOGANS.length;
      if (rows.getX(index) !== 2 - phrase) {
        rows.setX(index, 2 - phrase);
        rows.needsUpdate = true;
      }
      intensities.setX(index, transitSignIntensity(phrase, world.animationSeconds, chroma));
      sampleTransitPath(encounter.distance + TRANSIT_SIGN.offset, position).sub(center);
      position.y += TRANSIT_SIGN.heightOffset;
      transform.position.copy(position);
      transform.scale.set(TRANSIT_SIGN.width, TRANSIT_SIGN.height, TRANSIT_SIGN.depth);
      transform.updateMatrix();
      panels.setMatrixAt(panelIndex++, transform.matrix);
      transform.position.z += TRANSIT_SIGN.faceOffset;
      transform.scale.set(TRANSIT_SIGN.width, TRANSIT_SIGN.height, 1);
      transform.updateMatrix();
      faces.setMatrixAt(index, transform.matrix);
      if (encounter.kind === "bridge") {
        for (const side of [-1, 1]) {
          transform.position.copy(position);
          transform.position.x += side * (TRANSIT_SIGN.width / 2 - 16);
          transform.position.y += 510;
          transform.scale.set(18, 1020, 24);
          transform.updateMatrix();
          panels.setMatrixAt(panelIndex++, transform.matrix);
        }
      }
    }
    panels.count = panelIndex;
    intensities.needsUpdate = true;
    panels.instanceMatrix.needsUpdate = true;
    faces.instanceMatrix.needsUpdate = true;
  };
  return {
    objects, update,
    dispose: () => {
      for (const object of objects) object.dispose();
      panelGeometry.dispose();
      faceGeometry.dispose();
      panelMaterial.dispose();
      faceMaterial.dispose();
      texture.dispose();
    },
  };
}