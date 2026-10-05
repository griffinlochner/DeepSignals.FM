import { test, expect } from "../support/test";
import type { Page } from "@playwright/test";
import type { RuntimeTestSnapshot } from "../../src/app/runtimeTestBridge";

const STREAM_URL = "https://listen.openstream.co/6517/audio";
const ARTWORK_PATH = "/images/stations/psybient-sunset.webp";
const STATIONS = [
  { id: "psybient-sunset", url: STREAM_URL },
  { id: "dmt-fm", url: "https://dc1.serverse.com/proxy/ywycfrxn/live" },
  { id: "psybient-sunset", url: STREAM_URL },
  {
    id: "hirschmilch-chillout",
    url: "https://hirschmilch.de:7000/chillout.mp3",
  },
  { id: "psybient-sunset", url: STREAM_URL },
  {
    id: "psyndora-chillout",
    url: "https://cast.magicstreams.gr/sc/psychill/stream",
  },
  { id: "psybient-sunset", url: STREAM_URL },
];

type AudioProbe = {
  elements: HTMLAudioElement[];
  analysers: AnalyserNode[];
  contexts: AudioContext[];
  sources: number;
  assignments: { url: string; crossOrigin: string | null }[];
};

declare global {
  interface Window {
    __PSYBIENT_AUDIO_TEST__?: AudioProbe;
  }
}

async function instrumentAudio(page: Page) {
  await page.addInitScript(() => {
    const probe: AudioProbe = {
      elements: [],
      analysers: [],
      contexts: [],
      sources: 0,
      assignments: [],
    };
    window.__PSYBIENT_AUDIO_TEST__ = probe;
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src?: string) {
        super(src);
        probe.elements.push(this);
      }
    };
    const src = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "src",
    )!;
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      ...src,
      set(value: string) {
        probe.assignments.push({ url: value, crossOrigin: this.crossOrigin });
        src.set!.call(this, value);
      },
    });
    const createAnalyser = AudioContext.prototype.createAnalyser;
    AudioContext.prototype.createAnalyser = function () {
      const analyser = createAnalyser.call(this);
      probe.analysers.push(analyser);
      probe.contexts.push(this);
      return analyser;
    };
    const createSource = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (element) {
      probe.sources += 1;
      return createSource.call(this, element);
    };
  });
}

async function readAudio(page: Page) {
  return page.evaluate(() => {
    const probe = window.__PSYBIENT_AUDIO_TEST__!;
    const audio = probe.elements[0];
    const analyser = probe.analysers[0];
    const data = new Uint8Array(analyser?.frequencyBinCount ?? 0);
    analyser?.getByteFrequencyData(data);
    return {
      elementCount: probe.elements.length,
      analyserCount: probe.analysers.length,
      sourceCount: probe.sources,
      contextStates: probe.contexts.map((context) => context.state),
      assignments: probe.assignments,
      src: audio?.currentSrc,
      paused: audio?.paused,
      error: audio?.error?.message ?? null,
      currentTime: audio?.currentTime ?? 0,
      frequencySum: data.reduce((sum, value) => sum + value, 0),
      runtime: window.__DSFM_TEST__ as RuntimeTestSnapshot | undefined,
    };
  });
}

async function verifyStationUi(page: Page) {
  const options = page.locator(
    'select[aria-label="Signal source"] optgroup[label="EXTERNAL SIGNALS"] option',
  );
  const names = await options.allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  expect(names.filter((name) => name === "Psybient Sunset")).toHaveLength(1);
  const index = names.indexOf("Psybient Sunset");
  expect(names[index - 1]).toBe("Hirschmilch Psytrance");
  expect(names[index + 1]).toBe("Psyndora Chillout");

  await page.getByLabel("Signal source").selectOption("psybient-sunset");
  await expect(page.locator(".track-marquee__live")).toHaveText("Psybient Sunset");
  const artwork = page.locator(".visual-feed-window__artwork");
  await expect(artwork).toHaveAttribute("src", ARTWORK_PATH);
  await expect
    .poll(() =>
      artwork.evaluate((image: HTMLImageElement) =>
        image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      ),
    )
    .toBe(true);
  await page.getByLabel("Toggle signal info").check();
  const sourceLink = page.getByRole("link", {
    name: "Open source for Psybient Sunset",
    exact: true,
  });
  await expect(sourceLink).toBeVisible();
  await expect(sourceLink).toHaveAttribute(
    "href",
    "https://mixlive.net/stream/psybient-sunset/",
  );
}

