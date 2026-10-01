import { Line3, Matrix4, ShaderLib, Vector3 } from "three";
import type { BufferGeometry, Material, WebGLRenderer } from "three";
import { test, expect } from "../support/test";
import {
  advanceTunnel,
  createChamberPointSampler,
  createTunnelSection,
  createTunnelTravel,
  dampTunnelSpeed,
  sampleCenterline,
  sampleDirection,
  sampleTunnelSection,
  tunnelTargetSpeed,
  tunnelDoorOpening,
  tunnelDoorHalfGap,
  TUNNEL,
} from "../../src/themes/signal-tunnel/tunnelPath";
import type { Page } from "@playwright/test";
import { createTunnelMotion, tunnelSurgeActivation, updateTunnelMotion } from "../../src/themes/signal-tunnel/tunnelMotion";
import { createTunnelDoors, TUNNEL_DOORS, tunnelDoorLayout, tunnelDoorLeafClearance, tunnelDoorLeafOpening, tunnelDoorVariant } from "../../src/themes/signal-tunnel/tunnelDoors";

declare global {
  interface Window {
    __TUNNEL_RESOURCES__: { frames: Set<number>; buffers: Set<WebGLBuffer>; programs: Set<WebGLProgram>; textures: Set<WebGLTexture> };
  }
}

test("door variants are stable per encounter with shared max-surge clearance", () => {
  const section = createTunnelSection();
  const direction = new Vector3();
  const camera = new Vector3();
  const center = new Vector3();
  const variants = new Set<string>();
  const maxSpeed = TUNNEL.speed + TUNNEL.maxSpeedBoost + TUNNEL.surgeBoost;
  for (let encounter = 0; encounter < 30; encounter += 1) {
    const distance = encounter * TUNNEL.sectionLength + 112;
    const layout = tunnelDoorLayout(distance, sampleTunnelSection(distance, section).radius);
    variants.add(layout.variant.id);
    expect(layout.variant).toBe(TUNNEL_DOORS[encounter % 3]);
    expect(tunnelDoorVariant(distance)).toBe(tunnelDoorVariant(distance));
    expect(layout.aperture).toBeLessThan(layout.pocketRadius);
    expect(layout.pocketRadius).toBeLessThan(layout.outerRadius);
    const travel = createTunnelTravel();
    travel.distance = distance - 125;
    while (travel.distance < distance + 12) {
      advanceTunnel(travel, 0.05, true, direction, maxSpeed);
      const ahead = distance - travel.distance;
      for (let leaf = 0; leaf < layout.variant.leaves; leaf += 1) {
        if (ahead > TUNNEL.doorStartDistance) expect(tunnelDoorLeafOpening(ahead, leaf, layout.variant)).toBe(0);
        if (ahead <= TUNNEL.doorClearDistance) {
          expect(tunnelDoorLeafOpening(ahead, leaf, layout.variant)).toBe(1);
          expect(tunnelDoorLeafClearance(ahead, leaf, layout)).toBeGreaterThan(layout.aperture);
        }
      }
      if (Math.abs(ahead) < 12) {
        sampleCenterline(travel.distance, camera);
        sampleCenterline(distance, center).sub(camera);
        sampleDirection(distance, direction).normalize();
        const axial = center.dot(direction);
        const transverse = Math.sqrt(Math.max(0, center.lengthSq() - axial * axial));
        const structuralClearance = layout.aperture - section.radius * 0.012;
        expect(structuralClearance - transverse).toBeGreaterThan(TUNNEL.safeRadius);
      }
    }
  }
  expect([...variants]).toEqual(["iris", "split", "bay"]);
  const small = tunnelDoorLayout(112, 9).aperture;
  const normal = tunnelDoorLayout(752, 7).aperture;
  const large = tunnelDoorLayout(1392, 7).aperture;
  expect(small).toBeLessThan(normal);
  expect(tunnelDoorLayout(752, 9).aperture).toBeLessThan(large);
});

