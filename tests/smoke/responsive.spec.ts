import { test, expect } from "../support/test";
import {
  expectNoHorizontalOverflow,
  expectSaneGeometry,
} from "../support/geometry";

const viewports = [
  [1200, 800, "desktop"],
  [390, 844, "phone portrait"],
  [844, 390, "phone landscape"],
  [924, 412, "short landscape"],
] as const;

for (const [width, height, name] of viewports) {
  test(`${name} landing content remains reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "TUNE INTO THE PLAYER" }),
    ).toBeVisible();
    await expect(
      page.getByText("Stay connected:", { exact: false }),
    ).toBeVisible();
    await expectSaneGeometry(
      page,
      page.locator(".transmission-overlay"),
      `${name} launch content`,
    );
    await expectNoHorizontalOverflow(page);
  });

  test(`${name} player keeps controls reachable`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height });
    await page.goto("/player/");
    await expect(page.locator(".player-shell")).toBeVisible();
    await expect(
      page.getByLabel("Toggle environment chroma effects"),
    ).toBeVisible();
    await expect(page.getByLabel("Motion")).toBeVisible();
    await expect(page.getByLabel("Toggle signal info")).toBeVisible();
    await expectSaneGeometry(
      page,
      page.locator(".player-shell"),
      `${name} player shell`,
    );
    await expectNoHorizontalOverflow(page);

    const toggleBoxes = await Promise.all([
      page.getByLabel("Toggle environment chroma effects").boundingBox(),
      page.getByLabel("Motion").boundingBox(),
      page.getByLabel("Toggle signal info").boundingBox(),
    ]);
    expect(toggleBoxes.every((box) => box !== null)).toBeTruthy();
    const top = toggleBoxes.map((box) => box?.y ?? 0);
    expect(
      Math.max(...top) - Math.min(...top),
      `${name} toggle row alignment`,
    ).toBeLessThan(12);

    if (width < 500) {
      const infoToggle = page.getByLabel("Toggle signal info");
      if (!(await infoToggle.isChecked())) {
        await page
          .locator("label")
          .filter({ hasText: /^Info$/ })
          .click();
      }
      await expect(page.locator(".visual-feed-window")).toBeVisible();
      await expectSaneGeometry(
        page,
        page.locator(".visual-feed-window"),
        `${name} INFO panel`,
      );
    }
  });
}
