import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Matrix4, Vector3, ShaderLib } from "three";
import type { BufferGeometry, Material } from "three";
import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";
import {
  RUNNER, createRunnerJourney, advanceRunnerJourney, runnerEncounter, runnerPathX, runnerPathY,
  createRunnerMotion, updateRunnerMotion, runnerSurgeEnvelope, runnerGateActivation,
  createRunnerFlight, sampleRunnerFlight, runnerMajorSize, createRunnerTraffic, sampleRunnerTraffic, runnerRegionWeight,
} from "../../src/themes/signal-runner-2/runnerJourney";
import { createRunnerSpace } from "../../src/themes/signal-runner-2/runnerSpace";
import { createRunnerRock } from "../../src/themes/signal-runner-2/runnerRock";
import SignalRunner2Definition from "../../src/themes/signal-runner-2";

const loud = { isActive: true, smoothedEnergy: 1, bass: 0.8, mids: 0.6, highs: 0.7 };
const quiet = { ...loud, smoothedEnergy: 0.1 };

test("sibling has its own stable registration and does not replace the original", () => {
  expect(SignalRunner2Definition.id).toBe("signal-runner-2");
  expect(SignalRunner2Definition.name).toBe("Signal Runner 2.0");
  expect(SignalRunner2Definition.supportsMotion).toBe(true);
  expect(SignalRunner2Definition.supportsChroma).toBe(true);
  const registry = readFileSync(resolve("src", "themes", "themeRegistry.ts"), "utf8");
  expect(registry).toContain('import SignalRunnerDefinition from "./signal-runner"');
  expect(registry).toContain('import SignalRunner2Definition from "./signal-runner-2"');
  expect(registry).toMatch(/\sSignalRunnerDefinition,/);
  expect(registry).toMatch(/\sSignalRunner2Definition,/);
  const original = readFileSync(resolve("src", "themes", "signal-runner", "index.ts"), "utf8");
  expect(original).toContain('id: "signal-runner"');
  expect(original).toContain('name: "Signal Runner"');
  expect(original).toContain("Scene: SignalRunnerTheme");
});

test("seeded encounter selection, open breaks and recycling preserve bounded object identities", () => {
  const journey = createRunnerJourney();
  expect(journey).toEqual(createRunnerJourney());
  expect(createRunnerJourney(999).regions[1].rocks).not.toEqual(journey.regions[1].rocks);
  const regions = [...journey.regions];
  const rocks = journey.regions.map((region) => [...region.rocks]);
  const kinds = new Set<string>();
  for (let frame = 0; frame < 30_000; frame += 1) {
    advanceRunnerJourney(journey, RUNNER.surgeMax / 60);
    if (frame % 120) continue;
    for (let slot = 0; slot < RUNNER.regionCount; slot += 1) {
      const region = journey.regions[slot];
      expect(region).toBe(regions[slot]);
      expect(region.rocks).toHaveLength(RUNNER.rocksPerRegion);
      expect(region.rocks.every((rock, index) => rock === rocks[slot][index])).toBe(true);
      expect(region.kind).toBe(runnerEncounter(region.index));
      expect(region.start + RUNNER.regionLength).toBeGreaterThanOrEqual(journey.distance - 30);
      kinds.add(region.kind);
      if (region.kind !== "open-warp") {
        expect(runnerEncounter(region.index + 1)).toBe("open-warp");
        expect(runnerEncounter(region.index - 1)).toBe("open-warp");
      }
    }
    expect(journey.regions.some((region) => region.start <= journey.distance
      && region.start + RUNNER.regionLength > journey.distance)).toBe(true);
    expect(Math.max(...journey.regions.map((region) => region.start + RUNNER.regionLength)))
      .toBeGreaterThan(journey.distance + RUNNER.far);
  }
  expect(kinds).toEqual(new Set(["open-warp", "asteroid-field", "signal-gates"]));
  expect(journey.recycled).toBeGreaterThan(200);
});

