import { test, expect } from "../support/test";
import {
  ENVIRONMENT_GROUPS,
  SHUFFLE_MODES,
  getShufflePool,
} from "../../src/app/environmentSelection";
import {
  EnvironmentShuffle,
  EnvironmentShuffleBag,
  getShuffleTrack,
  scheduleEnvironmentShuffle,
  SHUFFLE_COOLDOWN_MS,
  SHUFFLE_FALLBACK_MS,
  type EnvironmentShuffleInput,
} from "../../src/app/environmentShuffle";
import { instrumentAudio, readAudio } from "../support/audioProbe";

const MINUTE = 60_000;

function setup() {
  const shuffle = new EnvironmentShuffle();
  const input: EnvironmentShuffleInput = {
    mode: "shuffle-all",
    stationId: "station-a",
    track: getShuffleTrack({ title: "First Track", artist: "Artist" }),
    playing: true,
    activeEnvironment: "minimal",
  };
  const step = (now: number, patch: Partial<EnvironmentShuffleInput> = {}) => {
    Object.assign(input, patch);
    const next = shuffle.update(input, now);
    if (next !== null) input.activeEnvironment = next;
    return next;
  };
  return { shuffle, input, step };
}

test("shuffle pools follow the visible categories, excluding Black, branded and hidden environments", () => {
  const depth = [
    "analog-signal-laboratory", "crystal-cavern", "dark-psy-temple",
    "uv-reactive-jungle", "bioluminescent-psy-reef",
  ];
  const experiences = [
    "signal-runner-2", "cosmic-roller-coaster", "alien-megastructure-transit",
    "neon-hyper-racer", "signal-runner", "signal-tunnel", "cosmic-nexus", "twilight-tides", "toxic-horizon",
  ];
  expect(getShufflePool("shuffle-depth")).toEqual(depth);
  expect(getShufflePool("shuffle-3d")).toEqual(experiences);
  expect(getShufflePool("shuffle-all")).toEqual(["signal-gradient", "signal-rain", ...depth, ...experiences]);
  expect(ENVIRONMENT_GROUPS.flatMap((group) => group.environmentIds)).toContain("minimal");
});

for (const mode of SHUFFLE_MODES) {
  test(`${mode.id} excludes branded environments throughout active shuffle cycles`, () => {
    const { step } = setup();
    const pool = getShufflePool(mode.id);
    for (let index = 0; index < pool.length * 3; index++) {
      const next = step(index * SHUFFLE_FALLBACK_MS, {
        mode: mode.id,
        ...(index === 0 ? { activeEnvironment: "deep-signals" } : {}),
      });
      expect(pool).toContain(next);
      expect(["minimal", "slime-cavern", "psybrazil", "deep-signals"]).not.toContain(next);
    }
  });

  test(`${mode.id} exhausts each bag before repeating and avoids cycle-boundary repeats`, () => {
    const pool = getShufflePool(mode.id);
    const bag = new EnvironmentShuffleBag(pool, () => 0.37);
    let current = pool[0];
    for (let cycle = 0; cycle < 4; cycle++) {
      const visited: string[] = [];
      for (let index = 0; index < pool.length; index++) {
        const next = bag.next(current)!;
        expect(next).not.toBe(current);
        visited.push(next);
        current = next;
      }
      expect([...visited].sort()).toEqual([...pool].sort());
    }
  });
}

test("empty and single-environment bags terminate safely", () => {
  expect(new EnvironmentShuffleBag([]).next("minimal")).toBeNull();
  const single = new EnvironmentShuffleBag(["signal-rain"]);
  expect(single.next("signal-rain")).toBe("signal-rain");
  expect(single.next("signal-rain")).toBe("signal-rain");
});

test("mode changes rebuild the pool; manual selection disables all automatic transitions", () => {
  const { step, input, shuffle } = setup();
  expect(step(0)).not.toBeNull();
  expect(getShufflePool("shuffle-depth")).toContain(step(1, { mode: "shuffle-depth" }));
  expect(getShufflePool("shuffle-3d")).toContain(step(2, { mode: "shuffle-3d" }));
  expect(step(3, { mode: null, activeEnvironment: "minimal" })).toBeNull();
  expect(step(20 * MINUTE, { track: getShuffleTrack({ title: "Next" }) })).toBeNull();
  expect(shuffle.nextDelay(20 * MINUTE)).toBeNull();
  expect(input.activeEnvironment).toBe("minimal");
});

