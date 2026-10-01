import { BoxGeometry, InstancedMesh, Matrix4, Quaternion, Texture, TorusGeometry, Vector3 } from "three";
import type { Page } from "@playwright/test";
import type { AudioReactiveSnapshot } from "../../src/app/playerTypes";
import { test, expect } from "../support/test";
import {
  advanceTransitWorld, createTransitLighting, createTransitWorld, sampleTransitDirection,
  sampleTransitPath, TRANSIT, updateTransitLighting,
} from "../../src/themes/alien-megastructure-transit/transitWorld";
import { createTransitArchitecture } from "../../src/themes/alien-megastructure-transit/transitArchitecture";
import {
  createTransitMotion, transitPropulsionEnergy, transitSurgeActivation, TRANSIT_MOTION, updateTransitMotion,
} from "../../src/themes/alien-megastructure-transit/transitMotion";
import { createTransitSpace, generateTransitStars, TRANSIT_STAR_CLASSES } from "../../src/themes/alien-megastructure-transit/transitSpace";
import { createTransitSigns, transitSignIntensity, TRANSIT_SIGN, TRANSIT_SLOGANS } from "../../src/themes/alien-megastructure-transit/transitSigns";

test("transit slogan lights have distinct bounded envelopes and freeze with scene controls", () => {
  const samples = TRANSIT_SLOGANS.map((_slogan, phrase) => Array.from({ length: 960 }, (_unused, frame) => transitSignIntensity(phrase, frame / 60, true)));
  expect(Math.min(...samples[0])).toBeLessThan(0.05);
  expect(Math.max(...samples[0])).toBeCloseTo(1.25);
  expect(Math.min(...samples[1])).toBeGreaterThan(0.2);
  expect(Math.min(...samples[1])).toBeLessThan(0.3);
  expect(Math.max(...samples[1])).toBeLessThan(1);
  expect(Math.max(...samples[2])).toBeGreaterThan(1.5);
  for (const [phrase, values] of samples.entries()) {
    expect(Math.min(...values)).toBeGreaterThan(0);
    expect(Math.max(...values)).toBeLessThan(1.84);
    expect(Math.max(...values.slice(1).map((value, index) => Math.abs(value - values[index])))).toBeLessThan(0.14);
    expect(transitSignIntensity(phrase, NaN, true)).toBe(transitSignIntensity(phrase, 0, true));
    expect(transitSignIntensity(phrase, 4, false)).toBe(0.16);
    expect(transitSignIntensity(phrase, 9, false)).toBe(0.16);
  }
  const world = createTransitWorld();
  const signs = createTransitSigns(world, new Texture());
  const center = new Vector3();
  const direction = new Vector3();
  const intensity = signs.objects[1].geometry.getAttribute("signIntensity");
  for (let phrase = 0; phrase < 3; phrase += 1) {
    world.encounters[5].distance = TRANSIT.firstEncounter + (5 + phrase * 6) * TRANSIT.spacing;
    world.animationSeconds = 1.1;
    signs.update(center, true);
    const frozen = intensity.getX(0);
    for (const gates of [[false, true, false], [true, false, false], [true, true, true]]) {
      advanceTransitWorld(world, 0.05, gates[0], gates[1], gates[2], direction, 0);
      signs.update(center, true);
      expect(intensity.getX(0)).toBe(frozen);
    }
    advanceTransitWorld(world, 0.05, true, true, false, direction, 0);
    signs.update(center, true);
    expect(intensity.getX(0)).not.toBe(frozen);
    signs.update(center, false);
    expect(intensity.getX(0)).toBeCloseTo(0.16);
  }
  signs.dispose();
});

test("transit slogans use one hanging sign every other sequence and stay ordered, pooled and clear through recycling", () => {
  const world = createTransitWorld();
  const texture = new Texture();
  let textureDisposals = 0;
  texture.addEventListener("dispose", () => { textureDisposals += 1; });
  const signs = createTransitSigns(world, texture);
  const center = new Vector3();
  const direction = new Vector3();
  const position = new Vector3();
  const scale = new Vector3();
  const rotation = new Quaternion();
  const matrix = new Matrix4();
  const buffers = signs.objects.map((mesh) => mesh.instanceMatrix.array);
  expect(TRANSIT_SLOGANS.map((slogan) => slogan.text)).toEqual(["TUNE IN.", "TRANSMIT.", "TRANSCEND."]);
  expect(TRANSIT_SIGN.faceOffset - TRANSIT_SIGN.depth / 2).toBeGreaterThanOrEqual(12);
  let minimumClearance = Infinity;
  const seen = new Map<number, number>();
  for (let frame = 0; frame < 6000; frame += 1) {
    advanceTransitWorld(world, 0.05, true, true, false, direction, TRANSIT_MOTION.surgeMax);
    if (frame % 10 !== 0) continue;
    sampleTransitPath(world.distance, center);
    signs.update(center, true);
    const faces = signs.objects[1];
    const ordered = Array.from({ length: faces.count }, (_unused, index) => {
      faces.getMatrixAt(index, matrix);
      const phrase = 2 - faces.geometry.getAttribute("signRow").getX(index);
      const distance = -matrix.elements[14] - center.z + TRANSIT_SIGN.faceOffset;
      const encounterDistance = distance - TRANSIT_SIGN.offset;
      const sequence = Math.round((encounterDistance - TRANSIT.firstEncounter) / TRANSIT.spacing);
      expect(sequence % 6).toBe(5);
      expect(phrase).toBe(Math.floor(sequence / 6) % 3);
      seen.set(sequence, phrase);
      expect(encounterDistance).toBeCloseTo(TRANSIT.firstEncounter + sequence * TRANSIT.spacing, 2);
      return { phrase, distance };
    }).sort((first, second) => first.distance - second.distance);
    ordered.slice(1).forEach((sign, index) => expect(sign.phrase).toBe((ordered[index].phrase + 1) % 3));
    for (const mesh of signs.objects) {
      expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.array.length / 16);
      for (let instance = 0; instance < mesh.count; instance += 1) {
        mesh.getMatrixAt(instance, matrix);
        matrix.decompose(position, rotation, scale);
        const clearance = Math.hypot(Math.max(0, Math.abs(position.x) - scale.x / 2),
          Math.max(0, Math.abs(position.y) - scale.y / 2), Math.max(0, Math.abs(position.z) - scale.z / 2));
        minimumClearance = Math.min(minimumClearance, clearance);
      }
    }
  }
  expect(minimumClearance).toBeGreaterThan(TRANSIT.safeRadius);
  expect(world.recycled).toBeGreaterThan(12);
  expect(signs.objects).toHaveLength(2);
  expect(signs.objects.map((mesh) => mesh.count)).toEqual([3, 1]);
  expect([...seen.values()].slice(0, 6)).toEqual([0, 1, 2, 0, 1, 2]);
  signs.objects.forEach((mesh, index) => expect(mesh.instanceMatrix.array).toBe(buffers[index]));
  signs.update(center, false);
  expect(signs.objects.every((mesh) => mesh.visible)).toBe(true);
  signs.dispose();
  expect(textureDisposals).toBe(1);
});

