import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Matrix4, Vector3, ShaderLib } from "three";
import type { BufferGeometry, Material } from "three";
import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";
import {
  RUNNER, createRunnerJourney, advanceRunnerJourney, runnerEncounter, runnerPathX, runnerPathY,
  createRunnerMotion, updateRunnerMotion, runnerSurgeEnvelope, runnerGateActivation,
  createRunnerFlight, sampleRunnerFlight, runnerMajorSize, createRunnerTraffic, sampleRunnerTraffic,
  runnerRegionStart, runnerRegionLength, runnerRegionIndex, runnerBypassDistance,
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
  const gates = journey.regions.map((region) => [...region.gates]);
  const kinds = new Set<string>();
  for (let frame = 0; frame < 30_000; frame += 1) {
    advanceRunnerJourney(journey, RUNNER.surgeMax / 60);
    if (frame % 120) continue;
    for (let slot = 0; slot < RUNNER.regionCount; slot += 1) {
      const region = journey.regions[slot];
      expect(region).toBe(regions[slot]);
      expect(region.rocks).toHaveLength(RUNNER.rocksPerRegion);
      expect(region.rocks.every((rock, index) => rock === rocks[slot][index])).toBe(true);
      expect(region.gates.every((gate, index) => gate === gates[slot][index])).toBe(true);
      expect(region.kind).toBe(runnerEncounter(region.index));
      expect(region.start + region.length).toBeGreaterThanOrEqual(journey.distance - 30);
      expect(region.start).toBe(runnerRegionStart(region.index));
      expect(region.length).toBe(runnerRegionLength(region.index));
      kinds.add(region.kind);
      if (region.kind !== "open-warp") {
        expect(runnerEncounter(region.index + 1)).toBe("open-warp");
        expect(runnerEncounter(region.index - 1)).toBe("open-warp");
      }
    }
    expect(journey.regions.some((region) => region.start <= journey.distance
      && region.start + region.length > journey.distance)).toBe(true);
    expect(Math.max(...journey.regions.map((region) => region.start + region.length)))
      .toBeGreaterThan(journey.distance + RUNNER.far);
  }
  expect(kinds).toEqual(new Set(["open-warp", "asteroid-field", "signal-gates"]));
  expect(journey.recycled).toBeGreaterThan(150);
});

test("seeded gates mix widely spaced singles, rare short sleeves, clusters and hero diameters", () => {
  const families = new Set<string>();
  const gaps: number[] = [];
  const radii: number[] = [];
  const thicknesses: number[] = [];
  let heroes = 0, sleeves = 0, count = 0;
  for (const seed of [RUNNER.seed, 42, 999, 90210]) {
    const journey = createRunnerJourney(seed);
    const repeat = createRunnerJourney(seed);
    for (let index = 0; index < 96; index += 1) {
      const distance = runnerRegionStart(index, seed);
      advanceRunnerJourney(journey, distance - journey.distance);
      advanceRunnerJourney(repeat, distance - repeat.distance);
      const region = journey.regions.find((candidate) => candidate.index === index)!;
      expect(region.gates).toEqual(repeat.regions.find((candidate) => candidate.index === index)!.gates);
      const active = region.gates.filter((gate) => gate.active);
      if (region.kind !== "signal-gates") {
        expect(active).toHaveLength(0);
        continue;
      }
      expect(active.length).toBeGreaterThanOrEqual(2);
      expect(active.length).toBeLessThanOrEqual(RUNNER.gatesPerRegion);
      for (let i = 0; i < active.length; i += 1) {
        const gate = active[i];
        count += 1;
        families.add(gate.family);
        radii.push(gate.radius);
        thicknesses.push(gate.thickness);
        expect(gate.distance).toBeGreaterThan(region.start + 60);
        expect(gate.distance + gate.depth).toBeLessThan(region.start + region.length - 80);
        if (i) gaps.push(gate.distance - active[i - 1].distance);
        if (gate.hero) {
          heroes += 1;
          expect(gate.radius).toBeGreaterThanOrEqual(23);
        }
        if (gate.family === "sleeve") {
          sleeves += 1;
          expect(gate.depth).toBeGreaterThanOrEqual(32);
          expect(gate.depth).toBeLessThanOrEqual(44);
          expect(gate.depth / RUNNER.normalMax).toBeLessThan(0.56);
          expect(active[i + 1].distance - gate.distance - gate.depth).toBeGreaterThan(10);
        } else expect(gate.depth).toBe(0);
      }
    }
  }
  expect(families).toEqual(new Set(["structural", "portal", "sleeve"]));
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(55);
  expect(Math.min(...gaps)).toBeLessThan(85);
  expect(Math.max(...gaps)).toBeGreaterThan(275);
  expect(gaps.filter((gap) => gap > 230).length / gaps.length).toBeGreaterThan(0.45);
  expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(1.8);
  expect(Math.max(...thicknesses) - Math.min(...thicknesses)).toBeGreaterThan(0.8);
  expect(heroes / count).toBeGreaterThan(0.08);
  expect(heroes / count).toBeLessThan(0.15);
  expect(sleeves / count).toBeGreaterThan(0.1);
  expect(sleeves / count).toBeLessThan(0.16);
});

