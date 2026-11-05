import { test, expect } from "../support/test";

test("player header continues resolving and scrambling its branding", async ({
  page,
  pageErrors,
}) => {
  void pageErrors;
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const startTime = Date.now();
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(startTime + 1000);
  await page.goto("/player/");
  await page.getByLabel("Visual environment").selectOption("minimal");

  const header = page.locator(".floating-player-panel__header");
  const branding = header.locator(".public-brand-ident");
  const resolvedCells = branding.locator(".public-brand-ident__cell--resolved");
  const scramblingCells = branding.locator(
    ".public-brand-ident__cell--scrambling",
  );
  await expect(branding).toBeVisible();
  await expect(branding.locator(".public-brand-ident__cell")).toHaveCount(14);

  await page.clock.runFor(3000);
  await expect(resolvedCells).toHaveCount(14);
  expect(await resolvedCells.allTextContents()).toEqual(
    "DEEPSIGNALS.FM".split(""),
  );

  await page.clock.runFor(3000);
  expect(await scramblingCells.count()).toBeGreaterThan(0);

  await page.clock.runFor(3000);
  await expect(resolvedCells).toHaveCount(14);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`floating branding stays absent during playback (${reducedMotion})`, async ({
    page,
    pageErrors,
  }) => {
    void pageErrors;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion });
    await page.clock.install();
    await page.goto("/player/?identDebug=1");
    await page.getByLabel("Visual environment").selectOption("minimal");
    await page
      .getByLabel("Signal source")
      .selectOption("demo-psychedelic-experience");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();

    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        if (document.querySelector(".station-ident-overlay")) {
          document.documentElement.dataset.floatingBrandingSeen = "true";
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });

    // Cross both the former first-appearance and maximum recurring delays.
    await page.clock.fastForward(40_000);
    await page.clock.fastForward(12_000);
    await page.clock.fastForward(420_000);
    await expect(page.locator(".station-ident-overlay")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-floating-branding-seen",
      "true",
    );
    await expect(
      page.locator(".floating-player-panel__header .public-brand-ident"),
    ).toBeVisible();
  });
}
