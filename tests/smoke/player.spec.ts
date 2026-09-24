import { test, expect } from "../support/test";
import { expectSaneGeometry } from "../support/geometry";

const PSYSTREAM_TELEMETRY_URL =
  "https://radio.psymusic.co.uk/api/nowplaying_static/psystream.json";
const PSYSTREAM_STREAM_URL =
  "https://radio.psymusic.co.uk/listen/psystream/hifi.mp3";
const PSYNDORA_PSYTRANCE_TELEMETRY_URL =
  "https://cast.magicstreams.gr:2199/rpc/psyndora/streaminfo.get";
const PSYNDORA_CHILLOUT_TELEMETRY_URL =
  "https://cast.magicstreams.gr:2199/rpc/psychill/streaminfo.get";

function normalizePsyndoraBitrate(value: unknown) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(?:kbps)?$/i);
  return match?.[1] ?? null;
}

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

test("public Hirschmilch external signals are available in the selector", async ({
  page,
}) => {
  const signalSource = page.getByLabel("Signal source");

  await expect(signalSource).toContainText("Hirschmilch Psytrance");
  await expect(signalSource).toContainText("Hirschmilch Progressive");
  await expect(signalSource).toContainText("Hirschmilch Chillout");

  await signalSource.selectOption("hirschmilch-psytrance");
  await expect(page.getByRole("button", { name: /^(Play|Pause)$/ })).toBeVisible();
});

test("Space Unicorn Radio shows live listener and bitrate telemetry", async ({
  page,
}) => {
  const signalSource = page.getByLabel("Signal source");
  const listenersValue = page.locator(
    ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
  );
  const bitrateValue = page.locator(
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
  );
  const bitrateUnit = page.locator(
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-unit",
  );

  await signalSource.selectOption("space-unicorn-radio");
  await page.waitForRequest("https://spaceunicorn.radio/status-json.xsl");

  await expect(listenersValue).not.toHaveText("---");
  await expect(bitrateValue).not.toHaveText("---");
  await expect(bitrateUnit).toHaveText("kbps");

  await expect(listenersValue).toHaveText(/\d+/);
  await expect(bitrateValue).toHaveText(/\d+/);

  await signalSource.selectOption("dmt-fm");
  await expect(listenersValue).toHaveText("---");
  await expect(bitrateValue).toHaveText("---");

  await signalSource.selectOption("space-unicorn-radio");
  await expect(listenersValue).not.toHaveText("---");
  await expect(bitrateValue).not.toHaveText("---");
});

test("PsyStream shows telemetry from the configured live mount", async ({
  page,
  request,
}) => {
  const apiResponse = await request.get(PSYSTREAM_TELEMETRY_URL);
  expect(apiResponse.ok()).toBe(true);

  const payload = (await apiResponse.json()) as {
    station?: {
      mounts?: Array<{
        url?: string;
        bitrate?: number | string;
        listeners?: { current?: number | string };
      }>;
    };
  };
  const matchedMount = payload.station?.mounts?.find(
    (mount) => mount.url === PSYSTREAM_STREAM_URL,
  );

  expect(matchedMount, "configured PsyStream mount").toBeDefined();

  const browserResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === PSYSTREAM_TELEMETRY_URL && response.ok(),
  );
  await page.getByLabel("Signal source").selectOption("psystream");
  const browserResponse = await browserResponsePromise;

  expect(browserResponse.url()).toBe(PSYSTREAM_TELEMETRY_URL);
  expect(browserResponse.headers()["access-control-allow-origin"]).toBe("*");
  await expect(
    page.locator(
      ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
    ),
  ).toHaveText(String(matchedMount!.listeners!.current));
  await expect(
    page.locator(
      ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
    ),
  ).toHaveText(String(matchedMount!.bitrate));
  await expect(
    page.locator(".visual-feed-window__metric--bitrate .visual-feed-window__metric-unit"),
  ).toHaveText("kbps");

  const headerGeometry = await page.evaluate(() => {
    const selectors = [
      ".visual-feed-window__fps",
      ".visual-feed-window__metric--listeners",
      ".visual-feed-window__metric--bitrate",
      ".visual-feed-window__source-link",
    ];

    return selectors.map((selector) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, width: rect.width };
    });
  });
  const rowTop = Math.max(...headerGeometry.map((box) => box.top));
  const rowBottom = Math.min(...headerGeometry.map((box) => box.bottom));
  expect(rowBottom).toBeGreaterThan(rowTop);
  expect(headerGeometry.every((box) => box.width > 0)).toBe(true);
  const sourceLink = page.locator(".visual-feed-window__source-link");
  await expect(sourceLink).toBeVisible();
  await expect(sourceLink).toHaveAttribute(
    "href",
    "https://radio.psymusic.co.uk/public/psystream",
  );

  const signalSource = page.getByLabel("Signal source");
  await signalSource.selectOption("space-unicorn-radio");
  await expect(
    page.locator(
      ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
    ),
  ).toHaveText(/^\d+$/);
  await signalSource.selectOption("dmt-fm");
  await expect(
    page.locator(
      ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
    ),
  ).toHaveText("---");
  await expect(
    page.locator(
      ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
    ),
  ).toHaveText("---");
  await signalSource.selectOption("psystream");
  await expect(
    page.locator(
      ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
    ),
  ).toHaveText(/^\d+$/);
  await expect(
    page.locator(
      ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
    ),
  ).toHaveText(/^\d+(?:\.\d+)?$/);
});