test("maximum-speed path retains comfortable asteroid and gate clearance after recycling", () => {
  const journey = createRunnerJourney();
  let minimum = Infinity;
  let nearMiss = Infinity;
  let previousRoll = 0;
  const flight = createRunnerFlight();
  for (let frame = 0; frame < 12_000; frame += 1) {
    advanceRunnerJourney(journey, RUNNER.surgeMax * 0.05);
    const x = runnerPathX(journey.distance);
    const y = runnerPathY(journey.distance);
    const { roll } = sampleRunnerFlight(journey.distance, journey.seed, flight);
    expect(Math.abs(roll)).toBeLessThanOrEqual(RUNNER.maxBank);
    expect(Math.abs(roll - previousRoll)).toBeLessThan(0.018);
    previousRoll = roll;
    for (const region of journey.regions) {
      if (region.kind === "asteroid-field") {
        for (const rock of region.rocks) {
          const clearance = Math.hypot(rock.x - x, rock.y - y, rock.distance - journey.distance) - rock.size * 1.35;
          minimum = Math.min(minimum, clearance);
          if (Math.abs(rock.distance - journey.distance) < 6) nearMiss = Math.min(nearMiss, clearance);
        }
      } else if (region.kind === "signal-gates") {
        for (let i = 0; i < RUNNER.gatesPerRegion; i += 1) {
          const distance = region.start + 135 + i * 100;
          if (Math.abs(distance - journey.distance) > 15) continue;
          expect(RUNNER.gateRadius * 0.945 - 0.05
            - Math.hypot(runnerPathX(distance) - x, runnerPathY(distance) - y)).toBeGreaterThan(10);
        }
      }
    }
  }
  expect(minimum).toBeGreaterThan(6);
  expect(nearMiss).toBeLessThan(11);
});

test("propulsion is continuous, delta-bounded, volume-neutral and settles with quiet or unavailable audio", () => {
  const state = createRunnerMotion();
  for (let i = 0; i < 180; i += 1) updateRunnerMotion(state, 1 / 60, true, true, false, loud);
  expect(state.speed).toBeGreaterThan(RUNNER.normalMax - 1);
  expect(state.speed).toBeLessThanOrEqual(RUNNER.normalMax);
  const fast = state.speed;
  updateRunnerMotion(state, 1 / 60, true, true, false, quiet);
  expect(state.speed).toBeLessThan(fast);
  expect(state.speed).toBeGreaterThan(fast - 6);
  for (const snapshot of [undefined, { ...loud, isActive: false }, { ...loud, smoothedEnergy: NaN },
    { ...loud, smoothedEnergy: 0 }, { ...loud, smoothedEnergy: 0.001 }]) {
    for (let i = 0; i < 300; i += 1) updateRunnerMotion(state, 1 / 60, true, true, false, snapshot);
    expect(state.targetSpeed).toBe(0);
    expect(state.speed).toBe(0);
  }
  expect(updateRunnerMotion(state, 1000, true, true, false, loud)).toBeLessThanOrEqual(RUNNER.surgeMax * 0.05);
  const before = state.elapsedMs;
  updateRunnerMotion(state, NaN, true, true, false, loud);
  expect(state.elapsedMs).toBe(before);
});

test("obstacle-driven autopilot translates, looks ahead and recenters deterministically for many seeds", () => {
  const flight = createRunnerFlight();
  let minClearance = Infinity;
  let minUnsteeredClearance = Infinity;
  let maximumTranslation = 0;
  let maximumAngularStep = 0;
  let maximumYaw = 0, maximumPitch = 0, maximumRoll = 0;
  for (const seed of [RUNNER.seed, 999, 42, 90210]) {
    const journey = createRunnerJourney(seed);
    for (let regionIndex = 0; regionIndex < 40; regionIndex += 1) {
      if (runnerEncounter(regionIndex, seed) !== "asteroid-field") continue;
      const start = regionIndex * RUNNER.regionLength;
      advanceRunnerJourney(journey, start - journey.distance);
      const region = journey.regions.find((candidate) => candidate.index === regionIndex)!;
      expect(region.rocks[0].size).toBe(runnerMajorSize(regionIndex, seed));
      const obstacle = region.rocks[0];
      expect(obstacle.size).toBeGreaterThanOrEqual(12);
      const center = start + 240;
      const baselineX = Math.sin(center / 170) * 2.2;
      const baselineY = Math.sin(center / 231) * 1.1;
      minUnsteeredClearance = Math.min(minUnsteeredClearance,
        Math.hypot(obstacle.x - baselineX, obstacle.y - baselineY) - obstacle.size * RUNNER.rockStretch);
      sampleRunnerFlight(start, seed, flight);
      expect(sampleRunnerFlight(center, seed, createRunnerFlight()))
        .toEqual(sampleRunnerFlight(center, seed, createRunnerFlight()));
      let previousYaw = flight.yaw, previousPitch = flight.pitch, previousRoll = flight.roll;
      for (let local = 0; local <= RUNNER.regionLength; local += 2) {
        sampleRunnerFlight(start + local, seed, flight);
        for (const rock of region.rocks) {
          minClearance = Math.min(minClearance,
            Math.hypot(flight.x - rock.x, flight.y - rock.y, start + local - rock.distance)
              - rock.size * RUNNER.rockStretch);
        }
        maximumTranslation = Math.max(maximumTranslation, Math.hypot(
          flight.x - Math.sin((start + local) / 170) * 2.2,
          flight.y - Math.sin((start + local) / 231) * 1.1));
        maximumAngularStep = Math.max(maximumAngularStep,
          Math.abs(flight.yaw - previousYaw), Math.abs(flight.pitch - previousPitch), Math.abs(flight.roll - previousRoll));
        maximumYaw = Math.max(maximumYaw, Math.abs(flight.yaw));
        maximumPitch = Math.max(maximumPitch, Math.abs(flight.pitch));
        maximumRoll = Math.max(maximumRoll, Math.abs(flight.roll));
        previousYaw = flight.yaw; previousPitch = flight.pitch; previousRoll = flight.roll;
      }
      expect(flight.x).toBeCloseTo(Math.sin((start + 480) / 170) * 2.2, 8);
      expect(flight.y).toBeCloseTo(Math.sin((start + 480) / 231) * 1.1, 8);
    }
  }
  expect(minUnsteeredClearance).toBeLessThan(-16);
  expect(minClearance).toBeGreaterThan(6);
  expect(maximumTranslation).toBeGreaterThan(30);
  expect(maximumTranslation).toBeLessThan(34);
  expect(maximumAngularStep).toBeLessThan(0.006);
  expect(maximumYaw).toBeLessThan(0.2);
  expect(maximumPitch).toBeLessThan(0.15);
  expect(maximumRoll).toBeLessThanOrEqual(RUNNER.maxBank);
});

