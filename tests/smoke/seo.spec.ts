import { test, expect, type Page } from "../support/test";

const SITE_URL = "https://deepsignals.fm";
const PLAYER_TITLE = "DeepSignals.FM Player | Live Psytrance Radio";
const PLAYER_DESCRIPTION =
  "Listen to live psychedelic electronic radio from independent partner stations with immersive, music-reactive visual environments on DeepSignals.FM.";

const publicPages = [
  { path: "/", canonical: `${SITE_URL}/` },
  { path: "/player/", canonical: `${SITE_URL}/player/` },
  { path: "/about/", canonical: `${SITE_URL}/about/` },
  { path: "/submissions/", canonical: `${SITE_URL}/submissions/` },
  { path: "/updates/", canonical: `${SITE_URL}/updates/` },
] as const;

async function parseMetadata(page: Page, html: string) {
  return page.evaluate((markup) => {
    const document = new DOMParser().parseFromString(markup, "text/html");

    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content"),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      openGraphTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
      openGraphDescription: document.querySelector('meta[property="og:description"]')?.getAttribute("content"),
      openGraphImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content"),
      twitterTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute("content"),
      twitterDescription: document.querySelector('meta[name="twitter:description"]')?.getAttribute("content"),
      twitterImage: document.querySelector('meta[name="twitter:image"]')?.getAttribute("content"),
    };
  }, html);
}

test("public pages are indexable and self-canonical", async ({ page, request }) => {
  for (const publicPage of publicPages) {
    const response = await request.get(publicPage.path);
    expect(response.ok(), `${publicPage.path} should be served`).toBeTruthy();

    const metadata = await parseMetadata(page, await response.text());
    expect(metadata.robots?.toLowerCase() ?? "").not.toContain("noindex");
    expect(metadata.canonical).toBe(publicPage.canonical);
  }
});

test("player exposes production search and social metadata", async ({ page, request }) => {
  const response = await request.get("/player/");
  const html = await response.text();
  const metadata = await parseMetadata(page, html);

  expect(metadata.title).toBe(PLAYER_TITLE);
  expect(metadata.description).toBe(PLAYER_DESCRIPTION);
  expect(metadata.openGraphTitle).toBe(PLAYER_TITLE);
  expect(metadata.openGraphDescription).toBe(PLAYER_DESCRIPTION);
  expect(metadata.twitterTitle).toBe(PLAYER_TITLE);
  expect(metadata.twitterDescription).toBe(PLAYER_DESCRIPTION);
  expect(metadata.openGraphImage).toBe(`${SITE_URL}/og-image-deepsignals.jpg`);
  expect(metadata.twitterImage).toBe(`${SITE_URL}/og-image-deepsignals.jpg`);
  expect(html).not.toContain("Development Preview");
  expect(html).not.toContain("signals in development");
});

test("404 remains excluded from indexing", async ({ page, request }) => {
  const response = await request.get("/404.html");
  const metadata = await parseMetadata(page, await response.text());

  expect(metadata.robots?.toLowerCase()).toContain("noindex");
});

test("sitemap lists exactly the intended public routes", async ({ page, request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBeTruthy();

  const urls = await page.evaluate((xml) => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    return Array.from(document.querySelectorAll("loc"), (node) => node.textContent);
  }, await response.text());

  expect(urls).toEqual(publicPages.map(({ canonical }) => canonical));
});

test("robots permits crawling and advertises the production sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.ok()).toBeTruthy();

  const robots = await response.text();
  expect(robots).toMatch(/^User-agent:\s*\*$/m);
  expect(robots).toMatch(/^Allow:\s*\/$/m);
  expect(robots).not.toMatch(/^Disallow:/m);
  expect(robots).toMatch(
    /^Sitemap:\s*https:\/\/deepsignals\.fm\/sitemap\.xml$/m,
  );
});