test("transit panel lighting has slow dark-to-bright cycles without audio and CHROMA OFF stays authored", () => {
  const world = createTransitWorld();
  const architecture = createTransitArchitecture(world);
  const center = sampleTransitPath(0, new Vector3());
  const lighting = createTransitLighting();
  updateTransitLighting(lighting, 0.05, false, true);
  const signals = architecture.meshes[5];
  const brightness: number[] = [];
  let maximumStep = 0;
  let previous: number[] | undefined;
  for (let frame = 0; frame <= 720; frame += 1) {
    world.animationSeconds = frame / 60;
    architecture.update(center, lighting, true);
    const colors = Array.from(signals.instanceColor!.array.slice(0, signals.count * 3));
    brightness.push(Math.max(...colors.slice(0, 3)));
    if (previous) colors.forEach((value, index) => { maximumStep = Math.max(maximumStep, Math.abs(value - previous![index])); });
    previous = colors;
  }
  expect(Math.min(...brightness)).toBeLessThan(0.03);
  expect(Math.max(...brightness)).toBeGreaterThan(0.9);
  expect(maximumStep).toBeLessThan(0.06);
  updateTransitLighting(lighting, 0.05, false, false);
  architecture.update(center, lighting, false);
  const off = Array.from(signals.instanceColor!.array.slice(0, signals.count * 3));
  world.animationSeconds += 7;
  architecture.update(center, lighting, false);
  expect(Array.from(signals.instanceColor!.array.slice(0, signals.count * 3))).toEqual(off);
  architecture.dispose();
});

test("transit LED tracks chase with fixed geometry, bounded buffers and no CHROMA OFF additions", () => {
  const world = createTransitWorld();
  const architecture = createTransitArchitecture(world);
  const center = sampleTransitPath(0, new Vector3());
  const lighting = createTransitLighting();
  const leds = architecture.meshes[7];
  architecture.update(center, lighting, true);
  expect(leds.visible).toBe(true);
  expect(leds.count).toBe(1504);
  expect(leds.instanceMatrix.array.length).toBe(leds.count * 16);
  const matrices = Array.from(leds.instanceMatrix.array);
  const colors = Array.from(leds.instanceColor!.array);
  const matrixBuffer = leds.instanceMatrix.array;
  const colorBuffer = leds.instanceColor!.array;
  const direction = new Vector3();
  for (const gates of [[false, true, false], [true, false, false], [true, true, true]]) {
    advanceTransitWorld(world, 0.05, gates[0], gates[1], gates[2], direction, 0);
    architecture.update(center, lighting, true);
    expect(Array.from(leds.instanceColor!.array)).toEqual(colors);
  }
  for (let frame = 0; frame < 40; frame += 1) advanceTransitWorld(world, 0.05, true, true, false, direction, 0);
  architecture.update(center, lighting, true);
  expect(world.distance).toBe(0);
  expect(Array.from(leds.instanceColor!.array)).not.toEqual(colors);
  expect(Array.from(leds.instanceMatrix.array)).toEqual(matrices);
  expect(leds.instanceMatrix.array).toBe(matrixBuffer);
  expect(leds.instanceColor!.array).toBe(colorBuffer);
  architecture.update(center, lighting, false);
  expect(leds.visible).toBe(false);
  architecture.dispose();
});

