import { test, expect } from "../support/test";
import { instrumentAudio } from "../support/audioProbe";

const ID = "deepsignals-psytrance";
const STREAM = "https://a6.asurahosting.com:7530/radio.mp3?_ic2=1";

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-30T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-30T12:00:01Z"));
  await instrumentAudio(page);
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      get() { return this.dataset.mockPaused !== "false"; },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", { get: () => 0 });
    HTMLMediaElement.prototype.load = function () {
      const wasPlaying = !this.paused;
      this.dataset.mockPaused = "true";
      this.dataset.loads = String(Number(this.dataset.loads ?? 0) + 1);
      Object.defineProperty(this, "error", { configurable: true, value: null });
      if (wasPlaying) queueMicrotask(() => this.dispatchEvent(new Event("pause")));
    };
    HTMLMediaElement.prototype.pause = function () {
      if (this.paused) return;
      this.dataset.mockPaused = "true";
      queueMicrotask(() => this.dispatchEvent(new Event("pause")));
    };
    HTMLMediaElement.prototype.play = function () {
      this.dataset.plays = String(Number(this.dataset.plays ?? 0) + 1);
      if (this.dataset.mode === "denied") {
        return Promise.reject(new DOMException("User gesture required", "NotAllowedError"));
      }
      this.dataset.mockPaused = "false";
      if (this.dataset.mode === "pending") {
        return new Promise<void>((resolve, reject) => {
          this.addEventListener("reject-play", () => reject(new DOMException("Old request aborted", "AbortError")), { once: true });
          this.addEventListener("resolve-play", () => {
            this.dataset.mockPaused = "false";
            this.dispatchEvent(new Event("playing"));
            resolve();
          }, { once: true });
        });
      }
      queueMicrotask(() => this.dispatchEvent(new Event("playing")));
      return Promise.resolve();
    };
  });
  await page.route("https://a6.asurahosting.com/api/nowplaying/764", (route) =>
    route.fulfill({ json: { station: {}, is_online: false } }));
  await page.goto("/player/");
  await page.getByLabel("Signal source").selectOption(ID);
});

test("live pause releases the source; buffering can be cancelled and old Play failures cannot change the new station", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].hasAttribute("src"))).toBe(false);
  await page.evaluate(() => { window.__DSFM_AUDIO_TEST__!.elements[0].dataset.mode = "pending"; });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].getAttribute("src"))).toBe(STREAM);
  await page.getByRole("button", { name: "Pause loading playback" }).click();
  await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dispatchEvent(new Event("reject-play")));
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.locator(".floating-player-panel__audio-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByLabel("Signal source").selectOption("demo-psychedelic-experience");
  await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dispatchEvent(new Event("reject-play")));
  await page.clock.fastForward(120_000);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.locator(".floating-player-panel__audio-error")).toHaveCount(0);
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("3");
});

test("network interruption preserves Play intent but retries only three times, even after successful recovery", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const interrupt = () => page.evaluate(() => {
    const audio = window.__DSFM_AUDIO_TEST__!.elements[0];
    Object.defineProperty(audio, "error", { configurable: true, value: { code: 2 } });
    audio.dispatchEvent(new Event("error"));
  });
  for (const [index, delay] of [3_000, 8_000, 15_000].entries()) {
    await interrupt();
    await expect(page.getByRole("button", { name: "Pause loading playback" })).toBeEnabled();
    await page.clock.fastForward(delay - 1);
    expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe(String(index + 1));
    await page.clock.fastForward(1);
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  }
  await interrupt();
  await page.clock.fastForward(120_000);
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("4");
  await expect(page.getByRole("status")).toContainText("Press Play to reconnect");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("a reconnect that never settles expires at exactly 20 seconds and rejects late playback", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => {
    const audio = window.__DSFM_AUDIO_TEST__!.elements[0];
    audio.dataset.mode = "pending";
    audio.dispatchEvent(new Event("waiting"));
  });
  await page.clock.fastForward(19_999);
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("2");
  await expect(page.getByRole("button", { name: "Pause loading playback" })).toBeVisible();
  await page.clock.fastForward(1);
  await expect(page.getByRole("status")).toContainText("Press Play to reconnect");
  await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dispatchEvent(new Event("resolve-play")));
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].paused)).toBe(true);
  await page.clock.fastForward(120_000);
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("2");
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].hasAttribute("src"))).toBe(false);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Press Play to reconnect");
});

