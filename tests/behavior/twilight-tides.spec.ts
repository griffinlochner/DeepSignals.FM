import type { Page } from "@playwright/test";
import { Color, PerspectiveCamera, Vector3 } from "three";
import { test, expect } from "../support/test";
import { createTwilightState, twilightQuality, updateTwilightState, twilightMusicEnergy, TWILIGHT_METEOR_PATHS, TWILIGHT_PALETTE_SECONDS, TWILIGHT_FIRST_METEOR_SECONDS } from "../../src/themes/twilight-tides/twilightRuntime";
import { createTwilightPalette, updateTwilightPalette, TWILIGHT_SUN, TWILIGHT_ALIEN_SUN } from "../../src/themes/twilight-tides/twilightSky";
import type { RuntimeTestSnapshot } from "../../src/app/runtimeTestBridge";
import { TWILIGHT_SURGE, twilightSurgeEnvelope } from "../../src/themes/twilight-tides/twilightSurge";

const playing = { isPlaying: true, motionEnabled: true, reducedMotion: false };
const loud = { isActive: true, smoothedEnergy: 1 };

function advanceTwilight(state: ReturnType<typeof createTwilightState>, seconds: number,
  snapshot = { ...loud, kickPulseAcceptedEventSequence: 0 }, controls = playing) {
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) updateTwilightState(state, 1 / 60, controls, snapshot);
}

function startSolarSurge() {
  const state = createTwilightState();
  advanceTwilight(state, 0.6, { ...loud, smoothedEnergy: 0.2, kickPulseAcceptedEventSequence: 7 });
  expect(state.surge.qualification.armed).toBe(true);
  advanceTwilight(state, 0.1, { ...loud, kickPulseAcceptedEventSequence: 8 });
  expect(state.surge.count).toBe(1);
  return state;
}

test("Twilight Tides SURGE uses shared qualification, lasts 3.2 seconds and blooms both suns to 1.5x", () => {
  const unarmed = createTwilightState();
  advanceTwilight(unarmed, 5);
  expect(unarmed.surge.count).toBe(0);
  const state = startSolarSurge();
  expect(state.surge.qualification.lastTriggeredSequence).toBe(8);
  advanceTwilight(state, 0.6);
  expect(state.surge.envelope).toBe(1);
  expect(state.surge.scale).toBe(1.5);
  // A fresh shared trigger inside the local envelope cannot restart or stack the effect.
  advanceTwilight(state, 1.1, { ...loud, smoothedEnergy: 0.2, kickPulseAcceptedEventSequence: 9 });
  advanceTwilight(state, 0.1, { ...loud, kickPulseAcceptedEventSequence: 10 });
  expect(state.surge.count).toBe(1);
  advanceTwilight(state, 1.6);
  expect(state.surge.ageSeconds).toBe(TWILIGHT_SURGE.durationSeconds);
  expect(state.surge.envelope).toBe(0);
  expect(state.surge.scale).toBe(1);
  advanceTwilight(state, 4);
  expect(state.surge.count).toBe(1);
  advanceTwilight(state, 0.6, { ...loud, smoothedEnergy: 0.2, kickPulseAcceptedEventSequence: 11 });
  advanceTwilight(state, 0.1, { ...loud, kickPulseAcceptedEventSequence: 12 });
  expect(state.surge.count).toBe(2);
  for (const age of [-1, 0, 3.2, Infinity]) expect(twilightSurgeEnvelope(age)).toBe(0);
  expect(twilightSurgeEnvelope(0.55)).toBe(1);
  expect(twilightSurgeEnvelope(1.45)).toBe(1);
  for (let frame = 1; frame <= 192; frame++) {
    expect(Math.abs(twilightSurgeEnvelope(frame / 60) - twilightSurgeEnvelope((frame - 1) / 60))).toBeLessThan(0.046);
  }
});

test("Twilight Tides SURGE freezes every kinetic gate, resets arming and ignores invalid analysis", () => {
  for (const controls of [{ ...playing, isPlaying: false }, { ...playing, motionEnabled: false }, { ...playing, reducedMotion: true }]) {
    const state = startSolarSurge();
    advanceTwilight(state, 0.7);
    const before = structuredClone(state.surge);
    advanceTwilight(state, 4, { ...loud, kickPulseAcceptedEventSequence: 8 }, controls);
    expect(state.surge).toEqual(before);
    advanceTwilight(state, 0.5);
    expect(state.surge.ageSeconds).toBeCloseTo(before.ageSeconds + 0.5, 8);
    const armed = createTwilightState();
    advanceTwilight(armed, 0.6, { ...loud, smoothedEnergy: 0.2, kickPulseAcceptedEventSequence: 1 });
    expect(armed.surge.qualification.armed).toBe(true);
    advanceTwilight(armed, 0.1, { ...loud, kickPulseAcceptedEventSequence: 2 }, controls);
    expect(armed.surge.qualification.armed).toBe(false);
    advanceTwilight(armed, 0.2);
    expect(armed.surge.count).toBe(0);
  }
  for (const snapshot of [null, undefined, { ...loud, isActive: false }, { ...loud, smoothedEnergy: NaN }, { ...loud, smoothedEnergy: Infinity }]) {
    const state = createTwilightState();
    advanceTwilight(state, 0.6, { ...loud, smoothedEnergy: 0.2, kickPulseAcceptedEventSequence: 0 });
    updateTwilightState(state, 1 / 60, playing, snapshot);
    advanceTwilight(state, 0.2);
    expect(state.surge.count).toBe(0);
  }
  for (const chromaEnabled of [false, true]) {
    const state = createTwilightState();
    for (let frame = 0; frame < 80; frame++) {
      updateTwilightState(state, 1 / 60, { ...playing, chromaEnabled },
        { ...loud, smoothedEnergy: frame < 36 ? 0.2 : 1 });
    }
    expect(state.surge.scale).toBe(1.5);
  }
});

test("Twilight Tides SURGE timing is energy-independent and does not drive baseline systems", () => {
  const states = [30, 60, 120].map((fps) => {
    const state = createTwilightState();
    for (let frame = 0; frame < fps * 4; frame++) {
      updateTwilightState(state, 1 / fps, playing, { ...loud, smoothedEnergy: frame < fps * 0.6 ? 0.2 : 1 });
    }
    expect(state.surge.count).toBe(1);
    expect(state.surge.envelope).toBe(0);
    return state;
  });
  expect(Math.max(...states.map((state) => state.surge.startedAt)) - Math.min(...states.map((state) => state.surge.startedAt))).toBeLessThan(70);
  const surge = startSolarSurge();
  const baseline = { ...structuredClone(surge), surge: createTwilightState().surge };
  for (let frame = 0; frame < 240; frame++) {
    updateTwilightState(surge, 1 / 60, playing, loud);
    updateTwilightState(baseline, 1 / 60, playing, loud);
    expect({ ...surge, surge: null }).toEqual({ ...baseline, surge: null });
  }
});

declare global {
  interface Window {
    __TWILIGHT_RENDER_INPUTS__?: Record<string, number | number[]>;
    __TWILIGHT_RESOURCES__: {
      frames: Set<number>;
      buffers: Map<WebGLBuffer, WebGL2RenderingContext>;
      textures: Map<WebGLTexture, WebGL2RenderingContext>;
      programs: Map<WebGLProgram, WebGL2RenderingContext>;
      framebuffers: Map<WebGLFramebuffer, WebGL2RenderingContext>;
    };
  }
}

test("Twilight Tides smooths energy without beat pumping and retains ambient motion at silence", () => {
  const state = createTwilightState();
  updateTwilightState(state, 1 / 60, playing, loud);
  expect(state.waterEnergy).toBeGreaterThan(0);
  expect(state.waterEnergy).toBeLessThan(0.04);
  for (let frame = 0; frame < 300; frame++) updateTwilightState(state, 1 / 60, playing, loud);
  expect(state.waterEnergy).toBeGreaterThan(0.99);
  expect(state.time).toBeGreaterThan(5.2);
  expect(state.time).toBeLessThan(5.4);
  for (const snapshot of [undefined, null, { ...loud, isActive: false }, { ...loud, smoothedEnergy: NaN }, { ...loud, smoothedEnergy: 0 }]) {
    const before = state.time;
    for (let frame = 0; frame < 600; frame++) updateTwilightState(state, 1 / 60, playing, snapshot);
    expect(state.waterEnergy).toBeLessThan(0.001);
    expect(state.time - before).toBeGreaterThan(0.44);
    expect(state.time - before).toBeLessThan(1.15);
    expect(Number.isFinite(state.time)).toBe(true);
  }
});

