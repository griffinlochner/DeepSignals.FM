import * as THREE from "three";
import { createTransitWorld, sampleTransitPath } from "./transitWorld";

export const TRANSIT_SLOGANS = [
  { kind: "ring", text: "TUNE IN.", color: "#b2ff86", glow: "#74fff0", offset: 460, height: -480 },
  { kind: "pylons", text: "TRANSMIT.", color: "#74fff0", glow: "#ff9eaa", offset: -800, height: -420 },
  { kind: "bridge", text: "TRANSCEND.", color: "#ff9eaa", glow: "#b2ff86", offset: -900, height: -420 },
] as const;

export const TRANSIT_SIGN = { width: 1120, height: 280, depth: 32, faceOffset: 28 } as const;

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
  const slots = world.encounters.slice(TRANSIT_SLOGANS.length).map((encounter) => ({
    encounter, phrase: TRANSIT_SLOGANS.findIndex((slogan) => slogan.kind === encounter.kind),
  }));
  const panelGeometry = new THREE.BoxGeometry(1, 1, 1);
  const faceGeometry = new THREE.PlaneGeometry(1, 1);
  faceGeometry.setAttribute("signRow", new THREE.InstancedBufferAttribute(new Float32Array(slots.map(({ phrase }) => 2 - phrase)), 1));
  faceGeometry.setAttribute("signPhase", new THREE.InstancedBufferAttribute(new Float32Array(slots.map(({ phrase }) => phrase * 2.1)), 1));
  const panelMaterial = new THREE.MeshLambertMaterial({ color: 0x1a3438 });
  const faceMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const clock = { value: 0 };
  faceMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.signClock = clock;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `
      #include <common>
      attribute float signRow;
      attribute float signPhase;
      varying vec2 vSignUv;
      varying float vSignPhase;
    `).replace("#include <uv_vertex>", `
      #include <uv_vertex>
      vSignUv = uv;
      vSignPhase = signPhase;
      vMapUv.y = (vMapUv.y + signRow) / 3.0;
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `
      #include <common>
      uniform float signClock;
      varying vec2 vSignUv;
      varying float vSignPhase;
    `).replace("#include <map_fragment>", `
      #include <map_fragment>
      float sweep = pow(0.5 + 0.5 * sin(vSignUv.x * 6.283185 - signClock * 0.7 + vSignPhase), 12.0);
      float edge = smoothstep(0.32, 0.45, abs(vSignUv.y - 0.5));
      float breathe = 0.88 + 0.12 * sin(signClock * 0.55 + vSignPhase);
      diffuseColor.rgb *= breathe + sweep * (0.28 + edge * 0.5);
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
    for (const object of objects) object.visible = chroma;
    if (!chroma) return;
    clock.value = world.animationSeconds;
    let panelIndex = 0;
    for (const [index, { encounter, phrase }] of slots.entries()) {
      const slogan = TRANSIT_SLOGANS[phrase];
      sampleTransitPath(encounter.distance + slogan.offset, position).sub(center);
      position.y += slogan.height;
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