test("PsyStream telemetry failure clears and recovers without affecting controls", async ({
  page,
  pageErrors,
}) => {
  await page.route(PSYSTREAM_TELEMETRY_URL, (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );

  const signalSource = page.getByLabel("Signal source");
  const listenersValue = page.locator(
    ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
  );
  const bitrateValue = page.locator(
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
  );

  await signalSource.selectOption("psystream");
  await expect(listenersValue).toHaveText("---");
  await expect(bitrateValue).toHaveText("---");
  await expect(page.getByRole("button", { name: /^(Play|Pause)$/ })).toBeEnabled();
  expect(pageErrors).toEqual([]);

  await page.unroute(PSYSTREAM_TELEMETRY_URL);
  await signalSource.selectOption("dmt-fm");
  await expect(listenersValue).toHaveText("---");
  await signalSource.selectOption("psystream");
  await expect(listenersValue).toHaveText(/^\d+$/);
  await expect(bitrateValue).toHaveText(/^\d+(?:\.\d+)?$/);
});

test("PsyStream ignores stale failed requests after reselection", async ({
  page,
}) => {
  let delayedRequestCount = 0;
  let releaseDelayedFailures = () => {};
  let markInitialRequestsStarted = () => {};
  const delayedFailures = new Promise<void>((resolve) => {
    releaseDelayedFailures = resolve;
  });
  const initialRequestsStarted = new Promise<void>((resolve) => {
    markInitialRequestsStarted = resolve;
  });

  await page.route(PSYSTREAM_TELEMETRY_URL, async (route) => {
    if (delayedRequestCount < 2) {
      delayedRequestCount += 1;
      if (delayedRequestCount === 2) {
        markInitialRequestsStarted();
      }
      await delayedFailures;
      await route.fulfill({ status: 503, body: "stale failure" }).catch(() => {});
      return;
    }

    await route.continue();
  });

  const signalSource = page.getByLabel("Signal source");
  const listenersValue = page.locator(
    ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
  );
  const bitrateValue = page.locator(
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
  );

  await signalSource.selectOption("psystream");
  await initialRequestsStarted;
  await signalSource.selectOption("dmt-fm");
  await signalSource.selectOption("psystream");
  await expect(listenersValue).toHaveText(/^\d+$/);
  await expect(bitrateValue).toHaveText(/^\d+(?:\.\d+)?$/);

  const currentListeners = await listenersValue.textContent();
  const currentBitrate = await bitrateValue.textContent();
  releaseDelayedFailures();
  await page.waitForTimeout(250);
  await expect(listenersValue).toHaveText(currentListeners!);
  await expect(bitrateValue).toHaveText(currentBitrate!);
});

test("Psyndora channels show their own live RPC telemetry", async ({ page }) => {
  const listenersValue = page.locator(
    ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
  );
  const bitrateValue = page.locator(
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
  );
  const bitrateUnit = page.locator(
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-unit",
  );
  const cases = [
    {
      sourceId: "psyndora-psytrance",
      telemetryUrl: PSYNDORA_PSYTRANCE_TELEMETRY_URL,
      sourceUrl: "https://www.psyndora.com/trance.html",
    },
    {
      sourceId: "psyndora-chillout",
      telemetryUrl: PSYNDORA_CHILLOUT_TELEMETRY_URL,
      sourceUrl: "https://www.psyndora.com/chill.html",
    },
  ] as const;

  for (const testCase of cases) {
    const responsePromise = page.waitForResponse(
      (response) => response.url() === testCase.telemetryUrl && response.ok(),
    );
    await page.getByLabel("Signal source").selectOption(testCase.sourceId);
    const response = await responsePromise;
    const payload = (await response.json()) as {
      data?: Array<{
        listeners?: number | string;
        bitrate?: number | string;
        mountpoint?: string;
      }>;
    };
    const entry = payload.data?.[0];
    const expectedBitrate = normalizePsyndoraBitrate(entry?.bitrate);

    expect(response.url()).toBe(testCase.telemetryUrl);
    expect(response.request().resourceType()).toBe("fetch");
    expect(entry?.mountpoint).toBe("/stream");
    expect(expectedBitrate).not.toBeNull();
    await expect(listenersValue).toHaveText(String(entry?.listeners));
    await expect(bitrateValue).toHaveText(expectedBitrate!);
    await expect(bitrateUnit).toHaveText("kbps");

    const sourceLink = page.locator(".visual-feed-window__source-link");
    await expect(sourceLink).toBeVisible();
    await expect(sourceLink).toHaveAttribute("href", testCase.sourceUrl);

    const rowGeometry = await page.evaluate(() => {
      const selectors = [
        ".visual-feed-window__fps",
        ".visual-feed-window__metric--listeners",
        ".visual-feed-window__metric--bitrate",
        ".visual-feed-window__source-link",
      ];

      return selectors.map((selector) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, width: rect.width };
      });
    });
    const rowTop = Math.max(...rowGeometry.map((box) => box.top));
    const rowBottom = Math.min(...rowGeometry.map((box) => box.bottom));
    expect(rowBottom).toBeGreaterThan(rowTop);
    expect(rowGeometry.every((box) => box.width > 0)).toBe(true);
  }
});