test("transit bands illuminate different architecture without changing geometry", () => {
  const world = createTransitWorld();
  world.animationSeconds = 4;
  const architecture = createTransitArchitecture(world);
  const center = sampleTransitPath(0, new Vector3());
  const neutral = { isActive: true, energy: 0.3, smoothedEnergy: 0.3, bass: 0, mids: 0, highs: 0 };
  const sample = (band: "bass" | "mids" | "highs" | "none", chroma = true) => {
    const lighting = createTransitLighting();
    for (let frame = 0; frame < 120; frame += 1) {
      updateTransitLighting(lighting, 0.05, true, chroma, { ...neutral, [band]: 1 });
    }
    architecture.update(center, lighting, chroma);
    return architecture.meshes.map((mesh) => mesh.instanceColor ? Array.from(mesh.instanceColor.array) : []);
  };
  const neutralColors = sample("none");
  const matrices = architecture.meshes.map((mesh) => Array.from(mesh.instanceMatrix.array));
  const bassColors = sample("bass");
  expect(bassColors[6]).not.toEqual(neutralColors[6]);
  expect(bassColors[3]).toEqual(neutralColors[3]);
  const midColors = sample("mids");
  expect(midColors[3]).not.toEqual(neutralColors[3]);
  expect(midColors[6]).toEqual(neutralColors[6]);
  const highColors = sample("highs");
  expect(highColors[5]).not.toEqual(neutralColors[5]);
  expect(highColors[3]).toEqual(neutralColors[3]);
  expect(highColors[6]).toEqual(neutralColors[6]);
  expect(sample("bass", false)).toEqual(sample("highs", false));
  const signals = architecture.meshes[5];
  const offColors = Array.from(signals.instanceColor!.array.slice(0, signals.count * 3));
  const surge = createTransitMotion();
  surge.surgeStartedAt = 0;
  surge.elapsedMs = 1000;
  surge.surgeEnvelope = 1;
  architecture.update(center, createTransitLighting(), false, surge);
  const surgeColors = Array.from(signals.instanceColor!.array.slice(0, signals.count * 3));
  expect(surgeColors.reduce((sum, value) => sum + value, 0)).toBeGreaterThan(offColors.reduce((sum, value) => sum + value, 0) * 2);
  architecture.meshes.forEach((mesh, index) => expect(Array.from(mesh.instanceMatrix.array)).toEqual(matrices[index]));
  architecture.dispose();
});

test("transit stars are deterministic, irregular and bounded; surge space freezes and clears", () => {
  const stars = generateTransitStars();
  expect(stars).toEqual(generateTransitStars());
  expect(stars).not.toEqual(generateTransitStars(5));
  expect(stars.reduce((total, batch) => total + batch.count, 0)).toBe(TRANSIT.starCount);
  expect(TRANSIT_STAR_CLASSES.map((batch) => batch.size)).toEqual([1, 1.8, 3]);
  const latitudes: number[] = [];
  let bandStars = 0;
  for (const batch of stars) {
    expect(new Set(batch.colors).size).toBeGreaterThan(batch.count);
    for (let index = 0; index < batch.positions.length; index += 3) {
      const radius = Math.hypot(...batch.positions.slice(index, index + 3));
      expect(radius).toBeGreaterThan(8499);
      expect(radius).toBeLessThan(10001);
      latitudes.push(batch.positions[index + 1] / radius);
      const bandLatitude = (-Math.sin(0.55) * batch.positions[index] + Math.cos(0.55) * batch.positions[index + 1]) / radius;
      if (Math.abs(bandLatitude) < 0.18) bandStars += 1;
    }
  }
  latitudes.sort((first, second) => first - second);
  const gaps = latitudes.slice(1).map((latitude, index) => latitude - latitudes[index]);
  expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(20);
  expect(bandStars / TRANSIT.starCount).toBeGreaterThan(0.5);
  expect(bandStars / TRANSIT.starCount).toBeLessThan(0.8);
  expect(TRANSIT_STAR_CLASSES[2].count).toBe(14);
  const space = createTransitSpace();
  const world = createTransitWorld();
  const motion = createTransitMotion();
  const lighting = createTransitLighting();
  const center = sampleTransitPath(0, new Vector3());
  space.update(world, motion, lighting, true, center);
  const dark = space.background.clone();
  expect(space.objects).toHaveLength(5);
  const effects = space.objects.filter((object): object is InstancedMesh => object instanceof InstancedMesh);
  expect(effects.map((mesh) => mesh.count)).toEqual([3, 24]);
  expect(effects.every((mesh) => !mesh.visible)).toBe(true);
  const buffers = effects.map((mesh) => mesh.instanceMatrix.array);
  motion.surgeStartedAt = 0;
  motion.elapsedMs = 1000;
  motion.surgeEnvelope = 1;
  space.update(world, motion, lighting, true, center);
  expect(space.background.equals(dark)).toBe(false);
  expect(effects.every((mesh) => mesh.visible)).toBe(true);
  const matrices = effects.map((mesh) => Array.from(mesh.instanceMatrix.array));
  const tint = space.background.clone();
  for (const gates of [[false, true, false], [true, false, false], [true, true, true]]) {
    updateTransitMotion(motion, 0.05, gates[0], gates[1], gates[2], 0);
    space.update(world, motion, lighting, true, center);
    expect(space.background.equals(tint)).toBe(true);
    effects.forEach((mesh, index) => expect(Array.from(mesh.instanceMatrix.array)).toEqual(matrices[index]));
  }
  space.update(world, motion, lighting, false, center);
  expect(space.background.equals(tint)).toBe(false);
  expect(space.background.equals(dark)).toBe(false);
  for (let frame = 0; frame < 100; frame += 1) updateTransitMotion(motion, 0.05, true, true, false, 0);
  space.update(world, motion, lighting, true, center);
  expect(space.background.equals(dark)).toBe(true);
  expect(effects.every((mesh) => !mesh.visible)).toBe(true);
  effects.forEach((mesh, index) => expect(mesh.instanceMatrix.array).toBe(buffers[index]));
  space.dispose();
});