test("Twilight Tides freezes kinetic state with every gate, bounds deltas and preserves independent color", () => {
  for (const controls of [
    { ...playing, isPlaying: false },
    { ...playing, motionEnabled: false },
    { ...playing, reducedMotion: true },
  ]) {
    const state = createTwilightState();
    for (let frame = 0; frame < (TWILIGHT_FIRST_METEOR_SECONDS + 0.5) * 60; frame++) {
      updateTwilightState(state, 1 / 60, playing, { ...loud, bass: 0.6, mids: 0.7, highs: 0.8, kickPulse: 0.5 });
    }
    expect(state.meteorCount).toBe(1);
    expect(state.meteorProgress).toBeLessThan(1);
    const before = { ...state };
    for (let frame = 0; frame < 90; frame++) updateTwilightState(state, 1 / 60, controls, { ...loud, smoothedEnergy: 0.1, bass: 0.3 });
    expect(state.time).toBe(before.time);
    expect(state.skyTime).toBe(before.skyTime);
    expect(state.paletteTime).toBe(before.paletteTime);
    expect(state.meteorCount).toBe(before.meteorCount);
    expect(state.meteorProgress).toBe(before.meteorProgress);
    expect(state.meteorWait).toBe(before.meteorWait);
    expect(state.waterEnergy).toBe(before.waterEnergy);
    expect(state.auroraBass).toBe(before.auroraBass);
    expect(state.auroraMids).toBe(before.auroraMids);
    expect(state.auroraHighs).toBe(before.auroraHighs);
    if (controls.isPlaying) expect(state.colorEnergy).toBeLessThan(before.colorEnergy);
    else expect(state).toEqual(before);
    updateTwilightState(state, 100, playing, loud);
    expect(state.time - before.time).toBeLessThanOrEqual(0.05 * 1.145 + 1e-10);
    const resumed = { ...state };
    for (const delta of [NaN, Infinity, -1]) updateTwilightState(state, delta, playing, loud);
    expect(state).toEqual(resumed);
  }
  const at30 = createTwilightState();
  const at120 = createTwilightState();
  for (let i = 0; i < 150; i++) updateTwilightState(at30, 1 / 30, playing, loud);
  for (let i = 0; i < 600; i++) updateTwilightState(at120, 1 / 120, playing, loud);
  expect(at30.waterEnergy).toBeCloseTo(at120.waterEnergy, 10);
  expect(at30.time).toBeCloseTo(at120.time, 2);
});

test("Twilight Tides maps ordinary music into a visible range without amplifying silence or invalid bands", () => {
  expect(twilightMusicEnergy({ ...loud, smoothedEnergy: 0.01 })).toBe(0);
  expect(twilightMusicEnergy({ ...loud, smoothedEnergy: 0.1 })).toBeGreaterThan(0.25);
  expect(twilightMusicEnergy({ ...loud, smoothedEnergy: 0.3 })).toBeGreaterThan(0.65);
  expect(twilightMusicEnergy({ ...loud, smoothedEnergy: 0.5 })).toBe(1);
  for (const value of [NaN, Infinity, -Infinity, -1]) expect(twilightMusicEnergy({ ...loud, smoothedEnergy: value })).toBe(0);
  const quiet = createTwilightState();
  const music = createTwilightState();
  for (let frame = 0; frame < 600; frame++) {
    updateTwilightState(quiet, 1 / 60, playing, { ...loud, smoothedEnergy: 0, bass: 1, highs: 1 });
    updateTwilightState(music, 1 / 60, playing, { ...loud, smoothedEnergy: 0.3, bass: 0.7, highs: 0.4 });
  }
  expect(music.time).toBeGreaterThan(quiet.time * 12);
  expect(music.skyTime).toBeGreaterThan(quiet.skyTime * 9);
  expect(music.glintEnergy).toBeGreaterThan(0.45);
  expect(quiet.glintEnergy).toBe(0);
  const noBands = createTwilightState();
  updateTwilightState(noBands, 0.05, playing, { ...loud, bass: NaN, highs: Infinity });
  expect(noBands.glintEnergy).toBe(0);
});

test("Twilight Tides schedules a light meteor shower with occasional pairs, quiet gaps and silence gates", () => {
  const state = createTwilightState();
  let previousCount = 0;
  let lastStarted = -Infinity;
  let progressInBounds = true;
  let activeFrames = 0;
  let closePairs = 0;
  for (let frame = 0; frame < 60 * 240; frame++) {
    updateTwilightState(state, 1 / 60, playing, loud);
    progressInBounds &&= state.meteorProgress >= 0 && state.meteorProgress <= 1;
    if (state.meteorProgress < 1) activeFrames++;
    if (state.meteorCount !== previousCount) {
      if (previousCount === 0) {
        expect(frame / 60).toBeCloseTo(8, 1);
      } else {
        const interval = frame / 60 - lastStarted;
        expect(interval).toBeGreaterThanOrEqual(4.6);
        expect(interval).toBeLessThan(18);
        if (interval < 6) closePairs++;
        else expect(interval).toBeGreaterThanOrEqual(9.8);
      }
      lastStarted = frame / 60;
      previousCount = state.meteorCount;
    }
    expect(progressInBounds).toBe(true);
  }
  expect(state.meteorCount).toBeGreaterThanOrEqual(19);
  expect(state.meteorCount).toBeLessThanOrEqual(23);
  expect(closePairs).toBeGreaterThanOrEqual(4);
  expect(activeFrames / (60 * 240)).toBeLessThan(0.18);
  for (const chromaEnabled of [true, false]) {
    const subdued = createTwilightState();
    for (let frame = 0; frame < 60 * 90; frame++) {
      updateTwilightState(subdued, 1 / 60, { ...playing, chromaEnabled }, chromaEnabled ? { ...loud, smoothedEnergy: 0 } : loud);
    }
    expect(subdued.meteorCount).toBe(0);
    if (!chromaEnabled) expect(subdued.paletteTime).toBe(0);
  }
  expect(TWILIGHT_ALIEN_SUN.x).toBeGreaterThan(TWILIGHT_SUN.x);
  expect(TWILIGHT_ALIEN_SUN.y).toBeGreaterThan(TWILIGHT_SUN.y);
  for (const [startX, startY, endX, endY] of TWILIGHT_METEOR_PATHS) {
    expect(Math.max(Math.abs(startX), Math.abs(endX))).toBeLessThan(0.22);
    expect(startY).toBeLessThan(0.4);
    expect(endY).toBeGreaterThan(0.25);
    expect(Math.hypot(startX - endX, startY - endY)).toBeLessThan(0.22);
  }
});

test("Twilight Tides confines Kick accents to the aurora, not water, clouds, suns or meteors", () => {
  const kick = createTwilightState();
  const steady = createTwilightState();
  for (const controls of [playing, { ...playing, motionEnabled: false }, { ...playing, reducedMotion: true }, { ...playing, isPlaying: false }]) {
    for (let frame = 0; frame < 120; frame++) {
      const snapshot = { ...loud, kickPulse: [0, 1, NaN, Infinity, -1][frame % 5] };
      updateTwilightState(kick, 1 / 60, controls, snapshot);
      updateTwilightState(steady, 1 / 60, controls, loud);
      expect({ ...kick, auroraBass: 0 }).toEqual({ ...steady, auroraBass: 0 });
    }
  }
  expect(kick.auroraBass).toBeGreaterThan(0.1);
  expect(steady.auroraBass).toBe(0);
});