test("Psyndora telemetry follows the selected station sequence", async ({
  page,
}) => {
  const signalSource = page.getByLabel("Signal source");
  const listenersValue = page.locator(
    ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
  );
  const bitrateValue = page.locator(
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
  );

  for (const sourceId of [
    "psyndora-psytrance",
    "psyndora-chillout",
    "space-unicorn-radio",
    "psystream",
  ]) {
    await signalSource.selectOption(sourceId);
    await expect(listenersValue).toHaveText(/^\d+$/);
    await expect(bitrateValue).toHaveText(/^\d+(?:\.\d+)?$/);
  }

  await signalSource.selectOption("dmt-fm");
  await expect(listenersValue).toHaveText("---");
  await expect(bitrateValue).toHaveText("---");

  await signalSource.selectOption("psyndora-psytrance");
  await expect(listenersValue).toHaveText(/^\d+$/);
  await expect(bitrateValue).toHaveText(/^\d+(?:\.\d+)?$/);
});

test("Psyndora telemetry failure clears and recovers without affecting controls", async ({
  page,
  pageErrors,
}) => {
  await page.route(PSYNDORA_PSYTRANCE_TELEMETRY_URL, (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );

  const signalSource = page.getByLabel("Signal source");
  const listenersValue = page.locator(
    ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
  );
  const bitrateValue = page.locator(
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
  );

  await signalSource.selectOption("psyndora-psytrance");
  await expect(listenersValue).toHaveText("---");
  await expect(bitrateValue).toHaveText("---");
  await expect(page.getByRole("button", { name: /^(Play|Pause)$/ })).toBeEnabled();
  expect(pageErrors).toEqual([]);

  await page.unroute(PSYNDORA_PSYTRANCE_TELEMETRY_URL);
  await signalSource.selectOption("dmt-fm");
  await signalSource.selectOption("psyndora-psytrance");
  await expect(listenersValue).toHaveText(/^\d+$/);
  await expect(bitrateValue).toHaveText(/^\d+(?:\.\d+)?$/);
});

test("Psyndora telemetry normalizes fields independently", async ({ page }) => {
  const signalSource = page.getByLabel("Signal source");
  const listenersValue = page.locator(
    ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
  );
  const bitrateValue = page.locator(
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
  );

  await page.route(PSYNDORA_PSYTRANCE_TELEMETRY_URL, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ listeners: "12", bitrate: "invalid", mountpoint: "/stream" }],
      }),
    }),
  );
  await signalSource.selectOption("psyndora-psytrance");
  await expect(listenersValue).toHaveText("12");
  await expect(bitrateValue).toHaveText("---");

  await signalSource.selectOption("dmt-fm");
  await page.unroute(PSYNDORA_PSYTRANCE_TELEMETRY_URL);
  await page.route(PSYNDORA_PSYTRANCE_TELEMETRY_URL, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ listeners: -1, bitrate: "128 kbps", mountpoint: "/stream" }],
      }),
    }),
  );
  await signalSource.selectOption("psyndora-psytrance");
  await expect(listenersValue).toHaveText("---");
  await expect(bitrateValue).toHaveText("128");
});

