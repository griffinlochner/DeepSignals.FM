import { test, expect } from "../support/test";
import type { Page } from "@playwright/test";
import { instrumentAudio, readAudio } from "../support/audioProbe";
import {
  parseTriplagNowPlaying,
  TRIPLAG_NOW_PLAYING_URL,
} from "../../src/app/useTriplagNowPlaying";

const ID = "triplag-darkpsy";
const STREAM = "https://a3.asurahosting.com/listen/triplag/radio.mp3";
const EXISTING_STREAM = "https://listen.openstream.co/6517/audio";
const ART = "https://a3.asurahosting.com/api/station/triplag/art/test.jpg";
const BRAND = "/branding/deepsignals-logo-square.png";
const TRACK = "public\\audio\\demo\\illustrator-psychedelic-experience.mp3";
const fixture = {
  is_online: true,
  station: {
    mounts: [
      {
        url: STREAM,
        bitrate: 192,
        listeners: { current: 5 },
      },
    ],
  },
  now_playing: {
    sh_id: 123,
    played_at: 1792441418,
    song: {
      id: "song-one",
      artist: "Trashlords",
      title: "[EP] Trashlords - Orange (StoneAge Records)",
      album: "Orange",
      art: ART,
    },
  },
};
const fullLabel = "Trashlords — [EP] Trashlords - Orange (StoneAge Records) — Album: Orange";
const listeners = (page: Page) => page.locator(".visual-feed-window__metric--listeners .visual-feed-window__metric-value");
const bitrate = (page: Page) => page.locator(".visual-feed-window__metric--bitrate .visual-feed-window__metric-value");
const transmission = (page: Page) => page.locator(".track-marquee__live");
const image = (page: Page) => page.locator(".visual-feed-window__artwork");

async function openTriplag(page: Page) {
  await page.goto("/player/");
  await page.getByLabel("Signal source").selectOption(ID);
  await page.getByLabel("Toggle signal info").check();
}

async function mockAudio(page: Page) {
  for (const url of [STREAM, EXISTING_STREAM]) {
    await page.route(url, (route) => route.fulfill({
      path: TRACK,
      contentType: "audio/mpeg",
      headers: { "Access-Control-Allow-Origin": "*" },
    }));
  }
}

test("Triplag parser preserves real fields without inventing track metadata", () => {
  const parsed = parseTriplagNowPlaying(fixture)!;
  expect(parsed.metadata).toMatchObject({
    title: fixture.now_playing.song.title,
    artist: "Trashlords", album: "Orange", artworkUrl: ART,
  });
  expect(parsed.telemetry).toEqual({ listeners: 5, bitrateKbps: 192 });
  const mix = parseTriplagNowPlaying({
    ...fixture,
    now_playing: { song: { title: "[MIX] Waater-Triptonceiver", artist: " ", album: null, art: "" } },
  })!;
  expect(mix.metadata).toMatchObject({ title: "[MIX] Waater-Triptonceiver" });
  expect(mix.metadata?.artist).toBeUndefined();
  expect(mix.metadata?.album).toBeUndefined();
  expect(mix.metadata?.artworkUrl).toBeUndefined();
  for (const art of ["http://example.com/art.jpg", "javascript:alert(1)", "not a URL", 42]) {
    expect(parseTriplagNowPlaying({
      ...fixture, now_playing: { song: { title: "Mix", art } },
    })?.metadata?.artworkUrl).toBeUndefined();
  }
  expect(parseTriplagNowPlaying({ ...fixture, now_playing: { song: { artist: "Only Artist" } } })?.metadata).toBeNull();
  expect(parseTriplagNowPlaying({ ...fixture, is_online: false })).toMatchObject({ metadata: null, telemetry: null });
  for (const invalid of [null, [], "invalid", {}, { station: [] }]) {
    expect(parseTriplagNowPlaying(invalid)).toBeNull();
  }
});

