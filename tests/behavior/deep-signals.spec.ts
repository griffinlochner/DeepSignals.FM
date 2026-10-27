import type { Locator } from "@playwright/test";
import { test, expect } from "../support/test";
import { expectNoHorizontalOverflow } from "../support/geometry";
import { getImageDepthEnvironmentById } from "../../src/themes/image-depth/environmentCatalog";
import { computeImageDepthFraming } from "../../src/themes/image-depth/framing";

const environment = getImageDepthEnvironmentById("deep-signals")!;
const sceneSelector = '[data-scene-id="deep-signals"]';

async function litPixels(canvas: Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) =>
    new Promise<number>((resolve) => {
      requestAnimationFrame(() => {
        const sample = document.createElement("canvas");
        sample.width = 160;
        sample.height = 120;
        const context = sample.getContext("2d")!;
        context.drawImage(element, 0, 0, sample.width, sample.height);
        const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
        let lit = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) > 10) lit++;
        }
        resolve(lit);
      });
    }),
  );
}

test("DeepSignals.FM assets and preset preserve alignment and cover framing", async ({ page, request }) => {
  expect(environment.displayName).toBe("DeepSignals.FM");
  expect(environment.productionScenePreset).toMatchObject({
    id: "deep-signals-default",
    assetId: "deep-signals",
    behavior: {
      depth: {
        depthStrength: 0.58,
        motionIntensity: 0.42,
        pointerParallaxStrength: 0.5,
        pointerParallaxEnabled: true,
        ambientMotionEnabled: true,
      },
    },
  });
  await page.goto("/player/");
  for (const url of [environment.asset.colorImageUrl, environment.asset.depthMapUrl]) {
    expect((await request.get(url)).status()).toBe(200);
  }
  const dimensions = await page.evaluate(async (asset) => {
    return Promise.all([asset.colorImageUrl, asset.depthMapUrl].map(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }));
  }, environment.asset);
  expect(dimensions[0]).toEqual(dimensions[1]);
  expect(dimensions[0]).toEqual({ width: 4197, height: 3148 });
  const assetAspectRatio = dimensions[0].width / dimensions[0].height;
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    const framing = computeImageDepthFraming({
      viewportWidth: width,
      viewportHeight: height,
      assetAspectRatio,
      mode: "cover-safe-overscan",
      motionProfile: environment.productionScenePreset.behavior.depth,
    });
    expect(framing.width / framing.height).toBeCloseTo(assetAspectRatio, 6);
    expect(framing.widthScaleToViewport).toBeGreaterThanOrEqual(1);
    expect(framing.heightScaleToViewport).toBeGreaterThanOrEqual(1);
  }
});

test("DeepSignals.FM is selectable for every station and persists across remounts", async ({ page, pageErrors }) => {
  test.setTimeout(60_000);
  await page.goto("/player/");
  const selector = page.getByLabel("Visual environment");
  await expect(selector.locator('optgroup[label="DEPTH WORLDS"] option[value="deep-signals"]'))
    .toHaveText("DeepSignals.FM");
  await selector.selectOption({ label: "DeepSignals.FM" });
  const source = page.getByLabel("Signal source");
  const sourceIds = await source.locator("option").evaluateAll((options) =>
    options.filter((option) => !option.disabled && option.value).map((option) => option.value),
  );
  for (const id of sourceIds) {
    await source.selectOption(id);
    await expect(selector).toHaveValue("deep-signals");
    await expect(page.locator(`${sceneSelector} canvas`)).toHaveCount(1);
  }
  await source.selectOption("demo-psychedelic-experience");
  await page.reload();
  await expect(selector).toHaveValue("deep-signals");
  for (const id of ["analog-signal-laboratory", "deep-signals", "minimal", "deep-signals"]) {
    await selector.selectOption(id);
    await expect(page.locator(".player-shell")).toHaveAttribute("data-theme", id);
  }
  await expect(page.locator(".image-depth-theme-scene canvas")).toHaveCount(1);
  await expect.poll(() => litPixels(page.locator(`${sceneSelector} canvas`))).toBeGreaterThan(500);
  expect(pageErrors).toEqual([]);
});

test("DeepSignals.FM retains audio CHROMA and MOTION controls on desktop and mobile", async ({ page, pageErrors }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/player/");
  await page.getByLabel("Signal source").selectOption("demo-psychedelic-experience");
  await page.getByLabel("Visual environment").selectOption("deep-signals");
  const canvas = page.locator(`${sceneSelector} canvas`);
  const filter = () => canvas.evaluate((element) => element.style.filter);
  await expect.poll(filter).toContain("grayscale(1)");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__DSFM_TEST__?.audio.smoothedEnergy), {
    timeout: 15_000,
  }).toBeGreaterThan(0.01);
  await expect.poll(filter, { timeout: 15_000 }).toContain("grayscale(0)");
  await expect.poll(filter).not.toContain("hue-rotate(0deg)");

  await page.locator("label").filter({ hasText: /^Motion$/ }).click();
  await expect(page.getByLabel("Motion")).not.toBeChecked();
  await expect(page.getByLabel("Toggle environment chroma effects")).toBeChecked();
  await expect.poll(filter).not.toContain("hue-rotate(0deg)");
  await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
  await expect.poll(filter).toContain("hue-rotate(0deg)");
  await expect.poll(filter).toContain("saturate(1)");
  await expect(page.getByLabel("Motion")).not.toBeChecked();
  await page.locator("label").filter({ hasText: /^Motion$/ }).click();

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => litPixels(canvas)).toBeGreaterThan(500);
    await expectNoHorizontalOverflow(page);
    const box = await canvas.boundingBox();
    expect(box?.width).toBe(viewport.width);
    expect(box?.height).toBe(viewport.height);
    await page.screenshot({ path: testInfo.outputPath(`deep-signals-${viewport.width}.png`) });
  }
  await page.locator("label").filter({ hasText: /^Chroma$/ }).click();
  await expect.poll(filter).not.toContain("hue-rotate(0deg)");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(filter, { timeout: 15_000 }).toContain("grayscale(1)");
  await expect(page.getByLabel("Motion")).toBeChecked();
  await expect(page.getByLabel("Toggle environment chroma effects")).toBeChecked();
  expect(pageErrors).toEqual([]);
});
