import { test, expect } from "../support/test";
import type { Page } from "@playwright/test";

const DEMO_SOURCE_ID = "demo-fragments-of-reality";

type RuntimeSnapshot = {
  playback: string;
  audio: { smoothedEnergy: number };
  controls: { chroma: boolean; motion: boolean; volume: number };
  environment: {
    id: string;
    motionTargetSpeed: number | null;
    motionSpeed: number | null;
    travelPosition: number | null;
    hue: number | null;
  };
};

async function runtime(page: Page) {
  return page.evaluate(
    () =>
      (window as Window & { __DSFM_TEST__?: RuntimeSnapshot }).__DSFM_TEST__,
  ) as Promise<RuntimeSnapshot>;
}

async function startDemo(page: Page, environmentId: string) {
  await page.goto("/player/");
  await page.getByLabel("Signal source").selectOption(DEMO_SOURCE_ID);
  await page.getByLabel("Visual environment").selectOption(environmentId);
  const play = page.getByRole("button", { name: "Play", exact: true });
  await play.click();
  await expect
    .poll(async () => (await runtime(page)).playback, { timeout: 15_000 })
    .toBe("playing");
  await expect
    .poll(async () => (await runtime(page)).audio.smoothedEnergy, {
      timeout: 15_000,
    })
    .toBeGreaterThan(0.01);
  await expect
    .poll(async () => (await runtime(page)).environment.motionSpeed, {
      timeout: 15_000,
    })
    .not.toBeNull();
}

test.describe("Race to the Signal Nexus runtime contracts", () => {
  test("MOTION OFF stops travel and MOTION ON resumes it", async ({ page }) => {
    test.setTimeout(60_000);
    await startDemo(page, "neon-hyper-racer");
    const motion = page.getByLabel("Motion");

    await expect
      .poll(async () => (await runtime(page)).environment.motionSpeed ?? 0)
      .toBeGreaterThan(0);
    await page
      .locator("label")
      .filter({ hasText: /^Motion$/ })
      .click();
    await expect
      .poll(async () => (await runtime(page)).environment.motionSpeed, {
        timeout: 5_000,
      })
      .toBe(0);
    await expect
      .poll(async () => (await runtime(page)).environment.motionTargetSpeed, {
        timeout: 5_000,
      })
      .toBe(0);
    await expect(motion).not.toBeChecked();

    await page
      .locator("label")
      .filter({ hasText: /^Motion$/ })
      .click();
    await expect
      .poll(async () => (await runtime(page)).environment.motionSpeed ?? 0, {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    await expect(motion).toBeChecked();
  });

  test("CHROMA settles hue without changing the motion target path", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startDemo(page, "neon-hyper-racer");
    const chroma = page.getByLabel("Toggle environment chroma effects");

    await expect
      .poll(async () => Math.abs((await runtime(page)).environment.hue ?? 0), {
        timeout: 10_000,
      })
      .toBeGreaterThan(1);
    const before = await runtime(page);
    await page
      .locator("label")
      .filter({ hasText: /^Chroma$/ })
      .click();
    await expect
      .poll(async () => Math.abs((await runtime(page)).environment.hue ?? 0), {
        timeout: 5_000,
      })
      .toBeLessThan(3);
    const after = await runtime(page);
    expect(after.environment.motionTargetSpeed).toBeGreaterThanOrEqual(0);
    expect(after.environment.motionSpeed).toBeGreaterThan(0);
    expect(
      Math.abs(
        (after.environment.motionTargetSpeed ?? 0) -
          (before.environment.motionTargetSpeed ?? 0),
      ),
    ).toBeLessThan(30);
    await expect(chroma).not.toBeChecked();

    await page
      .locator("label")
      .filter({ hasText: /^Chroma$/ })
      .click();
    await expect
      .poll(async () => Math.abs((await runtime(page)).environment.hue ?? 0), {
        timeout: 10_000,
      })
      .toBeGreaterThan(1);
  });

  test("MOTION OFF leaves CHROMA reacting to the playing audio", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startDemo(page, "neon-hyper-racer");
    await expect
      .poll(async () => Math.abs((await runtime(page)).environment.hue ?? 0), {
        timeout: 10_000,
      })
      .toBeGreaterThan(1);
    await page
      .locator("label")
      .filter({ hasText: /^Motion$/ })
      .click();
    await expect
      .poll(async () => (await runtime(page)).environment.motionSpeed, {
        timeout: 5_000,
      })
      .toBe(0);
    await expect
      .poll(async () => Math.abs((await runtime(page)).environment.hue ?? 0), {
        timeout: 10_000,
      })
      .toBeGreaterThan(1);
    await page
      .locator("label")
      .filter({ hasText: /^Motion$/ })
      .click();
  });
});

test.describe("Signal Runner runtime contracts", () => {
  test("MOTION gates travel while CHROMA remains independent", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startDemo(page, "signal-runner");
    await expect
      .poll(async () => (await runtime(page)).environment.motionSpeed ?? 0, {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => Math.abs((await runtime(page)).environment.hue ?? 0), {
        timeout: 10_000,
      })
      .toBeGreaterThan(1);

    await page
      .locator("label")
      .filter({ hasText: /^Motion$/ })
      .click();
    await expect
      .poll(async () => (await runtime(page)).environment.motionSpeed, {
        timeout: 5_000,
      })
      .toBe(0);
    await expect
      .poll(async () => Math.abs((await runtime(page)).environment.hue ?? 0), {
        timeout: 10_000,
      })
      .toBeGreaterThan(1);

    await page
      .locator("label")
      .filter({ hasText: /^Chroma$/ })
      .click();
    await expect
      .poll(async () => Math.abs((await runtime(page)).environment.hue ?? 0), {
        timeout: 15_000,
      })
      .toBeLessThan(5);
    await expect
      .poll(async () => (await runtime(page)).environment.motionSpeed, {
        timeout: 5_000,
      })
      .toBe(0);
    await page
      .locator("label")
      .filter({ hasText: /^Chroma$/ })
      .click();
    await page
      .locator("label")
      .filter({ hasText: /^Motion$/ })
      .click();
  });
});