test("Triplag telemetry selects its mount, validates stats and updates independently of the song", () => {
  const parseMount = (mount: unknown) => parseTriplagNowPlaying({
    ...fixture, station: { mounts: [{ url: "https://example.com/other", bitrate: 999 }, mount] },
  });
  expect(parseMount({ url: STREAM, bitrate: "192", listeners: { current: "0" } })?.telemetry)
    .toEqual({ listeners: 0, bitrateKbps: 192 });
  for (const invalid of [-1, Infinity, "bad", true, null, ""]) {
    expect(parseMount({ url: STREAM, bitrate: invalid, listeners: { current: invalid } })?.telemetry)
      .toEqual({ listeners: null, bitrateKbps: null });
  }
  expect(parseMount({ url: STREAM, bitrate: 0, listeners: { current: 2.5 } })?.telemetry)
    .toEqual({ listeners: null, bitrateKbps: null });
  expect(parseMount(null)?.telemetry).toBeNull();
  expect(parseTriplagNowPlaying({ ...fixture, station: {} })?.telemetry).toBeNull();
  const first = parseTriplagNowPlaying(fixture)!;
  const changed = parseMount({ url: STREAM, bitrate: 192, listeners: { current: 6 } })!;
  expect(changed.metadata?.changeKey).toBe(first.metadata?.changeKey);
  expect(changed.changeKey).not.toBe(first.changeKey);
  for (const fields of [{ album: "Corrected Album" }, { art: `${ART}?v=2` }]) {
    const result = parseTriplagNowPlaying({
      ...fixture, now_playing: { ...fixture.now_playing, song: { ...fixture.now_playing.song, ...fields } },
    });
    expect(result?.metadata?.changeKey).not.toBe(first.metadata?.changeKey);
  }
});

test("Triplag uses one poll for metadata and stats, artwork fallback and alphabetical source UI", async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  let artworkRequests = 0;
  await page.route(TRIPLAG_NOW_PLAYING_URL, (route) => {
    calls++;
    return route.fulfill({ json: {
      ...fixture,
      station: { mounts: [{ ...fixture.station.mounts[0], listeners: { current: calls === 1 ? 5 : 6 } }] },
    } });
  });
  await page.route(ART, (route) => {
    artworkRequests++;
    return route.fulfill({ path: "public\\branding\\deepsignals-logo-square.png", contentType: "image/png" });
  });
  await openTriplag(page);
  await expect(transmission(page)).toHaveText(fullLabel);
  await expect(listeners(page)).toHaveText("5");
  await expect(bitrate(page)).toHaveText("192");
  await expect(image(page)).toHaveAttribute("src", ART);
  await expect.poll(() => image(page).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  const names = await page.locator('optgroup[label="EXTERNAL SIGNALS"] option').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  expect(names.filter((name) => name === "Triplag Darkpsy")).toHaveLength(1);
  await expect(page.getByLabel("Seek playback")).toHaveCount(0);
  await expect(page.getByRole("link", { name: `Open source for ${fixture.now_playing.song.title}`, exact: true }))
    .toHaveAttribute("href", "https://triplag.com/webradio/");
  expect(calls).toBe(1);
  await page.clock.fastForward(19_000);
  expect(calls).toBe(1);
  await page.clock.fastForward(1_100);
  await expect(listeners(page)).toHaveText("6");
  expect(calls).toBe(2);
  expect(artworkRequests).toBe(1);
  await page.getByLabel("Signal source").selectOption("psybient-sunset");
  await expect(transmission(page)).toHaveText("Psybient Sunset");
  await expect(listeners(page)).toHaveText("---");
  await expect(bitrate(page)).toHaveText("---");
  await page.clock.fastForward(60_000);
  expect(calls).toBe(2);
});