test("gateway pockets conceal moving edges and reuse bounded geometry through every opening", () => {
  const doors = createTunnelDoors();
  expect(doors.group.children).toEqual([...doors.meshes, doors.housing]);
  expect([...doors.meshes, doors.housing].every((mesh) => mesh.material.map === null)).toBe(true);
  const section = createTunnelSection();
  const matrix = new Matrix4();
  const point = new Vector3();
  const buffers = doors.meshes.map((mesh) => [mesh.instanceMatrix.array, mesh.instanceColor!.array]);
  const clipped = doors.meshes.slice(0, 3);
  let minimumHardwareClearance = Infinity;
  let maximumProtrusion = -Infinity;
  let minimumOpenLeafClearance = Infinity;
  for (const mesh of clipped) {
    const shader = { ...ShaderLib.basic, uniforms: { ...ShaderLib.basic.uniforms } };
    mesh.material.onBeforeCompile(shader, {} as WebGLRenderer);
    expect(shader.uniforms.doorPocketRadius).toBe(doors.pocket);
    expect(shader.vertexShader).toContain("doorLocalPosition = (instanceMatrix * vec4(transformed, 1.0)).xy");
    expect(shader.fragmentShader).toContain("if (length(doorLocalPosition) > doorPocketRadius) discard;");
  }
  for (let encounter = 0; encounter < 18; encounter += 1) {
    const distance = encounter * TUNNEL.sectionLength + 112;
    const radius = sampleTunnelSection(distance, section).radius;
    const layout = tunnelDoorLayout(distance, radius);
    for (let ahead = 140; ahead >= -20; ahead -= 4) {
      doors.update(distance, radius, ahead, 3.2, 0.7, true, 0.4);
      expect(doors.pocket.value).toBeLessThan(layout.outerRadius - 0.2);
      expect(doors.pocket.value).toBeGreaterThan(layout.aperture);
      expect(doors.meshes[0].count + doors.meshes[1].count).toBe(layout.variant.leaves);
      expect(doors.meshes[3].count).toBe(24);
      expect(doors.meshes[4].count).toBe(12);
      for (const [index, mesh] of doors.meshes.entries()) {
        expect(mesh.instanceMatrix.array).toBe(buffers[index][0]);
        expect(mesh.instanceColor!.array).toBe(buffers[index][1]);
        expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.count);
        if (index < 3) continue;
        const positions = mesh.geometry.getAttribute("position");
        for (let instance = 0; instance < mesh.count; instance += 1) {
          mesh.getMatrixAt(instance, matrix);
          for (let vertex = 0; vertex < positions.count; vertex += 1) {
            point.fromBufferAttribute(positions, vertex).applyMatrix4(matrix);
            const radial = Math.hypot(point.x, point.y);
            maximumProtrusion = Math.max(maximumProtrusion, radial - layout.outerRadius);
            minimumHardwareClearance = Math.min(minimumHardwareClearance, radial);
          }
        }
      }
      if (ahead <= TUNNEL.doorClearDistance) {
        for (const mesh of clipped) {
          const positions = mesh.geometry.getAttribute("position");
          for (let instance = 0; instance < mesh.count; instance += 1) {
            mesh.getMatrixAt(instance, matrix);
            for (let vertex = 0; vertex < positions.count; vertex += 1) {
              point.fromBufferAttribute(positions, vertex).applyMatrix4(matrix);
              minimumOpenLeafClearance = Math.min(minimumOpenLeafClearance, Math.hypot(point.x, point.y) - layout.aperture);
            }
          }
        }
      }
    }
  }
  expect(maximumProtrusion).toBeLessThan(0.02);
  expect(minimumHardwareClearance).toBeGreaterThan(TUNNEL.safeRadius);
  expect(minimumOpenLeafClearance).toBeGreaterThan(0);
  doors.dispose();
});