test("Psyndora Chillout ignores a delayed Psytrance response", async ({ page }) => {
  let releasePsytranceResponse = () => {};
  let markPsytranceRequestStarted = () => {};
  const responseRelease = new Promise<void>((resolve) => {
    releasePsytranceResponse = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    markPsytranceRequestStarted = resolve;
  });

  await page.route(PSYNDORA_PSYTRANCE_TELEMETRY_URL, async (route) => {
    markPsytranceRequestStarted();
    await responseRelease;
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ listeners: 999, bitrate: "64 Kbps", mountpoint: "/stream" }],
        }),
      })
      .catch(() => {});
  });

  const signalSource = page.getByLabel("Signal source");
  const listenersValue = page.locator(
    ".visual-feed-window__metric--listeners .visual-feed-window__metric-value",
  );
  const bitrateValue = page.locator(
    ".visual-feed-window__metric--bitrate .visual-feed-window__metric-value",
  );

  await signalSource.selectOption("psyndora-psytrance");
  await requestStarted;
  await signalSource.selectOption("psyndora-chillout");
  await expect(listenersValue).toHaveText(/^\d+$/);
  await expect(bitrateValue).toHaveText(/^\d+(?:\.\d+)?$/);

  const chilloutListeners = await listenersValue.textContent();
  const chilloutBitrate = await bitrateValue.textContent();
  releasePsytranceResponse();
  await page.waitForTimeout(250);
  await expect(listenersValue).toHaveText(chilloutListeners!);
  await expect(bitrateValue).toHaveText(chilloutBitrate!);
});

test("Space Unicorn Radio is available in the public selector with its station info", async ({
  page,
}) => {
  const signalSource = page.getByLabel("Signal source");

  await expect(signalSource).toContainText("Space Unicorn Radio");

  await signalSource.selectOption("space-unicorn-radio");
  await expect(page.getByRole("button", { name: /^(Play|Pause)$/ })).toBeVisible();

  const artworkImage = page.locator(".visual-feed-window__artwork");
  await expect(artworkImage).toBeVisible();
  await expect(artworkImage).toHaveAttribute("src", /space-unicorn-radio/);

  const infoLink = page.getByRole("link", { name: /Space Unicorn Radio|Info/i }).first();
  await expect(infoLink).toHaveAttribute("href", "https://spaceunicorn.radio/");
});

test("Hirschmilch channels use their official channel artwork in the feed", async ({
  page,
}) => {
  const cases = [
    ["hirschmilch-psytrance", "/images/channel-track-psytrance.webp"],
    ["hirschmilch-progressive", "/images/channel-track-progressive.webp"],
    ["hirschmilch-chillout", "/images/channel-track-chillout.webp"],
  ] as const;

  for (const [signalId, expectedArtworkPath] of cases) {
    await page.getByLabel("Signal source").selectOption(signalId);
    await expect(page.locator(".visual-feed-window__artwork")).toBeVisible();

    const artworkSrc = await page
      .locator(".visual-feed-window__artwork")
      .getAttribute("src");

    expect(artworkSrc).toContain(expectedArtworkPath);
  }
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
