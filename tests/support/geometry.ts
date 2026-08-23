import { expect, type Locator, type Page } from "@playwright/test";

export async function expectSaneGeometry(
  page: Page,
  locator: Locator,
  label: string,
) {
  const box = await locator.boundingBox();
  expect(box, `${label} should have a bounding box`).not.toBeNull();
  if (!box) return;

  const viewport = page.viewportSize();
  expect(Number.isFinite(box.x) && Number.isFinite(box.y)).toBeTruthy();
  expect(
    Number.isFinite(box.width) && Number.isFinite(box.height),
  ).toBeTruthy();
  expect(box.width, `${label} width`).toBeGreaterThan(0);
  expect(box.height, `${label} height`).toBeGreaterThan(0);
  expect(box.width, `${label} width is implausible`).toBeLessThan(10_000);
  expect(box.height, `${label} height is implausible`).toBeLessThan(10_000);
  expect(box.y, `${label} is implausibly far below the viewport`).toBeLessThan(
    10_000,
  );
  if (viewport) {
    expect(box.x, `${label} is implausibly far off screen`).toBeGreaterThan(
      -10_000,
    );
  }
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(
    overflow,
    "page should not have meaningful horizontal overflow",
  ).toBeLessThanOrEqual(3);
}