test("fractured rocks remain inside their safety sphere and chroma changes only localized light uniforms", () => {
  const rock = createRunnerRock();
  const second = createRunnerRock();
  expect(rock.geometry.getAttribute("position").array).toEqual(second.geometry.getAttribute("position").array);
  const positions = rock.geometry.getAttribute("position");
  const point = new Vector3();
  let minRadius = Infinity, maxRadius = 0;
  for (let i = 0; i < positions.count; i += 1) {
    const radius = point.fromBufferAttribute(positions, i).length();
    minRadius = Math.min(minRadius, radius);
    maxRadius = Math.max(maxRadius, radius);
  }
  expect(maxRadius).toBeLessThanOrEqual(1.00001);
  expect(maxRadius - minRadius).toBeGreaterThan(0.2);
  expect(rock.material.roughness).toBeGreaterThan(0.9);
  const shader = { ...ShaderLib.standard, uniforms: { ...ShaderLib.standard.uniforms } };
  // The renderer argument is unused by this material hook.
  rock.material.onBeforeCompile(shader, {} as Parameters<typeof rock.material.onBeforeCompile>[1]);
  expect(shader.uniforms.rockChroma).toBe(rock.lighting.chroma);
  expect(shader.fragmentShader).toContain("totalEmissiveRadiance += mineral");
  const space = createRunnerSpace();
  const journey = createRunnerJourney();
  advanceRunnerJourney(journey, 650);
  const motion = createRunnerMotion();
  space.update(journey, motion, false);
  const natural = space.meshes[0].instanceColor!.array.slice();
  space.update(journey, motion, true);
  expect(space.meshes[0].instanceColor!.array).toEqual(natural);
  expect(space.rockResources.lighting.chroma.value).toBe(1);
  space.dispose();
  rock.geometry.dispose(); rock.material.dispose();
  second.geometry.dispose(); second.material.dispose();
});

test("mechanical gates retain a recessed clear aperture throughout rotation and recycling", () => {
  const space = createRunnerSpace();
  const journey = createRunnerJourney();
  const motion = createRunnerMotion();
  const matrix = new Matrix4();
  const vertex = new Vector3();
  let minimum = Infinity;
  for (let encounter = 0; encounter < 8; encounter += 1) {
    const distance = (3 + encounter * 4) * RUNNER.regionLength + 135;
    advanceRunnerJourney(journey, distance - journey.distance);
    for (let step = 0; step < 8; step += 1) {
      motion.animationSeconds = step * 13;
      space.update(journey, motion, true);
      for (const slot of [1, 2, 3, 5]) {
        const mesh = space.meshes[slot];
        const positions = mesh.geometry.getAttribute("position");
        for (let instance = 0; instance < mesh.count; instance += 1) {
          mesh.getMatrixAt(instance, matrix);
          for (let i = 0; i < positions.count; i += 1) {
            vertex.fromBufferAttribute(positions, i).applyMatrix4(matrix);
            if (Math.abs(vertex.z) > 8) continue;
            minimum = Math.min(minimum, Math.hypot(vertex.x - runnerPathX(distance), vertex.y - runnerPathY(distance)));
          }
        }
      }
    }
  }
  expect(minimum).toBeGreaterThan(12);
  expect(minimum).toBeLessThan(14);
  space.dispose();
});