test("Twilight Tides aurora bands are smooth, bounded, independent and frame-rate independent", () => {
  for (const [band, field] of [
    ["bass", "auroraBass"], ["bassPulse", "auroraBass"], ["kickPulse", "auroraBass"],
    ["mids", "auroraMids"], ["highs", "auroraHighs"], ["transient", "auroraHighs"],
  ] as const) {
    const state = createTwilightState();
    updateTwilightState(state, 1 / 60, playing, { ...loud, [band]: 1 });
    expect(state[field]).toBeGreaterThan(0.02);
    expect(state[field]).toBeLessThan(0.15);
    for (let frame = 0; frame < 180; frame++) updateTwilightState(state, 1 / 60, playing, { ...loud, [band]: 1 });
    expect(state[field]).toBeGreaterThan(0.3);
    expect(state[field]).toBeLessThanOrEqual(1);
    for (const other of ["auroraBass", "auroraMids", "auroraHighs"] as const) {
      if (other !== field) expect(state[other]).toBe(0);
    }
    const peak = state[field];
    updateTwilightState(state, 1 / 60, playing, null);
    expect(state[field]).toBeGreaterThan(peak * 0.94);
    expect(state[field]).toBeLessThan(peak);
  }
  const bands = { bass: 0.6, kickPulse: 0.9, bassPulse: 0.7, mids: 0.5, highs: 0.8, transient: 0.4 };
  const at30 = createTwilightState();
  const at120 = createTwilightState();
  for (let i = 0; i < 150; i++) updateTwilightState(at30, 1 / 30, playing, { ...loud, ...bands });
  for (let i = 0; i < 600; i++) updateTwilightState(at120, 1 / 120, playing, { ...loud, ...bands });
  for (const field of ["auroraBass", "auroraMids", "auroraHighs"] as const) expect(at30[field]).toBeCloseTo(at120[field], 10);
  for (const snapshot of [undefined, null, { ...loud, ...bands, isActive: false },
    { ...loud, ...bands, smoothedEnergy: 0 }, { ...loud, ...bands, smoothedEnergy: NaN },
    { ...loud, bass: NaN, kickPulse: Infinity, bassPulse: -1, mids: -Infinity, highs: NaN, transient: Infinity }]) {
    const state = { ...at30 };
    for (let frame = 0; frame < 600; frame++) updateTwilightState(state, 1 / 60, playing, snapshot);
    for (const field of ["auroraBass", "auroraMids", "auroraHighs"] as const) {
      expect(Number.isFinite(state[field])).toBe(true);
      expect(state[field]).toBeLessThan(0.0001);
    }
  }
});

test("Twilight Tides reuses palette colors with slow continuous interpolation and a seamless loop", () => {
  const palette = createTwilightPalette();
  const initial = createTwilightPalette();
  const references = { ...palette };
  let previous = paletteInputs(0);
  for (let second = 1; second <= 300; second++) {
    updateTwilightPalette(palette, second / 300);
    for (const [key, color] of Object.entries(palette)) {
      expect(color).toBe(references[key as keyof typeof references]);
      const channels = color.toArray();
      expect(Math.max(...channels.map((channel, i) => Math.abs(channel - previous[key][i])))).toBeLessThan(0.024);
    }
    for (const sun of [palette.sunColor, palette.alienSunColor]) {
      const channels = sun.toArray();
      expect((Math.max(...channels) - Math.min(...channels)) / Math.max(...channels)).toBeGreaterThan(0.68);
    }
    previous = paletteInputs(second / 300);
  }
  expect(palette).toEqual(initial);
});

test("Twilight Tides palette takes five eligible minutes at any energy and freezes with CHROMA off", () => {
  expect(TWILIGHT_PALETTE_SECONDS).toBe(300);
  for (const snapshot of [loud, { ...loud, smoothedEnergy: 0.1 }, undefined]) {
    const state = createTwilightState();
    expect(state.paletteTime).toBe(0);
    for (let quarter = 1; quarter <= 4; quarter++) {
      for (let frame = 0; frame < 75 * 60; frame++) updateTwilightState(state, 1 / 60, playing, snapshot);
      if (quarter < 4) expect(state.paletteTime).toBeCloseTo(quarter * 75, 6);
      else expect(Math.min(state.paletteTime, 300 - state.paletteTime)).toBeLessThan(0.000001);
    }
    const before = state.paletteTime;
    for (let frame = 0; frame < 300; frame++) updateTwilightState(state, 1 / 60, { ...playing, chromaEnabled: false }, loud);
    expect(state.paletteTime).toBe(before);
  }
});

test("Twilight Tides quality bounds desktop, mobile and high-DPR drawing buffers", () => {
  for (const [width, height, dpr, constrained] of [
    [1440, 900, 2, false], [390, 844, 3, true], [3840, 2160, 3, false], [900, 600, 2, true],
  ] as const) {
    const quality = twilightQuality(width, height, dpr, constrained);
    const compact = constrained || Math.min(width, height) < 600;
    expect(width * height * quality.pixelRatio ** 2).toBeLessThanOrEqual((compact ? 1_100_000 : 2_600_000) + 1);
    expect(quality.pixelRatio).toBeLessThanOrEqual(compact ? 1.25 : 1.6);
    expect(quality.reflectionSize).toBe(compact ? 128 : 256);
    expect(quality.columns * quality.rows * 2).toBeLessThanOrEqual(32_256);
  }
});

async function runtime(page: Page): Promise<RuntimeTestSnapshot> {
  return page.evaluate(() => window.__DSFM_TEST__!);
}

async function canvasPixels(page: Page) {
  return page.getByLabel("Twilight Tides canvas").evaluate((element) =>
    new Promise<{ hash: number; sky: number; water: number; colors: number; greenSky: number; greenWater: number }>((resolve) => {
      requestAnimationFrame(() => {
        const sample = document.createElement("canvas");
        sample.width = 160;
        sample.height = 100;
        const context = sample.getContext("2d")!;
        context.drawImage(element as HTMLCanvasElement, 0, 0, 160, 100);
        const pixels = context.getImageData(0, 0, 160, 100).data;
        let hash = 0;
        let sky = 0;
        let water = 0;
        let greenSky = 0;
        let greenWater = 0;
        const colors = new Set<number>();
        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          hash = (Math.imul(hash, 31) + red + green * 3 + blue * 7) | 0;
          if (index < pixels.length * 0.4) sky += red + green + blue;
          if (index > pixels.length * 0.5) water += red + green + blue;
          if (green > 70 && green > red * 1.4 && green > blue * 1.2) {
            if (index < pixels.length * 0.44) greenSky++;
            if (index > pixels.length * 0.5) greenWater++;
          }
          colors.add((red << 16) | (green << 8) | blue);
        }
        resolve({ hash, sky, water, colors: colors.size, greenSky, greenWater });
      });
    }),
  );
}

async function visibleMotion(page: Page) {
  return page.getByLabel("Twilight Tides canvas").evaluate((element) => new Promise<number>((resolve) => {
    const sample = document.createElement("canvas");
    sample.width = 160;
    sample.height = 100;
    const context = sample.getContext("2d")!;
    requestAnimationFrame(() => {
      context.drawImage(element as HTMLCanvasElement, 0, 0, 160, 100);
      const before = context.getImageData(0, 0, 160, 100).data;
      setTimeout(() => requestAnimationFrame(() => {
        context.drawImage(element as HTMLCanvasElement, 0, 0, 160, 100);
        const after = context.getImageData(0, 0, 160, 100).data;
        let difference = 0;
        for (let index = 160 * 50 * 4; index < after.length; index += 4) {
          difference += Math.abs(after[index] - before[index]) + Math.abs(after[index + 1] - before[index + 1]) + Math.abs(after[index + 2] - before[index + 2]);
        }
        resolve(difference / (160 * 50 * 3));
      }), 350);
    });
  }));
}

