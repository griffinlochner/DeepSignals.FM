import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";
import { createTwilightState, twilightQuality, updateTwilightState } from "../../src/themes/twilight-tides/twilightRuntime";
import type { RuntimeTestSnapshot } from "../../src/app/runtimeTestBridge";

const playing = { isPlaying: true, motionEnabled: true, reducedMotion: false };
const loud = { isActive: true, smoothedEnergy: 1 };

declare global {
  interface Window {
    __TWILIGHT_RESOURCES__: {
      frames: Set<number>;
      buffers: Map<WebGLBuffer, WebGL2RenderingContext>;
      textures: Map<WebGLTexture, WebGL2RenderingContext>;
      programs: Map<WebGLProgram, WebGL2RenderingContext>;
      framebuffers: Map<WebGLFramebuffer, WebGL2RenderingContext>;
    };
  }
}

test("Twilight Tides smooths energy without beat pumping and retains ambient motion at silence", () => {
  const state = createTwilightState();
  updateTwilightState(state, 1 / 60, playing, loud);
  expect(state.waterEnergy).toBeGreaterThan(0);
  expect(state.waterEnergy).toBeLessThan(0.025);
  for (let frame = 0; frame < 300; frame++) updateTwilightState(state, 1 / 60, playing, loud);
  expect(state.waterEnergy).toBeGreaterThan(0.99);
  expect(state.time).toBeGreaterThan(4);
  expect(state.time).toBeLessThan(4.7);
  for (const snapshot of [undefined, null, { ...loud, isActive: false }, { ...loud, smoothedEnergy: NaN }, { ...loud, smoothedEnergy: 0 }]) {
    const before = state.time;
    for (let frame = 0; frame < 600; frame++) updateTwilightState(state, 1 / 60, playing, snapshot);
    expect(state.waterEnergy).toBeLessThan(0.001);
    expect(state.time).toBeGreaterThan(before + 7.4);
    expect(Number.isFinite(state.time)).toBe(true);
  }
});

test("Twilight Tides freezes kinetic state with every gate, bounds deltas and preserves independent color", () => {
  for (const controls of [
    { ...playing, isPlaying: false },
    { ...playing, motionEnabled: false },
    { ...playing, reducedMotion: true },
  ]) {
    const state = createTwilightState();
    for (let frame = 0; frame < 30; frame++) updateTwilightState(state, 1 / 60, playing, loud);
    const before = { ...state };
    for (let frame = 0; frame < 90; frame++) updateTwilightState(state, 1 / 60, controls, loud);
    expect(state.time).toBe(before.time);
    expect(state.waterEnergy).toBe(before.waterEnergy);
    if (controls.isPlaying) expect(state.colorEnergy).toBeGreaterThan(before.colorEnergy);
    else expect(state).toEqual(before);
    updateTwilightState(state, 100, playing, loud);
    expect(state.time - before.time).toBeLessThanOrEqual(0.05 * 0.93);
    const resumed = { ...state };
    for (const delta of [NaN, Infinity, -1]) updateTwilightState(state, delta, playing, loud);
    expect(state).toEqual(resumed);
  }
  const at30 = createTwilightState();
  const at120 = createTwilightState();
  for (let i = 0; i < 150; i++) updateTwilightState(at30, 1 / 30, playing, loud);
  for (let i = 0; i < 600; i++) updateTwilightState(at120, 1 / 120, playing, loud);
  expect(at30.waterEnergy).toBeCloseTo(at120.waterEnergy, 10);
  expect(at30.time).toBeCloseTo(at120.time, 2);
});

test("Twilight Tides quality bounds desktop, mobile and high-DPR drawing buffers", () => {
  for (const [width, height, dpr, constrained] of [
    [1440, 900, 2, false], [390, 844, 3, true], [3840, 2160, 3, false], [900, 600, 2, true],
  ] as const) {
    const quality = twilightQuality(width, height, dpr, constrained);
    const compact = constrained || Math.min(width, height) < 600;
    expect(width * height * quality.pixelRatio ** 2).toBeLessThanOrEqual((compact ? 1_100_000 : 2_600_000) + 1);
    expect(quality.pixelRatio).toBeLessThanOrEqual(compact ? 1.25 : 1.6);
    expect(quality.reflectionSize).toBe(compact ? 128 : 256);
    expect(quality.columns * quality.rows * 2).toBeLessThanOrEqual(32_256);
  }
});

async function runtime(page: Page): Promise<RuntimeTestSnapshot> {
  return page.evaluate(() => window.__DSFM_TEST__!);
}

async function canvasPixels(page: Page) {
  return page.getByLabel("Twilight Tides canvas").evaluate((element) =>
    new Promise<{ hash: number; sky: number; water: number; colors: number }>((resolve) => {
      requestAnimationFrame(() => {
        const sample = document.createElement("canvas");
        sample.width = 160;
        sample.height = 100;
        const context = sample.getContext("2d")!;
        context.drawImage(element as HTMLCanvasElement, 0, 0, 160, 100);
        const pixels = context.getImageData(0, 0, 160, 100).data;
        let hash = 0;
        let sky = 0;
        let water = 0;
        const colors = new Set<number>();
        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          hash = (Math.imul(hash, 31) + red + green * 3 + blue * 7) | 0;
          if (index < pixels.length * 0.4) sky += red + green + blue;
          if (index > pixels.length * 0.5) water += red + green + blue;
          colors.add((red << 16) | (green << 8) | blue);
        }
        resolve({ hash, sky, water, colors: colors.size });
      });
    }),
  );
}