test("rare traffic and scenery recycle without popping or progressing while frozen", () => {
  const space = createRunnerSpace();
  const journey = createRunnerJourney();
  const motion = createRunnerMotion();
  const traffic = createRunnerTraffic();
  let starts = 0, previousVisible = false, minimumClearance = Infinity;
  for (let distance = 0; distance < RUNNER.regionLength * 24; distance += 4) {
    sampleRunnerTraffic(distance, traffic);
    if (traffic.visible && !previousVisible) starts += 1;
    if (traffic.visible) minimumClearance = Math.min(minimumClearance, Math.hypot(
      traffic.x - runnerPathX(distance), traffic.y - runnerPathY(distance), traffic.z) - 20);
    previousVisible = traffic.visible;
  }
  expect(starts).toBe(3);
  expect(minimumClearance).toBeGreaterThan(60);
  expect(sampleRunnerTraffic(1000, traffic).fade).toBe(0);
  expect(sampleRunnerTraffic(1390, traffic).fade).toBe(0);
  for (const distance of [650, 990, 1170, 1600]) {
    advanceRunnerJourney(journey, distance - journey.distance);
    space.update(journey, motion, true);
    const before = space.scenery.objects.map((object) => ({
      position: object.position.toArray(), rotation: object.rotation.toArray(), visible: object.visible,
      opacity: object.material.opacity,
    }));
    const lampMatrices = Array.from(space.scenery.lamps.instanceMatrix.array);
    for (const [playing, enabled, reduced] of [[false, true, false], [true, false, false], [true, true, true]]) {
      advanceRunnerJourney(journey, updateRunnerMotion(motion, 1, playing, enabled, reduced, loud));
      space.update(journey, motion, true);
      expect(space.scenery.objects.map((object) => ({
        position: object.position.toArray(), rotation: object.rotation.toArray(), visible: object.visible,
        opacity: object.material.opacity,
      }))).toEqual(before);
      expect(Array.from(space.scenery.lamps.instanceMatrix.array)).toEqual(lampMatrices);
    }
  }
  expect(Math.abs(runnerRegionWeight(990, 1) - runnerRegionWeight(991, 1))).toBeLessThan(0.01);
  space.dispose();
});

test("shared SURGE requires a low hold, rejects sustained highs, freezes, and can rearm", () => {
  const state = createRunnerMotion();
  const tick = (frames: number, snapshot = loud) => {
    for (let i = 0; i < frames; i += 1) updateRunnerMotion(state, 0.05, true, true, false, snapshot);
  };
  tick(30);
  expect(state.surgeCount).toBe(0);
  tick(5, quiet);
  tick(10);
  expect(state.surgeCount).toBe(0);
  tick(10, quiet);
  tick(8);
  expect(state.surgeCount).toBe(1);
  expect(state.targetSpeed).toBe(RUNNER.surgeMax);
  expect(state.speed).toBeGreaterThan(RUNNER.normalMax);
  expect(runnerGateActivation(238, 400, 1)).toBe(1);
  expect(runnerGateActivation(238, 1600, 1)).toBeLessThan(1);
  for (const [playing, motion, reduced] of [[false, true, false], [true, false, false], [true, true, true]]) {
    const before = { clock: state.elapsedMs, animation: state.animationSeconds, surge: state.surge, speed: state.speed };
    for (let i = 0; i < 100; i += 1) {
      expect(updateRunnerMotion(state, 0.05, playing, motion, reduced, quiet)).toBe(0);
    }
    expect({ clock: state.elapsedMs, animation: state.animationSeconds, surge: state.surge, speed: state.speed }).toEqual(before);
    expect(state.qualification.armed).toBe(false);
  }
  tick(100);
  expect(state.surge).toBe(0);
  expect(state.surgeCount).toBe(1);
  tick(10, quiet);
  tick(8);
  expect(state.surgeCount).toBe(2);
  expect(runnerSurgeEnvelope(RUNNER.surgeDurationMs)).toBe(0);
  expect(runnerSurgeEnvelope(-1)).toBe(0);
  for (const [playing, motion, reduced] of [[false, true, false], [true, false, false], [true, true, true]]) {
    const armed = createRunnerMotion();
    for (let i = 0; i < 10; i += 1) updateRunnerMotion(armed, 0.05, true, true, false, quiet);
    expect(armed.qualification.armed).toBe(true);
    updateRunnerMotion(armed, 0.05, playing, motion, reduced, loud);
    updateRunnerMotion(armed, 0.05, true, true, false, loud);
    expect(armed.surgeCount).toBe(0);
  }
});