test("only genuine track changes advance, with an exact two-minute cooldown and no queued switches", () => {
  const { step, shuffle } = setup();
  step(0);
  expect(step(SHUFFLE_COOLDOWN_MS - 1, { track: getShuffleTrack({ title: "Short ident" }) })).toBeNull();
  expect(step(SHUFFLE_COOLDOWN_MS)).toBeNull();
  expect(step(SHUFFLE_COOLDOWN_MS, { track: getShuffleTrack({ title: "Second" }) })).not.toBeNull();
  expect(step(2 * SHUFFLE_COOLDOWN_MS - 1, { track: getShuffleTrack({ title: "Third" }) })).toBeNull();
  expect(step(2 * SHUFFLE_COOLDOWN_MS)).toBeNull();
  expect(step(2 * SHUFFLE_COOLDOWN_MS, { track: getShuffleTrack({ title: "Fourth" }) })).not.toBeNull();
  expect(shuffle.nextDelay(2 * SHUFFLE_COOLDOWN_MS)).toBe(SHUFFLE_FALLBACK_MS);
});

test("fallback advances at exactly ten minutes of active playback and resets after transitions", () => {
  const { step, shuffle } = setup();
  step(0);
  expect(step(SHUFFLE_FALLBACK_MS - 1)).toBeNull();
  expect(shuffle.nextDelay(SHUFFLE_FALLBACK_MS - 1)).toBe(1);
  expect(step(SHUFFLE_FALLBACK_MS)).not.toBeNull();
  expect(shuffle.nextDelay(SHUFFLE_FALLBACK_MS)).toBe(SHUFFLE_FALLBACK_MS);
  expect(step(SHUFFLE_FALLBACK_MS + 2 * MINUTE, { track: getShuffleTrack({ title: "Second" }) })).not.toBeNull();
  expect(step(2 * SHUFFLE_FALLBACK_MS)).toBeNull();
  expect(step(2 * SHUFFLE_FALLBACK_MS + 2 * MINUTE)).not.toBeNull();
});

test("pauses do not accumulate fallback time or queue metadata changes", () => {
  const { step, shuffle } = setup();
  step(0);
  step(4 * MINUTE, { playing: false });
  expect(shuffle.nextDelay(4 * MINUTE)).toBeNull();
  expect(step(40 * MINUTE, { track: getShuffleTrack({ title: "While paused" }) })).toBeNull();
  expect(step(50 * MINUTE, { playing: true })).toBeNull();
  expect(shuffle.nextDelay(50 * MINUTE)).toBe(6 * MINUTE);
  expect(step(56 * MINUTE - 1)).toBeNull();
  expect(step(56 * MINUTE)).not.toBeNull();
});

test("station browsing preserves the environment and mode, suppresses initial metadata, and resets both clocks", () => {
  const { step, input, shuffle } = setup();
  step(0);
  const environment = input.activeEnvironment;
  expect(step(9 * MINUTE, { stationId: "station-b", track: null })).toBeNull();
  expect(input.activeEnvironment).toBe(environment);
  expect(input.mode).toBe("shuffle-all");
  expect(shuffle.nextDelay(9 * MINUTE)).toBe(SHUFFLE_FALLBACK_MS);
  expect(step(12 * MINUTE, { track: getShuffleTrack({ title: "Delayed initial metadata" }) })).toBeNull();
  expect(step(12 * MINUTE + 1, { track: getShuffleTrack({ title: "Next genuine track" }) })).not.toBeNull();
  expect(step(13 * MINUTE, { stationId: "station-c", track: getShuffleTrack({ title: "Initial C" }) })).toBeNull();
  expect(step(15 * MINUTE - 1, { track: getShuffleTrack({ title: "Too early" }) })).toBeNull();
  expect(step(15 * MINUTE)).toBeNull();
  expect(step(15 * MINUTE, { track: getShuffleTrack({ title: "Genuine C" }) })).not.toBeNull();
  expect(step(16 * MINUTE, { stationId: "station-a", track: null })).toBeNull();
  expect(step(26 * MINUTE - 1)).toBeNull();
  expect(step(26 * MINUTE)).not.toBeNull();
});