test("repeated network errors cannot extend the 20-second deadline", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const interrupt = () => page.evaluate(() => {
    const audio = window.__DSFM_AUDIO_TEST__!.elements[0];
    audio.dataset.mode = "pending";
    Object.defineProperty(audio, "error", { configurable: true, value: { code: 2 } });
    audio.dispatchEvent(new Event("error"));
  });
  await interrupt();
  for (let elapsed = 2_000; elapsed <= 18_000; elapsed += 2_000) {
    await page.clock.fastForward(2_000);
    await interrupt();
  }
  await page.clock.fastForward(1_999);
  await expect(page.getByRole("button", { name: "Pause loading playback" })).toBeVisible();
  await page.clock.fastForward(1);
  await expect(page.getByRole("status")).toContainText("Press Play to reconnect");
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("1");
});

for (const wake of ["timer", "visibility", "playing"] as const) {
  test(`expired recovery cannot restart after minutes of suspension (${wake} first)`, async ({ page }) => {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.evaluate(() => {
      const audio = window.__DSFM_AUDIO_TEST__!.elements[0];
      audio.dataset.mode = "pending";
      audio.dispatchEvent(new Event("waiting"));
    });
    if (wake === "playing") await page.clock.fastForward(15_000);
    // Advance wall time without running queued timers, as when a tab is suspended.
    await page.clock.setSystemTime(new Date("2026-10-30T12:05:00Z"));
    if (wake === "timer") {
      await page.clock.fastForward(15_000);
    } else if (wake === "visibility") {
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    } else {
      await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dispatchEvent(new Event("resolve-play")));
    }
    await expect(page.getByRole("status")).toContainText("Press Play to reconnect");
    const plays = wake === "playing" ? "2" : "1";
    expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe(plays);
    expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].paused)).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.clock.fastForward(120_000);
    expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe(plays);
  });
}

for (const cancel of ["pause", "switch", "expiry"] as const) {
  test(`${cancel} invalidates an already queued retry even after a new Play`, async ({ page }) => {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.evaluate(() => {
      const setTimeout = window.setTimeout.bind(window);
      window.setTimeout = (handler, delay, ...args) => {
        if (typeof handler === "function" && delay === 15_000) {
          document.addEventListener("run-old-retry", () => handler(...args), { once: true });
        }
        return setTimeout(handler, delay, ...args);
      };
      window.__DSFM_AUDIO_TEST__!.elements[0].dispatchEvent(new Event("waiting"));
    });
    if (cancel === "pause") await page.getByRole("button", { name: "Pause loading playback" }).click();
    if (cancel === "switch") await page.getByLabel("Signal source").selectOption("demo-psychedelic-experience");
    if (cancel === "expiry") {
      await page.clock.setSystemTime(new Date("2026-10-30T12:05:00Z"));
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    }
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.evaluate(() => document.dispatchEvent(new Event("run-old-retry")));
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("2");
  });
}

test("media Play is not blocked by a pending AudioContext resume", async ({ page }) => {
  await page.evaluate(() => {
    AudioContext.prototype.resume = () => new Promise<void>(() => {});
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("1");
});

test("visibility changes leave playback alone and a browser pause cancels reconnect intent", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.__DSFM_AUDIO_TEST__!.elements[0].pause();
  });
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dispatchEvent(new Event("stalled")));
  await page.clock.fastForward(120_000);
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("1");
  await page.evaluate(() => { window.__DSFM_AUDIO_TEST__!.elements[0].dataset.mode = "pending"; });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].pause());
  await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dispatchEvent(new Event("reject-play")));
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.locator(".floating-player-panel__audio-error")).toHaveCount(0);
});

test("waiting, stalled and ended recover; Pause, switching and Safari permission rejection cancel recovery", async ({ page }) => {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  for (const event of ["waiting", "stalled", "ended"]) {
    await page.evaluate((name) => window.__DSFM_AUDIO_TEST__!.elements[0].dispatchEvent(new Event(name)), event);
    await page.clock.fastForward(15_000);
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dispatchEvent(new Event("waiting")));
  await page.getByRole("button", { name: "Pause loading playback" }).click();
  await page.clock.fastForward(120_000);
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("5");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => {
    const audio = window.__DSFM_AUDIO_TEST__!.elements[0];
    audio.dataset.mode = "denied";
    audio.dispatchEvent(new Event("waiting"));
  });
  await page.clock.fastForward(15_000);
  await expect(page.getByRole("status")).toContainText("Press Play to reconnect");
  await page.clock.fastForward(120_000);
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("7");
  await page.evaluate(() => { window.__DSFM_AUDIO_TEST__!.elements[0].dataset.mode = ""; });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dispatchEvent(new Event("waiting")));
  await page.getByLabel("Signal source").selectOption("demo-psychedelic-experience");
  await page.clock.fastForward(120_000);
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("8");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dispatchEvent(new Event("ended")));
  await page.clock.fastForward(120_000);
  expect(await page.evaluate(() => window.__DSFM_AUDIO_TEST__!.elements[0].dataset.plays)).toBe("9");
});