test("Triplag polls hidden pages at 60 seconds and clears missing fields and failed artwork", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => Object.defineProperty(document, "visibilityState", { get: () => "hidden" }));
  let calls = 0;
  await page.route(TRIPLAG_NOW_PLAYING_URL, (route) => {
    calls++;
    return route.fulfill({ json: calls === 1 ? fixture : {
      ...fixture, now_playing: { song: { title: "[MIX] Waater-Triptonceiver" } },
      station: { mounts: [{ url: STREAM }] },
    } });
  });
  await page.route(ART, (route) => route.fulfill({ status: 404 }));
  await openTriplag(page);
  await expect(transmission(page)).toHaveText(fullLabel);
  await expect(image(page)).toHaveAttribute("src", BRAND);
  await page.clock.fastForward(59_000);
  expect(calls).toBe(1);
  await page.clock.fastForward(1_100);
  await expect(transmission(page)).toHaveText("[MIX] Waater-Triptonceiver");
  await expect(listeners(page)).toHaveText("---");
  await expect(bitrate(page)).toHaveText("---");
  await expect(image(page)).toHaveAttribute("src", BRAND);
  expect(calls).toBe(2);
});

test("Triplag API failures clear stale metadata and stats without interrupting audio", async ({ page }) => {
  await page.clock.install();
  await instrumentAudio(page);
  await mockAudio(page);
  let calls = 0;
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.route(TRIPLAG_NOW_PLAYING_URL, (route) => {
    calls++;
    if (calls === 2) return route.fulfill({ status: 503 });
    if (calls === 3) return route.fulfill({ body: "{broken", contentType: "application/json" });
    if (calls === 4) return route.fulfill({ json: {} });
    return route.fulfill({ json: fixture });
  });
  await page.route(ART, (route) => route.fulfill({ status: 404 }));
  await openTriplag(page);
  await expect(transmission(page)).toHaveText(fullLabel);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).paused).toBe(false);
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  for (let i = 2; i <= 4; i++) {
    await page.clock.fastForward(20_100);
    await expect.poll(() => calls).toBe(i);
    await expect(transmission(page)).toHaveText("Triplag Darkpsy");
    await expect(listeners(page)).toHaveText("---");
    await expect(bitrate(page)).toHaveText("---");
    await expect(image(page)).toHaveAttribute("src", BRAND);
    expect((await readAudio(page)).paused).toBe(false);
    expect((await readAudio(page)).error).toBeNull();
  }
  await expect.poll(() => warnings.filter((text) => text.includes("triplag-darkpsy Now Playing metadata unavailable")).length).toBe(3);
  await page.clock.fastForward(20_100);
  await expect(transmission(page)).toHaveText(fullLabel);
  await expect(listeners(page)).toHaveText("5");
});

test("Triplag discards an in-flight response after switching away and starts fresh on return", async ({ page }) => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  let finished = false;
  await page.route(TRIPLAG_NOW_PLAYING_URL, async (route) => {
    calls++;
    if (calls === 1) {
      await delayed;
      await route.fulfill({ json: fixture });
      finished = true;
    } else {
      await route.fulfill({ json: { ...fixture, now_playing: { song: { title: "Fresh mix" } } } });
    }
  });
  await openTriplag(page);
  await expect.poll(() => calls).toBe(1);
  await page.getByLabel("Signal source").selectOption("psybient-sunset");
  await expect(transmission(page)).toHaveText("Psybient Sunset");
  await expect(listeners(page)).toHaveText("---");
  await expect(bitrate(page)).toHaveText("---");
  await expect(image(page)).toHaveAttribute("src", "/images/stations/psybient-sunset.webp");
  await page.getByLabel("Signal source").selectOption(ID);
  await expect(transmission(page)).toHaveText("Fresh mix");
  release();
  await expect.poll(() => finished).toBe(true);
  await expect(transmission(page)).toHaveText("Fresh mix");
  await expect(image(page)).toHaveAttribute("src", BRAND);
});