test("only asteroid fields expand to three times the travel length with three spaced bypasses", () => {
  for (const seed of [RUNNER.seed, 42, 999, 90210]) {
    const journey = createRunnerJourney(seed);
    for (let index = 0; index < 32; index += 1) {
      const start = runnerRegionStart(index, seed);
      const length = runnerRegionLength(index, seed);
      expect(runnerRegionIndex(start, seed)).toBe(index);
      expect(runnerRegionIndex(start + length - 0.001, seed)).toBe(index);
      expect(runnerRegionStart(index + 1, seed)).toBe(start + length);
      advanceRunnerJourney(journey, start - journey.distance);
      const region = journey.regions.find((candidate) => candidate.index === index)!;
      expect(region).toBeDefined();
      if (region.kind !== "asteroid-field") {
        expect(length).toBe(480);
        continue;
      }
      expect(length / 480).toBe(3);
      expect(length / RUNNER.normalMax).toBe(18);
      const obstacles = region.rocks.slice(0, RUNNER.bypassCount);
      expect(obstacles).toHaveLength(3);
      expect(obstacles.filter((rock) => rock.size >= 26)).toHaveLength(1);
      expect(region.rocks.filter((rock) => rock.size <= 8.5).length).toBe(105);
      for (let i = 0; i < obstacles.length; i += 1) {
        expect(obstacles[i].distance).toBe(runnerBypassDistance(index, i, seed));
        expect(obstacles[i].size).toBe(runnerMajorSize(index, seed, i));
        if (i === 0) continue;
        const gap = obstacles[i].distance - obstacles[i - 1].distance;
        expect(gap).toBe(420);
        expect(gap / RUNNER.surgeMax).toBeGreaterThanOrEqual(1.75);
        const rest = (obstacles[i].distance + obstacles[i - 1].distance) / 2;
        expect(Math.hypot(runnerPathX(rest, seed) - Math.sin(rest / 170) * 2.2,
          runnerPathY(rest, seed) - Math.sin(rest / 231) * 1.1)).toBeLessThan(4);
      }
      expect(Math.max(...region.rocks.map((rock) => rock.distance))
        - Math.min(...region.rocks.map((rock) => rock.distance))).toBeGreaterThan(1000);
    }
  }
});

