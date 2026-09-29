import { Line3, Vector3 } from "three";
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
  TUNNEL,
} from "../../src/themes/signal-tunnel/tunnelPath";
import type { Page } from "@playwright/test";
import { createTunnelMotion, updateTunnelMotion } from "../../src/themes/signal-tunnel/tunnelMotion";

async function runtime(page: Page) {
  return page.evaluate(() => window.__DSFM_TEST__!.environment);
}

async function canvasPixels(page: Page) {
  return page.getByLabel("Signal Tunnel canvas").evaluate((element) =>
    new Promise<{ hash: number; litPixels: number }>((resolve) => {
      requestAnimationFrame(() => {
        const sample = document.createElement("canvas");
        sample.width = 160;
        sample.height = 100;
        const context = sample.getContext("2d")!;
        context.drawImage(element as HTMLCanvasElement, 0, 0, 160, 100);
        const pixels = context.getImageData(0, 0, 160, 100).data;
        let hash = 0;
        let litPixels = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          hash = (Math.imul(hash, 31) + pixels[index]) | 0;
          if (pixels[index] > 10) litPixels += 1;
        }
        resolve({ hash, litPixels });
      });
    }),
  );
}

test("section pacing smoothly opens two distinct chamber types", () => {
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
  expect([...types]).toEqual(["spiral", "rails"]);
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

test("audio speed is bounded, damped and falls back without usable playback", () => {
  const loud = { isActive: true, smoothedEnergy: 1 };
  expect(tunnelTargetSpeed(true, loud)).toBe(TUNNEL.speed + TUNNEL.maxSpeedBoost);
  expect(tunnelTargetSpeed(false, loud)).toBe(TUNNEL.speed);
  expect(tunnelTargetSpeed(true)).toBe(TUNNEL.speed);
  expect(tunnelTargetSpeed(true, { ...loud, isActive: false })).toBe(TUNNEL.speed);
  expect(tunnelTargetSpeed(true, { ...loud, smoothedEnergy: NaN })).toBe(TUNNEL.speed);
  expect(tunnelTargetSpeed(true, { ...loud, smoothedEnergy: -1 })).toBe(TUNNEL.speed);
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
  for (let frame = 0; frame < 120; frame += 1) updateTunnelMotion(motion, 1 / 60, true, true, loud);
  expect(motion.surgeCount).toBe(1);
  expect(motion.surgeEnvelope).toBe(0);
  for (let frame = 0; frame < 40; frame += 1) updateTunnelMotion(motion, 1 / 60, true, true, quiet);
  for (let frame = 0; frame < 30; frame += 1) updateTunnelMotion(motion, 1 / 60, true, true, loud);
  expect(motion.surgeCount).toBe(2);
  updateTunnelMotion(motion, 1 / 60, true, true, { ...quiet, smoothedEnergy: 0, energy: 0, bass: 0 });
  expect(motion.targetSpeed).toBe(TUNNEL.speed);
  expect(motion.surgeEnvelope).toBe(0);
  updateTunnelMotion(motion, 1 / 60, true, false, loud);
  expect(motion.targetSpeed).toBe(TUNNEL.speed);
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
      if (section.openness > 0) {
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

  test("registers, travels without audio, freezes and resumes", async ({ page, pageErrors }) => {
    const canvas = page.getByLabel("Signal Tunnel canvas");
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toBeVisible();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(TUNNEL.speed);
    const before = (await runtime(page)).travelPosition!;
    await expect.poll(async () => (await runtime(page)).travelPosition).toBeGreaterThan(before);
    const movingPixels = await canvasPixels(page);
    expect(movingPixels.litPixels).toBeGreaterThan(50);
    await expect.poll(async () => (await canvasPixels(page)).hash).not.toBe(movingPixels.hash);

    await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const frozen = (await runtime(page)).travelPosition;
    const image = await canvasPixels(page);
    await page.waitForTimeout(350);
    expect((await runtime(page)).travelPosition).toBe(frozen);
    expect(await canvasPixels(page)).toEqual(image);
    await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    await expect.poll(async () => (await runtime(page)).travelPosition).toBeGreaterThan(frozen!);
    expect(pageErrors).toEqual([]);
  });

  test("reduced motion freezes the visible tunnel", async ({ page, pageErrors }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect(page.getByLabel("Signal Tunnel canvas")).toBeVisible();
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
    const frozen = (await runtime(page)).travelPosition;
    await page.waitForTimeout(350);
    expect((await runtime(page)).travelPosition).toBe(frozen);
    expect(pageErrors).toEqual([]);
  });

  test("music boosts speed while MOTION still freezes all geometry", async ({ page, pageErrors }) => {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).motionSpeed, { timeout: 15_000 })
      .toBeGreaterThan(TUNNEL.speed + 0.2);
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
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed).toBe(TUNNEL.speed);
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
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed, { timeout: 10_000 }).toBeLessThan(TUNNEL.speed + 8);
    expect(await page.evaluate(() => window.__DSFM_TEST__!.audio.smoothedEnergy)).toBeLessThan(fullEnergy);
    await volume.fill("0");
    await expect.poll(async () => (await runtime(page)).motionTargetSpeed).toBe(TUNNEL.speed);
    await expect.poll(async () => (await runtime(page)).motionSpeed).toBeLessThan(TUNNEL.speed + 0.3);
    const surgeCount = (await runtime(page)).surgeCount;
    await page.waitForTimeout(500);
    expect((await runtime(page)).surgeCount).toBe(surgeCount);
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
    await page.waitForTimeout(200);
    expect(await canvasPixels(page)).toEqual(authored);
    expect(pageErrors).toEqual([]);
  });

  test("corridors, gateways and both chambers render through the same bounded journey", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(90_000);
    const checkpoints = [[85, "corridor"], [136, "gateway"], [285, "spiral"], [925, "rails"]] as const;
    const observations = [];
    for (const [distance, name] of checkpoints) {
      await expect.poll(async () => (await runtime(page)).travelPosition, { timeout: 40_000, intervals: [100] })
        .toBeGreaterThan(distance);
      const telemetry = await runtime(page);
      await page.locator("label").filter({ hasText: /^Motion$/ }).click();
      await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        const pixels = await canvasPixels(page);
        expect(pixels.litPixels).toBeGreaterThan(50);
        await page.screenshot({ path: testInfo.outputPath(`${name}-${viewport.width}.png`) });
        observations.push({ name, viewport, pixels, telemetry });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.locator("label").filter({ hasText: /^Motion$/ }).click();
    }
    await testInfo.attach("journey-render-samples", { body: JSON.stringify(observations, null, 2), contentType: "application/json" });
    expect(pageErrors).toEqual([]);
  });

  test("reports render FPS and releases the scene on repeated switches", async ({ page, pageErrors }) => {
    const environment = page.getByLabel("Visual environment");
    const fps = page.locator(".visual-feed-window__fps .visual-feed-window__metric-value");
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await expect(page.getByLabel("Signal Tunnel canvas")).toHaveCount(1);
      await expect.poll(async () => Number(await fps.textContent())).toBeGreaterThan(0);
      await environment.selectOption("minimal");
      await expect(page.getByLabel("Signal Tunnel environment")).toHaveCount(0);
      await expect(page.locator(".player-shell__scene canvas")).toHaveCount(0);
      await expect(page.locator(".minimal-scene")).toBeVisible();
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