test("all gateway leaves and lighting freeze with each motion gate and release owned resources", () => {
  const doors = createTunnelDoors();
  const motion = createTunnelMotion();
  const travel = createTunnelTravel();
  const direction = new Vector3();
  const snapshot = { isActive: true, smoothedEnergy: 0.6 };
  const resources = new Set<BufferGeometry | Material>([doors.housing.material]);
  const meshDisposals = new Set();
  doors.meshes.forEach((mesh) => {
    resources.add(mesh.geometry);
    resources.add(mesh.material);
    mesh.addEventListener("dispose", () => meshDisposals.add(mesh));
  });
  const state = () => doors.meshes.map((mesh) => ({
    count: mesh.count, matrices: Array.from(mesh.instanceMatrix.array), colors: Array.from(mesh.instanceColor!.array),
  }));
  for (let encounter = 0; encounter < 3; encounter += 1) {
    const distance = encounter * TUNNEL.sectionLength + 112;
    travel.distance = distance - 72;
    const update = (chroma = true) => doors.update(distance, 8, distance - travel.distance, motion.animationMs / 1000, motion.energy, chroma, motion.surgeEnvelope);
    updateTunnelMotion(motion, 0.05, true, true, snapshot);
    update();
    resources.add(doors.housing.geometry);
    const frozen = state();
    for (const [playing, enabled, reduced] of [[false, true, false], [true, false, false], [true, true, true]]) {
      const moving = playing && enabled && !reduced;
      updateTunnelMotion(motion, 0.05, moving, playing, snapshot);
      advanceTunnel(travel, 0.05, moving, direction, 72);
      update();
      expect(state()).toEqual(frozen);
    }
    updateTunnelMotion(motion, 0.05, true, true, snapshot);
    advanceTunnel(travel, 0.05, true, direction, 72);
    update();
    expect(state()).not.toEqual(frozen);
    update(false);
    const off = state();
    doors.update(distance, 8, distance - travel.distance, 999, 1, false, 1);
    expect(state()).toEqual(off);
  }
  const disposed = new Map<BufferGeometry | Material, number>();
  resources.forEach((resource) => resource.addEventListener("dispose", () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1)));
  doors.dispose();
  expect(disposed.size).toBe(resources.size);
  expect([...disposed.values()].every((count) => count === 1)).toBe(true);
  expect(meshDisposals.size).toBe(doors.meshes.length);
  expect(doors.group.children).toHaveLength(0);
});

async function runtime(page: Page) {
  return page.evaluate(() => window.__DSFM_TEST__!.environment);
}

async function canvasPixels(page: Page) {
  return page.getByLabel("Signal Tunnel canvas").evaluate((element) =>
    new Promise<{ hash: number; litPixels: number; intensity: number; accentPixels: number }>((resolve) => {
      requestAnimationFrame(() => {
        const sample = document.createElement("canvas");
        sample.width = 160;
        sample.height = 100;
        const context = sample.getContext("2d")!;
        context.drawImage(element as HTMLCanvasElement, 0, 0, 160, 100);
        const pixels = context.getImageData(0, 0, 160, 100).data;
        let hash = 0;
        let litPixels = 0;
        let intensity = 0;
        let accentPixels = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          hash = (Math.imul(hash, 31) + red + green * 3 + blue * 7) | 0;
          intensity += red + green + blue;
          if (Math.max(red, green, blue) > 10) {
            litPixels += 1;
            if (red > green * 1.2 || (green > red * 1.15 && green > blue * 1.3)) accentPixels += 1;
          }
        }
        resolve({ hash, litPixels, intensity, accentPixels });
      });
    }),
  );
}

test("section pacing smoothly opens three distinct chamber types", () => {
  const section = createTunnelSection();
  const types = new Set<string>();
  let previousRadius = sampleTunnelSection(0, section).radius;
  let maximumRadius = 0;
  for (let distance = 1; distance < TUNNEL.sectionLength * 4; distance += 1) {
    sampleTunnelSection(distance, section);
    expect(section.radius).toBeGreaterThanOrEqual(7);
    expect(Math.abs(section.radius - previousRadius)).toBeLessThan(0.3);
    if (section.openness === 1) types.add(section.archetype);
    maximumRadius = Math.max(maximumRadius, section.radius);
    previousRadius = section.radius;
  }
  expect(maximumRadius).toBe(TUNNEL.chamberRadius);
  expect([...types]).toEqual(["spiral", "rails", "torus"]);
  expect(sampleTunnelSection(640, section).openness).toBe(0);
});

test("solid corridors and paired thresholds recycle without entering chamber clearings", () => {
  const section = createTunnelSection();
  const travel = createTunnelTravel();
  const direction = new Vector3();
  const modes = new Set<string>();
  let maximumGateways = 0;
  for (let frame = 0; frame < 9000; frame += 1) {
    advanceTunnel(travel, 1 / 30, true, direction, 72);
    if (frame % 30 !== 0) continue;
    let gateways = 0;
    let solidSegments = 0;
    for (const distance of travel.segments) {
      sampleTunnelSection(distance, section);
      if (section.solid) {
        expect(section.openness).toBe(0);
        solidSegments += 1;
        modes.add("solid");
      } else if (section.openness === 0) modes.add("lattice");
      if (section.gateway) {
        expect(section.openness).toBe(0);
        gateways += 1;
        modes.add("gateway");
      }
    }
    maximumGateways = Math.max(maximumGateways, gateways);
    expect(solidSegments).toBeLessThanOrEqual(TUNNEL.segmentCount);
    expect(gateways).toBeLessThanOrEqual(4);
  }
  expect(modes).toEqual(new Set(["solid", "lattice", "gateway"]));
  expect(maximumGateways).toBeGreaterThan(0);
});

