import { test, expect } from "../support/test";

const DEMO_SOURCE_ID = "demo-psychedelic-experience";

type RuntimeSnapshot = {
  environment: {
    id: string;
    renderFps: number | null;
    motionSpeed: number | null;
    travelPosition: number | null;
  };
};

async function runtime(page: import("@playwright/test").Page) {
  return page.evaluate(
    () =>
      (window as Window & { __DSFM_TEST__?: RuntimeSnapshot }).__DSFM_TEST__,
  ) as Promise<RuntimeSnapshot>;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/player/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("Signal Rain registers as one Canvas2D environment", async ({ page }) => {
  const environment = page.getByLabel("Visual environment");
  await expect(
    environment.locator('optgroup[label="MINIMAL"] option'),
  ).toHaveText(["Black", "Signal Gradient", "Signal Rain"]);

  await environment.selectOption("signal-rain");
  const canvas = page.locator(".signal-rain-canvas");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-renderer", "canvas2d");
  expect(
    await canvas.evaluate((element) =>
      Boolean((element as HTMLCanvasElement).getContext("2d")),
    ),
  ).toBe(true);
  expect(
    await canvas.evaluate((element) =>
      Boolean((element as HTMLCanvasElement).getContext("webgl")),
    ),
  ).toBe(false);
});

test("stopped playback freezes Signal Rain until play begins", async ({ page }) => {
  await page.getByLabel("Visual environment").selectOption("signal-rain");
  const canvas = page.locator(".signal-rain-canvas");
  await expect(canvas).toHaveAttribute("data-motion-active", "false");
  const stopped = await canvas.getAttribute("data-travel-position");
  const stoppedTransmissionY = await canvas.getAttribute("data-transmission-y");
  await page.waitForTimeout(350);
  await expect(canvas).toHaveAttribute("data-travel-position", stopped!);
  await expect(canvas).toHaveAttribute(
    "data-transmission-y",
    stoppedTransmissionY!,
  );

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(async () => (await runtime(page)).environment.motionSpeed ?? 0)
    .toBeGreaterThan(0);

  const before = Number(await canvas.getAttribute("data-travel-position"));
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-travel-position")))
    .toBeGreaterThan(before);
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-transmission-y")))
    .toBeGreaterThan(Number(stoppedTransmissionY));

  await page.locator("label").filter({ hasText: /^Motion$/ }).click();
  await expect(page.getByLabel("Motion")).not.toBeChecked();
  await expect
    .poll(async () => (await runtime(page)).environment.motionSpeed)
    .toBe(0);
  const frozen = await canvas.getAttribute("data-travel-position");
  await page.waitForTimeout(350);
  await expect(canvas).toHaveAttribute("data-travel-position", frozen!);
});

test("branded transmission is prominent and present while stopped", async ({
  page,
}) => {
  await page.getByLabel("Visual environment").selectOption("signal-rain");
  const canvas = page.locator(".signal-rain-canvas");

  await expect(canvas).toHaveAttribute("data-transmission", "DEEPSIGNALS.FM");
  await expect(canvas).toHaveAttribute("data-motion-active", "false");
});

test("reduced motion keeps Signal Rain spatially frozen", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.getByLabel("Visual environment").selectOption("signal-rain");

  const canvas = page.locator(".signal-rain-canvas");
  await expect(canvas).toHaveAttribute("data-motion-active", "false");
  const frozen = await canvas.getAttribute("data-travel-position");
  await page.waitForTimeout(350);
  await expect(canvas).toHaveAttribute("data-travel-position", frozen!);
});

test("CHROMA switches between fixed baseline and audio color energy", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.getByLabel("Signal source").selectOption(DEMO_SOURCE_ID);
  await page.getByLabel("Visual environment").selectOption("signal-rain");
  const canvas = page.locator(".signal-rain-canvas");
  const chroma = page.getByLabel("Toggle environment chroma effects");

  if (await chroma.isChecked()) {
    await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
  }
  await expect(canvas).toHaveAttribute("data-chroma-energy", "0.000");

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
  await expect
    .poll(
      async () => Number(await canvas.getAttribute("data-chroma-energy")),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0.02);
});

test("Signal Rain reports honest FPS and cleans up when switched", async ({
  page,
}) => {
  test.setTimeout(30_000);
  const environment = page.getByLabel("Visual environment");
  const fpsValue = page.locator(
    ".visual-feed-window__fps .visual-feed-window__metric-value",
  );

  await environment.selectOption("signal-rain");
  await expect
    .poll(async () => Number(await fpsValue.textContent()), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(20);
  await expect
    .poll(async () => Number(await fpsValue.textContent()))
    .toBeLessThanOrEqual(32);

  await environment.selectOption("signal-gradient");
  await expect(page.locator(".signal-rain-canvas")).toHaveCount(0);
  await expect(page.locator(".signal-gradient-scene")).toHaveCount(1);
  await expect(fpsValue).toHaveText("---");

  await environment.selectOption("minimal");
  await expect(page.locator(".minimal-scene")).toHaveCount(1);
  await expect(page.locator(".player-shell__scene canvas")).toHaveCount(0);

  await environment.selectOption("signal-rain");
  await expect(page.locator(".signal-rain-canvas")).toHaveCount(1);
  await expect
    .poll(async () => Number(await fpsValue.textContent()), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(20);
});