test("missing, blank, duplicate and backtracking metadata do not trigger transitions", () => {
  const { step } = setup();
  step(0);
  for (const metadata of [
    null, { title: "" }, { title: "   " }, { title: "Unknown" }, { title: "N/A" },
  ]) {
    expect(getShuffleTrack(metadata)).toBeNull();
    expect(step(2 * MINUTE, { track: getShuffleTrack(metadata) })).toBeNull();
  }
  expect(step(2 * MINUTE, { track: getShuffleTrack({ title: " FIRST   TRACK ", artist: "ARTIST" }) })).toBeNull();
  expect(step(2 * MINUTE, { track: getShuffleTrack({ title: "First Track" }) })).toBeNull();
  expect(step(2 * MINUTE, { track: getShuffleTrack({ title: "First Track", artist: "Unknown Artist" }) })).toBeNull();
  expect(step(2 * MINUTE, { track: getShuffleTrack({ title: "Second" }) })).not.toBeNull();
  expect(step(4 * MINUTE, { track: getShuffleTrack({ title: "First Track", artist: "Artist" }) })).toBeNull();
  expect(step(4 * MINUTE, { track: getShuffleTrack({ title: "Second" }) })).toBeNull();
  expect(step(4 * MINUTE, { track: getShuffleTrack({ title: "Third" }) })).not.toBeNull();
});

test("artist identity distinguishes tracks sharing a title, while title-only feeds also work", () => {
  const { step } = setup();
  step(0);
  expect(step(2 * MINUTE, { track: getShuffleTrack({ title: "First Track", artist: "Other Artist" }) })).not.toBeNull();
  expect(step(4 * MINUTE, { track: getShuffleTrack({ title: "Title only" }) })).not.toBeNull();
});

test("effect scheduling owns one timeout and cleanup cancels it, including repeated setup/cleanup", () => {
  const { shuffle, input } = setup();
  let now = 0;
  let sequence = 0;
  let transitions = 0;
  const pending = new Map<number, { callback: () => void; delay: number }>();
  const clock = {
    now: () => now,
    setTimeout: (callback: () => void, delay: number) => {
      const id = ++sequence;
      pending.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id: number) => { pending.delete(id); },
  };
  const start = () => scheduleEnvironmentShuffle(shuffle, input, (id) => {
    input.activeEnvironment = id;
    transitions++;
  }, clock);
  const stop = start();
  expect(transitions).toBe(1);
  expect(pending.size).toBe(1);
  stop();
  expect(pending.size).toBe(0);
  const stopAgain = start();
  expect(transitions).toBe(1);
  expect(pending.size).toBe(1);
  const [id, timer] = [...pending][0];
  pending.delete(id);
  now = SHUFFLE_FALLBACK_MS;
  timer.callback();
  expect(transitions).toBe(2);
  expect(pending.size).toBe(1);
  stopAgain();
  expect(pending.size).toBe(0);
  input.playing = false;
  const stopPaused = start();
  expect(pending.size).toBe(0);
  stopPaused();
});

const API = "https://a6.asurahosting.com/api/nowplaying/764";
const STREAM = "https://a6.asurahosting.com:7530/radio.mp3";
const TRIPLAG_API = "https://a3.asurahosting.com/api/nowplaying/triplag";
const TRIPLAG_STREAM = "https://a3.asurahosting.com/listen/triplag/radio.mp3";

function payload(title: string, stream = STREAM, art?: string) {
  return {
    is_online: true,
    station: { mounts: [{ url: stream, bitrate: 192, listeners: { current: 1 } }] },
    now_playing: { song: { title, artist: "Artist", art } },
  };
}

declare global {
  interface Window {
    __shuffleTimers: Set<number>;
  }
}