test("doors open before arrival at every speed and new set pieces remain bounded", () => {
  const travel = createTunnelTravel();
  const section = createTunnelSection();
  const direction = new Vector3();
  const camera = new Vector3();
  const doorCenter = new Vector3();
  let doors = 0;
  let tori = 0;
  let portals = 0;
  expect(tunnelDoorOpening(120)).toBe(0);
  expect(tunnelDoorOpening(72)).toBeCloseTo(0.5);
  expect(tunnelDoorOpening(TUNNEL.doorClearDistance)).toBe(1);
  expect(tunnelDoorOpening(-20)).toBe(1);
  for (let frame = 0; frame < 3_600; frame += 1) {
    advanceTunnel(travel, 1 / 20, true, direction, frame % 2 ? 72 : 8);
    sampleCenterline(travel.distance, camera);
    let liveTori = 0;
    let livePortals = 0;
    let liveDoors = 0;
    for (const distance of travel.segments) {
      sampleTunnelSection(distance, section);
      if (section.door) {
        liveDoors += 1;
        doors += 1;
        const ahead = distance - travel.distance;
        if (ahead <= TUNNEL.doorClearDistance) expect(tunnelDoorOpening(ahead)).toBe(1);
        if (Math.abs(ahead) < 12) {
          sampleCenterline(distance, doorCenter).sub(camera);
          sampleDirection(distance, direction).normalize();
          const axial = doorCenter.dot(direction);
          const transverseOffset = Math.sqrt(Math.max(0, doorCenter.lengthSq() - axial * axial));
          expect(tunnelDoorHalfGap(ahead, section.radius) - transverseOffset).toBeGreaterThan(TUNNEL.safeRadius);
        }
      }
      if (section.torus) {
        tori += 1;
        liveTori += 1;
        expect(section.radius * 0.86 * Math.cos(TUNNEL.torusTilt) ** 2 - TUNNEL.torusTube).toBeGreaterThan(TUNNEL.safeRadius);
      }
      if (section.reentry) {
        portals += 1;
        livePortals += 1;
        expect(section.radius - 0.5).toBeGreaterThan(TUNNEL.safeRadius);
      }
    }
    expect(liveDoors).toBeLessThanOrEqual(1);
    expect(liveTori).toBeLessThanOrEqual(5);
    expect(livePortals).toBeLessThanOrEqual(1);
  }
  expect(doors).toBeGreaterThan(0);
  expect(tori).toBeGreaterThan(0);
  expect(portals).toBeGreaterThan(0);
});

test("audio speed is bounded, damped and stops without usable playback", () => {
  const loud = { isActive: true, smoothedEnergy: 1 };
  expect(tunnelTargetSpeed(true, loud)).toBe(TUNNEL.speed + TUNNEL.maxSpeedBoost);
  expect(tunnelTargetSpeed(false, loud)).toBe(0);
  expect(tunnelTargetSpeed(true)).toBe(0);
  expect(tunnelTargetSpeed(true, { ...loud, isActive: false })).toBe(0);
  expect(tunnelTargetSpeed(true, { ...loud, smoothedEnergy: NaN })).toBe(0);
  expect(tunnelTargetSpeed(true, { ...loud, smoothedEnergy: -1 })).toBe(0);
  expect(tunnelTargetSpeed(true, { ...loud, smoothedEnergy: 0.01 })).toBeLessThan(1);
  const target = tunnelTargetSpeed(true, loud);
  let speed: number = TUNNEL.speed;
  for (let frame = 0; frame < 180; frame += 1) {
    const next = dampTunnelSpeed(speed, target, 1 / 60);
    expect(next - speed).toBeLessThan(2);
    expect(next).toBeLessThanOrEqual(target);
    speed = next;
  }
  expect(speed).toBeGreaterThan(TUNNEL.speed + 6);
  expect(dampTunnelSpeed(speed, TUNNEL.speed, 1 / 60)).toBeLessThan(speed);
  let coarse: number = TUNNEL.speed;
  for (let frame = 0; frame < 90; frame += 1) coarse = dampTunnelSpeed(coarse, target, 1 / 30);
  expect(coarse).toBeCloseTo(speed, 8);
});

