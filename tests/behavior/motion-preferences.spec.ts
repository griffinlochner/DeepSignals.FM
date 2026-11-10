import type { Page } from "@playwright/test";
import type { RuntimeTestSnapshot } from "../../src/app/runtimeTestBridge";
import { test, expect } from "../support/test";

const STORAGE_KEY = "deepsignals.player.preferences.v3";
const DEMO = "demo-psychedelic-experience";

function runtime(page: Page): Promise<RuntimeTestSnapshot | undefined> {
  return page.evaluate(() => window.__DSFM_TEST__);
}

async function toggleMotion(page: Page) {
  await page.locator("label").filter({ hasText: /^Motion$/ }).click();
}

async function startDemo(page: Page) {
  await page.getByLabel("Signal source").selectOption(DEMO);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => (await runtime(page))?.audio.smoothedEnergy,
    { timeout: 15_000 }).toBeGreaterThan(0.01);
}

async function pixelHash(page: Page) {
  return page.locator(".player-shell__scene canvas").evaluate((element) =>
    new Promise<number>((resolve) => requestAnimationFrame(() => {
      const sample = document.createElement("canvas");
      sample.width = 160;
      sample.height = 100;
      const context = sample.getContext("2d")!;
      context.drawImage(element as HTMLCanvasElement, 0, 0, 160, 100);
      const data = context.getImageData(0, 0, 160, 100).data;
      let hash = 0;
      for (let i = 0; i < data.length; i += 4) {
        hash = (Math.imul(hash, 31) + data[i] + data[i + 1] * 3 + data[i + 2] * 7) | 0;
      }
      resolve(hash);
    })));
}

async function sceneTransform(page: Page) {
  return page.locator(".player-shell__scene canvas").evaluate((element) =>
    new Promise<number[]>((resolve) => requestAnimationFrame(() => {
      const gl = (element as HTMLCanvasElement).getContext("webgl2")!;
      const program: WebGLProgram | null = gl.getParameter(gl.CURRENT_PROGRAM);
      if (!program) throw new Error("Expected a scene shader program");
      const location = gl.getUniformLocation(program, "modelViewMatrix");
      if (!location) throw new Error("Expected scene modelViewMatrix");
      const matrix: unknown = gl.getUniform(program, location);
      if (!(matrix instanceof Float32Array)) throw new Error("Expected a transform matrix");
      resolve(Array.from(matrix));
    })));
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort());
  await page.goto("/player/");
});

test("OS determines defaults until an explicit selection, without persisting an override", async ({ page }) => {
  const motion = page.getByLabel("Motion", { exact: true });
  await expect(motion).not.toBeChecked();
  await expect.poll(() => page.evaluate((key) =>
    JSON.parse(localStorage.getItem(key)!).motionEnabled, STORAGE_KEY)).toBeNull();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(motion).toBeChecked();
  await page.reload();
  await expect(motion).toBeChecked();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(motion).not.toBeChecked();

  await toggleMotion(page);
  await expect(motion).toBeChecked();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(motion).toBeChecked();
  // Visualization opt-in must not enable unrelated UI animation.
  await page.getByLabel("Visual environment").selectOption("shuffle-all");
  await expect(page.locator(".theme-selector__shuffle-icon").first())
    .toHaveCSS("animation-name", "none");
});

for (const enabled of [true, false]) {
  test(`explicit ${enabled ? "ON" : "OFF"} persists across sources, environments and reloads`, async ({ page }) => {
    const motion = page.getByLabel("Motion", { exact: true });
    await toggleMotion(page);
    if (!enabled) await toggleMotion(page);
    await expect.poll(() => page.evaluate((key) =>
      JSON.parse(localStorage.getItem(key)!).motionEnabled, STORAGE_KEY)).toBe(enabled);
    await page.getByLabel("Visual environment").selectOption("signal-runner");
    await page.getByLabel("Signal source").selectOption(DEMO);
    await expect(motion).toBeChecked({ checked: enabled });
    await page.getByLabel("Visual environment").selectOption("minimal");
    await expect(motion).toBeDisabled();
    await page.getByLabel("Signal source").selectOption("globular-for-the-time-being");
    await page.getByLabel("Visual environment").selectOption("signal-tunnel");
    await page.reload();
    await expect(motion).toBeChecked({ checked: enabled });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(motion).toBeChecked({ checked: enabled });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(motion).toBeChecked({ checked: enabled });
    await startDemo(page);
    const speed = expect.poll(async () => (await runtime(page))?.environment.motionSpeed);
    if (enabled) await speed.toBeGreaterThan(0);
    else await speed.toBe(0);
  });

  test(`legacy saved ${enabled ? "ON" : "OFF"} remains an override`, async ({ page }) => {
    await page.evaluate(({ key, enabled }) => localStorage.setItem(key,
      JSON.stringify({ motionEnabled: enabled })), { key: STORAGE_KEY, enabled });
    await page.reload();
    await expect(page.getByLabel("Motion", { exact: true })).toBeChecked({ checked: enabled });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.getByLabel("Motion", { exact: true })).toBeChecked({ checked: enabled });
  });
}

for (const environment of [
  "signal-tunnel", "signal-runner-2", "neon-hyper-racer",
  "cosmic-roller-coaster", "alien-megastructure-transit", "signal-rain",
  "signal-runner", "cosmic-nexus", "twilight-tides", "toxic-horizon", "uv-reactive-jungle",
]) {
  test(`explicit ON animates ${environment} despite OS reduced motion`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByLabel("Visual environment").selectOption(environment);
    await expect(page.getByLabel("Motion", { exact: true })).not.toBeChecked();
    await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
    await startDemo(page);
    await toggleMotion(page);
    await expect(page.getByLabel("Motion", { exact: true })).toBeChecked();
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

    if (environment === "uv-reactive-jungle") {
      const initial = await sceneTransform(page);
      await expect.poll(() => sceneTransform(page)).not.toEqual(initial);
      await toggleMotion(page);
      // Parallax eases back to its neutral pose after disabling motion.
      await page.waitForTimeout(1500);
      const off = await sceneTransform(page);
      expect(off[12]).toBeCloseTo(0, 2);
      expect(off[13]).toBeCloseTo(0, 2);
    } else if (["cosmic-nexus", "twilight-tides", "toxic-horizon"].includes(environment)) {
      const initial = await pixelHash(page);
      await expect.poll(() => pixelHash(page)).not.toBe(initial);
      await toggleMotion(page);
      await page.waitForTimeout(400);
      if (environment === "cosmic-nexus") {
        const off = await sceneTransform(page);
        await page.waitForTimeout(300);
        expect(await sceneTransform(page)).toEqual(off);
      } else {
        const off = await pixelHash(page);
        await page.waitForTimeout(300);
        expect(await pixelHash(page)).toBe(off);
      }
    } else {
      await expect.poll(async () => (await runtime(page))?.environment.motionSpeed)
        .toBeGreaterThan(0);
      await toggleMotion(page);
      if (environment === "cosmic-roller-coaster") {
        await page.waitForTimeout(200);
        const off = await sceneTransform(page);
        await page.waitForTimeout(300);
        expect(await sceneTransform(page)).toEqual(off);
      } else {
        await expect.poll(async () => (await runtime(page))?.environment.motionSpeed).toBe(0);
      }
    }
    await expect(page.getByLabel("Motion", { exact: true })).not.toBeChecked();
  });
}
