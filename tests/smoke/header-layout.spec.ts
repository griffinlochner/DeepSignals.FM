import { test, expect } from "../support/test";

type Page = Parameters<typeof test>[0]["page"];

const selectors = {
  header: ".visual-feed-window__header",
  fps: ".visual-feed-window__fps",
  fpsLabel: ".visual-feed-window__fps .visual-feed-window__metric-label",
  fpsValue: ".visual-feed-window__fps .visual-feed-window__metric-value",
  listeners: ".visual-feed-window__metric--listeners",
  listenersLabel:
    ".visual-feed-window__metric--listeners .visual-feed-window__metric-label",
  listenersValue:
    ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
  bitrate: ".visual-feed-window__metric--bitrate",
  bitrateLabel:
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-label",
  bitrateValue:
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
  bitrateUnit:
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-unit",
  source: ".visual-feed-window__source-link",
  sourceIcon: ".visual-feed-window__external-link-icon",
} as const;

async function setTelemetryValues(
  page: Page,
  fps: string,
  listeners: string,
  bitrate: string,
) {
  await page.evaluate(
    ({ selectors, values }) => {
      const setText = (selector: string, value: string) => {
        const element = document.querySelector(selector);
        if (element) element.textContent = value;
      };

      setText(selectors.fpsValue, values.fps);
      setText(selectors.listenersValue, values.listeners);
      setText(selectors.bitrateValue, values.bitrate);
    },
    { selectors, values: { fps, listeners, bitrate } },
  );
}

async function readHeaderGeometry(page: Page) {
  return page.evaluate((selectors) => {
    const read = (selector: string) => {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      return {
        text: element.textContent?.trim() ?? "",
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        display: style.display,
        overflow: style.overflow,
        visibility: style.visibility,
        fontSize: style.fontSize,
      };
    };

    return Object.fromEntries(
      Object.entries(selectors).map(([name, selector]) => [name, read(selector)]),
    ) as Record<keyof typeof selectors, ReturnType<typeof read>>;
  }, selectors);
}

function expectValidHeaderGeometry(
  geometry: Awaited<ReturnType<typeof readHeaderGeometry>>,
) {
  const header = geometry.header!;
  const ordered = [
    geometry.fps!,
    geometry.listeners!,
    geometry.bitrate!,
    geometry.source!,
  ];

  for (const element of [
    ...ordered,
    geometry.bitrateUnit!,
    geometry.sourceIcon!,
  ]) {
    expect(element.width).toBeGreaterThan(0);
    expect(element.height).toBeGreaterThan(0);
    expect(element.left).toBeGreaterThanOrEqual(header.left - 0.5);
    expect(element.right).toBeLessThanOrEqual(header.right + 0.5);
    expect(element.visibility).toBe("visible");
    expect(element.display).not.toBe("none");
  }

  for (let index = 0; index < ordered.length - 1; index += 1) {
    expect(ordered[index]!.right).toBeLessThan(ordered[index + 1]!.left);
  }

  const rowTop = Math.max(...ordered.map((element) => element.top));
  const rowBottom = Math.min(...ordered.map((element) => element.bottom));
  expect(rowBottom).toBeGreaterThan(rowTop);
  expect(geometry.source!.text).toBe("SOURCE");
  expect(geometry.bitrateUnit!.text).toBe("kbps");
}

test("telemetry labels stay anchored across representative values", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/player/");
  await page.getByLabel("Visual environment").selectOption("minimal");
  await expect(page.locator(selectors.header)).toBeVisible();

  const cases = [
    ["9", "1", "64"],
    ["60", "127", "192"],
    ["121", "9999", "320"],
    ["999", "123456", "320"],
  ] as const;
  const measurements: Awaited<ReturnType<typeof readHeaderGeometry>>[] = [];

  for (const [fps, listeners, bitrate] of cases) {
    await setTelemetryValues(page, fps, listeners, bitrate);
    const geometry = await readHeaderGeometry(page);
    expectValidHeaderGeometry(geometry);
    measurements.push(geometry);
  }

  for (const key of ["fpsLabel", "listenersLabel", "bitrateLabel"] as const) {
    const positions = measurements.map(
      (measurement) => measurement[key]!.left - measurement.header!.left,
    );
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(1);
  }

  const sourceRightGaps = measurements.map(
    (measurement) => measurement.header!.right - measurement.source!.right,
  );
  expect(Math.max(...sourceRightGaps) - Math.min(...sourceRightGaps)).toBeLessThan(
    1,
  );

  const fpsGap =
    measurements[0].fpsValue!.left - measurements[0].fpsLabel!.right;
  expect(fpsGap).toBeGreaterThan(0);
  expect(fpsGap).toBeLessThan(8);
});

test("telemetry grid remains unclipped across desktop viewport sizes", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const viewports = [
    { width: 1024, height: 600 },
    { width: 1024, height: 768 },
    { width: 1280, height: 600 },
    { width: 1280, height: 720 },
    { width: 1280, height: 900 },
    { width: 1366, height: 768 },
    { width: 1440, height: 600 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];
  const relativeLabelPositions = new Map<number, Map<string, number[]>>();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/player/");
    await page.getByLabel("Visual environment").selectOption("minimal");
    await expect(page.locator(selectors.header)).toBeVisible();
    await setTelemetryValues(page, "999", "123456", "320");

    const geometry = await readHeaderGeometry(page);
    expectValidHeaderGeometry(geometry);
    expect(geometry.header!.display).toBe("grid");
    expect(geometry.header!.fontSize).not.toMatch(/vh|dvh|svh|lvh/);

    const byLabel =
      relativeLabelPositions.get(viewport.width) ?? new Map<string, number[]>();
    for (const key of ["fpsLabel", "listenersLabel", "bitrateLabel"] as const) {
      const positions = byLabel.get(key) ?? [];
      positions.push(geometry[key]!.left - geometry.header!.left);
      byLabel.set(key, positions);
    }
    relativeLabelPositions.set(viewport.width, byLabel);
  }

  for (const byLabel of relativeLabelPositions.values()) {
    for (const positions of byLabel.values()) {
      expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(1);
    }
  }
});

test("Space Unicorn renders live listener and bitrate values without clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/player/");
  await page.getByLabel("Signal source").selectOption("space-unicorn-radio");

  await expect(page.locator(selectors.listenersValue)).toHaveText(/^\d+$/);
  await expect(page.locator(selectors.bitrateValue)).toHaveText(/^\d+(?:\.\d+)?$/);

  const geometry = await readHeaderGeometry(page);
  expectValidHeaderGeometry(geometry);
  expect(geometry.bitrate!.overflow).toBe("visible");
  expect(geometry.source!.overflow).toBe("visible");
});