test("shared surge qualification launches a bounded burst and freezes its clock", () => {
  const motion = createTunnelMotion();
  const loud = { isActive: true, smoothedEnergy: 1, energy: 1, bass: 1 };
  const quiet = { ...loud, smoothedEnergy: 0.1, energy: 0.1, bass: 0.1 };
  for (let frame = 0; frame < 60; frame += 1) updateTunnelMotion(motion, 1 / 60, true, true, loud);
  expect(motion.surgeCount).toBe(0);
  for (let frame = 0; frame < 40; frame += 1) updateTunnelMotion(motion, 1 / 60, true, true, quiet);
  for (let frame = 0; frame < 30; frame += 1) updateTunnelMotion(motion, 1 / 60, true, true, loud);
  expect(motion.surgeCount).toBe(1);
  expect(motion.speed).toBeGreaterThan(TUNNEL.speed + TUNNEL.maxSpeedBoost);
  expect(motion.targetSpeed).toBe(TUNNEL.speed + TUNNEL.maxSpeedBoost + TUNNEL.surgeBoost);
  const frozen = structuredClone(motion);
  for (let frame = 0; frame < 120; frame += 1) updateTunnelMotion(motion, 1 / 60, false, true, quiet);
  expect(motion).toEqual(frozen);
  for (let frame = 0; frame < 120; frame += 1) updateTunnelMotion(motion, 1 / 60, true, false, loud);
  expect(motion).toEqual(frozen);
  for (let frame = 0; frame < 120; frame += 1) updateTunnelMotion(motion, 1 / 60, true, true, loud);
  expect(motion.surgeCount).toBe(1);
  expect(motion.surgeEnvelope).toBe(0);
  for (let frame = 0; frame < 40; frame += 1) updateTunnelMotion(motion, 1 / 60, true, true, quiet);
  for (let frame = 0; frame < 30; frame += 1) updateTunnelMotion(motion, 1 / 60, true, true, loud);
  expect(motion.surgeCount).toBe(2);
  updateTunnelMotion(motion, 1 / 60, true, true, { ...quiet, smoothedEnergy: 0, energy: 0, bass: 0 });
  expect(motion.targetSpeed).toBe(0);
  expect(motion.surgeEnvelope).toBe(0);
  updateTunnelMotion(motion, 1 / 60, true, false, loud);
  expect(motion.targetSpeed).toBe(0);
});

test("surge activation propagates locally and silent playback settles to a full stop", () => {
  expect(tunnelSurgeActivation(150, 0, 1)).toBeGreaterThan(0.9);
  expect(tunnelSurgeActivation(5, 1, 1)).toBeGreaterThan(0.9);
  expect(tunnelSurgeActivation(150, 1, 1)).toBeLessThan(0.2);
  expect(tunnelSurgeActivation(500, 1, 1)).toBe(0);
  expect(tunnelSurgeActivation(5, 1, 0)).toBe(0);
  const motion = createTunnelMotion();
  for (let frame = 0; frame < 120; frame += 1) updateTunnelMotion(motion, 1 / 60, true, true, { isActive: true, smoothedEnergy: 1 });
  const animationTime = motion.animationMs;
  for (let frame = 0; frame < 300; frame += 1) updateTunnelMotion(motion, 1 / 60, true, true, { isActive: true, smoothedEnergy: 0 });
  expect(motion.speed).toBe(0);
  expect(motion.targetSpeed).toBe(0);
  expect(motion.animationMs).toBe(animationTime);
});