test("transit SURGE streaks approach the moving camera and recycle ahead after passing", () => {
  const space = createTransitSpace();
  const world = createTransitWorld();
  const motion = createTransitMotion();
  const lighting = createTransitLighting();
  const center = new Vector3();
  const matrix = new Matrix4();
  const streaks = space.objects.filter((object): object is InstancedMesh => object instanceof InstancedMesh)[1];
  const previousPositions: number[] = [];
  let recycled = 0;
  let passedCamera = false;
  motion.surgeStartedAt = 0;
  motion.surgeEnvelope = 1;
  for (let frame = 0; frame <= 120; frame += 1) {
    world.distance = frame * 40;
    motion.elapsedMs = frame * 50;
    sampleTransitPath(world.distance, center);
    space.update(world, motion, lighting, true, center);
    for (let index = 0; index < streaks.count; index += 1) {
      streaks.getMatrixAt(index, matrix);
      const position = matrix.elements[14];
      expect(position).toBeGreaterThanOrEqual(-3500);
      expect(position).toBeLessThanOrEqual(900);
      passedCamera ||= position > 0;
      if (frame > 0) {
        const delta = position - previousPositions[index];
        if (delta < 0) {
          expect(previousPositions[index]).toBeGreaterThan(700);
          expect(position).toBeLessThan(-3300);
          expect(delta).toBeCloseTo(130 - 4400, 2);
          recycled += 1;
        } else {
          expect(delta).toBeCloseTo(130, 2);
        }
      }
      previousPositions[index] = position;
    }
  }
  expect(streaks.count).toBe(24);
  expect(passedCamera).toBe(true);
  expect(recycled).toBeGreaterThan(24);
  space.dispose();
});

test("transit propulsion and shared-qualified SURGE are bounded, finite and strictly gated", () => {
  const motion = createTransitMotion();
  const quiet = { isActive: true, smoothedEnergy: 0.2, energy: 0.2 };
  const loud = { ...quiet, smoothedEnergy: 0.9, energy: 0.9, kickPulseAcceptedEventSequence: 4 };
  expect(transitPropulsionEnergy(true, { ...quiet, smoothedEnergy: 0, energy: 0 })).toBe(0);
  expect(transitPropulsionEnergy(true, { ...quiet, smoothedEnergy: NaN })).toBe(0);
  expect(transitPropulsionEnergy(true, { ...quiet, isActive: false })).toBe(0);
  expect(transitPropulsionEnergy(true)).toBe(0);
  expect(transitPropulsionEnergy(true, { ...quiet, smoothedEnergy: 0.03, energy: 0.03 })).toBeLessThan(0.02);
  for (let frame = 0; frame < 12; frame += 1) updateTransitMotion(motion, 0.05, true, true, false, 100, quiet);
  expect(motion.qualification.armed).toBe(true);
  expect(motion.speed).toBeGreaterThan(0);
  expect(motion.speed).toBeLessThan(TRANSIT_MOTION.normalMax);
  updateTransitMotion(motion, 0.05, true, true, false, 100, loud);
  expect(motion.surgeCount).toBe(1);
  expect(motion.surgeOrigin).toBe(100);
  for (let frame = 0; frame < 20; frame += 1) updateTransitMotion(motion, 0.05, true, true, false, 200, loud);
  expect(motion.speed).toBeGreaterThan(TRANSIT_MOTION.normalMax * 2);
  expect(motion.targetSpeed).toBe(TRANSIT_MOTION.surgeMax);
  const clock = motion.elapsedMs;
  const envelope = motion.surgeEnvelope;
  for (const gates of [[false, true, false], [true, false, false], [true, true, true]]) {
    updateTransitMotion(motion, 100, gates[0], gates[1], gates[2], 200, loud);
    expect(motion.elapsedMs).toBe(clock);
    expect(motion.surgeEnvelope).toBe(envelope);
    expect(motion.speed).toBe(0);
  }
  for (let frame = 0; frame < 160; frame += 1) updateTransitMotion(motion, 0.05, true, true, false, 200, loud);
  expect(motion.surgeCount).toBe(1);
  expect(motion.surgeEnvelope).toBe(0);
  expect(motion.targetSpeed).toBe(TRANSIT_MOTION.normalMax);
  expect(motion.speed).toBeCloseTo(TRANSIT_MOTION.normalMax, 0);
  for (let frame = 0; frame < 160; frame += 1) updateTransitMotion(motion, 0.05, true, true, false, 200, { ...quiet, smoothedEnergy: 0, energy: 0 });
  expect(motion.speed).toBe(0);
  updateTransitMotion(motion, 0.05, true, true, false, 200, loud);
  expect(motion.surgeCount).toBe(2);
  expect(transitSurgeActivation(6500, 700, 1)).toBeGreaterThan(transitSurgeActivation(1500, 700, 1));
  expect(transitSurgeActivation(1500, 2700, 1)).toBeGreaterThan(transitSurgeActivation(6500, 2700, 1));
  expect(transitSurgeActivation(1500, 5000, 0)).toBe(0);
});

