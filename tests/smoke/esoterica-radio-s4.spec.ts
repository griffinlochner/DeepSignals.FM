import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";
import { instrumentAudio, readAudio } from "../support/audioProbe";
import { ESOTERICA_NOW_PLAYING_URL as API } from "../../src/app/useEsotericaNowPlaying";

const ID = "esoterica-radio-s4";
const NAME = "ESOTERICA RADIO S4";
const WEBSITE = "https://esoterica.live/station4";
const STREAM = "https://esoterica.servemp3.com:444/listen/psytrance_progressivepsytrance/radio.mp3";
const OTHER_STREAM = "https://listen.openstream.co/6517/audio";
const ART = "https://esoterica.servemp3.com:444/api/station/psytrance_progressivepsytrance/art/first";
const NEXT_ART = "https://esoterica.servemp3.com:444/api/station/psytrance_progressivepsytrance/art/second";
const BRAND = "/branding/deepsignals-logo-square.png";
const TRACK = "public\\audio\\demo\\illustrator-psychedelic-experience.mp3";
const fixture = {
  is_online: true,
  station: {
    mounts: [{ url: STREAM, bitrate: 192, listeners: { current: 8 } }],
  },
  now_playing: {
    sh_id: 803082,
    played_at: 1795039612,
    song: { id: "first", artist: "Neelix", title: "The Twenty Five", album: "", art: ART },
  },
};
const nextFixture = {
  ...fixture,
  now_playing: {
    sh_id: 803083,
    played_at: 1795039902,
    song: { id: "second", artist: "NWYR", title: "Orchestra", album: "", art: NEXT_ART },
  },
};
const transmission = (page: Page) => page.locator(".track-marquee__live");
const image = (page: Page) => page.locator(".visual-feed-window__artwork");

async function openStation(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("deepsignals.player.preferences.v3", JSON.stringify({
      selectedAudioSourceId: "demo-psychedelic-experience",
    }));
  });
  await page.goto("/player/");
  await page.getByLabel("Signal source").selectOption(ID);
  await page.getByLabel("Toggle signal info").check();
}

async function mockAudio(page: Page) {
  for (const url of [STREAM, OTHER_STREAM]) {
    await page.route(url, (route) => route.fulfill({
      path: TRACK,
      contentType: "audio/mpeg",
      headers: { "Access-Control-Allow-Origin": "*" },
    }));
  }
}

test("Esoterica displays and updates metadata, artwork, telemetry and official links", async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  await page.route(API, (route) => {
    calls++;
    return route.fulfill({ json: calls === 1 ? fixture : nextFixture });
  });
  await page.route(ART, (route) => route.fulfill({
    path: "public\\branding\\deepsignals-logo-square.png", contentType: "image/png",
  }));
  await page.route(NEXT_ART, (route) => route.fulfill({ status: 404 }));
  await openStation(page);

  const options = page.locator('optgroup[label="EXTERNAL SIGNALS"] option');
  const names = await options.allTextContents();
  expect(names.filter((name) => name === NAME)).toHaveLength(1);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  await expect(transmission(page)).toHaveText("Neelix — The Twenty Five");
  await expect(image(page)).toHaveAttribute("src", ART);
  await expect.poll(() => image(page).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(page.locator(".visual-feed-window__metric--listeners .visual-feed-window__metric-value")).toHaveText("8");
  await expect(page.locator(".visual-feed-window__metric--bitrate .visual-feed-window__metric-value")).toHaveText("192");
  for (const link of [page.locator(".visual-feed-window__source-link"), page.locator(".visual-feed-window__artwork-link")]) {
    await expect(link).toHaveAttribute("href", WEBSITE);
    await expect(link).toHaveAttribute("title", "Visit Esoterica Radio S4");
  }
  await expect(page.getByLabel("Seek playback")).toHaveCount(0);
  expect(calls).toBe(1);
  await page.clock.fastForward(20_100);
  await expect(transmission(page)).toHaveText("NWYR — Orchestra");
  await expect(image(page)).toHaveAttribute("src", BRAND);
  expect(calls).toBe(2);
  await page.getByLabel("Signal source").selectOption("psybient-sunset");
  await expect(transmission(page)).toHaveText("Psybient Sunset");
  await expect(image(page)).toHaveAttribute("src", "/images/stations/psybient-sunset.webp");
  await page.clock.fastForward(60_000);
  expect(calls).toBe(2);
});

