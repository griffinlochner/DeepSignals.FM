import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";
import { instrumentAudio, readAudio } from "../support/audioProbe";
import { parseAzuraCastNowPlaying } from "../../src/app/azuraCastNowPlaying";

const ID = "deepsignals-psytrance";
const NAME = "DeepSignals.FM Psytrance";
const API = "https://a6.asurahosting.com/api/nowplaying/764";
const STREAM = "https://a6.asurahosting.com:7530/radio.mp3";
const ART = "https://a6.asurahosting.com/api/station/deepsignals.fm_psytrance/art/441768eb61a678fb00180412-1793051699.jpg";
const BRAND = "/branding/deepsignals-logo-square.png";
const TRACK = "public\\audio\\demo\\illustrator-psychedelic-experience.mp3";
const fixture = {
  is_online: true,
  station: {
    id: 764,
    mounts: [{ url: STREAM, bitrate: 192, listeners: { current: 1 } }],
  },
  listeners: { current: 999 },
  now_playing: {
    sh_id: 45433802,
    played_at: 1793053306,
    song: {
      id: "909035440c9253c28ff5f0b90f6184d6",
      artist: "Biomekanik",
      title: "Symphony of Noises",
      album: "Cinematech",
      art: ART,
    },
  },
};
const transmission = (page: Page) => page.locator(".track-marquee__live");
const image = (page: Page) => page.locator(".visual-feed-window__artwork");
const listeners = (page: Page) => page.locator(".visual-feed-window__metric--listeners .visual-feed-window__metric-value");
const bitrate = (page: Page) => page.locator(".visual-feed-window__metric--bitrate .visual-feed-window__metric-value");

async function selectStation(page: Page) {
  await page.goto("/player/");
  await page.getByLabel("Signal source").selectOption(ID);
  await page.getByLabel("Toggle signal info").check();
}

test("DeepSignals AzuraCast response selects the configured mount and preserves API fields", () => {
  const parse = (value: unknown) => parseAzuraCastNowPlaying(value, { nowPlayingUrl: API, streamUrl: STREAM });
  const snapshot = parse(fixture)!;
  expect(snapshot.metadata).toMatchObject({
    sourceUrl: API, artist: "Biomekanik", title: "Symphony of Noises",
    album: "Cinematech", artworkUrl: ART,
  });
  expect(snapshot.telemetry).toEqual({ listeners: 1, bitrateKbps: 192 });
  expect(parse({ ...fixture, station: { mounts: [{ url: "https://example.com/other", bitrate: 320 }] } })?.telemetry).toBeNull();
  expect(parse({ ...fixture, is_online: false })).toMatchObject({ metadata: null, telemetry: null });
  expect(parse({ ...fixture, now_playing: null })?.metadata).toBeNull();
});

test("production keeps Psytrance COMING SOON and rejects a persisted development selection", async ({ page }, testInfo) => {
  test.skip(testInfo.config.metadata.development === true, "Production preview only");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.addInitScript((id) => {
    localStorage.setItem("deepsignals.player.preferences.v3", JSON.stringify({ selectedAudioSourceId: id }));
  }, ID);
  await page.goto("/player/");
  const group = page.locator('optgroup[label="DEEPSIGNALS.FM"]');
  await expect(group.locator(`option[value="${ID}-coming-soon"]`)).toHaveText(`${NAME} — COMING SOON`);
  await expect(group.locator(`option[value="${ID}-coming-soon"]`)).toBeDisabled();
  await expect(page.locator(`option[value="${ID}"]`)).toHaveCount(0);
  await expect(group.locator('option[value="deepsignals-chillout-coming-soon"]')).toBeDisabled();
  await expect(page.getByLabel("Signal source")).not.toHaveValue(ID);
  await expect(transmission(page)).not.toContainText(NAME);
  expect(requests.some((url) => url.startsWith("https://a6.asurahosting.com"))).toBe(false);
});