test("transit machinery stays bounded and clear through rotation and recycling", async () => {
  const world = createTransitWorld();
  const architecture = createTransitArchitecture(world);
  const lighting = createTransitLighting();
  const center = new Vector3();
  const direction = new Vector3();
  const position = new Vector3();
  const scale = new Vector3();
  const local = new Vector3();
  const rotation = new Quaternion();
  const matrix = new Matrix4();
  const buffers = architecture.meshes.map((mesh) => mesh.instanceMatrix.array);
  let minimumClearance = Infinity;
  for (let frame = 0; frame < 6000; frame += 1) {
    advanceTransitWorld(world, 0.05, true, true, false, direction, TRANSIT_MOTION.surgeMax);
    if (frame % 4 !== 0) continue;
    sampleTransitPath(world.distance, center);
    architecture.update(center, lighting, true);
    for (const mesh of architecture.meshes) {
      expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.array.length / 16);
      for (let instance = 0; instance < mesh.count; instance += 1) {
        mesh.getMatrixAt(instance, matrix);
        matrix.decompose(position, rotation, scale);
        if (Math.abs(position.z) > 1700) continue;
        local.copy(position).negate().applyQuaternion(rotation.invert());
        let clearance: number;
        if (mesh.geometry instanceof BoxGeometry) {
          clearance = Math.hypot(
            Math.max(0, Math.abs(local.x) - scale.x / 2),
            Math.max(0, Math.abs(local.y) - scale.y / 2),
            Math.max(0, Math.abs(local.z) - scale.z / 2),
          );
        } else {
          const { radius, tube } = (mesh.geometry as TorusGeometry).parameters;
          clearance = Math.hypot(
            Math.max(0, Math.abs(Math.hypot(local.x, local.y) - radius * scale.x) - tube * scale.x),
            Math.max(0, Math.abs(local.z) - tube * scale.z),
          );
        }
        minimumClearance = Math.min(minimumClearance, clearance);
      }
    }
  }
  expect(minimumClearance).toBeGreaterThan(TRANSIT.safeRadius);
  expect(world.recycled).toBeGreaterThan(12);
  expect(architecture.meshes).toHaveLength(8);
  architecture.meshes.forEach((mesh, index) => expect(mesh.instanceMatrix.array).toBe(buffers[index]));
  architecture.update(center, lighting, true);
  const frozen = architecture.meshes.map((mesh) => Array.from(mesh.instanceMatrix.array));
  const colors = Array.from(architecture.meshes[5].instanceColor!.array);
  updateTransitLighting(lighting, 0.05, false, false);
  architecture.update(center, lighting, false);
  architecture.meshes.forEach((mesh, index) => expect(Array.from(mesh.instanceMatrix.array)).toEqual(frozen[index]));
  expect(Array.from(architecture.meshes[5].instanceColor!.array)).not.toEqual(colors);
  world.animationSeconds += 1;
  architecture.update(center, lighting, false);
  expect(Array.from(architecture.meshes[2].instanceMatrix.array)).not.toEqual(frozen[2]);
  expect(Array.from(architecture.meshes[4].instanceMatrix.array)).not.toEqual(frozen[4]);
  const counts = architecture.meshes.map((mesh) => ({
    instances: mesh.count, triangles: mesh.count * mesh.geometry.index!.count / 3,
  }));
  await test.info().attach("architecture-budget", {
    body: JSON.stringify({ minimumClearance, counts, sloganDrawCalls: 2, normalDrawCalls: counts.length + 5, surgeDrawCalls: counts.length + 7 }), contentType: "application/json",
  });
  architecture.dispose();
});

test("transit lighting uses bounded shared audio and a stable CHROMA OFF fallback", () => {
  const lighting = createTransitLighting();
  const snapshot = { isActive: true, energy: 0.9, smoothedEnergy: 0.8, bass: 1 } as AudioReactiveSnapshot;
  updateTransitLighting(lighting, 0.05, true, false, snapshot);
  expect(lighting).toEqual({ energy: 0, bass: 0, mids: 0, highs: 0, intensity: 0.16, interplay: 0 });
  updateTransitLighting(lighting, 0.05, true, true);
  const quiet = { ...lighting };
  expect(quiet.intensity).toBeGreaterThan(0.48);
  for (let frame = 0; frame < 120; frame += 1) updateTransitLighting(lighting, 0.05, true, true, snapshot);
  expect(lighting.energy).toBeCloseTo(0.825);
  expect(lighting.intensity).toBeGreaterThan(quiet.intensity + 0.5);
  expect(lighting.interplay).toBeGreaterThan(quiet.interplay);
  for (let frame = 0; frame < 120; frame += 1) {
    updateTransitLighting(lighting, 0.05, true, true, { ...snapshot, energy: 0, smoothedEnergy: 0, bass: 0 });
  }
  expect(lighting.energy).toBeLessThan(0.001);
  updateTransitLighting(lighting, 0.05, false, true, snapshot);
  expect(lighting).toEqual(quiet);
  updateTransitLighting(lighting, NaN, true, true, { ...snapshot, energy: NaN, smoothedEnergy: Infinity });
  expect(lighting).toEqual(quiet);
  updateTransitLighting(lighting, 0.05, true, true, { ...snapshot, isActive: false });
  expect(lighting).toEqual(quiet);
});

test("transit path keeps generous clearance and a bounded recycled world", () => {
  const world = createTransitWorld();
  const pool = [...world.encounters];
  const bodies = pool.flatMap((encounter) => encounter.bodies);
  const camera = new Vector3();
  const direction = new Vector3();
  const previousDirection = sampleTransitDirection(0, new Vector3()).normalize();
  const local = new Vector3();
  let minimumClearance = Infinity;
  let maximumBend = 0;
  let minimumAhead = Infinity;
  let maximumAhead = -Infinity;
  const seen = new Set<string>();
  for (let frame = 0; frame < 24_000; frame += 1) {
    advanceTransitWorld(world, 0.05, true, true, false, direction);
    sampleTransitPath(world.distance, camera);
    sampleTransitDirection(world.distance, direction).normalize();
    maximumBend = Math.max(maximumBend, direction.angleTo(previousDirection));
    previousDirection.copy(direction);
    for (const encounter of world.encounters) {
      const ahead = encounter.distance - world.distance;
      minimumAhead = Math.min(minimumAhead, ahead);
      maximumAhead = Math.max(maximumAhead, ahead);
      if (Math.abs(ahead) > 1700) continue;
      seen.add(encounter.kind);
      for (const body of encounter.bodies) {
        local.copy(camera).sub(body.position);
        const localX = local.x * Math.cos(body.angle) + local.y * Math.sin(body.angle);
        const localY = -local.x * Math.sin(body.angle) + local.y * Math.cos(body.angle);
        const clearance = Math.hypot(
          Math.max(0, Math.abs(localX) - body.size.x / 2),
          Math.max(0, Math.abs(localY) - body.size.y / 2),
          Math.max(0, Math.abs(local.z) - body.size.z / 2),
        );
        minimumClearance = Math.min(minimumClearance, clearance);
      }
      if (encounter.kind === "ring") {
        local.copy(camera).sub(encounter.center);
        const radialGap = Math.abs(Math.hypot(local.x, local.y) - TRANSIT.ringRadius);
        const clearance = Math.hypot(
          Math.max(0, radialGap - TRANSIT.ringTube),
          Math.max(0, Math.abs(local.z) - TRANSIT.ringTube * TRANSIT.ringDepthScale),
        );
        minimumClearance = Math.min(minimumClearance, clearance);
      }
    }
  }
  expect(minimumClearance).toBeGreaterThan(TRANSIT.safeRadius);
  expect(minimumAhead).toBeGreaterThanOrEqual(-TRANSIT.behind);
  expect(maximumAhead).toBeLessThan(TRANSIT.spacing * TRANSIT.poolSize);
  expect(maximumBend).toBeLessThan(0.001);
  expect(seen).toEqual(new Set(["ring", "pylons", "bridge"]));
  expect(world.recycled).toBeGreaterThan(70);
  expect(world.encounters).toHaveLength(TRANSIT.poolSize);
  world.encounters.forEach((encounter, index) => expect(encounter).toBe(pool[index]));
  world.encounters.flatMap((encounter) => encounter.bodies).forEach((body, index) => expect(body).toBe(bodies[index]));
});