test("Esoterica metadata errors and missing fields fall back without interrupting playback", async ({ page }) => {
  await page.clock.install();
  await instrumentAudio(page);
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      get() { return this.dataset.mockPaused !== "false"; },
    });
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.pause = function () {
      this.dataset.mockPaused = "true";
      this.dispatchEvent(new Event("pause"));
    };
    HTMLMediaElement.prototype.play = function () {
      this.dataset.mockPaused = "false";
      this.dispatchEvent(new Event("playing"));
      return Promise.resolve();
    };
  });
  let calls = 0;
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.route(API, (route) => {
    calls++;
    if (calls === 2) return route.fulfill({ status: 503 });
    if (calls === 3) return route.fulfill({ body: "{broken", contentType: "application/json" });
    if (calls === 4) return route.fulfill({ json: {} });
    if (calls === 5) return route.fulfill({ json: { ...fixture, now_playing: { song: {} } } });
    return route.fulfill({ json: fixture });
  });
  await page.route(ART, (route) => route.fulfill({ status: 404 }));
  await openStation(page);
  await expect(transmission(page)).toHaveText("Neelix — The Twenty Five");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).paused).toBe(false);
  for (let i = 2; i <= 5; i++) {
    await page.clock.fastForward(20_100);
    await expect.poll(() => calls).toBe(i);
    await expect(transmission(page)).toHaveText(NAME);
    await expect(image(page)).toHaveAttribute("src", BRAND);
    expect((await readAudio(page)).paused).toBe(false);
  }
  expect(warnings.filter((text) => text.includes(`${ID} Now Playing metadata unavailable`))).toHaveLength(3);
  await page.clock.fastForward(20_100);
  await expect(transmission(page)).toHaveText("Neelix — The Twenty Five");
});

test("Esoterica ignores an in-flight response after switching stations", async ({ page }) => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  let finished = false;
  await page.route(API, async (route) => {
    calls++;
    if (calls === 1) {
      await delayed;
      await route.fulfill({ json: fixture });
      finished = true;
    } else {
      await route.fulfill({ json: nextFixture });
    }
  });
  await page.route(NEXT_ART, (route) => route.fulfill({ status: 404 }));
  await openStation(page);
  await expect.poll(() => calls).toBe(1);
  await page.getByLabel("Signal source").selectOption("psybient-sunset");
  await expect(transmission(page)).toHaveText("Psybient Sunset");
  await page.getByLabel("Signal source").selectOption(ID);
  await expect(transmission(page)).toHaveText("NWYR — Orchestra");
  release();
  await expect.poll(() => finished).toBe(true);
  await expect(transmission(page)).toHaveText("NWYR — Orchestra");
  await expect(image(page)).toHaveAttribute("src", BRAND);
});

async function verifyPlayback(page: Page) {
  await page.getByLabel("Visual environment").selectOption("neon-hyper-racer");
  for (const [id, url] of [[ID, STREAM], ["psybient-sunset", OTHER_STREAM], [ID, STREAM]]) {
    await page.getByLabel("Signal source").selectOption(id);
    await expect.poll(async () => (await readAudio(page)).paused).toBe(true);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await readAudio(page)).rms, { timeout: 30_000 }).toBeGreaterThan(0.00001);
    await expect.poll(async () => (await readAudio(page)).runtime?.audio.energy ?? 0).toBeGreaterThan(0);
    await expect.poll(async () => (await readAudio(page)).runtime?.environment.motionSpeed ?? 0).toBeGreaterThan(0);
    const audio = await readAudio(page);
    expect(audio.src).toBe(url);
    expect(audio.error).toBeNull();
    expect(audio.frequencySum).toBeGreaterThan(0);
    expect([audio.elementCount, audio.analyserCount, audio.sourceCount]).toEqual([1, 1, 1]);
    expect(audio.contextStates).toEqual(["running"]);
    expect(audio.assignments.every((assignment) => assignment.crossOrigin === "anonymous")).toBe(true);
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).paused).toBe(true);
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].hasAttribute("src"))).toBe(false);
}

test("Esoterica uses the shared playback and reactive graph across station switches", async ({ page }) => {
  test.setTimeout(90_000);
  await instrumentAudio(page);
  await mockAudio(page);
  await page.route(API, (route) => route.fulfill({ json: fixture }));
  await page.route(ART, (route) => route.fulfill({ status: 404 }));
  await openStation(page);
  await verifyPlayback(page);
});

test("Esoterica reports an unavailable stream without affecting another station", async ({ page }) => {
  test.setTimeout(45_000);
  await instrumentAudio(page);
  await page.route(API, (route) => route.fulfill({ json: fixture }));
  await page.route(STREAM, (route) => route.abort("failed"));
  await page.route(OTHER_STREAM, (route) => route.fulfill({
    path: TRACK, contentType: "audio/mpeg", headers: { "Access-Control-Allow-Origin": "*" },
  }));
  await openStation(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/Audio source is not supported|Press Play to reconnect/, { timeout: 30_000 });
  await page.getByLabel("Signal source").selectOption("psybient-sunset");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).rms, { timeout: 15_000 }).toBeGreaterThan(0.00001);
  expect((await readAudio(page)).src).toBe(OTHER_STREAM);
});

test("real Esoterica endpoint supports metadata and reactive playback", async ({ page }) => {
  test.skip(process.env.DSFM_LIVE_STREAM_TEST !== "1", "Opt-in live network test");
  test.setTimeout(120_000);
  await instrumentAudio(page);
  const responsePromise = page.waitForResponse(API);
  await openStation(page);
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const responseBody = await response.json();
  expect(responseBody.now_playing.song.title).toBeTruthy();
  await expect(transmission(page)).toContainText(responseBody.now_playing.song.title);
  await verifyPlayback(page);
});