async function sceneColors(page: Page) {
  const viewport = page.viewportSize()!;
  const camera = new PerspectiveCamera(55, viewport.width / viewport.height, 0.5, 16000);
  camera.position.set(0, 6, 0);
  camera.lookAt(0, -3, -140);
  camera.updateMatrixWorld();
  const project = (direction: Vector3) => {
    const point = direction.clone().multiplyScalar(10000).add(camera.position).project(camera);
    return { x: (point.x + 1) / 2, y: (1 - point.y) / 2 };
  };
  return page.getByLabel("Twilight Tides canvas").evaluate((element, points) => new Promise<{
    suns: number[][]; horizonContrast: number; seamContrast: number; whitePixels: number;
    sky: number[]; water: number[]; upperSky: number[]; sunSurroundings: number[][]; sunProfiles: number[][][];
  }>((resolve) => requestAnimationFrame(() => {
    const canvas = element as HTMLCanvasElement;
    const sample = document.createElement("canvas");
    sample.width = canvas.width;
    sample.height = canvas.height;
    const context = sample.getContext("2d")!;
    context.drawImage(canvas, 0, 0);
    const { data } = context.getImageData(0, 0, sample.width, sample.height);
    const pixel = (x: number, y: number) => {
      const offset = (Math.floor(y * sample.height) * sample.width + Math.floor(x * sample.width)) * 4;
      return [data[offset], data[offset + 1], data[offset + 2]];
    };
    const difference = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / 3;
    let horizonContrast = 0;
    let seamContrast = 0;
    let whitePixels = 0;
    const horizonRow = Math.round(points.horizon.y * sample.height);
    for (let row = horizonRow - 1; row < horizonRow + sample.height * 0.009; row++) {
      for (const sun of points.suns) {
        const center = pixel(sun.x, row / sample.height);
        const neighbors = pixel(sun.x - 0.045, row / sample.height).map((v, i) => (v + pixel(sun.x + 0.045, row / sample.height)[i]) / 2);
        horizonContrast = Math.max(horizonContrast, difference(center, neighbors));
      }
      for (let x = 0.1; x < 0.9; x += 0.01) {
        const color = pixel(x, row / sample.height);
        if (Math.min(...color) > 220) whitePixels++;
        if (row <= horizonRow + 1) seamContrast = Math.max(seamContrast, difference(color, pixel(x, (row - 1) / sample.height)));
      }
    }
    const region = (startY: number, endY: number) => {
      const sums = [0, 0, 0];
      let count = 0;
      for (let y = startY; y < endY; y += 0.01) {
        for (let x = 0.1; x < 0.9; x += 0.01) {
          const color = pixel(x, y);
          color.forEach((value, i) => { sums[i] += value; });
          count++;
        }
      }
      return sums.map((value) => value / count);
    };
    resolve({ suns: points.suns.map((sun) => pixel(sun.x, sun.y)), horizonContrast, seamContrast, whitePixels,
      sunSurroundings: points.surroundings.map((ring) => ring.reduce((sum, point) =>
        pixel(point.x, point.y).map((v, i) => sum[i] + v / ring.length), [0, 0, 0])),
      sunProfiles: points.profiles.map((profile) => profile.map((point) => pixel(point.x, point.y))),
      sky: region(0.25, 0.4), water: region(0.5, 0.75), upperSky: region(0, 0.1) });
  })), {
    suns: [project(TWILIGHT_SUN), project(TWILIGHT_ALIEN_SUN)], horizon: project(new Vector3(0, 0, -1)),
    surroundings: [TWILIGHT_SUN, TWILIGHT_ALIEN_SUN].map((sun, i) => [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) =>
      project(sun.clone().add(new Vector3(Math.cos(angle), Math.sin(angle), 0).multiplyScalar((i ? 0.032 : 0.017) * 2)).normalize()))),
    profiles: [TWILIGHT_SUN, TWILIGHT_ALIEN_SUN].map((sun, i) => [0, 0.5, 0.85, 1, 1.15, 1.5].map((radius) =>
      project(sun.clone().add(new Vector3((i ? 0.032 : 0.017) * radius, 0, 0)).normalize()))),
  });
}

function paletteInputs(phase: number) {
  const palette = createTwilightPalette();
  updateTwilightPalette(palette, phase);
  return Object.fromEntries(Object.entries(palette).map(([key, color]) => [key, color.toArray()]));
}

function colorDifference(a: number[], b: number[]) {
  return a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / 3;
}

async function renderedImage(page: Page) {
  return page.getByLabel("Twilight Tides canvas").evaluate((element) => new Promise<number[]>((resolve) => {
    requestAnimationFrame(() => {
      const sample = document.createElement("canvas");
      sample.width = 160;
      sample.height = 100;
      const context = sample.getContext("2d")!;
      context.drawImage(element as HTMLCanvasElement, 0, 0, 160, 100);
      resolve(Array.from(context.getImageData(0, 0, 160, 100).data));
    });
  }));
}

async function solarRadialProfiles(page: Page) {
  const viewport = page.viewportSize()!;
  const camera = new PerspectiveCamera(55, viewport.width / viewport.height, 0.5, 16000);
  camera.position.set(0, 6, 0);
  camera.lookAt(0, -3, -140);
  camera.updateMatrixWorld();
  const points = [TWILIGHT_SUN, TWILIGHT_ALIEN_SUN].map((sun, index) => {
    const right = new Vector3().crossVectors(sun, new Vector3(0, 1, 0)).normalize();
    return Array.from({ length: 81 }, (_, step) => {
      const angle = step / 40 * (index ? 0.032 : 0.017);
      const point = sun.clone().multiplyScalar(Math.cos(angle)).addScaledVector(right, Math.sin(angle))
        .multiplyScalar(10000).add(camera.position).project(camera);
      return { x: (point.x + 1) / 2, y: (1 - point.y) / 2 };
    });
  });
  return page.getByLabel("Twilight Tides canvas").evaluate((element, suns) => new Promise<number[][][]>((resolve) => {
    requestAnimationFrame(() => {
      const canvas = element as HTMLCanvasElement;
      const sample = document.createElement("canvas");
      sample.width = canvas.width;
      sample.height = canvas.height;
      const context = sample.getContext("2d")!;
      context.drawImage(canvas, 0, 0);
      const { data } = context.getImageData(0, 0, sample.width, sample.height);
      resolve(suns.map((points) => points.map(({ x, y }) => {
        const offset = (Math.floor(y * sample.height) * sample.width + Math.floor(x * sample.width)) * 4;
        return [data[offset], data[offset + 1], data[offset + 2]];
      })));
    });
  }), points);
}

function imageDifference(a: number[], b: number[], startRow: number, endRow: number) {
  let total = 0;
  let changed = 0;
  const count = 160 * (endRow - startRow);
  for (let pixel = 160 * startRow; pixel < 160 * endRow; pixel++) {
    const offset = pixel * 4;
    const difference = (Math.abs(a[offset] - b[offset]) + Math.abs(a[offset + 1] - b[offset + 1]) + Math.abs(a[offset + 2] - b[offset + 2])) / 3;
    total += difference;
    if (difference > 3) changed++;
  }
  return { mean: total / count, coverage: changed / count };
}

// Exercise the real compiled shaders at deterministic extrema without a production debug API.
async function setRenderedInputs(page: Page, inputs: Record<string, number | number[]>) {
  await page.evaluate((values) => {
    if (!window.__TWILIGHT_RENDER_INPUTS__) {
      const draw = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function (mode, count, type, offset) {
        const program: WebGLProgram | null = this.getParameter(this.CURRENT_PROGRAM);
        if (program) {
          for (const [name, value] of Object.entries(window.__TWILIGHT_RENDER_INPUTS__!)) {
            const location = this.getUniformLocation(program, name);
            if (location) {
              if (typeof value === "number") this.uniform1f(location, value);
              else this.uniform3fv(location, value);
            }
          }
        }
        draw.call(this, mode, count, type, offset);
      };
    }
    window.__TWILIGHT_RENDER_INPUTS__ = values;
  }, inputs);
}

async function renderedSkyClocks(page: Page) {
  return page.getByLabel("Twilight Tides canvas").evaluate((element) => new Promise<Record<string, number>>((resolve) => {
    requestAnimationFrame(() => {
      const gl = (element as HTMLCanvasElement).getContext("webgl2")!;
      const program: WebGLProgram | null = gl.getParameter(gl.CURRENT_PROGRAM);
      if (!program) throw new Error("Expected the rendered Twilight Tides water program");
      const values: Record<string, number> = {};
      for (const name of ["time", "skyTime", "waterEnergy", "meteorProgress", "auroraBass", "auroraMids", "auroraHighs", "solarSurge", "solarSurgeTime", "solarScale"]) {
        const location = gl.getUniformLocation(program, name);
        if (!location) throw new Error(`Missing rendered uniform: ${name}`);
        const value: unknown = gl.getUniform(program, location);
        if (typeof value !== "number") throw new Error(`Expected a numeric rendered uniform: ${name}`);
        values[name] = value;
      }
      resolve(values);
    });
  }));
}

async function renderedPalette(page: Page) {
  return page.getByLabel("Twilight Tides canvas").evaluate((element) => new Promise<Record<string, number[]>>((resolve) => {
    requestAnimationFrame(() => {
      const gl = (element as HTMLCanvasElement).getContext("webgl2")!;
      const program: WebGLProgram | null = gl.getParameter(gl.CURRENT_PROGRAM);
      if (!program) throw new Error("Expected the rendered Twilight Tides water program");
      const values: Record<string, number[]> = {};
      for (const name of ["lowSkyColor", "sunColor", "alienSunColor"]) {
        const location = gl.getUniformLocation(program, name);
        if (!location) throw new Error(`Missing rendered color: ${name}`);
        const value: unknown = gl.getUniform(program, location);
        if (!(value instanceof Float32Array)) throw new Error(`Expected a rendered color vector: ${name}`);
        values[name] = Array.from(value);
      }
      resolve(values);
    });
  }));
}