test("transit freezes all clocks for playback, MOTION and reduced motion and caps delta", () => {
  const world = createTransitWorld();
  const direction = new Vector3();
  for (const gates of [[false, true, false], [true, false, false], [true, true, true]]) {
    advanceTransitWorld(world, 1, gates[0], gates[1], gates[2], direction);
    expect(world.distance).toBe(0);
    expect(world.animationSeconds).toBe(0);
  }
  advanceTransitWorld(world, 100, true, true, false, direction);
  expect(world.distance).toBeGreaterThan(0);
  expect(world.distance).toBeLessThanOrEqual(TRANSIT.speed * 0.05);
  expect(world.animationSeconds).toBe(0.05);
  const frozen = world.distance;
  advanceTransitWorld(world, NaN, true, true, false, direction);
  advanceTransitWorld(world, -1, true, true, false, direction);
  expect(world.distance).toBe(frozen);
});

async function runtime(page: Page) {
  return page.evaluate(() => window.__DSFM_TEST__!.environment);
}

async function canvasPixels(page: Page) {
  return page.getByLabel("Deep Space Drift canvas").evaluate((element) =>
    new Promise<{ hash: number; litPixels: number; brightness: number; colorfulPixels: number }>((resolve) => {
      requestAnimationFrame(() => {
        const sample = document.createElement("canvas");
        sample.width = 160;
        sample.height = 100;
        const context = sample.getContext("2d")!;
        context.drawImage(element as HTMLCanvasElement, 0, 0, 160, 100);
        const pixels = context.getImageData(0, 0, 160, 100).data;
        let hash = 0;
        let litPixels = 0;
        let brightness = 0;
        let colorfulPixels = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          hash = (Math.imul(hash, 31) + pixels[index] + pixels[index + 1] * 3 + pixels[index + 2] * 7) | 0;
          if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) > 30) litPixels += 1;
          brightness += pixels[index] + pixels[index + 1] + pixels[index + 2];
          if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2])
            - Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) > 45) colorfulPixels += 1;
        }
        resolve({ hash, litPixels, brightness, colorfulPixels });
      });
    }),
  );
}

declare global {
  interface Window {
    __TRANSIT_RESOURCES__: {
      frames: Set<number>;
      buffers: Set<WebGLBuffer>;
      programs: Set<WebGLProgram>;
      textures: Set<WebGLTexture>;
    };
  }
}