test("tunnel pool stays bounded and safely centered through repeated recycling", () => {
  const travel = createTunnelTravel();
  const segments = travel.segments;
  const direction = new Vector3();
  const center = new Vector3();
  const offset = new Vector3();
  const tangent = new Vector3();
  const section = createTunnelSection();
  const sampleChamberPoint = createChamberPointSampler();
  const beam = new Line3();
  const nearest = new Vector3();
  let minimumBeamClearance = Infinity;
  let minimumClearance = Infinity;
  let maximumBend = 0;

  for (let frame = 0; frame < 18_000; frame += 1) {
    advanceTunnel(travel, 1 / 60, true, direction, TUNNEL.speed + TUNNEL.maxSpeedBoost + TUNNEL.surgeBoost);
    if (frame % 60 !== 0) continue;
    sampleCenterline(travel.distance, center);
    for (const distance of segments) {
      sampleCenterline(distance, offset).sub(center);
      sampleDirection(distance, tangent).normalize();
      const axial = offset.dot(tangent);
      const radial = Math.sqrt(Math.max(0, offset.lengthSq() - axial * axial));
      const radius = sampleTunnelSection(distance, section).radius;
      const clearance = Math.hypot(axial, radial - radius) - 0.05 * radius;
      minimumClearance = Math.min(minimumClearance, clearance);
      if (section.openness > 0 && section.archetype !== "torus") {
        const laneCount = section.archetype === "spiral" ? 6 : 4;
        for (let lane = 0; lane < laneCount; lane += 1) {
          const layer = section.archetype === "spiral" && lane >= 3 ? 1 : 0;
          const strand = section.archetype === "spiral" ? lane % 3 : lane;
          sampleChamberPoint(distance - TUNNEL.spacing / 2, strand, section.archetype, beam.start, layer);
          sampleChamberPoint(distance + TUNNEL.spacing / 2, strand, section.archetype, beam.end, layer);
          beam.closestPointToPoint(center, true, nearest);
          minimumBeamClearance = Math.min(minimumBeamClearance, nearest.distanceTo(center) - 0.25);
        }
      }
      expect(distance).toBeGreaterThanOrEqual(travel.distance - TUNNEL.behindDistance);
    }
    const farthest = Math.max(...segments) - travel.distance;
    expect(farthest).toBeGreaterThan(TUNNEL.far + TUNNEL.radius);
    expect(farthest).toBeLessThanOrEqual(TUNNEL.segmentCount * TUNNEL.spacing);
    sampleDirection(travel.distance, direction).normalize();
    sampleDirection(travel.distance + 80, tangent).normalize();
    maximumBend = Math.max(maximumBend, direction.angleTo(tangent));
  }

  expect(travel.segments).toBe(segments);
  expect(new Set(segments).size).toBe(TUNNEL.segmentCount);
  expect(travel.recycled).toBeGreaterThan(700);
  expect(minimumClearance).toBeGreaterThan(6);
  expect(minimumBeamClearance).toBeGreaterThan(4.2);
  expect(maximumBend).toBeGreaterThan(0.1);
  expect(maximumBend).toBeLessThan(0.5);
  const frozen = travel.distance;
  const frozenSegments = [...segments];
  advanceTunnel(travel, 10, false, direction);
  expect(travel.distance).toBe(frozen);
  expect([...segments]).toEqual(frozenSegments);
  advanceTunnel(travel, 10, true, direction);
  expect(travel.distance - frozen).toBeLessThanOrEqual(TUNNEL.speed * 0.05);
});

