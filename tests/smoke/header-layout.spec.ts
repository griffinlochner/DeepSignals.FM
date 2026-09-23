import { test, expect } from "../support/test";

async function setTelemetryValues(page: Parameters<typeof test>[0]["page"], fps: string, listeners: string, bitrate: string) {
  await page.evaluate((values) => {
    const fpsValue = document.querySelector(
      ".visual-feed-window__fps .visual-feed-window__metric-value",
    );
    const listenersValue = document.querySelector(
      ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
    );
    const bitrateValue = document.querySelector(
      ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
    );
    const bitrateUnit = document.querySelector(
      ".visual-feed-window__metric--bitrate .visual-feed-window__metric-unit",
    );

    if (fpsValue) fpsValue.textContent = values.fps;
    if (listenersValue) listenersValue.textContent = values.listeners;
    if (bitrateValue) bitrateValue.textContent = values.bitrate;
    if (bitrateUnit) bitrateUnit.textContent = "kbps";
  }, { fps, listeners, bitrate });
}

async function readHeaderMetrics(page: Parameters<typeof test>[0]["page"]) {
  const values = await page.evaluate(() => {
    const getBox = (selector: string) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      };
    };

    return {
      fpsLabel: getBox(".visual-feed-window__fps .visual-feed-window__metric-label"),
      fpsValue: getBox(".visual-feed-window__fps .visual-feed-window__metric-value"),
      listenersLabel: getBox(".visual-feed-window__metric--listeners .visual-feed-window__metric-label"),
      listenersValue: getBox(".visual-feed-window__metric--listeners .visual-feed-window__metric-value"),
      bitrateLabel: getBox(".visual-feed-window__metric--bitrate .visual-feed-window__metric-label"),
      bitrateValue: getBox(".visual-feed-window__metric--bitrate .visual-feed-window__metric-value"),
      bitrateUnit: getBox(".visual-feed-window__metric--bitrate .visual-feed-window__metric-unit"),
      source: getBox(".visual-feed-window__source-link"),
      sourceIcon: getBox(".visual-feed-window__external-link-icon"),
      header: getBox(".visual-feed-window__header"),
    };
  });

  return values;
}

test("telemetry header keeps compact FPS spacing and stable source positioning", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/player/");
  await expect(page.locator(".visual-feed-window__header")).toBeVisible();

  await setTelemetryValues(page, "121", "12345", "320");
  const populated = await readHeaderMetrics(page);

  expect(populated.fpsLabel).not.toBeNull();
  expect(populated.fpsValue).not.toBeNull();
  expect(populated.source).not.toBeNull();

  expect(populated.fpsValue!.x - populated.fpsLabel!.right).toBeLessThan(18);
  expect(populated.fpsValue!.x - populated.fpsLabel!.right).toBeGreaterThan(-2);

  const listenersStartBefore = populated.listenersLabel?.x ?? 0;
  const bitrateStartBefore = populated.bitrateLabel?.x ?? 0;
  const sourceXBefore = populated.source?.x ?? 0;

  await setTelemetryValues(page, "9", "1", "64");
  const compact = await readHeaderMetrics(page);

  expect(Math.abs((compact.listenersLabel?.x ?? 0) - listenersStartBefore)).toBeLessThan(12);
  expect(Math.abs((compact.bitrateLabel?.x ?? 0) - bitrateStartBefore)).toBeLessThan(12);
  expect(Math.abs((compact.source?.x ?? 0) - sourceXBefore)).toBeLessThan(12);

  const sourceRight = (compact.source?.right ?? 0) + 2;
  const headerRight = (compact.header?.right ?? 0);
  expect(sourceRight).toBeLessThanOrEqual(headerRight);
  expect((compact.sourceIcon?.right ?? 0)).toBeLessThanOrEqual(headerRight);
  expect((compact.bitrateUnit?.right ?? 0)).toBeLessThanOrEqual(compact.source?.x ?? Infinity);
});

test("header typography remains stable across viewport heights at the same width", async ({ page }) => {
  const heights = [600, 720, 900, 1100];
  const measurements: Array<{ fontSizes: number[]; headerHeight: number; sourceX: number }> = [];

  for (const height of heights) {
    await page.setViewportSize({ width: 1440, height });
    await page.goto("/player/");
    await expect(page.locator(".visual-feed-window__header")).toBeVisible();

    await setTelemetryValues(page, "121", "12345", "320");
    const measurement = await page.evaluate(() => {
      const els = [
        ".visual-feed-window__fps",
        ".visual-feed-window__metric--listeners",
        ".visual-feed-window__metric--bitrate",
        ".visual-feed-window__source-link",
      ].map((selector) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        return el ? Number.parseFloat(getComputedStyle(el).fontSize) : 0;
      });

      const header = document.querySelector(".visual-feed-window__header") as HTMLElement | null;
      const source = document.querySelector(".visual-feed-window__source-link") as HTMLElement | null;
      return {
        fontSizes: els,
        headerHeight: header ? header.getBoundingClientRect().height : 0,
        sourceX: source ? source.getBoundingClientRect().left : 0,
      };
    });

    measurements.push(measurement);
  }

  const allFontSizes = measurements.flatMap((measurement) => measurement.fontSizes);
  const maxDelta = Math.max(...allFontSizes) - Math.min(...allFontSizes);
  const headerHeightDelta = Math.max(...measurements.map((m) => m.headerHeight)) - Math.min(...measurements.map((m) => m.headerHeight));
  const sourceXDelta = Math.max(...measurements.map((m) => m.sourceX)) - Math.min(...measurements.map((m) => m.sourceX));

  expect(maxDelta).toBeLessThan(0.5);
  expect(headerHeightDelta).toBeLessThan(1);
  expect(sourceXDelta).toBeLessThan(8);
});