test.describe("Deep Space Drift player", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/player/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByLabel("Visual environment").selectOption("alien-megastructure-transit");
  });

  test("registers and freezes pixels on idle, MOTION OFF and paused playback", async ({ page, pageErrors }) => {
    await expect(page.locator('optgroup[label="3D EXPERIENCES"] option[value="alien-megastructure-transit"]'))
      .toHaveText("Deep Space Drift");
    await expect(page.locator('optgroup[label="3D EXPERIENCES"] option'))
      .toHaveText([
        "Cosmic Coaster",
        "Deep Space Drift",
        "Race to the Signal Nexus",
        "Signal Runner",
        "Signal Tunnel",
        "The Signal Nexus",
      ]);
    await expect(page.getByLabel("Deep Space Drift canvas")).toHaveCount(1);
    await expect(page.getByLabel("Toggle environment chroma effects")).toBeEnabled();
    await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const idle = await canvasPixels(page);
    expect(idle.litPixels).toBeGreaterThan(100);
    await page.waitForTimeout(300);
    expect(await canvasPixels(page)).toEqual(idle);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).travelPosition).toBeGreaterThan(0);
    await expect.poll(async () => (await canvasPixels(page)).hash).not.toBe(idle.hash);
    await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const stopped = await canvasPixels(page);
    const distance = (await runtime(page)).travelPosition!;
    await page.waitForTimeout(350);
    expect(await canvasPixels(page)).toEqual(stopped);
    expect((await runtime(page)).travelPosition).toBe(distance);
    await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    await expect.poll(async () => (await runtime(page)).travelPosition).toBeGreaterThan(distance);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const paused = await canvasPixels(page);
    await page.waitForTimeout(350);
    expect(await canvasPixels(page)).toEqual(paused);
    await expect(page.getByLabel("Motion", { exact: true })).toBeChecked();
    expect(pageErrors).toEqual([]);
  });

  test("reduced motion freezes travel and ring rotation without changing MOTION", async ({ page, pageErrors }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const frozen = await canvasPixels(page);
    await page.waitForTimeout(350);
    expect(await canvasPixels(page)).toEqual(frozen);
    expect((await runtime(page)).travelPosition).toBe(0);
    await expect(page.getByLabel("Motion", { exact: true })).toBeChecked();
    expect(pageErrors).toEqual([]);
  });

  test("CHROMA adds color and real audio illumination independently of MOTION", async ({ page, pageErrors }) => {
    const chroma = page.locator("label").filter({ hasText: /^Chroma$/ });
    const motion = page.locator("label").filter({ hasText: /^Motion$/ });
    const volume = page.getByRole("slider", { name: "Volume" });
    await motion.click();
    const on = await canvasPixels(page);
    await chroma.click();
    await expect.poll(async () => (await canvasPixels(page)).hash).not.toBe(on.hash);
    const off = await canvasPixels(page);
    expect(on.brightness).toBeGreaterThan(off.brightness * 1.4);
    expect(on.colorfulPixels).toBeGreaterThan(off.colorfulPixels);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await volume.fill("1");
    await expect.poll(() => page.evaluate(() => window.__DSFM_TEST__!.audio.smoothedEnergy)).toBeGreaterThan(0.1);
    expect(await canvasPixels(page)).toEqual(off);
    await chroma.click();
    const audibleAccentGain = (on.brightness - off.brightness) * 0.12;
    await expect.poll(async () => (await canvasPixels(page)).brightness).toBeGreaterThan(on.brightness + audibleAccentGain);
    const loud = await canvasPixels(page);
    await volume.fill("0.03");
    await expect.poll(() => page.evaluate(() => window.__DSFM_TEST__!.audio.smoothedEnergy)).toBeLessThan(0.1);
    await expect.poll(async () => (await canvasPixels(page)).brightness).toBeLessThan(loud.brightness);
    await volume.fill("0");
    await expect.poll(() => page.evaluate(() => window.__DSFM_TEST__!.audio.smoothedEnergy)).toBeLessThan(0.001);
    await expect.poll(async () => Math.abs((await canvasPixels(page)).brightness - on.brightness), { timeout: 8000 }).toBeLessThan(on.brightness * 0.01);
    expect((await runtime(page)).travelPosition).toBe(0);
    await expect(page.getByLabel("Motion", { exact: true })).not.toBeChecked();
    await expect(page.getByLabel("Toggle environment chroma effects")).toBeChecked();
    expect(pageErrors).toEqual([]);
  });

  test("releases GPU resources and its only loop and clears FPS on repeated switches", async ({ page, pageErrors }) => {
    test.setTimeout(80_000);
    await page.addInitScript(() => {
      const resources = { frames: new Set<number>(), buffers: new Set<WebGLBuffer>(), programs: new Set<WebGLProgram>(), textures: new Set<WebGLTexture>() };
      window.__TRANSIT_RESOURCES__ = resources;
      const request = window.requestAnimationFrame.bind(window);
      const cancel = window.cancelAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => {
        const id = request((time) => { resources.frames.delete(id); callback(time); });
        resources.frames.add(id);
        return id;
      };
      window.cancelAnimationFrame = (id) => { resources.frames.delete(id); cancel(id); };
      const prototype = WebGL2RenderingContext.prototype;
      const createBuffer = prototype.createBuffer;
      const deleteBuffer = prototype.deleteBuffer;
      const createProgram = prototype.createProgram;
      const deleteProgram = prototype.deleteProgram;
      const texStorage2D = prototype.texStorage2D;
      const deleteTexture = prototype.deleteTexture;
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
      prototype.texStorage2D = function (target, levels, format, width, height) {
        if (target === this.TEXTURE_2D) {
          const texture = this.getParameter(this.TEXTURE_BINDING_2D) as WebGLTexture | null;
          if (texture) resources.textures.add(texture);
        }
        texStorage2D.call(this, target, levels, format, width, height);
      };
      prototype.deleteTexture = function (texture) {
        if (texture) resources.textures.delete(texture);
        deleteTexture.call(this, texture);
      };
    });
    await page.reload();
    const select = page.getByLabel("Visual environment");
    const fps = page.locator(".visual-feed-window__fps .visual-feed-window__metric-value");
    const resourceCounts = () => page.evaluate(() => {
      const resources = window.__TRANSIT_RESOURCES__;
      return { frames: resources.frames.size, buffers: resources.buffers.size, programs: resources.programs.size, textures: resources.textures.size };
    });
    await select.selectOption("minimal");
    await expect(fps).toHaveText("---");
    const baseline = await resourceCounts();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await select.selectOption("alien-megastructure-transit");
      await expect(page.getByLabel("Deep Space Drift canvas")).toHaveCount(1);
      await expect.poll(async () => (await runtime(page)).renderFps).toBeGreaterThan(0);
      const mounted = await resourceCounts();
      expect(mounted.frames).toBe(baseline.frames + 1);
      expect(mounted.buffers).toBeGreaterThan(baseline.buffers);
      expect(mounted.programs).toBeGreaterThan(baseline.programs);
      expect(mounted.textures).toBeGreaterThan(baseline.textures);
      if (cycle === 0) {
        await page.getByRole("slider", { name: "Volume" }).fill("1");
        await page.getByRole("button", { name: "Play", exact: true }).click();
        await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 45_000, intervals: [50] }).toBeGreaterThan(TRANSIT_MOTION.normalMax + 100);
        await page.getByRole("button", { name: "Pause", exact: true }).click();
        expect((await resourceCounts()).buffers).toBeGreaterThan(mounted.buffers);
      }
      await select.selectOption("minimal");
      await expect(page.locator(".player-shell__scene canvas")).toHaveCount(0);
      await expect.poll(resourceCounts).toEqual(baseline);
      await page.waitForTimeout(1100);
      await expect(fps).toHaveText("---");
    }
    expect(pageErrors).toEqual([]);
  });

  test("real volume drives propulsion down to zero without changing preferences", async ({ page, pageErrors }) => {
    test.setTimeout(65_000);
    const volume = page.getByRole("slider", { name: "Volume" });
    await volume.fill("1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByLabel("Seek playback").fill("43");
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 15_000 }).toBeGreaterThan(200);
    const fullEnergy = await page.evaluate(() => window.__DSFM_TEST__!.audio.smoothedEnergy);
    await volume.fill("0.12");
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 10_000 }).toBeLessThan(60);
    expect(await page.evaluate(() => window.__DSFM_TEST__!.audio.smoothedEnergy)).toBeLessThan(fullEnergy);
    await volume.fill("0.03");
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 10_000 }).toBeLessThan(10);
    await volume.fill("0");
    await expect.poll(async () => (await runtime(page)).motionSpeed, { timeout: 12_000 }).toBe(0);
    const muted = await runtime(page);
    await page.waitForTimeout(300);
    expect((await runtime(page)).travelPosition).toBe(muted.travelPosition);
    expect((await runtime(page)).surgeCount).toBe(muted.surgeCount);
    await expect(page.getByLabel("Motion", { exact: true })).toBeChecked();
    await expect(page.getByLabel("Toggle environment chroma effects")).toBeChecked();
    await volume.fill("1");
    await expect.poll(async () => (await runtime(page)).motionSpeed, { timeout: 10_000 }).toBeGreaterThan(200);
    expect(pageErrors).toEqual([]);
  });

  test("real music qualifies a visible SURGE and freezes the active wavefront", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(65_000);
    await page.getByRole("slider", { name: "Volume" }).fill("1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).surgeCount, { timeout: 45_000, intervals: [50] }).toBeGreaterThan(0);
    await expect.poll(async () => (await runtime(page)).motionSpeed, { timeout: 3000, intervals: [50] }).toBeGreaterThan(TRANSIT_MOTION.normalMax * 1.4);
    const surge = await runtime(page);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const frozen = await canvasPixels(page);
      expect(frozen.litPixels).toBeGreaterThan(100);
      await page.waitForTimeout(250);
      expect(await canvasPixels(page)).toEqual(frozen);
      await page.screenshot({ path: testInfo.outputPath(`surge-${viewport.width}.png`) });
      await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
      const off = await canvasPixels(page);
      expect(off.brightness).toBeLessThan(frozen.brightness);
      await page.waitForTimeout(200);
      expect(await canvasPixels(page)).toEqual(off);
      await page.screenshot({ path: testInfo.outputPath(`surge-${viewport.width}-chroma-off.png`) });
      await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
    }
    await testInfo.attach("surge-runtime", { body: JSON.stringify(surge), contentType: "application/json" });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBeGreaterThan(0);
    await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
    const motionOff = await canvasPixels(page);
    const stopped = await runtime(page);
    await page.waitForTimeout(300);
    expect(await canvasPixels(page)).toEqual(motionOff);
    expect((await runtime(page)).travelPosition).toBe(stopped.travelPosition);
    expect(pageErrors).toEqual([]);
  });

  test("renders open flight and all encounters on desktop and narrow screens", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(220_000);
    await page.getByRole("slider", { name: "Volume" }).fill("1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const observations = [];
    for (const [distance, name] of [[100, "ring"], [2450, "open-void"], [3900, "monoliths"], [7000, "bridge"], [14500, "hanging-slogan"]] as const) {
      await expect.poll(async () => (await runtime(page)).travelPosition, { timeout: 60_000, intervals: [100] })
        .toBeGreaterThan(distance);
      await page.locator("label").filter({ hasText: /^Motion$/ }).click();
      await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        const canvas = page.getByLabel("Deep Space Drift canvas");
        await expect.poll(async () => (await canvas.boundingBox())?.width).toBe(viewport.width);
        const pixels = await canvasPixels(page);
        expect(pixels.litPixels).toBeGreaterThan(50);
        await page.waitForTimeout(150);
        expect(await canvasPixels(page)).toEqual(pixels);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`${name}-${viewport.width}.png`) });
        await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
        await expect.poll(async () => (await canvasPixels(page)).brightness).toBeLessThan(pixels.brightness);
        await page.screenshot({ path: testInfo.outputPath(`${name}-${viewport.width}-chroma-off.png`) });
        if (name === "hanging-slogan" && viewport.width === 390) {
          await page.getByRole("button", { name: "Collapse player panel" }).click();
          await page.screenshot({ path: testInfo.outputPath("hanging-slogan-mobile-collapsed-off.png") });
          await page.getByRole("button", { name: "Expand player panel" }).click();
        }
        await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
        if (name === "hanging-slogan" && viewport.width === 390) {
          await page.getByRole("button", { name: "Collapse player panel" }).click();
          await page.screenshot({ path: testInfo.outputPath("hanging-slogan-mobile-collapsed-on.png") });
          await page.getByRole("button", { name: "Expand player panel" }).click();
        }
        observations.push({ name, viewport, pixels, telemetry: await runtime(page) });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.locator("label").filter({ hasText: /^Motion$/ }).click();
      await page.getByRole("button", { name: "Play", exact: true }).click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const before = await canvasPixels(page);
    await expect.poll(async () => (await canvasPixels(page)).hash).not.toBe(before.hash);
    await testInfo.attach("architecture-journey", { body: JSON.stringify(observations, null, 2), contentType: "application/json" });
    expect(pageErrors).toEqual([]);
  });
});