test.describe("local Vite development station", () => {
  test.beforeEach(({ pageErrors }, testInfo) => {
    test.skip(testInfo.config.metadata.development !== true, "Development server only");
    expect(pageErrors).toEqual([]);
  });

  test("selects only in the DSFM group, updates metadata/art/stats in one poll and stops on switch", async ({ page, pageErrors }) => {
    await page.clock.install();
    let calls = 0;
    await page.route(API, (route) => {
      calls++;
      return route.fulfill({ json: calls === 1 ? fixture : {
        ...fixture,
        station: { mounts: [{ url: STREAM, bitrate: 192, listeners: { current: 0 } }] },
        now_playing: { ...fixture.now_playing, song: {
          ...fixture.now_playing.song, title: "Fragments of Reality", art: `${ART}?v=2`,
        } },
      } });
    });
    await page.route(`${ART}*`, (route) => route.request().url().includes("?v=2")
      ? route.fulfill({ status: 404 })
      : route.fulfill({ path: "public\\branding\\deepsignals-logo-square.png", contentType: "image/png" }));
    await selectStation(page);
    await expect(page.locator(`option[value="${ID}"]`)).toHaveCount(1);
    await expect(page.locator(`optgroup[label="DEEPSIGNALS.FM"] option[value="${ID}"]`)).toBeEnabled();
    await expect(page.locator('option[value="deepsignals-chillout-coming-soon"]')).toBeDisabled();
    await expect(page.getByLabel("Seek playback")).toHaveCount(0);
    await expect(transmission(page)).toHaveText("Biomekanik — Symphony of Noises");
    await expect(listeners(page)).toHaveText("1");
    await expect(bitrate(page)).toHaveText("192");
    await expect(image(page)).toHaveAttribute("src", ART);
    await expect.poll(() => image(page).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await page.clock.fastForward(19_000);
    expect(calls).toBe(1);
    await page.clock.fastForward(1_100);
    await expect(transmission(page)).toHaveText("Biomekanik — Fragments of Reality");
    await expect(listeners(page)).toHaveText("0");
    await expect(image(page)).toHaveAttribute("src", BRAND);
    expect(calls).toBe(2);
    await page.getByLabel("Signal source").selectOption("psybient-sunset");
    await expect(transmission(page)).toHaveText("Psybient Sunset");
    await expect(listeners(page)).toHaveText("---");
    await expect(bitrate(page)).toHaveText("---");
    await page.clock.fastForward(60_000);
    expect(calls).toBe(2);
    expect(pageErrors).toEqual([]);
  });

  test("uses hidden polling cadence and clears API failures to existing fallbacks", async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(() => Object.defineProperty(document, "visibilityState", { get: () => "hidden" }));
    let calls = 0;
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") warnings.push(message.text());
    });
    await page.route(API, (route) => {
      calls++;
      return calls === 1 ? route.fulfill({ json: fixture }) : route.fulfill({ status: 503 });
    });
    await page.route(ART, (route) => route.fulfill({ status: 404 }));
    await selectStation(page);
    await expect(transmission(page)).toHaveText("Biomekanik — Symphony of Noises");
    await page.clock.fastForward(59_000);
    expect(calls).toBe(1);
    await page.clock.fastForward(1_100);
    await expect(transmission(page)).toHaveText(NAME);
    await expect(image(page)).toHaveAttribute("src", BRAND);
    await expect(listeners(page)).toHaveText("---");
    await expect(bitrate(page)).toHaveText("---");
    expect(warnings.some((warning) => warning.includes(`${ID} Now Playing metadata unavailable`))).toBe(true);
  });

  test("aborts pending metadata and ignores stale responses after station switching", async ({ page }) => {
    await page.clock.install();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    let aborted = false;
    let finished = false;
    page.on("requestfailed", (request) => {
      if (request.url() === API) aborted = true;
    });
    await page.route(API, async (route) => {
      calls++;
      if (calls === 1) {
        await pending;
        await route.fulfill({ json: fixture });
        finished = true;
      } else {
        await route.fulfill({ json: { ...fixture, now_playing: { song: { title: "Fresh track" } } } });
      }
    });
    await selectStation(page);
    await expect.poll(() => calls).toBe(1);
    await page.getByLabel("Signal source").selectOption("psybient-sunset");
    await expect(transmission(page)).toHaveText("Psybient Sunset");
    await expect.poll(() => aborted).toBe(true);
    await page.clock.fastForward(60_000);
    expect(calls).toBe(1);
    await page.getByLabel("Signal source").selectOption(ID);
    await expect(transmission(page)).toHaveText("Fresh track");
    release();
    await expect.poll(() => finished).toBe(true);
    await expect(transmission(page)).toHaveText("Fresh track");
    await page.goto("/about/");
    await page.clock.fastForward(60_000);
    expect(calls).toBe(2);
  });

  async function verifyPlayback(page: Page) {
    await page.getByLabel("Visual environment").selectOption("neon-hyper-racer");
    const measurements = [];
    for (const id of [ID, "demo-psychedelic-experience", ID]) {
      await page.getByLabel("Signal source").selectOption(id);
      expect((await readAudio(page)).paused).toBe(true);
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect.poll(async () => (await readAudio(page)).rms, { timeout: 30_000 }).toBeGreaterThan(0.00001);
      await expect.poll(async () => (await readAudio(page)).runtime?.audio.energy ?? 0).toBeGreaterThan(0);
      await expect.poll(async () => (await readAudio(page)).runtime?.environment.motionSpeed ?? 0).toBeGreaterThan(0);
      const first = await readAudio(page);
      await expect.poll(async () => (await readAudio(page)).frequencySum).not.toBe(first.frequencySum);
      const audio = await readAudio(page);
      if (id === ID) expect(audio.src).toBe(STREAM);
      expect([audio.elementCount, audio.analyserCount, audio.sourceCount]).toEqual([1, 1, 1]);
      expect(audio.contextStates).toEqual(["running"]);
      expect(audio.error).toBeNull();
      expect(audio.assignments.every((assignment) => assignment.crossOrigin === "anonymous")).toBe(true);
      measurements.push({ id, rms: audio.rms, fft: audio.frequencySum, energy: audio.runtime?.audio.energy });
    }
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect.poll(async () => (await readAudio(page)).rms).toBe(0);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await readAudio(page)).rms).toBeGreaterThan(0.00001);
    await page.getByRole("slider", { name: "Volume", exact: true }).fill("0");
    await expect.poll(async () => (await readAudio(page)).frequencySum).toBe(0);
    await expect.poll(async () => (await readAudio(page)).runtime?.environment.motionSpeed ?? Infinity).toBeLessThan(1);
    await page.getByRole("slider", { name: "Volume", exact: true }).fill("1");
    await expect.poll(async () => (await readAudio(page)).rms).toBeGreaterThan(0.00001);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    console.log("DeepSignals shared-graph measurements:", JSON.stringify(measurements));
  }

  test("preserves playback, shared analysis, controls and station switching", async ({ page }) => {
    test.setTimeout(90_000);
    await instrumentAudio(page);
    await page.route(STREAM, (route) => route.fulfill({
      path: TRACK, contentType: "audio/mpeg", headers: { "Access-Control-Allow-Origin": "*" },
    }));
    await page.route(API, (route) => route.fulfill({ json: fixture }));
    await page.route(ART, (route) => route.fulfill({ status: 404 }));
    await selectStation(page);
    await verifyPlayback(page);
  });

  test("real DeepSignals stream plays with metadata, artwork, telemetry and reactive audio", async ({ page }) => {
    test.skip(process.env.DSFM_LIVE_STREAM_TEST !== "1", "Opt-in live network test");
    test.setTimeout(120_000);
    await instrumentAudio(page);
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const responsePromise = page.waitForResponse(API);
    await selectStation(page);
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    const snapshot = parseAzuraCastNowPlaying(await response.json(), { nowPlayingUrl: API, streamUrl: STREAM })!;
    expect(snapshot.metadata?.title).toBeTruthy();
    expect(snapshot.metadata?.artworkUrl).toBeTruthy();
    await expect(transmission(page)).toContainText(snapshot.metadata!.title);
    await expect(image(page)).toHaveAttribute("src", snapshot.metadata!.artworkUrl!);
    await expect.poll(() => image(page).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(listeners(page)).toHaveText(String(snapshot.telemetry!.listeners));
    await expect(bitrate(page)).toHaveText(String(snapshot.telemetry!.bitrateKbps));
    await verifyPlayback(page);
    expect(errors).toEqual([]);
  });
});