test("render pools reuse buffers, freeze all kinetic geometry, and dispose every owned GPU resource", () => {
  const space = createRunnerSpace();
  const journey = createRunnerJourney();
  const motion = createRunnerMotion();
  space.update(journey, motion, true);
  const buffers = space.meshes.map((mesh) => [mesh.instanceMatrix.array, mesh.instanceColor?.array]);
  const resources = new Set<BufferGeometry | Material>();
  const disposed = new Set();
  for (const object of space.objects) {
    resources.add(object.geometry);
    resources.add(object.material);
    object.geometry.addEventListener("dispose", () => disposed.add(object.geometry));
    object.material.addEventListener("dispose", () => disposed.add(object.material));
  }
  const meshDisposals = new Set();
  space.meshes.forEach((mesh) => mesh.addEventListener("dispose", () => meshDisposals.add(mesh)));
  const matrix = new Matrix4();
  const position = new Vector3();
  let maxRocks = 0;
  let maxGates = 0;
  for (let i = 0; i < 1400; i += 1) {
    advanceRunnerJourney(journey, 12);
    updateRunnerMotion(motion, 0.05, true, true, false, i % 100 < 15 ? quiet : loud);
    space.update(journey, motion, true);
    maxRocks = Math.max(maxRocks, space.meshes[0].count);
    maxGates = Math.max(maxGates, space.meshes[1].count);
    for (let slot = 0; slot < space.meshes.length; slot += 1) {
      const mesh = space.meshes[slot];
      expect(mesh.instanceMatrix.array).toBe(buffers[slot][0]);
      expect(mesh.instanceColor?.array).toBe(buffers[slot][1]);
      expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.count);
      if (mesh.count) {
        mesh.getMatrixAt(0, matrix);
        position.setFromMatrixPosition(matrix);
        expect(Number.isFinite(position.length())).toBe(true);
      }
    }
  }
  expect(space.objects).toHaveLength(13);
  expect(maxRocks).toBeGreaterThan(20);
  expect(maxRocks).toBeLessThanOrEqual(RUNNER.rocksPerRegion);
  expect(maxGates).toBe(RUNNER.gatesPerRegion * 16);
  const matrices = space.meshes.map((mesh) => Array.from(mesh.instanceMatrix.array));
  const stars = space.objects[5].geometry.getAttribute("position").array.slice();
  for (const [playing, enabled, reduced] of [[false, true, false], [true, false, false], [true, true, true]]) {
    advanceRunnerJourney(journey, updateRunnerMotion(motion, 0.05, playing, enabled, reduced, loud));
    space.update(journey, motion, true);
    expect(space.meshes.map((mesh) => Array.from(mesh.instanceMatrix.array))).toEqual(matrices);
    expect(space.objects[5].geometry.getAttribute("position").array).toEqual(stars);
  }
  const colorful = space.objects[5].geometry.getAttribute("color").array.slice();
  space.update(journey, motion, false);
  expect(space.objects[5].geometry.getAttribute("color").array).not.toEqual(colorful);
  space.dispose();
  expect(disposed).toEqual(resources);
  expect(meshDisposals.size).toBe(space.meshes.length);
});

test("qualified SURGE extends peripheral trails, lights gates and expands only the fixed wave pool", () => {
  const space = createRunnerSpace();
  const journey = createRunnerJourney();
  advanceRunnerJourney(journey, 1500);
  const motion = createRunnerMotion();
  for (let i = 0; i < 100; i += 1) updateRunnerMotion(motion, 0.05, true, true, false, loud);
  space.update(journey, motion, true);
  const trailBuffer = space.objects[6].geometry.getAttribute("position").array;
  const normalLength = Math.abs(trailBuffer[2] - trailBuffer[5]);
  const normalGate = space.meshes[5].instanceColor!.array.slice();
  const normalBackground = space.background.clone();
  expect(space.meshes[4].visible).toBe(false);
  for (let i = 0; i < 10; i += 1) updateRunnerMotion(motion, 0.05, true, true, false, quiet);
  for (let i = 0; i < 8; i += 1) updateRunnerMotion(motion, 0.05, true, true, false, loud);
  space.update(journey, motion, true);
  expect(motion.surgeCount).toBe(1);
  expect(space.objects[6].geometry.getAttribute("position").array).toBe(trailBuffer);
  expect(Math.abs(trailBuffer[2] - trailBuffer[5])).toBeGreaterThan(normalLength * 3);
  expect(space.meshes[5].instanceColor!.array).not.toEqual(normalGate);
  expect(space.background.b).toBeGreaterThan(normalBackground.b * 5);
  const waves = space.meshes[4];
  expect(waves.count).toBe(3);
  expect(waves.visible).toBe(true);
  const matrix = new Matrix4();
  const scale = new Vector3();
  waves.getMatrixAt(0, matrix);
  const startScale = scale.setFromMatrixScale(matrix).x;
  for (let i = 0; i < 8; i += 1) updateRunnerMotion(motion, 0.05, true, true, false, loud);
  space.update(journey, motion, true);
  waves.getMatrixAt(0, matrix);
  expect(scale.setFromMatrixScale(matrix).x).toBeGreaterThan(startScale);
  for (let i = 0; i < 80; i += 1) updateRunnerMotion(motion, 0.05, true, true, false, loud);
  space.update(journey, motion, true);
  expect(waves.visible).toBe(false);
  space.dispose();
});