test.describe("player shuffle integration", () => {
  test.beforeEach(async ({ page }) => {
    await instrumentAudio(page);
    await page.addInitScript(() => {
      localStorage.setItem("deepsignals.player.preferences.v3", JSON.stringify({
        selectedThemeId: "signal-gradient",
        selectedAudioSourceId: "deepsignals-psytrance",
      }));
    });
    await page.clock.install();
    await page.route(API, (route) => route.fulfill({ json: payload("First Track") }));
    await page.route(`${STREAM}*`, (route) => route.fulfill({
      path: "public\\audio\\demo\\illustrator-psychedelic-experience.mp3",
      headers: { "Access-Control-Allow-Origin": "*" },
    }));
    await page.goto("/player/?testRuntime=1");
    await expect(page.locator(".track-marquee__live")).toHaveText("Artist \u2014 First Track");
    await page.evaluate(() => {
      window.__shuffleTimers = new Set<number>();
      const schedule = window.setTimeout.bind(window);
      const cancel = window.clearTimeout.bind(window);
      window.setTimeout = (handler, delay, ...args) => {
        if (typeof handler !== "function" || !delay || delay < 120_000) {
          return schedule(handler, delay, ...args);
        }
        const id = schedule(() => {
          window.__shuffleTimers.delete(id);
          handler(...args);
        }, delay);
        window.__shuffleTimers.add(id);
        return id;
      };
      window.clearTimeout = (id) => {
        if (id !== undefined) window.__shuffleTimers.delete(id);
        cancel(id);
      };
    });
  });

  test("shuffle indicator is decorative, opacity-only, responsive and reduced-motion aware", async ({ page, pageErrors }) => {
    const selector = page.getByLabel("Visual environment");
    const icon = page.locator(".theme-selector__shuffle-icon");
    await expect(icon).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const width of [1200, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const mode of SHUFFLE_MODES) {
        await selector.selectOption(mode.id);
        await expect(selector).toHaveValue(mode.id);
        await expect(icon).toBeVisible();
        await expect(icon).toHaveAttribute("aria-hidden", "true");
        await expect(icon).toHaveAttribute("focusable", "false");
        const layout = await icon.evaluate((element) => {
          const select = element.parentElement!.querySelector("select")!;
          const box = element.getBoundingClientRect();
          const selectBox = select.getBoundingClientRect();
          const style = getComputedStyle(element);
          const selectStyle = getComputedStyle(select);
          return {
            color: style.color,
            animation: style.animationName,
            duration: style.animationDuration,
            opacityFrames: element.getAnimations()[0].effect!.getKeyframes().map((frame) => ({
              offset: frame.offset,
              opacity: frame.opacity,
            })),
            pointerEvents: style.pointerEvents,
            hitIsSelect: document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === select,
            labelRight: selectBox.right - parseFloat(selectStyle.paddingRight),
            iconLeft: box.left,
            iconRight: box.right,
            chevronLeft: selectBox.right - 14 - 12,
            keyframes: element.getAnimations()[0].effect!.getKeyframes().map((frame) =>
              Object.keys(frame).filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key)),
            ),
          };
        });
        expect(layout.color).toBe("rgb(156, 255, 87)");
        expect(layout.animation).toBe("theme-selector-shuffle-breathe");
        expect(layout.duration).toBe("2.5s");
        expect(layout.opacityFrames).toEqual([
          { offset: 0, opacity: "1" },
          { offset: 0.15, opacity: "1" },
          { offset: 0.6, opacity: "0.15" },
          { offset: 1, opacity: "1" },
        ]);
        expect(layout.pointerEvents).toBe("none");
        expect(layout.hitIsSelect).toBe(true);
        expect(layout.labelRight).toBeLessThan(layout.iconLeft);
        expect(layout.iconRight).toBeLessThan(layout.chevronLeft);
        expect(layout.keyframes.every((keys) => keys.length === 1 && keys[0] === "opacity")).toBe(true);
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(icon).toHaveCSS("animation-name", "none");
    await expect(icon).toHaveCSS("opacity", "1");
    await selector.focus();
    await expect(selector).toBeFocused();
    await selector.press("End");
    await selector.press("Enter");
    await expect(selector).toHaveValue("toxic-horizon");
    await expect(icon).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("branded environments remain manually selectable after disabling active shuffle", async ({ page, pageErrors }) => {
    const selector = page.getByLabel("Visual environment");
    for (const id of ["psybrazil", "deep-signals"]) {
      await selector.selectOption("shuffle-depth");
      await selector.selectOption(id);
      await expect(selector).toHaveValue(id);
      await expect(page.locator(".player-shell")).toHaveAttribute("data-theme", id);
      await expect(page.locator(".player-shell__scene canvas")).toHaveCount(1);
      await page.clock.fastForward(20 * MINUTE);
      await expect(page.locator(".player-shell")).toHaveAttribute("data-theme", id);
    }
    expect(pageErrors).toEqual([]);
  });

  test("dropdown retains shuffle mode across automatic changes and audio is untouched", async ({ page, pageErrors }) => {
    const selector = page.getByLabel("Visual environment");
    await expect(selector.locator("optgroup").first()).toHaveAttribute("label", "SHUFFLE MODES");
    for (const mode of SHUFFLE_MODES) {
      await expect(selector.locator(`option[value="${mode.id}"]`)).toHaveText(mode.name);
    }
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await selector.selectOption("shuffle-all");
    const initial = await page.locator(".player-shell").getAttribute("data-theme");
    const before = await readAudio(page);
    await page.clock.fastForward(2 * MINUTE);
    await page.route(API, (route) => route.fulfill({ json: payload("Second Track") }));
    await page.clock.fastForward(10_000);
    await expect(page.locator(".track-marquee__live")).toHaveText("Artist \u2014 Second Track");
    await expect(page.locator(".player-shell")).not.toHaveAttribute("data-theme", initial!);
    await expect(selector).toHaveValue("shuffle-all");
    const after = await readAudio(page);
    expect(after.elementCount).toBe(1);
    expect(after.sourceCount).toBe(before.sourceCount);
    expect(after.analyserCount).toBe(before.analyserCount);
    expect(after.assignments).toEqual(before.assignments);
    expect(after.paused).toBe(false);
    expect(after.error).toBeNull();
    expect(after.currentTime).toBeGreaterThanOrEqual(before.currentTime);
    await expect(page.locator(".player-shell__scene")).toHaveCount(1);
    await selector.selectOption("minimal");
    await expect(selector).toHaveValue("minimal");
    await expect(page.locator(".player-shell")).toHaveAttribute("data-theme", "minimal");
    expect(await page.evaluate(() => window.__shuffleTimers.size)).toBe(0);
    await page.clock.fastForward(20 * MINUTE);
    await expect(page.locator(".player-shell")).toHaveAttribute("data-theme", "minimal");
    expect(pageErrors).toEqual([]);
  });

  test("fallback has one timer, pauses without elapsed time, and cleans up on manual selection", async ({ page, pageErrors }) => {
    await page.getByLabel("Visual environment").selectOption("shuffle-all");
    expect(await page.evaluate(() => window.__shuffleTimers.size)).toBe(0);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__shuffleTimers.size)).toBe(1);
    const initial = await page.locator(".player-shell").getAttribute("data-theme");
    await page.clock.fastForward(4 * MINUTE);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__shuffleTimers.size)).toBe(0);
    await page.clock.fastForward(30 * MINUTE);
    await expect(page.locator(".player-shell")).toHaveAttribute("data-theme", initial!);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__shuffleTimers.size)).toBe(1);
    await page.clock.fastForward(5 * MINUTE);
    await expect(page.locator(".player-shell")).toHaveAttribute("data-theme", initial!);
    await page.clock.fastForward(MINUTE + 1_000);
    await expect(page.locator(".player-shell")).not.toHaveAttribute("data-theme", initial!);
    await expect(page.getByLabel("Visual environment")).toHaveValue("shuffle-all");
    expect(await page.evaluate(() => window.__shuffleTimers.size)).toBe(1);
    await page.getByLabel("Visual environment").selectOption("minimal");
    expect(await page.evaluate(() => window.__shuffleTimers.size)).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test("station changes keep the environment, suppress initial metadata, and restart fallback", async ({ page, pageErrors }) => {
    await page.route(TRIPLAG_API, (route) => route.fulfill({ json: payload("New station baseline", TRIPLAG_STREAM) }));
    await page.route(`${TRIPLAG_STREAM}*`, (route) => route.fulfill({
      path: "public\\audio\\demo\\illustrator-psychedelic-experience.mp3",
      headers: { "Access-Control-Allow-Origin": "*" },
    }));
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByLabel("Visual environment").selectOption("shuffle-depth");
    const initial = await page.locator(".player-shell").getAttribute("data-theme");
    await page.clock.fastForward(9 * MINUTE);
    await page.getByLabel("Signal source").selectOption("triplag-darkpsy");
    await expect(page.locator(".track-marquee__live")).toHaveText("Artist \u2014 New station baseline");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect(page.locator(".player-shell")).toHaveAttribute("data-theme", initial!);
    await expect(page.getByLabel("Visual environment")).toHaveValue("shuffle-depth");
    await page.clock.fastForward(2 * MINUTE);
    await expect(page.locator(".player-shell")).toHaveAttribute("data-theme", initial!);
    await page.route(TRIPLAG_API, (route) => route.fulfill({ json: payload("Actual next track", TRIPLAG_STREAM) }));
    await page.clock.fastForward(20_000);
    await expect(page.locator(".track-marquee__live")).toHaveText("Artist \u2014 Actual next track");
    await expect(page.locator(".player-shell")).not.toHaveAttribute("data-theme", initial!);
    expect(pageErrors).toEqual([]);
  });

  test("artwork and duplicate or blank metadata do not cause visual transitions", async ({ page, pageErrors }) => {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByLabel("Visual environment").selectOption("shuffle-all");
    const initial = await page.locator(".player-shell").getAttribute("data-theme");
    await page.clock.fastForward(2 * MINUTE);
    for (const title of ["First Track", "", "First Track"]) {
      await page.route(API, (route) => route.fulfill({ json: payload(title, STREAM, "https://example.com/art.png") }));
      await page.route("https://example.com/art.png", (route) => route.fulfill({ status: 404 }));
      await page.clock.fastForward(10_000);
      await expect(page.locator(".player-shell")).toHaveAttribute("data-theme", initial!);
    }
    expect(pageErrors).toEqual([]);
  });
});
