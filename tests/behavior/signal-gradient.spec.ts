import { test, expect } from "../support/test";

const DEMO_SOURCE_ID = "demo-psychedelic-experience";

test.beforeEach(async ({ page }) => {
  await page.goto("/player/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("Signal Gradient is a static DOM environment when CHROMA is off", async ({
  page,
}) => {
  const environment = page.getByLabel("Visual environment");
  await expect(
    environment.locator('optgroup[label="MINIMAL"] option'),
  ).toHaveText(["Black", "Signal Gradient"]);

  await environment.selectOption("signal-gradient");
  const scene = page.locator(".signal-gradient-scene");
  await expect(scene).toBeVisible();
  await expect(page.locator('.player-shell[data-theme="signal-gradient"] canvas')).toHaveCount(0);

  const chroma = page.getByLabel("Toggle environment chroma effects");
  if (await chroma.isChecked()) {
    await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
  }

  const before = await scene.evaluate((element) => ({
    background: getComputedStyle(element).backgroundImage,
    filter: getComputedStyle(element).filter,
    inlineStyle: element.getAttribute("style"),
    transform: getComputedStyle(element).transform,
    animation: getComputedStyle(element).animationName,
  }));
  await page.waitForTimeout(400);
  const after = await scene.evaluate((element) => ({
    background: getComputedStyle(element).backgroundImage,
    filter: getComputedStyle(element).filter,
    inlineStyle: element.getAttribute("style"),
    transform: getComputedStyle(element).transform,
    animation: getComputedStyle(element).animationName,
  }));

  expect(before.background).toContain("rgb(156, 255, 87)");
  expect(before.background).toContain("rgb(71, 247, 255)");
  expect(before.background).toContain("rgb(255, 127, 161)");
  expect(before.transform).toBe("none");
  expect(before.animation).toBe("none");
  expect(after).toEqual(before);
});

test("CHROMA reacts dramatically while MOTION is unavailable", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.getByLabel("Signal source").selectOption(DEMO_SOURCE_ID);
  await page.getByLabel("Visual environment").selectOption("signal-gradient");

  const chroma = page.getByLabel("Toggle environment chroma effects");
  if (!(await chroma.isChecked())) {
    await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
  }

  await page.getByRole("button", { name: "Play", exact: true }).click();
  const scene = page.locator(".signal-gradient-scene");
  await expect
    .poll(
      async () =>
        Math.abs(
          Number.parseFloat(
            await scene.evaluate((element) =>
              getComputedStyle(element).getPropertyValue(
                "--signal-gradient-hue",
              ),
            ),
          ),
        ),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(20);

  const motion = page.getByLabel("Motion");
  await expect(motion).toBeDisabled();
  await expect(scene).toHaveCSS("transform", "none");
  await expect(scene).toHaveCSS("animation-name", "none");

  await page.getByRole("slider", { name: "Volume" }).fill("0");
  await expect
    .poll(
      async () =>
        Math.abs(
          Number.parseFloat(
            await scene.evaluate((element) =>
              getComputedStyle(element).getPropertyValue(
                "--signal-gradient-hue",
              ),
            ),
          ),
        ),
      { timeout: 15_000 },
    )
    .toBeLessThan(3);
});

test("Signal Gradient switches cleanly to and from a Three.js environment", async ({
  page,
}) => {
  const environment = page.getByLabel("Visual environment");

  await environment.selectOption("signal-gradient");
  await expect(page.locator(".signal-gradient-scene")).toHaveCount(1);
  await expect(page.locator(".player-shell__scene canvas")).toHaveCount(0);

  await environment.selectOption("signal-runner");
  await expect(page.locator(".signal-gradient-scene")).toHaveCount(0);
  await expect(page.locator(".player-shell__scene canvas")).toHaveCount(1);

  await environment.selectOption("signal-gradient");
  await expect(page.locator(".player-shell__scene canvas")).toHaveCount(0);
  await expect(page.locator(".signal-gradient-scene")).toHaveCount(1);

  await environment.selectOption("minimal");
  await expect(page.locator(".minimal-scene")).toHaveCount(1);
  await expect(page.locator(".signal-gradient-scene")).toHaveCount(0);
});