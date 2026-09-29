import { BoxGeometry, Matrix4, Quaternion, TorusGeometry, Vector3 } from "three";
import type { Page } from "@playwright/test";
import type { AudioReactiveSnapshot } from "../../src/app/playerTypes";
import { test, expect } from "../support/test";
import {
  advanceTransitWorld, createTransitLighting, createTransitWorld, sampleTransitDirection,
  sampleTransitPath, TRANSIT, updateTransitLighting,
} from "../../src/themes/alien-megastructure-transit/transitWorld";
import { createTransitArchitecture } from "../../src/themes/alien-megastructure-transit/transitArchitecture";

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
    advanceTransitWorld(world, 0.05, true, true, false, direction);
    if (frame % 12 !== 0) continue;
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
  expect(architecture.meshes).toHaveLength(7);
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
    body: JSON.stringify({ minimumClearance, counts, drawCallsWithStars: counts.length + 1 }), contentType: "application/json",
  });
  architecture.dispose();
});

test("transit lighting uses bounded shared audio and a stable CHROMA OFF fallback", () => {
  const lighting = createTransitLighting();
  const snapshot = { isActive: true, energy: 0.9, smoothedEnergy: 0.8, bass: 1 } as AudioReactiveSnapshot;
  updateTransitLighting(lighting, 0.05, true, false, snapshot);
  expect(lighting).toEqual({ energy: 0, bass: 0, intensity: 0.48, interplay: 0 });
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
  return page.getByLabel("Alien Megastructure Transit canvas").evaluate((element) =>
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
    };
  }
}

test.describe("Alien Megastructure Transit player", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/player/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByLabel("Visual environment").selectOption("alien-megastructure-transit");
  });

  test("registers and freezes pixels on idle, MOTION OFF and paused playback", async ({ page, pageErrors }) => {
    await expect(page.locator('optgroup[label="3D EXPERIENCES"] option[value="alien-megastructure-transit"]'))
      .toHaveText("Alien Megastructure Transit");
    await expect(page.getByLabel("Alien Megastructure Transit canvas")).toHaveCount(1);
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
    expect(on.brightness).toBeGreaterThan(off.brightness * 1.07);
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
    await page.addInitScript(() => {
      const resources = { frames: new Set<number>(), buffers: new Set<WebGLBuffer>(), programs: new Set<WebGLProgram>() };
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
    const select = page.getByLabel("Visual environment");
    const fps = page.locator(".visual-feed-window__fps .visual-feed-window__metric-value");
    const resourceCounts = () => page.evaluate(() => {
      const resources = window.__TRANSIT_RESOURCES__;
      return { frames: resources.frames.size, buffers: resources.buffers.size, programs: resources.programs.size };
    });
    await select.selectOption("minimal");
    await expect(fps).toHaveText("---");
    const baseline = await resourceCounts();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await select.selectOption("alien-megastructure-transit");
      await expect(page.getByLabel("Alien Megastructure Transit canvas")).toHaveCount(1);
      await expect.poll(async () => (await runtime(page)).renderFps).toBeGreaterThan(0);
      const mounted = await resourceCounts();
      expect(mounted.frames).toBe(baseline.frames + 1);
      expect(mounted.buffers).toBeGreaterThan(baseline.buffers);
      expect(mounted.programs).toBeGreaterThan(baseline.programs);
      await select.selectOption("minimal");
      await expect(page.locator(".player-shell__scene canvas")).toHaveCount(0);
      await expect.poll(resourceCounts).toEqual(baseline);
      await page.waitForTimeout(1100);
      await expect(fps).toHaveText("---");
    }
    expect(pageErrors).toEqual([]);
  });

  test("renders open flight and all encounters on desktop and narrow screens", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(100_000);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const observations = [];
    for (const [distance, name] of [[100, "ring"], [2450, "open-void"], [3900, "monoliths"], [7000, "bridge"]] as const) {
      await expect.poll(async () => (await runtime(page)).travelPosition, { timeout: 30_000, intervals: [100] })
        .toBeGreaterThan(distance);
      await page.locator("label").filter({ hasText: /^Motion$/ }).click();
      await expect.poll(async () => (await runtime(page)).motionSpeed).toBe(0);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        const canvas = page.getByLabel("Alien Megastructure Transit canvas");
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
        await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
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