async function runtime(page: Page) {
  return page.evaluate(() => window.__DSFM_TEST__!.environment);
}

async function pixels(page: Page) {
  return page.getByLabel("Signal Runner 2.0 canvas").evaluate((element) =>
    new Promise<{ hash: number; lit: number; intensity: number; accents: number }>((resolvePixels) => {
      requestAnimationFrame(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 100;
        const context = canvas.getContext("2d")!;
        context.drawImage(element as HTMLCanvasElement, 0, 0, 160, 100);
        const data = context.getImageData(0, 0, 160, 100).data;
        let hash = 0, lit = 0, intensity = 0, accents = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          hash = (Math.imul(hash, 31) + r + g * 3 + b * 7) | 0;
          intensity += r + g + b;
          if (Math.max(r, g, b) > 12) lit += 1;
          if (r > g * 1.3 || (g > r * 1.3 && g > b * 1.3)) accents += 1;
        }
        resolvePixels({ hash, lit, intensity, accents });
      });
    }));
}

test.describe("Signal Runner 2.0 player", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/player/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByLabel("Visual environment").selectOption("signal-runner-2");
  });

  test("both siblings remain selectable and persist independently", async ({ page, pageErrors }) => {
    const selector = page.getByLabel("Visual environment");
    const group = selector.locator('optgroup[label="3D EXPERIENCES"]');
    await expect(group.locator('option[value="signal-runner"]')).toHaveText("Signal Runner");
    await expect(group.locator('option[value="signal-runner-2"]')).toHaveText("Signal Runner 2.0");
    await page.reload();
    await expect(selector).toHaveValue("signal-runner-2");
    await selector.selectOption("signal-runner");
    await page.reload();
    await expect(selector).toHaveValue("signal-runner");
    await expect(page.getByLabel("Signal Runner 2.0 canvas")).toHaveCount(0);
    await expect(page.locator(".player-shell__scene canvas")).toHaveCount(1);
    expect(pageErrors).toEqual([]);
  });

  test("idle, pause, MOTION and reduced motion freeze pixels and resume without preference changes", async ({ page, pageErrors }) => {
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const idle = await pixels(page);
    await page.waitForTimeout(250);
    expect(await pixels(page)).toEqual(idle);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed, { timeout: 15_000 }).toBeGreaterThan(10);
    const moving = await pixels(page);
    await expect.poll(async () => (await pixels(page)).hash).not.toBe(moving.hash);
    for (const control of ["pause", "motion"] as const) {
      if (control === "pause") await page.getByRole("button", { name: "Pause", exact: true }).click();
      else await page.locator("label").filter({ hasText: /^Motion$/ }).click();
      await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
      const distance = (await runtime(page)).travelPosition!;
      const frozen = await pixels(page);
      await page.waitForTimeout(300);
      expect(await pixels(page)).toEqual(frozen);
      expect((await runtime(page)).travelPosition).toBe(distance);
      if (control === "pause") await page.getByRole("button", { name: "Play", exact: true }).click();
      else await page.locator("label").filter({ hasText: /^Motion$/ }).click();
      await expect.poll(async () => (await runtime(page)).travelPosition).toBeGreaterThan(distance);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const reduced = await pixels(page);
    await page.waitForTimeout(350);
    expect(await pixels(page)).toEqual(reduced);
    expect(await page.evaluate(() => window.__DSFM_TEST__!.controls.motion)).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test("real audio volume relaxes propulsion and mute settles to zero", async ({ page, pageErrors }) => {
    test.setTimeout(60_000);
    const volume = page.getByRole("slider", { name: "Volume" });
    await volume.fill("1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByLabel("Seek playback").fill("43");
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 15_000 }).toBeGreaterThan(60);
    await volume.fill("0.03");
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 10_000 }).toBeLessThan(2);
    await volume.fill("0");
    await expect.poll(async () => (await runtime(page)).motionSpeed, { timeout: 15_000 }).toBe(0);
    const distance = (await runtime(page)).travelPosition;
    await page.waitForTimeout(250);
    expect((await runtime(page)).travelPosition).toBe(distance);
    expect(await page.evaluate(() => window.__DSFM_TEST__!.controls)).toMatchObject({ motion: true, chroma: true });
    expect(pageErrors).toEqual([]);
  });

  test("real low-to-high audio qualifies SURGE and freezes its visible burst", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(45_000);
    const volume = page.getByRole("slider", { name: "Volume" });
    await volume.fill("0.1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByLabel("Seek playback").fill("43");
    await expect.poll(async () => (await runtime(page)).travelPosition).toBeGreaterThan(0);
    await page.waitForTimeout(800);
    const before = (await runtime(page)).surgeCount;
    await volume.fill("1");
    await expect.poll(async () => (await runtime(page)).surgeCount, { intervals: [50] }).toBe(before + 1);
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { intervals: [50] })
      .toBeGreaterThan(RUNNER.normalMax * 1.5);
    await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const burst = await pixels(page);
    expect(burst.lit).toBeGreaterThan(100);
    await page.waitForTimeout(300);
    expect(await pixels(page)).toEqual(burst);
    await page.screenshot({ path: testInfo.outputPath("surge-frozen.png") });
    await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { intervals: [50] })
      .toBeGreaterThan(RUNNER.normalMax * 1.5);
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed).toBeLessThanOrEqual(RUNNER.normalMax);
    expect((await runtime(page)).surgeCount).toBe(before + 1);
    expect(pageErrors).toEqual([]);
  });

  test("three encounter regions render with distinct chroma and fit desktop/mobile", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(180_000);
    const shaderErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /THREE|shader|WebGL/i.test(message.text())) shaderErrors.push(message.text());
    });
    await page.addInitScript(() => {
      window.__RUNNER2_DRAWS__ = { current: 0, max: 0 };
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => request((now) => {
        window.__RUNNER2_DRAWS__.current = 0;
        callback(now);
        window.__RUNNER2_DRAWS__.max = Math.max(window.__RUNNER2_DRAWS__.max, window.__RUNNER2_DRAWS__.current);
      });
      const prototype = WebGL2RenderingContext.prototype;
      const drawElements = prototype.drawElements;
      const drawArrays = prototype.drawArrays;
      const drawInstances = prototype.drawElementsInstanced;
      prototype.drawElements = function (...args) {
        window.__RUNNER2_DRAWS__.current += 1;
        drawElements.apply(this, args);
      };
      prototype.drawArrays = function (...args) {
        window.__RUNNER2_DRAWS__.current += 1;
        drawArrays.apply(this, args);
      };
      prototype.drawElementsInstanced = function (...args) {
        window.__RUNNER2_DRAWS__.current += 1;
        drawInstances.apply(this, args);
      };
      const drawArrayInstances = prototype.drawArraysInstanced;
      prototype.drawArraysInstanced = function (...args) {
        window.__RUNNER2_DRAWS__.current += 1;
        drawArrayInstances.apply(this, args);
      };
    });
    await page.reload();
    await page.getByRole("slider", { name: "Volume" }).fill("1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByLabel("Seek playback").fill("43");
    const observations = [];
    for (const [distance, name] of [[40, "open-warp"], [575, "asteroid-approach"], [690, "asteroid-bypass"],
      [840, "recentering"], [1170, "traffic"], [1530, "signal-gates"]] as const) {
      await expect.poll(async () => (await runtime(page)).travelPosition, { timeout: 60_000, intervals: [100] })
        .toBeGreaterThan(distance);
      await page.locator("label").filter({ hasText: /^Motion$/ }).click();
      await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
      const telemetry = await runtime(page);
      await page.getByRole("button", { name: "Collapse player panel" }).click();
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(150);
        const sample = await pixels(page);
        expect(sample.lit).toBeGreaterThan(50);
        expect(sample.lit).toBeLessThan(12800);
        const box = await page.getByLabel("Signal Runner 2.0 canvas").boundingBox();
        expect(box!.width).toBe(viewport.width);
        expect(box!.height).toBe(viewport.height);
        await page.screenshot({ path: testInfo.outputPath(`${name}-${viewport.width}.png`) });
        observations.push({ name, viewport, sample, telemetry });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole("button", { name: "Expand player panel" }).click();
      const chroma = await pixels(page);
      await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
      const restrained = await pixels(page);
      // Natural hull/rock surfaces stay neutral; CHROMA adds accents rather than repainting them.
      expect(chroma.intensity).toBeGreaterThan(restrained.intensity);
      expect(chroma.accents).toBeGreaterThan(restrained.accents);
      await page.screenshot({ path: testInfo.outputPath(`${name}-chroma-off.png`) });
      await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
      await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    }
    await testInfo.attach("encounter-samples", { body: JSON.stringify(observations, null, 2), contentType: "application/json" });
    const drawCalls = await page.evaluate(() => window.__RUNNER2_DRAWS__.max);
    expect(drawCalls).toBeGreaterThanOrEqual(7);
    expect(drawCalls).toBeLessThanOrEqual(13);
    console.log(`Signal Runner 2.0 observed maximum: ${drawCalls} WebGL draws per frame.`);
    await testInfo.attach("maximum-draw-calls", { body: String(drawCalls), contentType: "text/plain" });
    expect(shaderErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("switching releases GPU resources, observers, resize listeners, RAF and FPS", async ({ page, pageErrors }) => {
    await page.addInitScript(() => {
      const resources = {
        frames: new Set<number>(), buffers: new Set<WebGLBuffer>(), programs: new Set<WebGLProgram>(),
        observers: new Set<ResizeObserver>(), resizeListeners: new Set<EventListenerOrEventListenerObject>(),
      };
      Object.assign(window, { __RUNNER2_RESOURCES__: resources });
      const request = window.requestAnimationFrame.bind(window);
      const cancel = window.cancelAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => {
        const id = request((time) => { resources.frames.delete(id); callback(time); });
        resources.frames.add(id);
        return id;
      };
      window.cancelAnimationFrame = (id) => { resources.frames.delete(id); cancel(id); };
      const observe = ResizeObserver.prototype.observe;
      const disconnect = ResizeObserver.prototype.disconnect;
      ResizeObserver.prototype.observe = function (target, options) {
        resources.observers.add(this);
        observe.call(this, target, options);
      };
      ResizeObserver.prototype.disconnect = function () {
        resources.observers.delete(this);
        disconnect.call(this);
      };
      const add = window.addEventListener.bind(window);
      const remove = window.removeEventListener.bind(window);
      window.addEventListener = (type, listener, options) => {
        if (type === "resize" && listener) resources.resizeListeners.add(listener);
        add(type, listener, options);
      };
      window.removeEventListener = (type, listener, options) => {
        if (type === "resize" && listener) resources.resizeListeners.delete(listener);
        remove(type, listener, options);
      };
      const prototype = WebGL2RenderingContext.prototype;
      const createBuffer = prototype.createBuffer, deleteBuffer = prototype.deleteBuffer;
      const createProgram = prototype.createProgram, deleteProgram = prototype.deleteProgram;
      prototype.createBuffer = function () {
        const buffer = createBuffer.call(this);
        resources.buffers.add(buffer);
        return buffer;
      };
      prototype.deleteBuffer = function (buffer) {
        if (buffer) resources.buffers.delete(buffer);
        deleteBuffer.call(this, buffer);
      };
      prototype.createProgram = function () {
        const program = createProgram.call(this);
        if (program) resources.programs.add(program);
        return program;
      };
      prototype.deleteProgram = function (program) {
        if (program) resources.programs.delete(program);
        deleteProgram.call(this, program);
      };
    });
    await page.reload();
    const selector = page.getByLabel("Visual environment");
    const counts = () => page.evaluate(() => {
      const r = window.__RUNNER2_RESOURCES__;
      return { frames: r.frames.size, buffers: r.buffers.size, programs: r.programs.size,
        observers: r.observers.size, listeners: r.resizeListeners.size };
    });
    await selector.selectOption("minimal");
    const baseline = await counts();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await selector.selectOption("signal-runner-2");
      await expect(page.getByLabel("Signal Runner 2.0 canvas")).toHaveCount(1);
      await expect.poll(async () => Number(await page.locator(".visual-feed-window__fps .visual-feed-window__metric-value").textContent()))
        .toBeGreaterThan(0);
      const mounted = await counts();
      expect(mounted.frames).toBe(baseline.frames + 1);
      expect(mounted.observers).toBe(baseline.observers + 1);
      expect(mounted.listeners).toBe(baseline.listeners + 1);
      expect(mounted.buffers).toBeGreaterThan(baseline.buffers);
      await selector.selectOption("minimal");
      await expect(page.getByLabel("Signal Runner 2.0 canvas")).toHaveCount(0);
      await expect.poll(counts).toEqual(baseline);
      await page.waitForTimeout(1100);
      await expect(page.locator(".visual-feed-window__fps .visual-feed-window__metric-value")).toHaveText("---");
    }
    expect(pageErrors).toEqual([]);
  });
});

declare global {
  interface Window {
    __RUNNER2_DRAWS__: { current: number; max: number };
    __RUNNER2_RESOURCES__: {
      frames: Set<number>; buffers: Set<WebGLBuffer>; programs: Set<WebGLProgram>;
      observers: Set<ResizeObserver>; resizeListeners: Set<EventListenerOrEventListenerObject>;
    };
  }
}