async function verifyPlayback(page: Page) {
  await page.getByLabel("Visual environment").selectOption("neon-hyper-racer");
  const measurements = [];
  for (const [id, url] of [[ID, STREAM], ["psybient-sunset", EXISTING_STREAM], [ID, STREAM]]) {
    await page.getByLabel("Signal source").selectOption(id);
    expect((await readAudio(page)).paused).toBe(true);
    expect((await readAudio(page)).currentTime).toBe(0);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await readAudio(page)).rms, { timeout: 30_000 }).toBeGreaterThan(0.00001);
    await expect.poll(async () => (await readAudio(page)).runtime?.audio.energy ?? 0).toBeGreaterThan(0);
    await expect.poll(async () => (await readAudio(page)).runtime?.environment.motionSpeed ?? 0).toBeGreaterThan(0);
    const first = await readAudio(page);
    await expect.poll(async () => (await readAudio(page)).frequencySum).not.toBe(first.frequencySum);
    const result = await readAudio(page);
    expect(result.src).toBe(url);
    expect(result.frequencySum).toBeGreaterThan(0);
    expect(result.error).toBeNull();
    expect([result.elementCount, result.analyserCount, result.sourceCount]).toEqual([1, 1, 1]);
    expect(result.contextStates).toEqual(["running"]);
    expect(result.assignments.every((assignment) => assignment.crossOrigin === "anonymous")).toBe(true);
    measurements.push({ id, rms: result.rms, fftSum: result.frequencySum, energy: result.runtime?.audio.energy });
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).rms).toBe(0);
  const paused = await readAudio(page);
  await page.waitForTimeout(300);
  expect((await readAudio(page)).currentTime).toBe(paused.currentTime);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).rms).toBeGreaterThan(0.00001);
  await page.getByRole("slider", { name: "Volume", exact: true }).fill("0.02");
  await expect.poll(async () => (await readAudio(page)).volume).toBe(0.02);
  await expect.poll(async () => (await readAudio(page)).rms).toBeLessThan(0.025);
  await page.getByRole("slider", { name: "Volume", exact: true }).fill("0");
  await expect.poll(async () => (await readAudio(page)).frequencySum).toBe(0);
  expect((await readAudio(page)).rms).toBe(0);
  await expect.poll(async () => (await readAudio(page)).runtime?.environment.motionSpeed ?? Infinity).toBeLessThan(1);
  await page.getByRole("slider", { name: "Volume", exact: true }).fill("1");
  await expect.poll(async () => (await readAudio(page)).rms).toBeGreaterThan(0.00001);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  console.log("Triplag shared-graph measurements:", JSON.stringify(measurements));
}

test("Triplag shared controller preserves reactivity, controls and switching", async ({ page }) => {
  test.setTimeout(90_000);
  await instrumentAudio(page);
  await mockAudio(page);
  await page.route(TRIPLAG_NOW_PLAYING_URL, (route) => route.fulfill({ json: fixture }));
  await page.route(ART, (route) => route.fulfill({ status: 404 }));
  await openTriplag(page);
  await verifyPlayback(page);
});

test("real Triplag audio supports analyser reactivity, controls, metadata and switching", async ({ page }) => {
  test.skip(process.env.DSFM_LIVE_STREAM_TEST !== "1", "Opt-in live network test");
  test.setTimeout(120_000);
  await instrumentAudio(page);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const responsePromise = page.waitForResponse(TRIPLAG_NOW_PLAYING_URL);
  await openTriplag(page);
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const snapshot = parseTriplagNowPlaying(await response.json());
  expect(snapshot?.metadata?.title).toBeTruthy();
  await expect(transmission(page)).toContainText(snapshot!.metadata!.title);
  await expect(bitrate(page)).toHaveText(String(snapshot!.telemetry!.bitrateKbps));
  await expect(listeners(page)).toHaveText(String(snapshot!.telemetry!.listeners));
  await verifyPlayback(page);
  expect(errors).toEqual([]);
});
