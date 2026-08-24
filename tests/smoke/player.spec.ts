import { test, expect } from "../support/test";
import { expectSaneGeometry } from "../support/geometry";

test.beforeEach(async ({ page }) => {
  await page.goto("/player/");
});

test("desktop player exposes critical controls", async ({ page }) => {
  await expect(page.locator(".player-shell")).toBeVisible();
  await expect(page.getByLabel("Signal source")).toBeVisible();
  await expect(page.getByText("Transmission", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Play|Pause)$/ }),
  ).toBeVisible();
  await expect(page.getByRole("slider", { name: "Volume" })).toBeVisible();
  await expect(page.getByLabel("Visual environment")).toBeVisible();
  await expect(
    page.getByLabel("Toggle environment chroma effects"),
  ).toBeVisible();
  await expect(page.getByLabel("Motion")).toBeVisible();
  await expect(page.getByLabel("Toggle signal info")).toBeVisible();
  await expectSaneGeometry(page, page.locator(".player-shell"), "player shell");
  await expectSaneGeometry(
    page,
    page.locator(".floating-player-panel"),
    "player panel",
  );
});

test("fresh player defaults apply without replacing persisted choices", async ({
  page,
}) => {
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await expect(page.getByLabel("Signal source")).toHaveValue(
    "demo-psychedelic-experience",
  );
  await expect(page.getByLabel("Visual environment")).toHaveValue(
    "cosmic-nexus",
  );
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Toggle environment chroma effects"),
  ).toBeChecked();
  await expect(page.getByLabel("Motion")).toBeChecked();
  await expect(page.locator(".visual-feed-window")).toBeVisible();
  await expect(page.locator(".floating-player-panel")).toBeVisible();

  await page
    .getByLabel("Signal source")
    .selectOption("demo-modular-dimensions");
  await page.getByLabel("Visual environment").selectOption("neon-hyper-racer");
  await page
    .locator("label")
    .filter({ hasText: /^Chroma$/ })
    .click();
  await page
    .locator("label")
    .filter({ hasText: /^Info$/ })
    .click();
  await expect(page.locator(".visual-feed-window")).toBeHidden();

  await page.reload();
  await expect(page.getByLabel("Signal source")).toHaveValue(
    "demo-modular-dimensions",
  );
  await expect(page.getByLabel("Visual environment")).toHaveValue(
    "neon-hyper-racer",
  );
  await expect(
    page.getByLabel("Toggle environment chroma effects"),
  ).not.toBeChecked();
  await expect(page.locator(".visual-feed-window")).toBeHidden();
});

test("INFO can close, reopen, and exposes stable signal content", async ({
  page,
}) => {
  const infoPanel = page.locator(".visual-feed-window");
  await expect(infoPanel).toBeVisible();
  await expect(page.getByLabel("Signal artwork")).toBeVisible();
  await expect(page.getByLabel("Energy signal level")).toBeVisible();
  await expect(page.getByLabel("Kick signal level")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /About DeepSignals/ }),
  ).toBeVisible();

  await page
    .locator("label")
    .filter({ hasText: /^Info$/ })
    .click();
  await expect(infoPanel).toBeHidden();
  await page
    .locator("label")
    .filter({ hasText: /^Info$/ })
    .click();
  await expect(infoPanel).toBeVisible();
});

test("representative environments switch without losing the player", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const environment = page.getByLabel("Visual environment");
  const cases = [
    ["Psy Jungle", "uv-reactive-jungle"],
    ["Signal Runner", "signal-runner"],
    ["Race to the Signal Nexus", "neon-hyper-racer"],
    ["The Signal Nexus", "cosmic-nexus"],
  ] as const;

  for (const [label, id] of cases) {
    await environment.selectOption({ label });
    await expect(
      page.locator(`.player-shell[data-theme="${id}"]`),
    ).toBeVisible();
    await expectSaneGeometry(
      page,
      page.locator(".player-shell"),
      `${label} player shell`,
    );
    await expect(page.locator(".floating-player-panel")).toBeVisible();
  }
});

test("CHROMA and MOTION toggle independently", async ({ page }) => {
  const chroma = page.getByLabel("Toggle environment chroma effects");
  const motion = page.getByLabel("Motion");
  const initialMotion = await motion.isChecked();
  const initialChroma = await chroma.isChecked();

  await page
    .locator("label")
    .filter({ hasText: /^Chroma$/ })
    .click();
  await expect(chroma).toBeChecked({ checked: !initialChroma });
  await expect(motion).toBeChecked({ checked: initialMotion });
  await expect(page.locator(".player-shell")).toBeVisible();
  await page
    .locator("label")
    .filter({ hasText: /^Chroma$/ })
    .click();

  await page
    .locator("label")
    .filter({ hasText: /^Motion$/ })
    .click();
  await expect(motion).toBeChecked({ checked: !initialMotion });
  await expect(chroma).toBeChecked({ checked: initialChroma });
  await expect(page.locator(".player-shell")).toBeVisible();
  await page
    .locator("label")
    .filter({ hasText: /^Motion$/ })
    .click();
});