async function toggle(page: Page, name: "Chroma" | "Motion" | "Info") {
  await page.locator("label").filter({ hasText: new RegExp(`^${name}$`) }).click();
  await page.waitForTimeout(100);
}

test.describe("Twilight Tides player", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/player/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByLabel("Visual environment").selectOption("twilight-tides");
  });

  test("solar SURGE renders measured 1.5x discs, colorful curling ribbons and restrained reflections", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(60_000);
    const shaderMessages: string[] = [];
    page.on("console", (message) => {
      if (["warning", "error"].includes(message.type()) && /THREE|WebGL|shader/i.test(message.text())) shaderMessages.push(message.text());
    });
    await page.addInitScript(() => {
      const shaderSource = WebGL2RenderingContext.prototype.shaderSource;
      WebGL2RenderingContext.prototype.shaderSource = function (shader, source) {
        if (source.includes("vec3 celestialBody(")) {
          source = source.replace("uniform float solarSurge;", "uniform float testSolarVisibility;\nuniform float solarSurge;")
            .replace("float edge = max(fwidth(angle)", "visibility *= testSolarVisibility;\nfloat edge = max(fwidth(angle)");
        }
        shaderSource.call(this, shader, source);
      };
    });
    const measurements = [];
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.reload();
      const inputs = { time: 17, skyTime: 7, colorEnergy: 0.7, waterEnergy: 0.7, chroma: 1,
        solarSurge: 0, solarScale: 1, solarSurgeTime: 0, testSolarVisibility: 1 };
      await setRenderedInputs(page, inputs);
      const baseline = await renderedImage(page);
      const normalProfiles = await solarRadialProfiles(page);
      await setRenderedInputs(page, { ...inputs, testSolarVisibility: 0 });
      const absentProfiles = await solarRadialProfiles(page);
      await setRenderedInputs(page, { ...inputs, solarScale: 1.5 });
      const bloom = await renderedImage(page);
      const peakProfiles = await solarRadialProfiles(page);
      const sizes = [0, 1].map((sun) => {
        const radius = (profiles: number[][][]) => {
          const differences = profiles[sun].map((rgb, index) => colorDifference(rgb, absentProfiles[sun][index]));
          return differences.findIndex((difference) => difference < differences[0] * 0.5) / 40;
        };
        const normal = radius(normalProfiles);
        const peak = radius(peakProfiles);
        expect(normal).toBeGreaterThan(0.8);
        expect(peak / normal).toBeGreaterThan(1.4);
        expect(peak / normal).toBeLessThan(1.65);
        return { normal, peak, ratio: peak / normal };
      });
      const peakInputs = { ...inputs, solarScale: 1.5, solarSurge: 1, solarSurgeTime: 1.1 };
      await setRenderedInputs(page, peakInputs);
      const peak = await renderedImage(page);
      const ribbons = imageDifference(bloom, peak, 10, 43);
      const water = imageDifference(bloom, peak, 50, 100);
      expect(ribbons.mean).toBeGreaterThan(0.6);
      expect(ribbons.coverage).toBeGreaterThan(0.035);
      expect(water.mean).toBeGreaterThan(0.005);
      expect(water.mean).toBeLessThan(ribbons.mean * 0.5);
      expect(imageDifference(bloom, peak, 0, 9).mean).toBe(0);
      const colors = await sceneColors(page);
      expect(colors.horizonContrast).toBeLessThan(6);
      expect(colors.seamContrast).toBeLessThan(3);
      expect(colors.whitePixels).toBe(0);
      for (const rgb of colors.suns) {
        expect(new Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255).getHSL({ h: 0, s: 0, l: 0 }).s).toBeGreaterThan(0.3);
      }
      if (await page.getByLabel("Toggle signal info").isChecked()) await toggle(page, "Info");
      await page.getByRole("button", { name: "Collapse player panel" }).click();
      await page.screenshot({ path: testInfo.outputPath(`solar-surge-peak-${viewport.width}.png`),
        style: '[aria-label="Twilight Tides controls"] { opacity: 0 !important; }' });
      await setRenderedInputs(page, { ...peakInputs, solarSurgeTime: 1.4 });
      expect(imageDifference(peak, await renderedImage(page), 10, 43).mean).toBeGreaterThan(0.35);
      await setRenderedInputs(page, { ...peakInputs, chroma: 0 });
      const off = await renderedImage(page);
      await page.screenshot({ path: testInfo.outputPath(`solar-surge-chroma-off-${viewport.width}.png`),
        style: '[aria-label="Twilight Tides controls"] { opacity: 0 !important; }' });
      await setRenderedInputs(page, { ...peakInputs, chroma: 0, solarSurge: 0 });
      const offRibbons = imageDifference(off, await renderedImage(page), 10, 43);
      expect(offRibbons.mean).toBeGreaterThan(0.1);
      expect(offRibbons.mean).toBeLessThan(ribbons.mean);
      await setRenderedInputs(page, { ...inputs, solarSurgeTime: 3.2 });
      expect(imageDifference(baseline, await renderedImage(page), 0, 100).mean).toBe(0);
      measurements.push({ viewport, sizes, ribbons, water, offRibbons });
    }
    await testInfo.attach("solar-surge-render-measurements", { body: JSON.stringify(measurements), contentType: "application/json" });
    expect(shaderMessages).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("real demo qualifies solar SURGE near 26 seconds and freezes an active burst with playback and Motion", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(85_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    if (await page.getByLabel("Toggle signal info").isChecked()) await toggle(page, "Info");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await renderedSkyClocks(page)).solarScale,
      { timeout: 40_000, intervals: [50] }).toBe(1.5);
    const triggerTime = Number(await page.getByLabel("Seek playback").inputValue());
    expect(triggerTime).toBeGreaterThan(23);
    expect(triggerTime).toBeLessThan(30);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForTimeout(100);
    const paused = await renderedSkyClocks(page);
    expect(paused.solarSurge).toBeGreaterThan(0.9);
    const image = await renderedImage(page);
    await page.waitForTimeout(400);
    expect(await renderedSkyClocks(page)).toEqual(paused);
    expect(await renderedImage(page)).toEqual(image);
    await expect.poll(async () => (await runtime(page)).environment.surgeCount).toBe(1);
    const telemetry = (await runtime(page)).environment;
    expect(telemetry.lastSurgeAt).toBeGreaterThan(20_000);
    const performance = [];
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(2200);
      const fps = (await runtime(page)).environment.renderFps;
      expect(fps).toBeGreaterThan(0);
      performance.push({ phase: "surge", viewport, fps });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: testInfo.outputPath("solar-surge-real-demo.png"),
      style: '[aria-label="Twilight Tides controls"] { opacity: 0 !important; }' });
    await toggle(page, "Motion");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForTimeout(500);
    expect(await renderedSkyClocks(page)).toEqual(paused);
    await toggle(page, "Chroma");
    const off = await renderedImage(page);
    await page.waitForTimeout(350);
    expect(await renderedSkyClocks(page)).toEqual(paused);
    expect(await renderedImage(page)).toEqual(off);
    await toggle(page, "Chroma");
    await page.emulateMedia({ reducedMotion: "reduce" });
    // The existing shell reads the preference on render; toggling Motion supplies that render.
    await toggle(page, "Motion");
    await page.waitForTimeout(350);
    expect(await renderedSkyClocks(page)).toEqual(paused);
    await expect(page.getByLabel("Motion")).toBeChecked();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await toggle(page, "Chroma");
    await toggle(page, "Chroma");
    await expect.poll(async () => (await renderedSkyClocks(page)).solarScale, { intervals: [100] }).toBe(1);
    expect((await renderedSkyClocks(page)).solarSurge).toBe(0);
    expect((await runtime(page)).environment.surgeCount).toBe(1);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(2200);
      const fps = (await runtime(page)).environment.renderFps;
      expect(fps).toBeGreaterThan(0);
      performance.push({ phase: "baseline", viewport, fps });
    }
    for (let index = 0; index < 2; index++) {
      expect(performance[index].fps!).toBeGreaterThan(performance[index + 2].fps! * 0.65);
    }
    await testInfo.attach("real-solar-surge", { body: JSON.stringify({ triggerTime, paused, telemetry, performance }), contentType: "application/json" });
    await page.getByLabel("Visual environment").selectOption("minimal");
    await expect(page.getByLabel("Twilight Tides canvas")).toHaveCount(0);
    await page.getByLabel("Visual environment").selectOption("twilight-tides");
    await expect.poll(async () => (await runtime(page)).environment.surgeCount).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test("renders a fixed ocean, persists selection, and captures desktop/mobile palettes", async ({ page, pageErrors }, testInfo) => {
    const shaderErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /THREE|WebGL|shader/i.test(message.text())) shaderErrors.push(message.text());
    });
    await page.reload();
    await expect(page.getByLabel("Visual environment")).toHaveValue("twilight-tides");
    await expect(page.getByLabel("Twilight Tides canvas")).toHaveCount(1);
    await expect(page.getByLabel("Motion")).toBeEnabled();
    await expect(page.getByLabel("Toggle environment chroma effects")).toBeEnabled();
    const still = await canvasPixels(page);
    expect(still.sky).toBeGreaterThan(500_000);
    expect(still.water).toBeGreaterThan(400_000);
    expect(still.colors).toBeGreaterThan(2000);
    const greenSun = (await sceneColors(page)).suns[1];
    expect(greenSun[1]).toBeGreaterThan(greenSun[0] * 1.2);
    expect(greenSun[1]).toBeGreaterThan(greenSun[2] * 1.5);
    expect(still.greenWater).toBeGreaterThan(2);
    await page.mouse.move(900, 450);
    await page.mouse.down();
    await page.mouse.move(600, 300, { steps: 10 });
    await page.mouse.up();
    await page.mouse.wheel(0, 300);
    expect(await canvasPixels(page)).toEqual(still);
    await toggle(page, "Info");
    expect(await canvasPixels(page)).toEqual(still);
    await page.getByRole("button", { name: "Collapse player panel" }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: testInfo.outputPath("twilight-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByLabel("Twilight Tides canvas")).toBeVisible();
    expect((await canvasPixels(page)).colors).toBeGreaterThan(1500);
    await page.getByRole("button", { name: "Collapse player panel" }).click();
    await page.screenshot({ path: testInfo.outputPath("twilight-mobile.png") });
    await expect.poll(async () => (await runtime(page)).environment.renderFps).toBeGreaterThan(0);
    await testInfo.attach("mobile-render-observation", {
      body: JSON.stringify({ runtime: await runtime(page), drawingBuffer: await page.getByLabel("Twilight Tides canvas").evaluate((canvas) => {
        const element = canvas as HTMLCanvasElement;
        return { width: element.width, height: element.height };
      }) }), contentType: "application/json",
    });
    expect(shaderErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("real demo drives light, motion freezes independently, mute retains ambient ripples, pause freezes all", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(45_000);
    await toggle(page, "Motion");
    const beforeMusic = await canvasPixels(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).audio.smoothedEnergy, { timeout: 15_000 }).toBeGreaterThan(0.1);
    await expect.poll(async () => (await canvasPixels(page)).sky).toBeGreaterThan(beforeMusic.sky * 1.05);
    await toggle(page, "Chroma");
    const frozen = await canvasPixels(page);
    await page.waitForTimeout(400);
    expect(await canvasPixels(page)).toEqual(frozen);
    expect(frozen.sky).toBeLessThan(beforeMusic.sky);
    await page.screenshot({ path: testInfo.outputPath("twilight-chroma-off.png") });
    await toggle(page, "Motion");
    await expect.poll(async () => (await canvasPixels(page)).hash).not.toBe(frozen.hash);
    await page.waitForTimeout(1500);
    const musicMotion = (await visibleMotion(page) + await visibleMotion(page)) / 2;
    await page.getByRole("slider", { name: "Volume" }).fill("0");
    await expect.poll(async () => (await runtime(page)).audio.smoothedEnergy, { timeout: 15_000 }).toBeLessThan(0.01);
    await page.waitForTimeout(3000);
    const quietMotion = (await visibleMotion(page) + await visibleMotion(page)) / 2;
    expect(musicMotion).toBeGreaterThan(quietMotion * 2.5);
    await testInfo.attach("music-versus-muted-motion", { body: JSON.stringify({ musicMotion, quietMotion }), contentType: "application/json" });
    const quiet = await canvasPixels(page);
    await expect.poll(async () => (await canvasPixels(page)).hash).not.toBe(quiet.hash);
    await toggle(page, "Chroma");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForTimeout(100);
    const paused = await canvasPixels(page);
    await page.waitForTimeout(400);
    expect(await canvasPixels(page)).toEqual(paused);
    expect((await runtime(page)).controls).toEqual({ chroma: true, motion: true, volume: 0 });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await canvasPixels(page)).hash).not.toBe(paused.hash);
    expect(pageErrors).toEqual([]);
  });

  test("horizon highlights stay below the skyline at fractional desktop and mobile heights", async ({ page }, testInfo) => {
    const measurements = [];
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1000, height: 641 }, { width: 901, height: 743 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.reload();
      for (const energy of [0, 1]) {
        await setRenderedInputs(page, { colorEnergy: energy, glintEnergy: energy, turbulence: 0.65 + energy * 0.85,
          waterEnergy: energy, time: energy * 17, skyTime: energy * 7,
          auroraBass: energy, auroraMids: energy, auroraHighs: energy });
        const colors = await sceneColors(page);
        expect(colors.horizonContrast).toBeLessThan(6);
        expect(colors.seamContrast).toBeLessThan(3);
        expect(colors.whitePixels).toBe(0);
        measurements.push({ viewport, energy, ...colors });
      }
      await page.getByRole("button", { name: "Collapse player panel" }).click();
      await page.screenshot({ path: testInfo.outputPath(`twilight-horizon-${viewport.width}x${viewport.height}.png`) });
    }
    await testInfo.attach("horizon-measurements", { body: JSON.stringify(measurements), contentType: "application/json" });
  });

  test("aurora is always visible, band-reactive and softly reflected without hiding the suns", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const shaderMessages: string[] = [];
    page.on("console", (message) => {
      if (["warning", "error"].includes(message.type()) && /THREE|WebGL|shader/i.test(message.text())) shaderMessages.push(message.text());
    });
    // Isolate the aurora contribution in the actual shaders, without shipping a debug switch.
    await page.addInitScript(() => {
      const shaderSource = WebGL2RenderingContext.prototype.shaderSource;
      WebGL2RenderingContext.prototype.shaderSource = function (shader, source) {
        if (source.includes("vec4 auroraLight(")) {
          source = source.replace("uniform float auroraBass;", "uniform float testAuroraScale;\nuniform float auroraBass;")
            .replace("return light * skyMask", "return light * testAuroraScale * skyMask");
        }
        shaderSource.call(this, shader, source);
      };
    });
    const measurements = [];
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.reload();
      const inputs = { testAuroraScale: 1, time: 17, skyTime: 7, colorEnergy: 0, waterEnergy: 0,
        auroraBass: 0, auroraMids: 0, auroraHighs: 0 };
      await setRenderedInputs(page, { ...inputs, testAuroraScale: 0 });
      const quietAbsent = await renderedImage(page);
      await setRenderedInputs(page, inputs);
      const quiet = await renderedImage(page);
      const quietSky = imageDifference(quietAbsent, quiet, 4, 28);
      expect(quietSky.mean).toBeGreaterThan(2);
      expect(quietSky.coverage).toBeGreaterThan(0.12);
      if (await page.getByLabel("Toggle signal info").isChecked()) await toggle(page, "Info");
      await page.getByRole("button", { name: "Collapse player panel" }).click();
      await page.screenshot({ path: testInfo.outputPath(`aurora-quiet-${viewport.width}.png`),
        style: '[aria-label="Twilight Tides controls"] { opacity: 0 !important; }' });
      const energetic = { ...inputs, colorEnergy: 0.8, waterEnergy: 0.8 };
      await setRenderedInputs(page, energetic);
      const noBands = await renderedImage(page);
      const bandChanges = [];
      for (const band of ["auroraBass", "auroraMids", "auroraHighs"]) {
        await setRenderedInputs(page, { ...energetic, [band]: 0.8 });
        const change = imageDifference(noBands, await renderedImage(page), 4, 28);
        expect(change.mean, band).toBeGreaterThan(band === "auroraHighs" ? 0.08 : 0.5);
        bandChanges.push({ band, ...change });
      }
      const musical = { ...energetic, auroraBass: 0.8, auroraMids: 0.7, auroraHighs: 0.8 };
      await setRenderedInputs(page, { ...musical, testAuroraScale: 0 });
      const absent = await renderedImage(page);
      const absentColors = await sceneColors(page);
      await setRenderedInputs(page, musical);
      const present = await renderedImage(page);
      const colors = await sceneColors(page);
      const sky = imageDifference(absent, present, 4, 28);
      const water = imageDifference(absent, present, 50, 100);
      expect(sky.mean).toBeGreaterThan(quietSky.mean * 1.5);
      expect(sky.coverage).toBeGreaterThan(0.25);
      expect(water.mean).toBeGreaterThan(0.15);
      expect(water.mean).toBeLessThan(sky.mean * 0.6);
      for (const sun of [0, 1]) {
        expect(colorDifference(colors.suns[sun], absentColors.suns[sun])).toBeLessThan(1);
        expect(colorDifference(colors.suns[sun], colors.sunSurroundings[sun])).toBeGreaterThan(18);
      }
      expect(colors.horizonContrast).toBeLessThan(6);
      expect(colors.seamContrast).toBeLessThan(3);
      expect(colors.whitePixels).toBe(0);
      await page.screenshot({ path: testInfo.outputPath(`aurora-musical-${viewport.width}.png`),
        style: '[aria-label="Twilight Tides controls"] { opacity: 0 !important; }' });
      await setRenderedInputs(page, { ...musical, chroma: 0 });
      const chromaOff = await renderedImage(page);
      await setRenderedInputs(page, { ...inputs, chroma: 0 });
      expect(await renderedImage(page)).toEqual(chromaOff);
      await setRenderedInputs(page, { ...inputs, chroma: 0, testAuroraScale: 0 });
      expect(imageDifference(chromaOff, await renderedImage(page), 4, 28).mean).toBeGreaterThan(0.1);
      await setRenderedInputs(page, musical);
      measurements.push({ viewport, quietSky, sky, water, bandChanges });
    }
    await testInfo.attach("aurora-render-measurements", { body: JSON.stringify(measurements), contentType: "application/json" });
    expect(shaderMessages).toEqual([]);
  });

  test("observes uninstrumented aurora playback FPS on desktop and compact viewports", async ({ page }, testInfo) => {
    test.setTimeout(45_000);
    const observations = [];
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.reload();
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect.poll(async () => (await runtime(page)).audio.smoothedEnergy, { timeout: 15_000 }).toBeGreaterThan(0.1);
      await page.waitForTimeout(2000);
      const renderFps = [];
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(1100);
        const fps = (await runtime(page)).environment.renderFps;
        expect(fps).toBeGreaterThan(0);
        renderFps.push(fps);
      }
      observations.push({ viewport, renderFps });
    }
    await testInfo.attach("aurora-uninstrumented-fps", { body: JSON.stringify(observations), contentType: "application/json" });
  });

  test("real demo drives aurora bands and mute smoothly relaxes them without removing the curtains", async ({ page }, testInfo) => {
    test.setTimeout(45_000);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => {
      const values = await renderedSkyClocks(page);
      return Math.min(values.auroraBass, values.auroraMids, values.auroraHighs);
    }, { timeout: 15_000 }).toBeGreaterThan(0.05);
    const musical = await renderedSkyClocks(page);
    await page.getByRole("slider", { name: "Volume" }).fill("0");
    await expect.poll(async () => {
      const values = await renderedSkyClocks(page);
      return Math.max(values.auroraBass, values.auroraMids, values.auroraHighs);
    }, { timeout: 15_000 }).toBeLessThan(0.005);
    const muted = await renderedSkyClocks(page);
    expect(muted.skyTime).toBeGreaterThan(musical.skyTime);
    await page.getByRole("slider", { name: "Volume" }).fill("1");
    await expect.poll(async () => (await renderedSkyClocks(page)).auroraBass, { timeout: 15_000 }).toBeGreaterThan(0.1);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForTimeout(100);
    const paused = await renderedImage(page);
    await page.waitForTimeout(350);
    expect(await renderedImage(page)).toEqual(paused);
    await testInfo.attach("real-audio-aurora", { body: JSON.stringify({ musical, muted }), contentType: "application/json" });
  });

  test("real Kick leaves sun colors stable and readable with Motion off or reduced motion", async ({ page }, testInfo) => {
    test.setTimeout(45_000);
    await toggle(page, "Motion");
    const clocks = await renderedSkyClocks(page);
    const palette = await renderedPalette(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).audio.kickPulse, { timeout: 15_000 }).toBeGreaterThan(0.15);
    await expect(page.getByTestId("signal-meter-kick")).toBeVisible();
    const samples = [];
    for (let i = 0; i < 24; i++) {
      const colors = await sceneColors(page);
      samples.push({ kick: (await runtime(page)).audio.kickPulse, suns: colors.suns.map((rgb) =>
        new Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255).getHSL({ h: 0, s: 0, l: 0 })) });
      await page.waitForTimeout(100);
    }
    for (const sun of [0, 1]) {
      const hues = samples.map((sample) => sample.suns[sun].h > 0.8 ? sample.suns[sun].h - 1 : sample.suns[sun].h);
      expect(Math.max(...hues) - Math.min(...hues)).toBeLessThan(0.015);
      expect(Math.min(...samples.map((sample) => sample.suns[sun].s))).toBeGreaterThan(0.4);
      expect(Math.max(...samples.map((sample) => sample.suns[sun].l))).toBeLessThan(0.75);
    }
    expect(await renderedSkyClocks(page)).toEqual(clocks);
    expect(await renderedPalette(page)).toEqual(palette);
    await testInfo.attach("stable-sun-hues", { body: JSON.stringify(samples), contentType: "application/json" });
    await toggle(page, "Motion");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).audio.kickPulse, { timeout: 15_000 }).toBeGreaterThan(0.15);
    expect(await renderedPalette(page)).toEqual(palette);
    expect(await renderedSkyClocks(page)).toEqual(clocks);
    await expect(page.getByLabel("Motion")).toBeChecked();
  });

  test("four slow palette moods stay distinct in sky and water with visible suns and a dark upper sky", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const samples = [];
    await toggle(page, "Info");
    await page.getByRole("button", { name: "Collapse player panel" }).click();
    for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
      await setRenderedInputs(page, paletteInputs(phase));
      samples.push(await sceneColors(page));
      if (phase < 1) await page.screenshot({ path: testInfo.outputPath(`twilight-palette-${phase}.png`) });
    }
    for (const sample of samples) expect(Math.max(...sample.upperSky)).toBeLessThan(70);
    for (const region of ["sky", "water"] as const) {
      for (let a = 0; a < 4; a++) {
        for (let b = a + 1; b < 4; b++) expect(colorDifference(samples[a][region], samples[b][region])).toBeGreaterThan(region === "sky" ? 12 : 6);
      }
      expect(samples[4][region]).toEqual(samples[0][region]);
    }
    let minimumContrast = Infinity;
    let minimumSaturation = 1;
    for (let step = 0; step < 16; step++) {
      for (const skyTime of [0, 16, 40, 80, 120, 200]) {
        await setRenderedInputs(page, { ...paletteInputs(step / 16), skyTime, colorEnergy: 1,
          waterEnergy: 1, auroraBass: 1, auroraMids: 1, auroraHighs: 1 });
        const colors = await sceneColors(page);
        for (let sun = 0; sun < 2; sun++) {
          const contrast = colorDifference(colors.suns[sun], colors.sunSurroundings[sun]);
          minimumContrast = Math.min(minimumContrast, contrast);
          expect(contrast, `Sun ${sun}, palette ${step}/16, cloud time ${skyTime}`).toBeGreaterThan(18);
          const rgb = colors.suns[sun];
          const saturation = new Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255).getHSL({ h: 0, s: 0, l: 0 }).s;
          minimumSaturation = Math.min(minimumSaturation, saturation);
          expect(saturation).toBeGreaterThan(0.3);
        }
        expect(colors.seamContrast).toBeLessThan(3);
        expect(colors.whitePixels).toBe(0);
      }
    }
    await testInfo.attach("palette-color-cycle", { body: JSON.stringify({ samples, minimumContrast, minimumSaturation }), contentType: "application/json" });
  });

  test("cloud veils cross softened sun discs while the emitted palette remains stable", async ({ page }, testInfo) => {
    const emitted = await renderedPalette(page);
    const samples = [];
    for (const skyTime of [0, 10, 20, 30, 40, 50, 60]) {
      await setRenderedInputs(page, { skyTime });
      samples.push(await sceneColors(page));
      expect(await renderedPalette(page)).toEqual(emitted);
    }
    const alienColors = samples.map((sample) => sample.suns[1]);
    expect(Math.max(...alienColors.map((color) => colorDifference(color, alienColors[0])))).toBeGreaterThan(5);
    for (const sun of [0, 1]) {
      const profile = samples[0].sunProfiles[sun];
      expect(colorDifference(profile[0], profile[2])).toBeGreaterThan(3);
      const coreToSky = colorDifference(profile[0], profile[5]);
      const edgeToSky = colorDifference(profile[3], profile[5]);
      expect(edgeToSky).toBeGreaterThan(coreToSky * 0.1);
      expect(edgeToSky).toBeLessThan(coreToSky * 0.9);
    }
    await testInfo.attach("cloud-sun-compositing", { body: JSON.stringify(samples), contentType: "application/json" });
  });

  test("reduced motion freezes the water without changing user controls", async ({ page, pageErrors }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await toggle(page, "Chroma");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).audio.smoothedEnergy, { timeout: 15_000 }).toBeGreaterThan(0.05);
    const frozen = await canvasPixels(page);
    await page.waitForTimeout(400);
    expect(await canvasPixels(page)).toEqual(frozen);
    await expect(page.getByLabel("Motion")).toBeChecked();
    expect(pageErrors).toEqual([]);
  });

  test("cloud drift, palette and an active shooting star freeze in the rendered scene", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(55_000);
    await toggle(page, "Info");
    const initial = await renderedSkyClocks(page);
    const initialPalette = await renderedPalette(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => {
      const progress = (await renderedSkyClocks(page)).meteorProgress;
      return progress > 0.12 && progress < 0.6;
    }, { timeout: 45_000, intervals: [100] }).toBe(true);
    await toggle(page, "Motion");
    const frozen = await renderedSkyClocks(page);
    expect(frozen.skyTime).toBeGreaterThan(initial.skyTime + 1);
    const frozenPalette = await renderedPalette(page);
    expect(frozenPalette).not.toEqual(initialPalette);
    expect(frozen.meteorProgress).toBeLessThan(1);
    await page.waitForTimeout(450);
    expect(await renderedSkyClocks(page)).toEqual(frozen);
    expect(await renderedPalette(page)).toEqual(frozenPalette);
    await page.getByRole("button", { name: "Collapse player panel" }).click();
    await page.screenshot({ path: testInfo.outputPath("twilight-meteor-motion-off.png") });
    await page.getByRole("button", { name: "Expand player panel" }).click();
    await toggle(page, "Motion");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForTimeout(100);
    const paused = await renderedSkyClocks(page);
    const pixels = await canvasPixels(page);
    await page.waitForTimeout(350);
    expect(await renderedSkyClocks(page)).toEqual(paused);
    expect(await canvasPixels(page)).toEqual(pixels);
    expect(pageErrors).toEqual([]);
  });

  test("reuses both demo sources and the existing radio playback path", async ({ page, pageErrors }) => {
    test.setTimeout(45_000);
    const streamUrl = "https://hirschmilch.de:7000/psytrance.mp3";
    await page.route(streamUrl, (route) => route.fulfill({
      path: "public\\audio\\demo\\illustrator-psychedelic-experience.mp3",
      headers: { "Access-Control-Allow-Origin": "*" },
    }));
    await page.route("**/metadata?channel=psytrance", (route) => route.fulfill({ json: { channelId: "psytrance", artist: "Test", title: "Radio" } }));
    for (const source of ["globular-for-the-time-being", "hirschmilch-psytrance", "demo-psychedelic-experience"]) {
      await page.getByLabel("Signal source").selectOption(source);
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect.poll(async () => (await runtime(page)).audio.smoothedEnergy, { timeout: 15_000 }).toBeGreaterThan(0.01);
      await expect(page.getByLabel("Twilight Tides canvas")).toHaveCount(1);
      expect((await runtime(page)).environment.id).toBe("twilight-tides");
    }
    expect(pageErrors).toEqual([]);
  });

  test("rebuilds baked reflections after WebGL context restoration", async ({ page, pageErrors }) => {
    const before = await canvasPixels(page);
    await page.getByLabel("Twilight Tides canvas").evaluate((canvas) => new Promise<void>((resolve) => {
      const gl = (canvas as HTMLCanvasElement).getContext("webgl2")!;
      const extension = gl.getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("Context-loss testing requires WEBGL_lose_context");
      canvas.addEventListener("webglcontextrestored", () => resolve(), { once: true });
      extension.loseContext();
      setTimeout(() => extension.restoreContext(), 250);
    }));
    await expect.poll(async () => (await canvasPixels(page)).hash).toBe(before.hash);
    await expect.poll(async () => (await runtime(page)).environment.renderFps).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  test("releases GPU resources and its owning loop across repeated switches", async ({ page, pageErrors }) => {
    await page.addInitScript(() => {
      const resources = { frames: new Set<number>(), buffers: new Map<WebGLBuffer, WebGL2RenderingContext>(), textures: new Map<WebGLTexture, WebGL2RenderingContext>(), programs: new Map<WebGLProgram, WebGL2RenderingContext>(), framebuffers: new Map<WebGLFramebuffer, WebGL2RenderingContext>() };
      window.__TWILIGHT_RESOURCES__ = resources;
      const request = window.requestAnimationFrame.bind(window);
      const cancel = window.cancelAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => {
        const id = request((time) => { resources.frames.delete(id); callback(time); });
        resources.frames.add(id);
        return id;
      };
      window.cancelAnimationFrame = (id) => { resources.frames.delete(id); cancel(id); };
      const prototype = WebGL2RenderingContext.prototype;
      const createBuffer = prototype.createBuffer;
      const deleteBuffer = prototype.deleteBuffer;
      prototype.createBuffer = function () { const value = createBuffer.call(this); resources.buffers.set(value, this); return value; };
      prototype.deleteBuffer = function (value) { if (value) resources.buffers.delete(value); deleteBuffer.call(this, value); };
      const createTexture = prototype.createTexture;
      const deleteTexture = prototype.deleteTexture;
      prototype.createTexture = function () { const value = createTexture.call(this); resources.textures.set(value, this); return value; };
      prototype.deleteTexture = function (value) { if (value) resources.textures.delete(value); deleteTexture.call(this, value); };
      const createProgram = prototype.createProgram;
      const deleteProgram = prototype.deleteProgram;
      prototype.createProgram = function () { const value = createProgram.call(this); if (value) resources.programs.set(value, this); return value; };
      prototype.deleteProgram = function (value) { if (value) resources.programs.delete(value); deleteProgram.call(this, value); };
      const createFramebuffer = prototype.createFramebuffer;
      const deleteFramebuffer = prototype.deleteFramebuffer;
      prototype.createFramebuffer = function () { const value = createFramebuffer.call(this); resources.framebuffers.set(value, this); return value; };
      prototype.deleteFramebuffer = function (value) { if (value) resources.framebuffers.delete(value); deleteFramebuffer.call(this, value); };
    });
    await page.reload();
    const counts = () => page.evaluate(() => {
      const resources = window.__TWILIGHT_RESOURCES__;
      const active = (values: Map<unknown, WebGL2RenderingContext>) => [...values.values()].filter((context) => !context.isContextLost()).length;
      return { frames: resources.frames.size, buffers: active(resources.buffers), textures: active(resources.textures),
        programs: active(resources.programs), framebuffers: active(resources.framebuffers) };
    });
    const selector = page.getByLabel("Visual environment");
    const fps = page.locator(".visual-feed-window__fps .visual-feed-window__metric-value");
    await selector.selectOption("minimal");
    const baseline = await counts();
    for (let cycle = 0; cycle < 3; cycle++) {
      await selector.selectOption("twilight-tides");
      await expect(page.getByLabel("Twilight Tides canvas")).toHaveCount(1);
      await expect.poll(async () => Number(await fps.textContent())).toBeGreaterThan(0);
      const mounted = await counts();
      expect(mounted.frames).toBe(baseline.frames + 1);
      expect(mounted.textures).toBeGreaterThan(baseline.textures);
      expect(mounted.framebuffers).toBeGreaterThan(baseline.framebuffers);
      await setRenderedInputs(page, { solarScale: 1.5, solarSurge: 1, solarSurgeTime: 1.1 });
      expect((await renderedSkyClocks(page)).solarSurge).toBe(1);
      expect(await counts()).toEqual(mounted);
      await selector.selectOption("minimal");
      await expect(page.getByLabel("Twilight Tides environment")).toHaveCount(0);
      await expect(fps).toHaveText("---");
      await expect.poll(counts).toEqual(baseline);
    }
    expect(pageErrors).toEqual([]);
  });
});