test.describe("Signal Tunnel player", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/player/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByLabel("Visual environment").selectOption("signal-tunnel");
  });

  test("registers frozen without playback, travels with music and pauses completely", async ({ page, pageErrors }) => {
    const canvas = page.getByLabel("Signal Tunnel canvas");
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toBeVisible();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const before = (await runtime(page)).travelPosition!;
    const stopped = await canvasPixels(page);
    await page.waitForTimeout(350);
    expect((await runtime(page)).travelPosition).toBe(before);
    expect(await canvasPixels(page)).toEqual(stopped);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).travelPosition).toBeGreaterThan(before);
    const movingPixels = await canvasPixels(page);
    expect(movingPixels.litPixels).toBeGreaterThan(50);
    await expect.poll(async () => (await canvasPixels(page)).hash).not.toBe(movingPixels.hash);

    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const frozen = (await runtime(page)).travelPosition;
    const image = await canvasPixels(page);
    await page.waitForTimeout(350);
    expect((await runtime(page)).travelPosition).toBe(frozen);
    expect(await canvasPixels(page)).toEqual(image);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).travelPosition).toBeGreaterThan(frozen!);
    expect(pageErrors).toEqual([]);
  });

  test("reduced motion freezes the visible tunnel", async ({ page, pageErrors }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect(page.getByLabel("Signal Tunnel canvas")).toBeVisible();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const frozen = (await runtime(page)).travelPosition;
    const pixels = await canvasPixels(page);
    await page.waitForTimeout(350);
    expect((await runtime(page)).travelPosition).toBe(frozen);
    expect(await canvasPixels(page)).toEqual(pixels);
    expect(pageErrors).toEqual([]);
  });

  test("music drives travel while MOTION still freezes all geometry", async ({ page, pageErrors }) => {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed, { timeout: 15_000 })
      .toBeGreaterThan(5);
    expect((await runtime(page)).motionSpeed).toBeLessThanOrEqual(TUNNEL.speed + TUNNEL.maxSpeedBoost + TUNNEL.surgeBoost);
    await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const frozen = await canvasPixels(page);
    const distance = (await runtime(page)).travelPosition;
    await page.waitForTimeout(350);
    expect(await canvasPixels(page)).toEqual(frozen);
    expect((await runtime(page)).travelPosition).toBe(distance);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test("real playback volume reduces analyzed propulsion without changing toggles", async ({ page, pageErrors }) => {
    test.setTimeout(60_000);
    const volume = page.getByRole("slider", { name: "Volume" });
    await volume.fill("1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByLabel("Seek playback")).toBeVisible();
    await page.getByLabel("Seek playback").fill("43");
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 15_000 }).toBeGreaterThan(TUNNEL.speed + 12);
    const fullEnergy = await page.evaluate(() => window.__DSFM_TEST__!.audio.smoothedEnergy);
    await volume.fill("0.12");
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 10_000 }).toBeLessThan(10);
    expect(await page.evaluate(() => window.__DSFM_TEST__!.audio.smoothedEnergy)).toBeLessThan(fullEnergy);
    await volume.fill("0.03");
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 10_000 }).toBeLessThan(2);
    await volume.fill("0");
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed).toBe(0);
    await expect.poll(async () => (await runtime(page)).motionSpeed, { timeout: 10_000 }).toBe(0);
    const surgeCount = (await runtime(page)).surgeCount;
    const silentPixels = await canvasPixels(page);
    await page.waitForTimeout(500);
    expect((await runtime(page)).surgeCount).toBe(surgeCount);
    expect(await canvasPixels(page)).toEqual(silentPixels);
    await expect(page.getByLabel("Motion", { exact: true })).toBeChecked();
    await expect(page.getByLabel("Toggle environment chroma effects")).toBeChecked();
    await volume.fill("1");
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 10_000 }).toBeGreaterThan(TUNNEL.speed + 12);
    expect(pageErrors).toEqual([]);
  });

  test("real demo playback qualifies a surge and freezes it with MOTION OFF", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(65_000);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).surgeCount, { timeout: 45_000, intervals: [100] }).toBeGreaterThan(0);
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 2000, intervals: [50] })
      .toBeGreaterThan(TUNNEL.speed + TUNNEL.maxSpeedBoost);
    await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const frozen = await canvasPixels(page);
    const before = await runtime(page);
    await page.waitForTimeout(500);
    expect(await canvasPixels(page)).toEqual(frozen);
    expect((await runtime(page)).surgeCount).toBe(before.surgeCount);
    expect((await runtime(page)).travelPosition).toBe(before.travelPosition);
    await page.screenshot({ path: testInfo.outputPath("surge-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath("surge-mobile.png") });
    expect((await canvasPixels(page)).litPixels).toBeGreaterThan(50);
    await page.setViewportSize({ width: 1280, height: 720 });
    const chromatic = await canvasPixels(page);
    await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
    await expect(page.getByLabel("Toggle environment chroma effects")).not.toBeChecked();
    const authored = await canvasPixels(page);
    expect(authored.hash).not.toBe(chromatic.hash);
    expect(chromatic.intensity).toBeGreaterThan(authored.intensity * 1.1);
    expect(chromatic.accentPixels).toBeGreaterThan(authored.accentPixels);
    await page.waitForTimeout(200);
    expect(await canvasPixels(page)).toEqual(authored);
    expect(pageErrors).toEqual([]);
  });

  test("doors, corridors, all chambers and spiral reentry render through the same bounded journey", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(180_000);
    await page.getByRole("slider", { name: "Volume" }).fill("1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const checkpoints = [[8, "sealed-iris"], [55, "opening-iris"], [90, "clear-iris"], [136, "gateway"], [285, "spiral"],
      [648, "sealed-hatch"], [695, "opening-hatch"], [730, "clear-hatch"], [925, "rails"],
      [1288, "sealed-bay"], [1335, "opening-bay"], [1370, "clear-bay"], [1550, "torus"], [1690, "reentry"]] as const;
    const observations = [];
    for (const [distance, name] of checkpoints) {
      await expect.poll(async () => (await runtime(page)).travelPosition, { timeout: 65_000, intervals: [100] })
        .toBeGreaterThan(distance);
      const telemetry = await runtime(page);
      await page.locator("label").filter({ hasText: /^Motion$/ }).click();
      await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
      await page.getByRole("button", { name: "Collapse player panel" }).click();
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        const pixels = await canvasPixels(page);
        expect(pixels.litPixels).toBeGreaterThan(50);
        await page.waitForTimeout(150);
        expect(await canvasPixels(page)).toEqual(pixels);
        await page.screenshot({ path: testInfo.outputPath(`${name}-${viewport.width}.png`) });
        observations.push({ name, viewport, pixels, telemetry });
      }
      await page.getByRole("button", { name: "Expand player panel" }).click();
      await page.setViewportSize({ width: 1440, height: 900 });
      const colorful = await canvasPixels(page);
      await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
      const subdued = await canvasPixels(page);
      expect(colorful.intensity).toBeGreaterThan(subdued.intensity * 1.1);
      expect(colorful.accentPixels).toBeGreaterThan(subdued.accentPixels);
      await page.screenshot({ path: testInfo.outputPath(`${name}-chroma-off.png`) });
      await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
      await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    }
    await testInfo.attach("journey-render-samples", { body: JSON.stringify(observations, null, 2), contentType: "application/json" });
    expect(pageErrors).toEqual([]);
  });

  test("reports render FPS and releases the scene on repeated switches", async ({ page, pageErrors }) => {
    await page.addInitScript(() => {
      const resources = { frames: new Set<number>(), buffers: new Set<WebGLBuffer>(), programs: new Set<WebGLProgram>(), textures: new Set<WebGLTexture>() };
      window.__TUNNEL_RESOURCES__ = resources;
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
    const environment = page.getByLabel("Visual environment");
    const fps = page.locator(".visual-feed-window__fps .visual-feed-window__metric-value");
    const counts = () => page.evaluate(() => {
      const resources = window.__TUNNEL_RESOURCES__;
      return { frames: resources.frames.size, buffers: resources.buffers.size, programs: resources.programs.size, textures: resources.textures.size };
    });
    await environment.selectOption("minimal");
    const baseline = await counts();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await environment.selectOption("signal-tunnel");
      await expect(page.getByLabel("Signal Tunnel canvas")).toHaveCount(1);
      await expect.poll(async () => Number(await fps.textContent())).toBeGreaterThan(0);
      const mounted = await counts();
      expect(mounted.frames).toBe(baseline.frames + 1);
      expect(mounted.textures).toBe(baseline.textures);
      expect(mounted.buffers).toBeGreaterThan(baseline.buffers);
      expect(mounted.programs).toBeGreaterThan(baseline.programs);
      await environment.selectOption("minimal");
      await expect(page.getByLabel("Signal Tunnel environment")).toHaveCount(0);
      await expect(page.locator(".player-shell__scene canvas")).toHaveCount(0);
      await expect(page.locator(".minimal-scene")).toBeVisible();
      await expect.poll(counts).toEqual(baseline);
      await page.waitForTimeout(1100);
      await expect(fps).toHaveText("---");
      await environment.selectOption("signal-tunnel");
    }
    await environment.selectOption("signal-gradient");
    await expect(page.locator(".signal-gradient-scene")).toBeVisible();
    await expect(page.getByLabel("Signal Tunnel canvas")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("fits a narrow viewport and still advances", async ({ page, pageErrors }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const canvas = page.getByLabel("Signal Tunnel canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box!.width).toBe(390);
    expect(box!.height).toBe(844);
    await expect.poll(async () => (await runtime(page)).travelPosition).toBeGreaterThan(1);
    expect((await canvasPixels(page)).litPixels).toBeGreaterThan(50);
    expect(pageErrors).toEqual([]);
  });
});