test("discarded planet and nebula have no scheduled kinds or allocated draw resources", () => {
  const space = createRunnerSpace();
  expect(new Set(Array.from({ length: 64 }, (_, index) => runnerEncounter(index))))
    .toEqual(new Set(["open-warp", "asteroid-field", "signal-gates"]));
  expect(space.objects.some((object) => object.geometry.type === "SphereGeometry"
    || object.geometry.type === "RingGeometry")).toBe(false);
  expect(space.objects.filter((object) => object.type === "Points")
    .map((object) => object.geometry.getAttribute("position").count)).toEqual([RUNNER.starCount, RUNNER.exhaustCount]);
  expect(space.traffic.objects).toHaveLength(4);
  space.dispose();
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
        for (const gate of region.gates) {
          if (!gate.active || journey.distance < gate.distance - 15
            || journey.distance > gate.distance + gate.depth + 15) continue;
          const distance = gate.distance;
          expect(gate.radius * 0.945 - 0.05
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
  let maximumLateral = 0, maximumVertical = 0;
  let maximumAngularStep = 0;
  let maximumYaw = 0, maximumPitch = 0, maximumRoll = 0;
  const horizontal = new Set<number>(), vertical = new Set<number>();
  for (const seed of [RUNNER.seed, 999, 42, 90210, 0, 1, 7, 23, 1337, 2026]) {
    const journey = createRunnerJourney(seed);
    for (let regionIndex = 0; regionIndex < 40; regionIndex += 1) {
      if (runnerEncounter(regionIndex, seed) !== "asteroid-field") continue;
      const start = runnerRegionStart(regionIndex, seed);
      advanceRunnerJourney(journey, start - journey.distance);
      const region = journey.regions.find((candidate) => candidate.index === regionIndex)!;
      expect(region.rocks[0].size).toBe(runnerMajorSize(regionIndex, seed));
      const obstacle = region.rocks[0];
      expect(obstacle.size).toBeGreaterThanOrEqual(12);
      const center = runnerBypassDistance(regionIndex, 0, seed);
      const baselineX = Math.sin(center / 170) * 2.2;
      const baselineY = Math.sin(center / 231) * 1.1;
      minUnsteeredClearance = Math.min(minUnsteeredClearance,
        Math.hypot(obstacle.x - baselineX, obstacle.y - baselineY) - obstacle.size * RUNNER.rockStretch);
      sampleRunnerFlight(start, seed, flight);
      expect(sampleRunnerFlight(center, seed, createRunnerFlight()))
        .toEqual(sampleRunnerFlight(center, seed, createRunnerFlight()));
      for (let obstacle = 0; obstacle < RUNNER.bypassCount; obstacle += 1) {
        const crest = runnerBypassDistance(regionIndex, obstacle, seed);
        horizontal.add(Math.sign(runnerPathX(crest, seed) - Math.sin(crest / 170) * 2.2));
        vertical.add(Math.sign(runnerPathY(crest, seed) - Math.sin(crest / 231) * 1.1));
      }
      let previousYaw = flight.yaw, previousPitch = flight.pitch, previousRoll = flight.roll;
      for (let local = 0; local <= region.length; local += 2) {
        sampleRunnerFlight(start + local, seed, flight);
        for (const rock of region.rocks) {
          minClearance = Math.min(minClearance,
            Math.hypot(flight.x - rock.x, flight.y - rock.y, start + local - rock.distance)
              - rock.size * RUNNER.rockStretch);
        }
        maximumTranslation = Math.max(maximumTranslation, Math.hypot(
          flight.x - Math.sin((start + local) / 170) * 2.2,
          flight.y - Math.sin((start + local) / 231) * 1.1));
        maximumLateral = Math.max(maximumLateral, Math.abs(flight.x));
        maximumVertical = Math.max(maximumVertical, Math.abs(flight.y));
        maximumAngularStep = Math.max(maximumAngularStep,
          Math.abs(flight.yaw - previousYaw), Math.abs(flight.pitch - previousPitch), Math.abs(flight.roll - previousRoll));
        maximumYaw = Math.max(maximumYaw, Math.abs(flight.yaw));
        maximumPitch = Math.max(maximumPitch, Math.abs(flight.pitch));
        maximumRoll = Math.max(maximumRoll, Math.abs(flight.roll));
        previousYaw = flight.yaw; previousPitch = flight.pitch; previousRoll = flight.roll;
      }
      expect(flight.x).toBeCloseTo(Math.sin((start + region.length) / 170) * 2.2, 8);
      expect(flight.y).toBeCloseTo(Math.sin((start + region.length) / 231) * 1.1, 8);
    }
  }
  expect(minUnsteeredClearance).toBeLessThan(-16);
  expect(minClearance).toBeGreaterThan(6);
  expect(maximumTranslation).toBeGreaterThan(44);
  expect(maximumTranslation).toBeLessThanOrEqual(RUNNER.heroMax * RUNNER.rockStretch + 9);
  expect(maximumLateral).toBeLessThan(52);
  expect(maximumVertical).toBeLessThan(27);
  expect(horizontal).toEqual(new Set([-1, 1]));
  expect(vertical).toEqual(new Set([-1, 1]));
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

test("all gate families retain a clear swept aperture through rotation, sleeve exits and recycling", () => {
  const space = createRunnerSpace();
  const journey = createRunnerJourney();
  const motion = createRunnerMotion();
  const matrix = new Matrix4();
  const vertex = new Vector3();
  let minimum = Infinity;
  const families = new Set<string>();
  for (let encounter = 0; encounter < 8; encounter += 1) {
    const index = 3 + encounter * 4;
    advanceRunnerJourney(journey, runnerRegionStart(index) - journey.distance);
    const region = journey.regions.find((candidate) => candidate.index === index)!;
    for (const gate of region.gates.filter((candidate) => candidate.active)) {
      families.add(gate.family);
      for (const offset of [0, gate.depth / 2, gate.depth]) {
        const distance = gate.distance + offset;
        advanceRunnerJourney(journey, distance - journey.distance);
        for (let step = 0; step < 3; step += 1) {
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
    }
  }
  expect(minimum).toBeGreaterThan(12);
  expect(minimum).toBeLessThan(14);
  expect(families.size).toBe(3);
  space.dispose();
});

test("gate energy is bounded, kick softened, chroma restrained and every lighting clock freezes", () => {
  const space = createRunnerSpace();
  const journey = createRunnerJourney();
  advanceRunnerJourney(journey, runnerRegionStart(3));
  const motion = createRunnerMotion();
  const gateSpace = space.gateSpace;
  space.update(journey, motion, true);
  const resting = gateSpace.arcs.instanceColor!.array.slice();
  updateRunnerMotion(motion, 1 / 60, true, true, false, { ...loud, kickPulse: 1 });
  expect(motion.gateKick).toBeGreaterThan(0.2);
  expect(motion.gateKick).toBeLessThan(0.3);
  space.update(journey, motion, true);
  expect(gateSpace.arcs.instanceColor!.array).not.toEqual(resting);
  expect(motion.surgeCount).toBe(0);
  for (let i = 0; i < 60; i += 1) updateRunnerMotion(motion, 1 / 60, true, true, false, { ...loud, kickPulse: 1 });
  space.update(journey, motion, true);
  expect(motion.gateKick).toBeLessThanOrEqual(1);
  expect(Math.max(...gateSpace.arcs.instanceColor!.array.slice(0, gateSpace.arcs.count * 3))).toBeLessThan(1.25);
  expect(gateSpace.membranes.count).toBe(1);
  const material = gateSpace.membranes.material;
  expect(material.transparent).toBe(true);
  expect(material.depthWrite).toBe(false);
  expect(material.forceSinglePass).toBe(true);
  const state = () => ({
    kick: motion.gateKick, activity: motion.gateActivity,
    clock: material.uniforms.clock.value, shaderKick: material.uniforms.kick.value,
    shaderActivity: material.uniforms.activity.value,
    matrices: gateSpace.meshes.map((mesh) => mesh.instanceMatrix.array.slice()),
    colors: gateSpace.meshes.map((mesh) => mesh.instanceColor!.array.slice()),
  });
  const frozen = state();
  for (const [playing, enabled, reduced] of [[false, true, false], [true, false, false], [true, true, true]]) {
    for (let frame = 0; frame < 30; frame += 1) {
      updateRunnerMotion(motion, 0.05, playing, enabled, reduced, { ...quiet, kickPulse: 0 });
      space.update(journey, motion, true);
    }
    expect(state()).toEqual(frozen);
  }
  space.update(journey, motion, false);
  expect(material.uniforms.kick.value).toBe(0);
  expect(material.uniforms.activity.value).toBe(0);
  expect(Math.max(...gateSpace.arcs.instanceColor!.array.slice(0, gateSpace.arcs.count * 3))).toBeLessThan(0.3);
  for (const snapshot of [undefined, { ...loud, isActive: false }, { ...loud, kickPulse: NaN }]) {
    for (let i = 0; i < 60; i += 1) updateRunnerMotion(motion, 0.05, true, true, false, snapshot);
    expect(motion.gateKick).toBeLessThan(0.001);
  }
  const portal = journey.regions.find((region) => region.index === 3)!.gates[0];
  advanceRunnerJourney(journey, portal.distance - journey.distance - 8);
  space.update(journey, motion, true);
  expect(Array.from(gateSpace.membranes.instanceColor!.array.slice(0, 3))).toEqual([0, 0, 0]);
  space.dispose();
});

test("six rare seeded spacecraft crossings stay safely ahead and face their direction of travel", () => {
  const space = createRunnerSpace();
  const journey = createRunnerJourney();
  const motion = createRunnerMotion();
  const traffic = createRunnerTraffic();
  const hullRadius = 27;
  let starts = 0, previousVisible = false, minimumClearance = Infinity;
  const variants = new Set<number>();
  const directions = new Set<number>();
  for (let distance = 0; distance < runnerRegionStart(48); distance += 4) {
    sampleRunnerTraffic(distance, traffic);
    expect(traffic).toEqual(sampleRunnerTraffic(distance, createRunnerTraffic()));
    if (traffic.visible && !previousVisible) starts += 1;
    if (traffic.visible) {
      expect(runnerEncounter(runnerRegionIndex(distance))).toBe("open-warp");
      minimumClearance = Math.min(minimumClearance, Math.hypot(
        traffic.x - runnerPathX(distance), traffic.y - runnerPathY(distance), traffic.z) - hullRadius);
      expect(traffic.z).toBeLessThanOrEqual(-145);
      variants.add(traffic.variant);
      directions.add(Math.sign(traffic.dx));
    }
    previousVisible = traffic.visible;
  }
  expect(starts).toBe(6);
  expect(variants.size).toBe(6);
  expect(directions).toEqual(new Set([-1, 1]));
  expect(minimumClearance).toBeGreaterThan(140);
  const hull = space.traffic.ship.geometry.getAttribute("position");
  const vertex = new Vector3();
  for (let i = 0; i < hull.count; i += 1) {
    expect(vertex.fromBufferAttribute(hull, i).length() * 1.2).toBeLessThan(hullRadius);
  }
  for (let event = 0; event < 6; event += 1) {
    const start = runnerRegionStart(2 + event * 8);
    expect(sampleRunnerTraffic(start + 40, traffic).fade).toBe(0);
    expect(sampleRunnerTraffic(start + 430, traffic).fade).toBe(0);
    advanceRunnerJourney(journey, start + 235 - journey.distance);
    space.update(journey, motion, true);
    const sample = space.traffic.traffic;
    const nose = new Vector3(1, 0, 0).applyQuaternion(space.traffic.ship.quaternion);
    expect(nose.dot(new Vector3(sample.dx, sample.dy, sample.dz).normalize())).toBeCloseTo(1, 8);
  }
  expect(sampleRunnerTraffic(runnerRegionStart(2, 42) + 235, createRunnerTraffic(), 42).variant)
    .not.toBe(sampleRunnerTraffic(runnerRegionStart(2) + 235, createRunnerTraffic()).variant);
  space.dispose();
});

test("pooled ship exhaust is bounded, chromatic and freezes through all motion gates", () => {
  const space = createRunnerSpace();
  const journey = createRunnerJourney();
  const motion = createRunnerMotion();
  const { ship, lamps, plumes, exhaust } = space.traffic;
  const position = exhaust.geometry.getAttribute("position");
  const tint = exhaust.geometry.getAttribute("color");
  const size = exhaust.geometry.getAttribute("exhaustSize");
  const buffers = [position.array, tint.array, size.array, lamps.instanceMatrix.array, plumes.instanceMatrix.array];
  expect(position.count).toBe(64);
  expect(lamps.count).toBe(6);
  expect(plumes.count).toBe(2);
  const capture = () => ({
    ship: ship.matrix.toArray(), visible: space.traffic.objects.map((object) => object.visible),
    positions: Array.from(position.array), colors: Array.from(tint.array), sizes: Array.from(size.array),
    lamps: Array.from(lamps.instanceMatrix.array), plumes: Array.from(plumes.instanceMatrix.array),
    lampColors: Array.from(lamps.instanceColor!.array), plumeColors: Array.from(plumes.instanceColor!.array),
    opacity: space.traffic.objects.map((object) => object.material.opacity),
  });
  for (const distance of [runnerRegionStart(2) + 95, runnerRegionStart(2) + 235, runnerRegionStart(10) + 235]) {
    advanceRunnerJourney(journey, distance - journey.distance);
    updateRunnerMotion(motion, 0.05, true, true, false, loud);
    space.update(journey, motion, true);
    const before = capture();
    for (const [playing, enabled, reduced] of [[false, true, false], [true, false, false], [true, true, true]]) {
      advanceRunnerJourney(journey, updateRunnerMotion(motion, 1, playing, enabled, reduced, loud));
      space.update(journey, motion, true);
      expect(capture()).toEqual(before);
    }
    space.update(journey, motion, false);
    expect(Array.from(position.array)).toEqual(before.positions);
    expect(Array.from(tint.array)).not.toEqual(before.colors);
    updateRunnerMotion(motion, 0.05, true, true, false, loud);
    space.update(journey, motion, true);
    expect(Array.from(position.array)).not.toEqual(before.positions);
    [position.array, tint.array, size.array, lamps.instanceMatrix.array, plumes.instanceMatrix.array]
      .forEach((buffer, index) => expect(buffer).toBe(buffers[index]));
    const inverse = ship.matrix.clone().invert();
    const local = new Vector3();
    for (let i = 0; i < position.count; i += 1) {
      local.fromBufferAttribute(position, i).applyMatrix4(inverse);
      expect(local.x).toBeLessThan(-11.9);
      expect(local.x).toBeGreaterThanOrEqual(-60.01);
      expect(Math.abs(local.y)).toBeLessThan(4.4);
      expect(Math.abs(local.z)).toBeLessThan(10.7);
    }
  }
  advanceRunnerJourney(journey, 240);
  space.update(journey, motion, true);
  expect(space.traffic.objects.every((object) => !object.visible)).toBe(true);
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
  const instanced = [...space.meshes, space.traffic.lamps, space.traffic.plumes];
  instanced.forEach((mesh) => mesh.addEventListener("dispose", () => meshDisposals.add(mesh)));
  const matrix = new Matrix4();
  const position = new Vector3();
  let maxRocks = 0;
  let maxGates = 0;
  let maxGateTriangles = 0;
  for (let i = 0; i < 1400; i += 1) {
    advanceRunnerJourney(journey, 12);
    updateRunnerMotion(motion, 0.05, true, true, false, i % 100 < 15 ? quiet : loud);
    space.update(journey, motion, true);
    maxRocks = Math.max(maxRocks, space.meshes[0].count);
    maxGates = Math.max(maxGates, space.meshes[1].count);
    maxGateTriangles = Math.max(maxGateTriangles, space.gateSpace.meshes.reduce(
      (sum, mesh) => sum + mesh.count * mesh.geometry.index!.count / 3, 0));
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
  expect(space.objects).toHaveLength(14);
  expect(maxRocks).toBeGreaterThan(20);
  expect(maxRocks).toBeLessThanOrEqual(RUNNER.rocksPerRegion);
  expect(maxGates).toBe(64);
  expect(maxGateTriangles).toBeGreaterThan(8000);
  expect(maxGateTriangles).toBeLessThan(20_000);
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
  expect(meshDisposals.size).toBe(instanced.length);
});

test("qualified SURGE extends peripheral trails, lights gates and expands only the fixed wave pool", () => {
  const space = createRunnerSpace();
  const journey = createRunnerJourney();
  advanceRunnerJourney(journey, runnerRegionStart(3) + 60);
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

  test("encounters and gate families render with distinct chroma and fit desktop/mobile", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(240_000);
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
    const gateJourney = createRunnerJourney();
    advanceRunnerJourney(gateJourney, runnerRegionStart(3));
    const firstGates = gateJourney.regions.find((region) => region.index === 3)!.gates;
    const heroApproach = firstGates[0].distance - 70;
    const structuralApproach = firstGates[1].distance - 70;
    advanceRunnerJourney(gateJourney, runnerRegionStart(7) - gateJourney.distance);
    const sleeve = gateJourney.regions.find((region) => region.index === 7)!.gates.find((gate) => gate.family === "sleeve")!;
    const observations = [];
    for (const [distance, name] of [[40, "open-warp"], [630, "asteroid-approach"], [760, "asteroid-bypass"],
      [990, "recentering"], [1180, "second-bypass"], [1600, "final-bypass"],
      [2155, "traffic"], [heroApproach, "hero-portal"], [structuralApproach, "structural-ring"],
      [sleeve.distance - 70, "transit-sleeve"], [sleeve.distance + sleeve.depth * 0.4, "sleeve-interior"]] as const) {
      await expect.poll(async () => (await runtime(page)).travelPosition, { timeout: 60_000, intervals: [100] })
        .toBeGreaterThan(distance);
      await page.locator("label").filter({ hasText: /^Motion$/ }).click();
      await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
      const telemetry = await runtime(page);
      if (name === "sleeve-interior") {
        expect(telemetry.travelPosition).toBeGreaterThan(sleeve.distance);
        expect(telemetry.travelPosition).toBeLessThan(sleeve.distance + sleeve.depth);
      }
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
      await page.waitForTimeout(200);
      expect(await pixels(page)).toEqual(chroma);
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
    expect(drawCalls).toBeLessThanOrEqual(14);
    console.log(`Signal Runner 2.0 observed maximum: ${drawCalls} WebGL draws per frame.`);
    await testInfo.attach("maximum-draw-calls", { body: String(drawCalls), contentType: "text/plain" });
    expect(shaderErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("switching releases GPU resources, observers, resize listeners, RAF and FPS", async ({ page, pageErrors }) => {
    test.setTimeout(120_000);
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
      if (cycle < 2) {
        await page.getByRole("slider", { name: "Volume" }).fill("1");
        await page.getByRole("button", { name: "Play", exact: true }).click();
        await page.getByLabel("Seek playback").fill("43");
        await expect.poll(async () => (await runtime(page)).travelPosition, { timeout: 60_000, intervals: [100] })
          .toBeGreaterThan(cycle === 0 ? runnerRegionStart(2) + 100 : runnerRegionStart(3));
        await page.getByRole("button", { name: "Pause", exact: true }).click();
        await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
        expect((await runtime(page)).travelPosition).toBeLessThan(
          cycle === 0 ? runnerRegionStart(2) + 430 : runnerRegionStart(3) + 100);
        const frozenExhaust = await pixels(page);
        await page.waitForTimeout(250);
        expect(await pixels(page)).toEqual(frozenExhaust);
        expect((await counts()).buffers).toBeGreaterThan(mounted.buffers);
      }
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
