import { test, expect } from "../support/test";
import type { Page } from "@playwright/test";

const SOURCE_ID = "demo-fragments-of-reality";
type Snapshot = {
  playback: string;
  controls: { chroma: boolean; motion: boolean; volume: number };
  environment: {
    motionTargetSpeed: number | null;
    motionSpeed: number | null;
    surgeCount: number;
    lastSurgeAt: number | null;
  };
};

async function runtime(page: Page) {
  return page.evaluate(
    () => (window as Window & { __DSFM_TEST__?: Snapshot }).__DSFM_TEST__,
  ) as Promise<Snapshot>;
}

async function startRace(page: Page) {
  await page.goto("/player/");
  await page.getByLabel("Signal source").selectOption(SOURCE_ID);
  await page.getByLabel("Visual environment").selectOption("neon-hyper-racer");
  await expect(page.getByLabel("Seek playback")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(async () => (await runtime(page)).playback, { timeout: 15_000 })
    .toBe("playing");
  await expect
    .poll(async () => (await runtime(page)).controls.volume, { timeout: 5_000 })
    .toBeGreaterThan(0.9);
  await expect
    .poll(async () => (await runtime(page)).environment.motionSpeed ?? 0, {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
}

async function seekNearReference(page: Page) {
  const seek = page.getByLabel("Seek playback");
  await seek.fill("43");
  await expect
    .poll(async () => Number(await seek.inputValue()), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(42);
}

test.describe("Race volume contracts", () => {
  test("volume zero stops presented travel without changing CHROMA or MOTION", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startRace(page);
    const volume = page.getByRole("slider", { name: "Volume" });
    const chroma = page.getByLabel("Toggle environment chroma effects");
    const motion = page.getByLabel("Motion");
    const initialChroma = await chroma.isChecked();
    const initialMotion = await motion.isChecked();

    await volume.fill("0");
    await expect
      .poll(async () => (await runtime(page)).controls.volume, {
        timeout: 5_000,
      })
      .toBe(0);
    await expect
      .poll(async () => (await runtime(page)).environment.motionTargetSpeed, {
        timeout: 5_000,
      })
      .toBe(0);
    await expect
      .poll(async () => (await runtime(page)).environment.motionSpeed, {
        timeout: 5_000,
      })
      .toBeLessThan(1);
    await expect(chroma).toBeChecked({ checked: initialChroma });
    await expect(motion).toBeChecked({ checked: initialMotion });
  });

  test("a small volume increase from zero stays below normal speed and does not spike", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await startRace(page);
    await seekNearReference(page);
    const volume = page.getByRole("slider", { name: "Volume" });
    await expect
      .poll(
        async () => (await runtime(page)).environment.motionTargetSpeed ?? 0,
      )
      .toBeGreaterThan(0);
    const normalTarget =
      (await runtime(page)).environment.motionTargetSpeed ?? 0;

    await volume.fill("0");
    await expect
      .poll(async () => (await runtime(page)).environment.motionTargetSpeed, {
        timeout: 5_000,
      })
      .toBe(0);
    await volume.fill("0.15");
    await expect
      .poll(
        async () => (await runtime(page)).environment.motionTargetSpeed ?? 0,
        { timeout: 5_000 },
      )
      .toBeGreaterThan(0);
    const smallTarget =
      (await runtime(page)).environment.motionTargetSpeed ?? 0;
    expect(smallTarget).toBeLessThan(normalTarget);
    expect(smallTarget).toBeLessThan(99);
    await expect(
      page.getByLabel("Toggle environment chroma effects"),
    ).toBeChecked();
    await expect(page.getByLabel("Motion")).toBeChecked();
  });
});

test("qualified SURGE increments the real Race event count near the known reference", async ({
  page,
}) => {
  test.setTimeout(70_000);
  await startRace(page);
  await seekNearReference(page);
  const before = (await runtime(page)).environment.surgeCount;
  await expect
    .poll(async () => (await runtime(page)).environment.surgeCount, {
      timeout: 15_000,
    })
    .toBeGreaterThan(before);
});
