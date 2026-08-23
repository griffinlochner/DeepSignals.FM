import { test, expect } from "../support/test";
import { expectSaneGeometry } from "../support/geometry";

const routes = [
  { path: "/", heading: "TRANSMISSION INITIALIZING" },
  { path: "/player/", heading: "INFO" },
  { path: "/about/", heading: "ABOUT" },
  { path: "/submissions/", heading: "OPEN TRANSMISSION" },
  { path: "/updates/", heading: "TRANSMISSION LOG" },
];

for (const route of routes) {
  test(`${route.path} renders its primary content`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(
      page.getByText(route.heading, { exact: false }).first(),
    ).toBeVisible();
    const primaryContent =
      route.path === "/player/"
        ? page.locator(".player-shell")
        : page.locator("main").first();
    await expectSaneGeometry(
      page,
      primaryContent,
      `${route.path} primary content`,
    );
  });
}

test("landing page exposes the player launch link", async ({ page }) => {
  await page.goto("/");
  const launchLink = page.getByRole("link", { name: "TUNE INTO THE PLAYER" });
  await expect(launchLink).toBeVisible();
  await expect(launchLink).toHaveAttribute("href", "/player/");
  await expectSaneGeometry(
    page,
    page.locator(".transmission-overlay"),
    "landing launch content",
  );
  await expect(
    page.getByText("Stay connected:", { exact: false }),
  ).toBeVisible();
});