async function verifyPlaybackAndSwitching(page: Page) {
  await page.getByLabel("Visual environment").selectOption("neon-hyper-racer");
  const measurements = [];
  for (const station of STATIONS) {
    await page.getByLabel("Signal source").selectOption(station.id);
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    const stopped = await readAudio(page);
    expect(stopped.paused).toBe(true);
    expect(stopped.currentTime).toBe(0);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect
      .poll(async () => (await readAudio(page)).runtime?.playback, {
        timeout: 30_000,
      })
      .toBe("playing");
    await expect
      .poll(async () => (await readAudio(page)).frequencySum, {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await readAudio(page)).runtime?.audio.energy ?? 0, {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(
        async () => (await readAudio(page)).runtime?.environment.motionSpeed ?? 0,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    const first = await readAudio(page);
    await expect
      .poll(async () => (await readAudio(page)).frequencySum, {
        timeout: 10_000,
      })
      .not.toBe(first.frequencySum);
    const result = await readAudio(page);
    expect(result.src).toBe(station.url);
    expect(result.paused).toBe(false);
    expect(result.error).toBeNull();
    expect(result.elementCount).toBe(1);
    expect(result.analyserCount).toBe(1);
    expect(result.sourceCount).toBe(1);
    expect(result.contextStates).toEqual(["running"]);
    expect(result.assignments.every((item) => item.crossOrigin === "anonymous")).toBe(true);
    measurements.push({
      station: station.id,
      frequencySum: result.frequencySum,
      audio: result.runtime?.audio,
      motionSpeed: result.runtime?.environment.motionSpeed,
    });
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).paused).toBe(true);
  console.log("Station playback/reactivity measurements:", JSON.stringify(measurements));
}

test("Psybient Sunset config, artwork, CORS and shared audio switching", async ({
  page,
  pageErrors,
}) => {
  test.setTimeout(150_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await instrumentAudio(page);
  for (const url of new Set(STATIONS.map((station) => station.url))) {
    await page.route(url, (route) =>
      route.fulfill({
        path: "public\\audio\\demo\\illustrator-psychedelic-experience.mp3",
        contentType: "audio/mpeg",
        headers: { "Access-Control-Allow-Origin": "*" },
      }),
    );
  }
  await page.route("**/metadata?channel=chillout", (route) =>
    route.fulfill({ json: { channelId: "chillout", artist: null, title: null } }),
  );
  await page.route("https://cast.magicstreams.gr:2199/**", (route) =>
    route.fulfill({ json: {} }),
  );
  await page.goto("/player/?audioDebug=1");
  const psybientRequests: string[] = [];
  page.on("request", (request) => psybientRequests.push(request.url()));
  await verifyStationUi(page);
  expect(
    psybientRequests.filter((url) =>
      /listen\.openstream\.co|mixlive\.net/.test(url),
    ).every((url) => url === STREAM_URL),
  ).toBe(true);
  await verifyPlaybackAndSwitching(page);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("real Psybient Sunset and existing stations produce changing analyser data", async ({
  page,
  pageErrors,
}) => {
  test.skip(process.env.DSFM_LIVE_STREAM_TEST !== "1", "Opt-in live network test");
  test.setTimeout(300_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await instrumentAudio(page);
  await page.goto("/player/?audioDebug=1");
  await verifyStationUi(page);
  await verifyPlaybackAndSwitching(page);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
