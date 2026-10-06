import * as THREE from "three";
import {
  RUNNER, runnerRandom, runnerPathX, runnerPathY, runnerGateActivation,
  type createRunnerJourney, type createRunnerMotion,
} from "./runnerJourney";
import { createRunnerRock } from "./runnerRock";
import { createRunnerScenery } from "./runnerScenery";

export function createRunnerSpace() {
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [new THREE.Color(0x55eeff), new THREE.Color(0xc0ff63), new THREE.Color(0xff897f)];
  const cool = new THREE.Color(0x709aa9);
  const background = new THREE.Color();
  const rockResources = createRunnerRock();
  const scenery = createRunnerScenery();
  const geometries = [
    rockResources.geometry,
    new THREE.TorusGeometry(15.5, 2.2, 6, 6, Math.PI * 2 / 16 * 0.87),
    new THREE.TorusGeometry(13.5, 0.55, 6, 64),
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.TorusGeometry(1, 0.008, 4, 64),
  ];
  const rockMaterial = rockResources.material;
  const gateMaterial = new THREE.MeshStandardMaterial({ metalness: 0.6, roughness: 0.62 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x76818a, metalness: 0.7, roughness: 0.4 });
  const panelMaterial = new THREE.MeshBasicMaterial();
  const waveMaterial = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const materials = [rockMaterial, gateMaterial, trimMaterial, waveMaterial, panelMaterial];
  const rocks = new THREE.InstancedMesh(geometries[0], rockMaterial, RUNNER.regionCount * RUNNER.rocksPerRegion);
  const gateCapacity = RUNNER.regionCount * RUNNER.gatesPerRegion;
  const gates = new THREE.InstancedMesh(geometries[1], gateMaterial, gateCapacity * 16);
  const trims = new THREE.InstancedMesh(geometries[2], trimMaterial, gateCapacity * 2);
  const pylons = new THREE.InstancedMesh(geometries[3], gateMaterial, gateCapacity * 8 * 3);
  const panels = new THREE.InstancedMesh(geometries[3], panelMaterial, gateCapacity * 16);
  const waves = new THREE.InstancedMesh(geometries[4], waveMaterial, 3);
  const meshes = [rocks, gates, trims, pylons, waves, panels];
  for (const mesh of meshes) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    if (mesh !== waves) mesh.setColorAt(0, color);
  }

  const seeds = new Float32Array(RUNNER.starCount * 3);
  const points = new Float32Array(RUNNER.starCount * 3);
  const streaks = new Float32Array(RUNNER.starCount * 6);
  const colors = new Float32Array(RUNNER.starCount * 3);
  const streakColors = new Float32Array(RUNNER.starCount * 6);
  for (let i = 0; i < RUNNER.starCount; i += 1) {
    const angle = runnerRandom(i * 3) * Math.PI * 2;
    const radius = 6 + Math.pow(runnerRandom(i * 3 + 1), 0.65) * 190;
    seeds[i * 3] = Math.cos(angle) * radius;
    seeds[i * 3 + 1] = Math.sin(angle) * radius;
    seeds[i * 3 + 2] = runnerRandom(i * 3 + 2) * RUNNER.far;
  }
  const pointGeometry = new THREE.BufferGeometry();
  const streakGeometry = new THREE.BufferGeometry();
  const pointPosition = new THREE.BufferAttribute(points, 3).setUsage(THREE.DynamicDrawUsage);
  const streakPosition = new THREE.BufferAttribute(streaks, 3).setUsage(THREE.DynamicDrawUsage);
  const pointColor = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);
  const streakColor = new THREE.BufferAttribute(streakColors, 3).setUsage(THREE.DynamicDrawUsage);
  pointGeometry.setAttribute("position", pointPosition);
  pointGeometry.setAttribute("color", pointColor);
  streakGeometry.setAttribute("position", streakPosition);
  streakGeometry.setAttribute("color", streakColor);
  const pointMaterial = new THREE.PointsMaterial({
    size: 0.32, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const streakMaterial = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(pointGeometry, pointMaterial);
  const trails = new THREE.LineSegments(streakGeometry, streakMaterial);
  stars.frustumCulled = false;
  trails.frustumCulled = false;
  const objects = [rocks, gates, trims, pylons, waves, stars, trails, panels, ...scenery.objects];

  const paint = (accent: number, brightness: number, chroma: boolean, energy: number, surge: number) => {
    if (chroma) {
      color.copy(palette[accent]).lerp(palette[(accent + 1) % 3], energy * 0.16 + surge * 0.12);
    } else color.copy(cool);
    color.multiplyScalar(brightness * (chroma ? 1.5 : 0.5));
  };
  const instance = (mesh: THREE.InstancedMesh, index: number) => {
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, color);
  };

  return {
    objects, meshes, background, scenery, rockResources,
    update(journey: ReturnType<typeof createRunnerJourney>, motion: ReturnType<typeof createRunnerMotion>, chroma: boolean) {
      const distance = journey.distance;
      const cx = runnerPathX(distance, journey.seed);
      const cy = runnerPathY(distance, journey.seed);
      const surge = motion.surge;
      const age = motion.elapsedMs - motion.surgeStartedAt;
      scenery.update(journey, motion, chroma);
      rockResources.lighting.chroma.value = chroma ? 1 : 0;
      rockResources.lighting.surge.value = surge;
      rockResources.lighting.bass.value = motion.bass;
      background.setRGB(0.0003 + surge * (chroma ? 0.008 : 0.002), 0.0005 + surge * 0.005, 0.0015 + surge * 0.018);
      let rockCount = 0;
      let gateCount = 0;
      let trimCount = 0;
      let pylonCount = 0;
      let panelCount = 0;
      for (const region of journey.regions) {
        if (region.kind === "asteroid-field") {
          for (const rock of region.rocks) {
            const ahead = rock.distance - distance;
            if (ahead < -rock.size * RUNNER.rockStretch - 15 || ahead > RUNNER.far + rock.size) continue;
            transform.position.set(rock.x, rock.y, -ahead);
            transform.rotation.set(rock.phase + motion.animationSeconds * rock.spin,
              rock.phase * 0.7 + motion.animationSeconds * rock.spinY, rock.phase + motion.animationSeconds * rock.spinZ);
            transform.scale.set(rock.size, rock.size * 0.82, rock.size * RUNNER.rockStretch);
            color.setHex(rock.accent === 0 ? 0x66615c : rock.accent === 1 ? 0x555960 : 0x746657);
            instance(rocks, rockCount++);
          }
        } else if (region.kind === "signal-gates") {
          for (let i = 0; i < RUNNER.gatesPerRegion; i += 1) {
            const gateDistance = region.start + 135 + i * 100;
            const ahead = gateDistance - distance;
            if (ahead < -20 || ahead > RUNNER.far) continue;
            const activation = runnerGateActivation(ahead, age, surge);
            const x = runnerPathX(gateDistance, journey.seed);
            const y = runnerPathY(gateDistance, journey.seed);
            for (let segment = 0; segment < 16; segment += 1) {
              const angle = segment * Math.PI / 8;
              transform.position.set(x, y, -ahead);
              transform.rotation.set(0, 0, angle);
              transform.scale.set(1, 1, 2.5);
              color.setHex(segment % 2 ? 0x48515c : 0x72767b);
              instance(gates, gateCount++);
              const collarAngle = angle + motion.animationSeconds * 0.045 * (i % 2 ? -1 : 1);
              transform.position.set(x + Math.cos(collarAngle) * 14.4, y + Math.sin(collarAngle) * 14.4, -ahead + 4.7);
              transform.rotation.z = collarAngle;
              transform.scale.set(0.65, 1.5, 0.18);
              const sequence = Math.max(0, Math.min(1, activation * 1.7 - segment / 20));
              paint((i + segment % 3) % 3, 0.12 + sequence * (0.9 + motion.mids * 0.5) + surge, chroma, motion.energy, surge);
              instance(panels, panelCount++);
            }
            for (let rim = 0; rim < 2; rim += 1) {
              transform.position.set(x, y, -ahead + (rim ? 3.4 : -3.4));
              transform.rotation.set(0, 0, motion.animationSeconds * 0.045);
              transform.scale.set(1, 1, 1.6);
              color.setHex(0x69717a);
              instance(trims, trimCount++);
            }
            for (let pylon = 0; pylon < 8; pylon += 1) {
              const angle = pylon * Math.PI / 4;
              for (let part = 0; part < 3; part += 1) {
                const radius = part === 0 ? 17.6 : part === 1 ? 20 : 22;
                transform.position.set(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, -ahead);
                transform.rotation.set(0, 0, angle);
                transform.scale.set(part === 2 ? 5 : 1.6, part === 2 ? 0.18 : 0.7, part === 0 ? 11 : 2);
                color.setHex(part === 0 ? 0x81868b : 0x454b51);
                instance(pylons, pylonCount++);
              }
            }
          }
        }
      }
      rocks.count = rockCount;
      gates.count = gateCount;
      trims.count = trimCount;
      pylons.count = pylonCount;
      panels.count = panelCount;
      waves.visible = surge > 0.001;
      waveMaterial.opacity = surge * 0.7;
      waveMaterial.color.copy(chroma ? palette[1] : cool);
      for (let i = 0; i < 3; i += 1) {
        const progress = Number.isFinite(age) ? Math.max(0, age / 1000 - i * 0.18) : 0;
        transform.position.set(cx, cy, -95 + progress * 45);
        transform.rotation.set(0, 0, 0);
        transform.scale.setScalar(4 + progress * 34);
        transform.updateMatrix();
        waves.setMatrixAt(i, transform.matrix);
      }
      const speedMix = Math.min(1, motion.speed / 120);
      const length = 0.12 + speedMix * speedMix * 12 + surge * 30;
      streakMaterial.opacity = 0.12 + speedMix * 0.65 + surge * 0.23;
      pointMaterial.opacity = 0.85 - speedMix * 0.25;
      for (let i = 0; i < RUNNER.starCount; i += 1) {
        const p = i * 3;
        const s = i * 6;
        const ahead = 2 + ((seeds[p + 2] - distance) % RUNNER.far + RUNNER.far) % RUNNER.far;
        const x = seeds[p];
        const y = seeds[p + 1];
        points[p] = streaks[s] = streaks[s + 3] = x;
        points[p + 1] = streaks[s + 1] = streaks[s + 4] = y;
        points[p + 2] = streaks[s + 2] = -ahead;
        const peripheral = Math.min(1, Math.hypot(x, y) / 90);
        streaks[s + 5] = -ahead - length * (0.55 + peripheral * 0.8);
        const fade = Math.min(1, ahead / 12, (RUNNER.far + 2 - ahead) / 50);
        paint(i % 3, fade * (0.48 + (i % 11 === 0 ? motion.highs * 1.3 : motion.highs * 0.3) + surge),
          chroma, motion.energy, surge);
        colors[p] = streakColors[s] = color.r;
        colors[p + 1] = streakColors[s + 1] = color.g;
        colors[p + 2] = streakColors[s + 2] = color.b;
        streakColors[s + 3] = color.r * 0.04;
        streakColors[s + 4] = color.g * 0.04;
        streakColors[s + 5] = color.b * 0.04;
      }
      pointPosition.needsUpdate = streakPosition.needsUpdate = true;
      pointColor.needsUpdate = streakColor.needsUpdate = true;
      for (const mesh of meshes) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of meshes) mesh.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      pointGeometry.dispose();
      streakGeometry.dispose();
      pointMaterial.dispose();
      streakMaterial.dispose();
      scenery.dispose();
    },
  };
}
