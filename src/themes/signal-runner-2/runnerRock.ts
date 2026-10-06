import * as THREE from "three";

export function createRunnerRock() {
  const geometry = new THREE.IcosahedronGeometry(1, 4);
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const fracture = Math.abs(Math.sin(x * 11 + y * 7) * Math.cos(z * 13 - x * 5));
    const radius = 0.72 + 0.16 * Math.sin(x * 4 + z * 3) ** 2 + fracture * 0.12;
    position.setXYZ(i, x * radius, y * radius, z * radius);
    const shade = 0.52 + fracture * 0.38;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade * 0.94;
    colors[i * 3 + 2] = shade * 0.86;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.98, metalness: 0.06, flatShading: true, vertexColors: true,
  });
  const lighting = { chroma: { value: 1 }, surge: { value: 0 }, bass: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rockChroma = lighting.chroma;
    shader.uniforms.rockSurge = lighting.surge;
    shader.uniforms.rockBass = lighting.bass;
    shader.vertexShader = shader.vertexShader.replace("#include <common>",
      "#include <common>\nvarying vec3 rockLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nrockLocal = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
      varying vec3 rockLocal;
      uniform float rockChroma;
      uniform float rockSurge;
      uniform float rockBass;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 5.0);
        float vein = abs(sin(rockLocal.x * 19.0 + rockLocal.y * 13.0 + sin(rockLocal.z * 17.0)));
        float seam = (1.0 - smoothstep(0.015, 0.055, vein)) * step(0.2, rockLocal.y);
        vec3 mineral = mix(vec3(0.025, 0.5, 0.65), vec3(0.6, 0.18, 0.11),
          smoothstep(-0.4, 0.7, rockLocal.z));
        totalEmissiveRadiance += mineral * rockChroma *
          (rim * (0.12 + rockBass * 0.16 + rockSurge * 1.3) + seam * (0.035 + rockSurge * 0.65));
        totalEmissiveRadiance += vec3(0.18, 0.23, 0.27) * rim * rockSurge * (1.0 - rockChroma);`);
  };
  return { geometry, material, lighting };
}