async function toggle(page: Page, name: "Chroma" | "Motion" | "Info") {
  await page.locator("label").filter({ hasText: new RegExp(`^${name}$`) }).click();
  await page.waitForTimeout(100);
}

test.describe("Twilight Tides player", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/player/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByLabel("Visual environment").selectOption("twilight-tides");
  });

  test("renders a fixed ocean, persists selection, and captures desktop/mobile palettes", async ({ page, pageErrors }, testInfo) => {
    const shaderErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /THREE|WebGL|shader/i.test(message.text())) shaderErrors.push(message.text());
    });
    await page.reload();
    await expect(page.getByLabel("Visual environment")).toHaveValue("twilight-tides");
    await expect(page.getByLabel("Twilight Tides canvas")).toHaveCount(1);
    await expect(page.getByLabel("Motion")).toBeEnabled();
    await expect(page.getByLabel("Toggle environment chroma effects")).toBeEnabled();
    const still = await canvasPixels(page);
    expect(still.sky).toBeGreaterThan(500_000);
    expect(still.water).toBeGreaterThan(400_000);
    expect(still.colors).toBeGreaterThan(2000);
    await page.mouse.move(900, 450);
    await page.mouse.down();
    await page.mouse.move(600, 300, { steps: 10 });
    await page.mouse.up();
    await page.mouse.wheel(0, 300);
    expect(await canvasPixels(page)).toEqual(still);
    await toggle(page, "Info");
    expect(await canvasPixels(page)).toEqual(still);
    await page.getByRole("button", { name: "Collapse player panel" }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: testInfo.outputPath("twilight-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByLabel("Twilight Tides canvas")).toBeVisible();
    expect((await canvasPixels(page)).colors).toBeGreaterThan(1500);
    await page.getByRole("button", { name: "Collapse player panel" }).click();
    await page.screenshot({ path: testInfo.outputPath("twilight-mobile.png") });
    await expect.poll(async () => (await runtime(page)).environment.renderFps).toBeGreaterThan(0);
    await testInfo.attach("mobile-render-observation", {
      body: JSON.stringify({ runtime: await runtime(page), drawingBuffer: await page.getByLabel("Twilight Tides canvas").evaluate((canvas) => {
        const element = canvas as HTMLCanvasElement;
        return { width: element.width, height: element.height };
      }) }), contentType: "application/json",
    });
    expect(shaderErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("real demo drives light, motion freezes independently, mute retains ambient ripples, pause freezes all", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(45_000);
    await toggle(page, "Motion");
    const beforeMusic = await canvasPixels(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).audio.smoothedEnergy, { timeout: 15_000 }).toBeGreaterThan(0.1);
    await expect.poll(async () => (await canvasPixels(page)).sky).toBeGreaterThan(beforeMusic.sky * 1.015);
    await toggle(page, "Chroma");
    const frozen = await canvasPixels(page);
    await page.waitForTimeout(400);
    expect(await canvasPixels(page)).toEqual(frozen);
    expect(frozen.sky).toBeLessThan(beforeMusic.sky);
    await page.screenshot({ path: testInfo.outputPath("twilight-chroma-off.png") });
    await toggle(page, "Motion");
    await expect.poll(async () => (await canvasPixels(page)).hash).not.toBe(frozen.hash);
    await page.getByRole("slider", { name: "Volume" }).fill("0");
    await expect.poll(async () => (await runtime(page)).audio.smoothedEnergy, { timeout: 15_000 }).toBeLessThan(0.01);
    const quiet = await canvasPixels(page);
    await expect.poll(async () => (await canvasPixels(page)).hash).not.toBe(quiet.hash);
    await toggle(page, "Chroma");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForTimeout(100);
    const paused = await canvasPixels(page);
    await page.waitForTimeout(400);
    expect(await canvasPixels(page)).toEqual(paused);
    expect((await runtime(page)).controls).toEqual({ chroma: true, motion: true, volume: 0 });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await canvasPixels(page)).hash).not.toBe(paused.hash);
    expect(pageErrors).toEqual([]);
  });

  test("reduced motion freezes the water without changing user controls", async ({ page, pageErrors }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await toggle(page, "Chroma");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).audio.smoothedEnergy, { timeout: 15_000 }).toBeGreaterThan(0.05);
    const frozen = await canvasPixels(page);
    await page.waitForTimeout(400);
    expect(await canvasPixels(page)).toEqual(frozen);
    await expect(page.getByLabel("Motion")).toBeChecked();
    expect(pageErrors).toEqual([]);
  });

  test("reuses both demo sources and the existing radio playback path", async ({ page, pageErrors }) => {
    test.setTimeout(45_000);
    const streamUrl = "https://hirschmilch.de:7000/psytrance.mp3";
    await page.route(streamUrl, (route) => route.fulfill({
      path: "public\\audio\\demo\\illustrator-psychedelic-experience.mp3",
      headers: { "Access-Control-Allow-Origin": "*" },
    }));
    await page.route("**/metadata?channel=psytrance", (route) => route.fulfill({ json: { channelId: "psytrance", artist: "Test", title: "Radio" } }));
    for (const source of ["globular-for-the-time-being", "hirschmilch-psytrance", "demo-psychedelic-experience"]) {
      await page.getByLabel("Signal source").selectOption(source);
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect.poll(async () => (await runtime(page)).audio.smoothedEnergy, { timeout: 15_000 }).toBeGreaterThan(0.01);
      await expect(page.getByLabel("Twilight Tides canvas")).toHaveCount(1);
      expect((await runtime(page)).environment.id).toBe("twilight-tides");
    }
    expect(pageErrors).toEqual([]);
  });

  test("rebuilds baked reflections after WebGL context restoration", async ({ page, pageErrors }) => {
    const before = await canvasPixels(page);
    await page.getByLabel("Twilight Tides canvas").evaluate((canvas) => new Promise<void>((resolve) => {
      const gl = (canvas as HTMLCanvasElement).getContext("webgl2")!;
      const extension = gl.getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("Context-loss testing requires WEBGL_lose_context");
      canvas.addEventListener("webglcontextrestored", () => resolve(), { once: true });
      extension.loseContext();
      setTimeout(() => extension.restoreContext(), 250);
    }));
    await expect.poll(async () => (await canvasPixels(page)).hash).toBe(before.hash);
    await expect.poll(async () => (await runtime(page)).environment.renderFps).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  test("releases GPU resources and its owning loop across repeated switches", async ({ page, pageErrors }) => {
    await page.addInitScript(() => {
      const resources = { frames: new Set<number>(), buffers: new Map<WebGLBuffer, WebGL2RenderingContext>(), textures: new Map<WebGLTexture, WebGL2RenderingContext>(), programs: new Map<WebGLProgram, WebGL2RenderingContext>(), framebuffers: new Map<WebGLFramebuffer, WebGL2RenderingContext>() };
      window.__TWILIGHT_RESOURCES__ = resources;
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
      prototype.createBuffer = function () { const value = createBuffer.call(this); resources.buffers.set(value, this); return value; };
      prototype.deleteBuffer = function (value) { if (value) resources.buffers.delete(value); deleteBuffer.call(this, value); };
      const createTexture = prototype.createTexture;
      const deleteTexture = prototype.deleteTexture;
      prototype.createTexture = function () { const value = createTexture.call(this); resources.textures.set(value, this); return value; };
      prototype.deleteTexture = function (value) { if (value) resources.textures.delete(value); deleteTexture.call(this, value); };
      const createProgram = prototype.createProgram;
      const deleteProgram = prototype.deleteProgram;
      prototype.createProgram = function () { const value = createProgram.call(this); if (value) resources.programs.set(value, this); return value; };
      prototype.deleteProgram = function (value) { if (value) resources.programs.delete(value); deleteProgram.call(this, value); };
      const createFramebuffer = prototype.createFramebuffer;
      const deleteFramebuffer = prototype.deleteFramebuffer;
      prototype.createFramebuffer = function () { const value = createFramebuffer.call(this); resources.framebuffers.set(value, this); return value; };
      prototype.deleteFramebuffer = function (value) { if (value) resources.framebuffers.delete(value); deleteFramebuffer.call(this, value); };
    });
    await page.reload();
    const counts = () => page.evaluate(() => {
      const resources = window.__TWILIGHT_RESOURCES__;
      const active = (values: Map<unknown, WebGL2RenderingContext>) => [...values.values()].filter((context) => !context.isContextLost()).length;
      return { frames: resources.frames.size, buffers: active(resources.buffers), textures: active(resources.textures),
        programs: active(resources.programs), framebuffers: active(resources.framebuffers) };
    });
    const selector = page.getByLabel("Visual environment");
    const fps = page.locator(".visual-feed-window__fps .visual-feed-window__metric-value");
    await selector.selectOption("minimal");
    const baseline = await counts();
    for (let cycle = 0; cycle < 3; cycle++) {
      await selector.selectOption("twilight-tides");
      await expect(page.getByLabel("Twilight Tides canvas")).toHaveCount(1);
      await expect.poll(async () => Number(await fps.textContent())).toBeGreaterThan(0);
      const mounted = await counts();
      expect(mounted.frames).toBe(baseline.frames + 1);
      expect(mounted.textures).toBeGreaterThan(baseline.textures);
      expect(mounted.framebuffers).toBeGreaterThan(baseline.framebuffers);
      await selector.selectOption("minimal");
      await expect(page.getByLabel("Twilight Tides environment")).toHaveCount(0);
      await expect(fps).toHaveText("---");
      await expect.poll(counts).toEqual(baseline);
    }
    expect(pageErrors).toEqual([]);
  });
});
