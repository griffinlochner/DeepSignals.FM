import type { Page } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { test, expect } from "../support/test";
import { ENVIRONMENT_GROUPS, getShufflePool } from "../../src/app/environmentSelection";
import type { RuntimeTestSnapshot } from "../../src/app/runtimeTestBridge";
import {
  createToxicState, TOXIC_CAMERA, TOXIC_VOLCANO, toxicMusicEnergy, toxicQuality, toxicVolcanoFrame, updateToxicState,
} from "../../src/themes/toxic-horizon/toxicRuntime";
import {
  createToxicEruptionPhases, TOXIC_LIGHTNING_FLASHES, TOXIC_LIGHTNING_FLASH_SECONDS, TOXIC_SURGE,
  toxicEruptionPhases, toxicSurgeEnvelope,
} from "../../src/themes/toxic-horizon/toxicSurge";

const playing = { isPlaying: true, motionEnabled: true, reducedMotion: false };
const loud = { isActive: true, smoothedEnergy: 1 };
const gates = [{ ...playing, isPlaying: false }, { ...playing, motionEnabled: false }, { ...playing, reducedMotion: true }];
type ToxicState = ReturnType<typeof createToxicState>;
type ToxicSnapshot = Parameters<typeof updateToxicState>[3];

function advance(state: ToxicState, seconds: number, snapshot: ToxicSnapshot = { ...loud, kickPulseAcceptedEventSequence: 0 },
  controls = playing, fps = 60) {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) updateToxicState(state, 1 / fps, controls, snapshot);
}

function startEruption() {
  const state = createToxicState();
  advance(state, 0.6, { ...loud, smoothedEnergy: 0.2, kickPulseAcceptedEventSequence: 7 });
  expect(state.surge.qualification.armed).toBe(true);
  advance(state, 0.1, { ...loud, kickPulseAcceptedEventSequence: 8 });
  expect(state.surge.count).toBe(1);
  return state;
}

test("Toxic Horizon joins the visible 3D experiences and their shuffle pools without touching Twilight Tides", () => {
  const experiences = ENVIRONMENT_GROUPS.find((group) => group.groupName === "3D EXPERIENCES")!.environmentIds;
  expect(experiences.slice(-2)).toEqual(["twilight-tides", "toxic-horizon"]);
  expect(ENVIRONMENT_GROUPS.flatMap((group) => group.environmentIds).filter((id) => id === "toxic-horizon")).toHaveLength(1);
  expect(getShufflePool("shuffle-3d")).toContain("toxic-horizon");
  expect(getShufflePool("shuffle-all")).toContain("toxic-horizon");
  expect(getShufflePool("shuffle-depth")).not.toContain("toxic-horizon");
});

test("Toxic Horizon SURGE uses shared qualification, lasts 3.2 seconds, never overlaps and fully recovers", () => {
  const unarmed = createToxicState();
  advance(unarmed, 5);
  expect(unarmed.surge.count).toBe(0);
  const state = startEruption();
  expect(state.surge.qualification.lastTriggeredSequence).toBe(8);
  advance(state, 0.6);
  expect(state.surge.phases.envelope).toBe(1);
  expect(state.surge.phases.fountain).toBeGreaterThan(0.6);
  // A fresh shared trigger inside the local envelope cannot restart or stack the eruption.
  advance(state, 1.1, { ...loud, smoothedEnergy: 0.2, kickPulseAcceptedEventSequence: 9 });
  advance(state, 0.1, { ...loud, kickPulseAcceptedEventSequence: 10 });
  expect(state.surge.count).toBe(1);
  advance(state, 1.6);
  expect(state.surge.ageSeconds).toBe(TOXIC_SURGE.durationSeconds);
  expect(state.surge.phases).toEqual(createToxicEruptionPhases());
  // Sustained high energy never re-arms the shared qualifier.
  advance(state, 20);
  expect(state.surge.count).toBe(1);
  expect(state.surge.phases).toEqual(createToxicEruptionPhases());
  advance(state, 0.6, { ...loud, smoothedEnergy: 0.2, kickPulseAcceptedEventSequence: 11 });
  advance(state, 0.1, { ...loud, kickPulseAcceptedEventSequence: 12 });
  expect(state.surge.count).toBe(2);
  for (const age of [-1, 0, 3.2, Infinity, NaN]) expect(toxicSurgeEnvelope(age)).toBe(0);
  expect(toxicSurgeEnvelope(0.55)).toBe(1);
  expect(toxicSurgeEnvelope(1.45)).toBe(1);
});

test("Toxic Horizon eruption phases are bounded, ordered, smooth and end exactly at the ambient baseline", () => {
  for (const age of [-1, 3.2, 5, Infinity, NaN]) expect(toxicEruptionPhases(age)).toEqual(createToxicEruptionPhases());
  let previous = toxicEruptionPhases(0);
  let lightningSeconds = 0;
  const flashes = new Set<number>();
  for (let frame = 1; frame <= 3.2 * 240; frame++) {
    const age = frame / 240;
    const phases = toxicEruptionPhases(age);
    for (const [name, value] of Object.entries(phases)) {
      if (name === "flash") continue;
      expect(value, `${name} at ${age}`).toBeGreaterThanOrEqual(0);
      expect(value, `${name} at ${age}`).toBeLessThanOrEqual(1);
    }
    for (const name of ["envelope", "pressure", "fountain", "flare", "aurora"] as const) {
      expect(Math.abs(phases[name] - previous[name]), `${name} at ${age}`).toBeLessThan(0.02);
    }
    if (age < 3.2) expect(phases.front).toBeGreaterThanOrEqual(previous.front);
    // Pressure builds in the crater before the fountain leaves it.
    if (age < 0.8) expect(phases.pressure).toBeGreaterThanOrEqual(phases.fountain);
    if (phases.lightning > 0) {
      lightningSeconds += 1 / 240;
      flashes.add(phases.flash);
      expect(age).toBeGreaterThan(TOXIC_LIGHTNING_FLASHES[0]);
      expect(age).toBeLessThan(TOXIC_LIGHTNING_FLASHES[2] + TOXIC_LIGHTNING_FLASH_SECONDS);
    }
    previous = phases;
  }
  expect([...flashes]).toEqual([0, 1, 2]);
  // Lightning is brief: under a third of the event, in three separate flashes.
  expect(lightningSeconds).toBeLessThan(TOXIC_SURGE.durationSeconds / 3);
  expect(toxicEruptionPhases(0.8).pressure).toBeGreaterThan(0.95);
  expect(toxicEruptionPhases(1.2).fountain).toBe(1);
  expect(toxicEruptionPhases(1.7).front).toBeCloseTo(1, 6);
  for (const [name, value] of Object.entries(toxicEruptionPhases(3.19))) {
    if (name !== "front" && name !== "flash") expect(value, name).toBeLessThan(0.001);
  }
});

test("Toxic Horizon SURGE freezes with every kinetic gate, resets arming and ignores invalid analysis", () => {
  for (const controls of gates) {
    const state = startEruption();
    advance(state, 0.7);
    const before = structuredClone(state.surge);
    const magma = state.magmaTime;
    advance(state, 4, { ...loud, kickPulseAcceptedEventSequence: 8 }, controls);
    expect(state.surge).toEqual(before);
    expect(state.magmaTime).toBe(magma);
    advance(state, 0.5);
    expect(state.surge.ageSeconds).toBeCloseTo(before.ageSeconds + 0.5, 8);
    const armed = createToxicState();
    advance(armed, 0.6, { ...loud, smoothedEnergy: 0.2, kickPulseAcceptedEventSequence: 1 });
    expect(armed.surge.qualification.armed).toBe(true);
    advance(armed, 0.1, { ...loud, kickPulseAcceptedEventSequence: 2 }, controls);
    expect(armed.surge.qualification.armed).toBe(false);
    advance(armed, 0.2);
    expect(armed.surge.count).toBe(0);
  }
  for (const snapshot of [null, undefined, { ...loud, isActive: false }, { ...loud, smoothedEnergy: NaN }, { ...loud, smoothedEnergy: Infinity }]) {
    const state = createToxicState();
    advance(state, 0.6, { ...loud, smoothedEnergy: 0.2, kickPulseAcceptedEventSequence: 0 });
    updateToxicState(state, 1 / 60, playing, snapshot);
    advance(state, 0.2);
    expect(state.surge.count).toBe(0);
  }
  // Qualification time is frame-rate and energy independent; CHROMA never gates the event.
  const starts = [30, 60, 120].map((fps) => {
    const state = createToxicState();
    for (let frame = 0; frame < fps * 4; frame++) {
      updateToxicState(state, 1 / fps, { ...playing, chromaEnabled: fps !== 60 }, { ...loud, smoothedEnergy: frame < fps * 0.6 ? 0.2 : 1 });
    }
    expect(state.surge.count).toBe(1);
    expect(state.surge.phases).toEqual(createToxicEruptionPhases());
    return state.surge.startedAt;
  });
  expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(70);
});

test("Toxic Horizon smooths energy without beat pumping and keeps an ambient baseline at silence", () => {
  const state = createToxicState();
  updateToxicState(state, 1 / 60, playing, loud);
  expect(state.waterEnergy).toBeGreaterThan(0);
  expect(state.waterEnergy).toBeLessThan(0.04);
  advance(state, 5, loud);
  expect(state.waterEnergy).toBeGreaterThan(0.99);
  expect(state.time).toBeGreaterThan(5.2);
  expect(state.time).toBeLessThan(5.4);
  for (const snapshot of [undefined, null, { ...loud, isActive: false }, { ...loud, smoothedEnergy: NaN }, { ...loud, smoothedEnergy: 0 }]) {
    const before = { time: state.time, skyTime: state.skyTime, magmaTime: state.magmaTime };
    for (let frame = 0; frame < 600; frame++) updateToxicState(state, 1 / 60, playing, snapshot);
    expect(state.waterEnergy).toBeLessThan(0.001);
    // Water, sky and magma keep drifting slowly: the volcano never looks dead.
    expect(state.time - before.time).toBeGreaterThan(0.44);
    expect(state.time - before.time).toBeLessThan(1.15);
    expect(state.skyTime - before.skyTime).toBeGreaterThan(0.24);
    expect(state.magmaTime - before.magmaTime).toBeGreaterThan(2.1);
    expect(state.magmaTime - before.magmaTime).toBeLessThan(3);
  }
  expect(toxicMusicEnergy({ isActive: true, smoothedEnergy: 0.01 })).toBe(0);
  expect(toxicMusicEnergy({ isActive: true, smoothedEnergy: 0.25 })).toBeGreaterThan(0.5);
  expect(toxicMusicEnergy({ isActive: false, smoothedEnergy: 1 })).toBe(0);
});

test("Toxic Horizon freezes kinetic state with every gate, bounds deltas and keeps independent color", () => {
  const music = { ...loud, bass: 1, mids: 1, highs: 1, kickPulse: 1, bassPulse: 1, transient: 1 };
  for (const controls of gates) {
    const state = createToxicState();
    advance(state, 2, music);
    const before = structuredClone(state);
    advance(state, 4, { ...music, smoothedEnergy: 0.1 }, controls);
    // MOTION OFF still lets overall illumination follow the music; pause holds everything.
    if (controls.isPlaying) expect(state.colorEnergy).toBeLessThan(before.colorEnergy - 0.3);
    else expect(state.colorEnergy).toBe(before.colorEnergy);
    expect({ ...state, colorEnergy: 0, glintEnergy: 0 }).toEqual({ ...before, colorEnergy: 0, glintEnergy: 0 });
  }
  const capped = createToxicState();
  const reference = createToxicState();
  updateToxicState(capped, 10, playing, music);
  updateToxicState(reference, 0.05, playing, music);
  expect(capped).toEqual(reference);
  for (const delta of [NaN, -1, 0, Infinity]) {
    const state = createToxicState();
    updateToxicState(state, delta, playing, music);
    expect(state).toEqual(createToxicState());
  }
});

test("Toxic Horizon maps each band to its own bounded, frame-rate independent effect and decays when muted", () => {
  const settle = (snapshot: ToxicSnapshot, fps = 60) => {
    const state = createToxicState();
    advance(state, 2, snapshot, playing, fps);
    return state;
  };
  const silent = settle(loud);
  for (const name of ["auroraBass", "auroraMids", "auroraHighs", "fissureGlow", "moltenPulse", "moltenTrail", "sparkEnergy", "swellEnergy"] as const) {
    expect(silent[name], name).toBe(0);
  }
  const bass = settle({ ...loud, bass: 1 });
  expect(bass.fissureGlow).toBeGreaterThan(0.75);
  expect(bass.swellEnergy).toBeGreaterThan(0.8);
  expect(bass.auroraBass).toBeGreaterThan(0.5);
  expect([bass.moltenPulse, bass.sparkEnergy, bass.auroraMids, bass.auroraHighs]).toEqual([0, 0, 0, 0]);
  const kick = settle({ ...loud, kickPulse: 1 });
  expect(kick.moltenPulse).toBeGreaterThan(0.85);
  expect(kick.moltenTrail).toBeGreaterThan(0.8);
  // Kicks pulse the mountain and aurora, never the liquid, its clocks or the sparks.
  expect([kick.fissureGlow, kick.swellEnergy, kick.sparkEnergy, kick.auroraMids]).toEqual([0, 0, 0, 0]);
  expect([kick.time, kick.skyTime, kick.waterEnergy]).toEqual([silent.time, silent.skyTime, silent.waterEnergy]);
  const mids = settle({ ...loud, mids: 1 });
  expect(mids.auroraMids).toBeGreaterThan(0.95);
  expect([mids.fissureGlow, mids.moltenPulse, mids.sparkEnergy, mids.auroraBass, mids.auroraHighs]).toEqual([0, 0, 0, 0, 0]);
  const highs = settle({ ...loud, highs: 1 });
  expect(highs.sparkEnergy).toBeGreaterThan(0.75);
  expect(highs.auroraHighs).toBeGreaterThan(0.75);
  expect([highs.fissureGlow, highs.moltenPulse, highs.auroraBass, highs.auroraMids]).toEqual([0, 0, 0, 0]);
  // Controlled attack and release: the crater pulse leads, its echo down the fissures follows.
  const pulse = createToxicState();
  advance(pulse, 0.05, { ...loud, kickPulse: 1 });
  expect(pulse.moltenPulse).toBeGreaterThan(0.01);
  expect(pulse.moltenPulse).toBeLessThan(0.7);
  expect(pulse.moltenTrail).toBeLessThan(pulse.moltenPulse * 0.5);
  const everything = { ...loud, bass: 4, mids: 4, highs: 4, kickPulse: 4, bassPulse: 4, transient: 4 };
  const rates = [30, 60, 120].map((fps) => settle(everything, fps));
  for (const state of rates) {
    for (const [name, value] of Object.entries(state)) {
      if (typeof value === "number" && !name.endsWith("ime")) {
        expect(value, name).toBeLessThanOrEqual(1);
        expect(Math.abs(value - rates[1][name as "fissureGlow"]), name).toBeLessThan(0.02);
      }
    }
  }
  // Mute keeps stale band values but no energy: every accent settles while the clocks keep drifting.
  const muted = rates[1];
  const clock = muted.magmaTime;
  advance(muted, 6, { ...everything, smoothedEnergy: 0 });
  for (const name of ["auroraBass", "auroraMids", "auroraHighs", "fissureGlow", "moltenPulse", "moltenTrail", "sparkEnergy", "swellEnergy", "waterEnergy", "glintEnergy"] as const) {
    expect(muted[name], name).toBeLessThan(0.005);
  }
  expect(muted.magmaTime).toBeGreaterThan(clock + 1.2);
});

test("Toxic Horizon keeps Twilight's quality budgets and anchors the volcano inside every viewport", () => {
  for (const [width, height, dpr, constrained] of [
    [1440, 900, 2, false], [390, 844, 3, true], [3840, 2160, 3, false], [900, 600, 2, true],
  ] as const) {
    const quality = toxicQuality(width, height, dpr, constrained);
    const compact = constrained || Math.min(width, height) < 600;
    expect(width * height * quality.pixelRatio ** 2).toBeLessThanOrEqual((compact ? 1_100_000 : 2_600_000) + 1);
    expect(quality.pixelRatio).toBeLessThanOrEqual(compact ? 1.25 : 1.6);
    expect(quality.columns * quality.rows * 2).toBeLessThanOrEqual(32_256);
    expect(quality.noiseSize).toBe(compact ? 128 : 256);
    // Bounded effect pools: aurora curtains, lava fragments and the small reflection bake.
    expect(quality.auroraLayers).toBeGreaterThanOrEqual(3);
    expect(quality.auroraLayers).toBeLessThanOrEqual(4);
    expect(quality.ejecta).toBeLessThanOrEqual(14);
    expect(quality.bakeWidth * quality.bakeHeight).toBeLessThanOrEqual(512 * 192);
  }
  for (const aspect of [390 / 844, 412 / 915, 3 / 4, 1, 16 / 10, 16 / 9, 21 / 9, 0, NaN]) {
    const frame = toxicVolcanoFrame(aspect);
    expect(frame.scale).toBeGreaterThanOrEqual(0.6);
    expect(frame.scale).toBeLessThanOrEqual(1);
    // Centred or slightly right of centre.
    expect(frame.centerX).toBeGreaterThan(0);
    expect(frame.centerX).toBeLessThanOrEqual(0.06);
    if (aspect > 0) {
      for (const width of [1440, 390]) {
        const crater = volcanoPoint(0, TOXIC_VOLCANO.craterHeight, { width, height: width / aspect });
        expect(crater.x).toBeGreaterThanOrEqual(0.5);
        expect(crater.x).toBeLessThan(0.6);
        expect(crater.y).toBeGreaterThan(0.15);
        expect(crater.y).toBeLessThan(horizonRow({ width, height: width / aspect }));
      }
    }
  }
});

declare global {
  interface Window {
    __TOXIC_RENDER_INPUTS__?: Record<string, number | number[]>;
    __TOXIC_PROGRAMS__: WebGLProgram[];
    __TOXIC_RESOURCES__: {
      frames: Set<number>;
      buffers: Map<WebGLBuffer, WebGL2RenderingContext>;
      textures: Map<WebGLTexture, WebGL2RenderingContext>;
      programs: Map<WebGLProgram, WebGL2RenderingContext>;
      framebuffers: Map<WebGLFramebuffer, WebGL2RenderingContext>;
    };
  }
}

type Viewport = { width: number; height: number };
const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

function toxicCamera(viewport: Viewport) {
  const camera = new PerspectiveCamera(TOXIC_CAMERA.fov, viewport.width / viewport.height, 0.5, 16000);
  camera.position.set(...TOXIC_CAMERA.position);
  camera.lookAt(...TOXIC_CAMERA.target);
  camera.updateMatrixWorld();
  return camera;
}

// Screen fraction of a horizon tangent-plane point (x / -z, y / -z).
function skyPoint(x: number, y: number, viewport: Viewport) {
  const camera = toxicCamera(viewport);
  const point = new Vector3(x, y, -1).multiplyScalar(10000).add(camera.position).project(camera);
  return { x: (point.x + 1) / 2, y: (1 - point.y) / 2 };
}

// Screen fraction of a point in volcano units, which scale and shift with the viewport.
function volcanoPoint(x: number, y: number, viewport: Viewport) {
  const frame = toxicVolcanoFrame(viewport.width / viewport.height);
  return skyPoint(x * frame.scale + frame.centerX, y * frame.scale, viewport);
}

function horizonRow(viewport: Viewport) {
  return skyPoint(0, 0, viewport).y;
}

function eruptionInputs(ageSeconds: number): Record<string, number | number[]> {
  const phases = toxicEruptionPhases(ageSeconds);
  return {
    eruption: phases.envelope, eruptionAge: ageSeconds, eruptionPressure: phases.pressure, eruptionFountain: phases.fountain,
    eruptionFlare: phases.flare, eruptionFront: phases.front, eruptionAurora: phases.aurora,
    eruptionLightning: phases.lightning, eruptionSeed: [1, phases.flash],
  };
}

const UNIFORMS = [
  "time", "skyTime", "magmaTime", "waterEnergy", "turbulence", "auroraBass", "auroraMids", "auroraHighs",
  "fissureGlow", "moltenPulse", "moltenTrail", "sparkEnergy", "eruption", "eruptionAge", "eruptionPressure",
  "eruptionFountain", "eruptionFlare", "eruptionFront", "eruptionAurora", "eruptionLightning",
] as const;

async function runtime(page: Page): Promise<RuntimeTestSnapshot> {
  return page.evaluate(() => window.__DSFM_TEST__!);
}

const canvas = (page: Page) => page.getByLabel("Toxic Horizon canvas");

// The sky, water and reflection-bake programs each keep only the uniforms they use.
async function renderedUniforms(page: Page) {
  return canvas(page).evaluate((element, names) => new Promise<Record<string, number>>((resolve) => {
    requestAnimationFrame(() => {
      const gl = (element as HTMLCanvasElement).getContext("webgl2")!;
      const programs = window.__TOXIC_PROGRAMS__.filter((program) => gl.isProgram(program));
      const values: Record<string, number> = {};
      for (const name of names) {
        for (const program of programs) {
          const location = gl.getUniformLocation(program, name);
          if (!location) continue;
          const value: unknown = gl.getUniform(program, location);
          if (typeof value !== "number") throw new Error(`Expected a numeric rendered uniform: ${name}`);
          values[name] = value;
          break;
        }
        if (!(name in values)) throw new Error(`Missing rendered uniform: ${name}`);
      }
      resolve(values);
    });
  }), [...UNIFORMS]);
}

// Exercise the real compiled shaders at deterministic poses without a production debug API.
async function setRenderedInputs(page: Page, inputs: Record<string, number | number[]>) {
  await page.evaluate((values) => {
    if (!window.__TOXIC_RENDER_INPUTS__) {
      const draw = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function (mode, count, type, offset) {
        const program: WebGLProgram | null = this.getParameter(this.CURRENT_PROGRAM);
        if (program) {
          for (const [name, value] of Object.entries(window.__TOXIC_RENDER_INPUTS__!)) {
            const location = this.getUniformLocation(program, name);
            if (!location) continue;
            if (typeof value === "number") this.uniform1f(location, value);
            else if (value.length === 2) this.uniform2fv(location, value);
            else this.uniform3fv(location, value);
          }
        }
        draw.call(this, mode, count, type, offset);
      };
    }
    window.__TOXIC_RENDER_INPUTS__ = values;
  }, inputs);
}

async function renderedImage(page: Page) {
  return canvas(page).evaluate((element) => new Promise<number[]>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const sample = document.createElement("canvas");
      sample.width = 160;
      sample.height = 100;
      const context = sample.getContext("2d")!;
      context.drawImage(element as HTMLCanvasElement, 0, 0, 160, 100);
      resolve(Array.from(context.getImageData(0, 0, 160, 100).data));
    }));
  }));
}

function imageDifference(a: number[], b: number[]) {
  let total = 0;
  for (let index = 0; index < a.length; index += 4) {
    total += Math.abs(a[index] - b[index]) + Math.abs(a[index + 1] - b[index + 1]) + Math.abs(a[index + 2] - b[index + 2]);
  }
  return total / (a.length / 4 * 3);
}

type Region = [x0: number, y0: number, x1: number, y1: number];

type RegionSample = { mean: number[]; peak: number[]; green: number };

// Mean colour, peak colour and share of clearly green pixels in screen-fraction rectangles,
// read from the real drawing buffer.
async function regions<T extends Record<string, Region>>(page: Page, rectangles: T) {
  return canvas(page).evaluate((element, input) => new Promise<Record<string, RegionSample>>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const source = element as HTMLCanvasElement;
      const sample = document.createElement("canvas");
      sample.width = source.width;
      sample.height = source.height;
      const context = sample.getContext("2d")!;
      context.drawImage(source, 0, 0);
      const { data } = context.getImageData(0, 0, sample.width, sample.height);
      const result: Record<string, RegionSample> = {};
      for (const [name, [x0, y0, x1, y1]] of Object.entries(input)) {
        const mean = [0, 0, 0];
        let peak = [0, 0, 0];
        let count = 0;
        let green = 0;
        const left = Math.max(0, Math.floor(Math.min(x0, x1) * sample.width));
        const right = Math.min(sample.width - 1, Math.floor(Math.max(x0, x1) * sample.width));
        const top = Math.max(0, Math.floor(Math.min(y0, y1) * sample.height));
        const bottom = Math.min(sample.height - 1, Math.floor(Math.max(y0, y1) * sample.height));
        for (let y = top; y <= bottom; y++) {
          for (let x = left; x <= right; x++) {
            const offset = (y * sample.width + x) * 4;
            const color = [data[offset], data[offset + 1], data[offset + 2]];
            color.forEach((value, channel) => { mean[channel] += value; });
            if (color[0] + color[1] + color[2] > peak[0] + peak[1] + peak[2]) peak = color;
            if (color[1] > 40 && color[1] > color[0] * 1.3 && color[1] > color[2] * 1.3) green++;
            count++;
          }
        }
        result[name] = { mean: mean.map((value) => value / Math.max(1, count)), peak, green: green / Math.max(1, count) };
      }
      resolve(result);
    }));
  }), rectangles) as Promise<Record<keyof T, RegionSample>>;
}

const luminance = (color: number[]) => (color[0] + color[1] + color[2]) / 3;
const saturation = (color: number[]) => (Math.max(...color) - Math.min(...color)) / Math.max(1, Math.max(...color));

function sceneRegions(viewport: Viewport): Record<string, Region> {
  const crater = volcanoPoint(0, TOXIC_VOLCANO.craterHeight, viewport);
  const horizon = horizonRow(viewport);
  const fountainTop = volcanoPoint(0.04, TOXIC_VOLCANO.craterHeight + 0.2, viewport);
  const fountainBase = volcanoPoint(-0.03, TOXIC_VOLCANO.craterHeight + 0.02, viewport);
  const flankTop = volcanoPoint(-0.2, 0.11, viewport);
  const flankBottom = volcanoPoint(0.2, 0.02, viewport);
  const auroraNear = skyPoint(-0.2, 0.34, viewport);
  const auroraFar = skyPoint(-0.08, 0.12, viewport);
  return {
    crater: [crater.x - 0.006, crater.y - 0.008, crater.x + 0.006, crater.y + 0.008],
    fountain: [fountainBase.x, fountainTop.y, fountainTop.x, fountainBase.y],
    flanks: [flankTop.x, flankTop.y, flankBottom.x, flankBottom.y],
    aurora: [auroraNear.x, auroraNear.y, auroraFar.x, auroraFar.y],
    zenith: [0.05, 0, 0.95, 0.03],
    // The broken molten path runs from the horizon toward the viewer under the crater.
    path: [crater.x - 0.05, horizon + 0.06, crater.x + 0.05, 0.98],
    openWater: [0.02, horizon + 0.08, crater.x - 0.2, 0.98],
  };
}

const pose = { time: 17, skyTime: 7, magmaTime: 11, waterEnergy: 0.6, turbulence: 1.1, fissureGlow: 0.4 };

async function toggle(page: Page, name: "Chroma" | "Motion" | "Info") {
  await page.locator("label").filter({ hasText: new RegExp(`^${name}$`) }).click();
  await page.waitForTimeout(100);
}

function watchShaders(page: Page) {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()) && /THREE|WebGL: INVALID|shader/i.test(message.text())) messages.push(message.text());
  });
  return messages;
}

const hideControls = '[aria-label="Toxic Horizon controls"], .visual-feed-window { opacity: 0 !important; }';

test.describe("Toxic Horizon player", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__TOXIC_PROGRAMS__ = [];
      const createProgram = WebGL2RenderingContext.prototype.createProgram;
      WebGL2RenderingContext.prototype.createProgram = function () {
        const program = createProgram.call(this);
        if (program) window.__TOXIC_PROGRAMS__.push(program);
        return program;
      };
    });
    await page.goto("/player/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByLabel("Visual environment").selectOption("toxic-horizon");
  });

  test("registers under 3D Experiences, renders slime, sky and volcano, persists and ignores navigation input", async ({ page, pageErrors }, testInfo) => {
    const shaderMessages = watchShaders(page);
    const selector = page.getByLabel("Visual environment");
    await expect(selector.locator('optgroup[label="3D EXPERIENCES"] option[value="toxic-horizon"]')).toHaveText("Toxic Horizon");
    await expect(selector.locator('option[value="twilight-tides"]')).toHaveCount(1);
    await page.reload();
    await expect(selector).toHaveValue("toxic-horizon");
    await expect(canvas(page)).toHaveCount(1);
    await expect(page.getByLabel("Toxic Horizon environment")).toHaveCount(1);
    await expect(page.getByLabel("Motion")).toBeEnabled();
    await expect(page.getByLabel("Toggle environment chroma effects")).toBeEnabled();
    expect((await runtime(page)).environment.id).toBe("toxic-horizon");
    await setRenderedInputs(page, pose);
    const still = await renderedImage(page);
    const scene = await regions(page, sceneRegions(desktop));
    // Predominantly green liquid with dark troughs, under a near-black zenith.
    expect(scene.openWater.mean[1]).toBeGreaterThan(scene.openWater.mean[0] * 1.5);
    expect(scene.openWater.mean[1]).toBeGreaterThan(scene.openWater.mean[2] * 1.5);
    expect(scene.openWater.peak[1]).toBeGreaterThan(150);
    expect(luminance(scene.openWater.mean)).toBeLessThan(90);
    expect(luminance(scene.zenith.mean)).toBeLessThan(12);
    // A glowing crater above purple and orange fissures on dark rock.
    expect(scene.crater.mean[0]).toBeGreaterThan(150);
    expect(scene.crater.mean[0]).toBeGreaterThan(scene.crater.mean[2] * 1.3);
    expect(scene.flanks.peak[0]).toBeGreaterThan(150);
    expect(luminance(scene.flanks.mean)).toBeLessThan(70);
    expect(scene.flanks.mean[0] + scene.flanks.mean[2]).toBeGreaterThan(scene.flanks.mean[1] * 3);
    // The crater's molten path is mirrored into the liquid as warm, broken light.
    expect(scene.path.mean[0]).toBeGreaterThan(scene.openWater.mean[0] + 12);
    expect(scene.path.peak[0]).toBeGreaterThan(120);
    await page.mouse.move(900, 450);
    await page.mouse.down();
    await page.mouse.move(600, 300, { steps: 10 });
    await page.mouse.up();
    await page.mouse.wheel(0, 300);
    expect(await renderedImage(page)).toEqual(still);
    await toggle(page, "Info");
    expect(await renderedImage(page)).toEqual(still);
    await page.screenshot({ path: testInfo.outputPath("toxic-horizon-desktop.png"), style: hideControls });
    await page.screenshot({ path: testInfo.outputPath("toxic-horizon-desktop-controls.png") });
    await page.setViewportSize(mobile);
    await page.reload();
    await expect(canvas(page)).toBeVisible();
    await setRenderedInputs(page, pose);
    const compact = await regions(page, sceneRegions(mobile));
    expect(compact.crater.mean[0]).toBeGreaterThan(150);
    expect(compact.openWater.mean[1]).toBeGreaterThan(compact.openWater.mean[0] * 1.5);
    await page.screenshot({ path: testInfo.outputPath("toxic-horizon-mobile.png"), style: hideControls });
    await expect.poll(async () => (await runtime(page)).environment.renderFps).toBeGreaterThan(0);
    const drawingBuffer = await canvas(page).evaluate((element) => {
      const source = element as HTMLCanvasElement;
      return { width: source.width, height: source.height };
    });
    expect(drawingBuffer.width * drawingBuffer.height).toBeLessThanOrEqual(1_100_000 + 1500);
    await testInfo.attach("toxic-horizon-render-observation", {
      body: JSON.stringify({ scene, compact, drawingBuffer, runtime: await runtime(page) }), contentType: "application/json",
    });
    expect(shaderMessages).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("horizon stays straight, seam-free and anchored under the volcano at desktop and mobile sizes", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const measurements = [];
    for (const viewport of [desktop, { width: 1280, height: 733 }, mobile, { width: 412, height: 915 }]) {
      await page.setViewportSize(viewport);
      await page.reload();
      await setRenderedInputs(page, pose);
      const horizon = horizonRow(viewport);
      // Twilight's camera places the horizon slightly above the vertical centre.
      expect(horizon).toBeGreaterThan(0.42);
      expect(horizon).toBeLessThan(0.46);
      const crater = volcanoPoint(0, TOXIC_VOLCANO.craterHeight, viewport);
      const columns = [0.03, 0.1, 0.17, 0.83, 0.9, 0.97];
      const strips: Record<string, Region> = {};
      for (const [index, x] of columns.entries()) {
        strips[`above${index}`] = [x - 0.025, horizon - 0.05, x + 0.025, horizon - 0.012];
        strips[`below${index}`] = [x - 0.025, horizon + 0.04, x + 0.025, horizon + 0.10];
        strips[`seamSky${index}`] = [x - 0.025, horizon - 0.003, x + 0.025, horizon - 0.0008];
        strips[`seamWater${index}`] = [x - 0.025, horizon + 0.0008, x + 0.025, horizon + 0.003];
      }
      strips.foot = [crater.x - 0.04, horizon - 0.04, crater.x + 0.04, horizon - 0.012];
      strips.crater = [crater.x - 0.006, crater.y - 0.008, crater.x + 0.006, crater.y + 0.008];
      const scene = await regions(page, strips);
      const seams = [];
      for (const index of columns.keys()) {
        // Green crests below the predicted row and none above it, at both edges of every viewport.
        expect(scene[`below${index}`].green, `${viewport.width}x${viewport.height} column ${index}`).toBeGreaterThan(0.05);
        expect(scene[`above${index}`].green, `${viewport.width}x${viewport.height} column ${index}`).toBe(0);
        // The far liquid dissolves into the glowing zero-elevation haze: no hard finite-grid seam.
        const seam = Math.abs(luminance(scene[`seamSky${index}`].mean) - luminance(scene[`seamWater${index}`].mean));
        seams.push(seam);
      }
      expect(Math.max(...seams), JSON.stringify(seams)).toBeLessThan(18);
      // The mountain sits on the horizon under its crater at every aspect ratio.
      expect(scene.foot.green).toBe(0);
      expect(scene.crater.mean[0]).toBeGreaterThan(150);
      measurements.push({ viewport, horizon, crater, seams, green: [...columns.keys()].map((index) => scene[`below${index}`].green) });
    }
    await testInfo.attach("toxic-horizon-horizon", { body: JSON.stringify(measurements), contentType: "application/json" });
  });

  test("eruption renders fountain, fragments, lightning, fissure flare, aurora growth and a molten reflection, then recovers", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(90_000);
    const shaderMessages = watchShaders(page);
    const measurements = [];
    for (const viewport of [desktop, mobile]) {
      await page.setViewportSize(viewport);
      await page.reload();
      if (await page.getByLabel("Toggle signal info").isChecked()) await toggle(page, "Info");
      const areas = sceneRegions(viewport);
      await setRenderedInputs(page, { ...pose, ...eruptionInputs(TOXIC_SURGE.durationSeconds) });
      const baselineImage = await renderedImage(page);
      const baseline = await regions(page, areas);
      await setRenderedInputs(page, pose);
      expect(await renderedImage(page)).toEqual(baselineImage);
      await setRenderedInputs(page, { ...pose, ...eruptionInputs(1.25) });
      const peak = await regions(page, areas);
      await page.screenshot({ path: testInfo.outputPath(`toxic-eruption-${viewport.width}.png`), style: hideControls });
      // Fountain and crater pressure above the vent.
      expect(luminance(peak.fountain.mean)).toBeGreaterThan(luminance(baseline.fountain.mean) + 25);
      expect(peak.fountain.mean[0]).toBeGreaterThan(peak.fountain.mean[1] * 1.2);
      // Energy flares down the fissures while the rock stays dark.
      expect(luminance(peak.flanks.mean)).toBeGreaterThan(luminance(baseline.flanks.mean) * 1.25);
      // The aurora brightens and widens.
      expect(luminance(peak.aurora.mean)).toBeGreaterThan(luminance(baseline.aurora.mean) * 1.2);
      // The reflection follows through the same rippled liquid; the open slime stays green.
      expect(luminance(peak.path.mean)).toBeGreaterThan(luminance(baseline.path.mean) + 4);
      expect(peak.openWater.mean[1]).toBeGreaterThan(peak.openWater.mean[0] * 1.3);
      expect(luminance(peak.zenith.mean)).toBeLessThan(40);
      // Lightning alone: brief bolts near the plume, not a full-screen flash.
      const flashAge = TOXIC_LIGHTNING_FLASHES[1] + 0.03;
      await setRenderedInputs(page, { ...pose, ...eruptionInputs(flashAge) });
      const flash = await renderedImage(page);
      await setRenderedInputs(page, { ...pose, ...eruptionInputs(flashAge), eruptionLightning: 0 });
      const dark = await renderedImage(page);
      const lightning = imageDifference(flash, dark);
      expect(lightning).toBeGreaterThan(0.05);
      expect(lightning).toBeLessThan(6);
      // Lava fragments exist only inside the event and are gone before it ends.
      await setRenderedInputs(page, { ...pose, ...eruptionInputs(1.6) });
      const fragments = await renderedImage(page);
      await setRenderedInputs(page, { ...pose, ...eruptionInputs(1.6), eruptionAge: 0.1 });
      expect(imageDifference(fragments, await renderedImage(page))).toBeGreaterThan(0.02);
      await setRenderedInputs(page, { ...pose, ...eruptionInputs(3.1) });
      const late = imageDifference(await renderedImage(page), baselineImage);
      expect(late).toBeLessThan(1.5);
      // CHROMA OFF keeps a visible, subdued eruption in fixed authored colours.
      await toggle(page, "Chroma");
      await setRenderedInputs(page, pose);
      const offBaseline = await regions(page, areas);
      await setRenderedInputs(page, { ...pose, ...eruptionInputs(1.25) });
      const offPeak = await regions(page, areas);
      const onRise = luminance(peak.fountain.mean) - luminance(baseline.fountain.mean);
      const offRise = luminance(offPeak.fountain.mean) - luminance(offBaseline.fountain.mean);
      expect(offRise).toBeGreaterThan(8);
      expect(offRise).toBeLessThan(onRise * 0.85);
      await toggle(page, "Chroma");
      // Everything subsides to exactly the ambient frame.
      await setRenderedInputs(page, { ...pose, ...eruptionInputs(TOXIC_SURGE.durationSeconds) });
      expect(await renderedImage(page)).toEqual(baselineImage);
      measurements.push({ viewport, baseline, peak, offBaseline, offPeak, lightning, late });
    }
    await testInfo.attach("toxic-eruption-measurements", { body: JSON.stringify(measurements), contentType: "application/json" });
    expect(shaderMessages).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("CHROMA ON and OFF are distinct while OFF keeps its authored green, purple and orange identity", async ({ page }, testInfo) => {
    await setRenderedInputs(page, pose);
    const areas = sceneRegions(desktop);
    const onImage = await renderedImage(page);
    const on = await regions(page, areas);
    await toggle(page, "Chroma");
    await expect(page.getByLabel("Toggle environment chroma effects")).not.toBeChecked();
    const offImage = await renderedImage(page);
    const off = await regions(page, areas);
    await page.screenshot({ path: testInfo.outputPath("toxic-horizon-chroma-off.png"), style: hideControls });
    expect(imageDifference(onImage, offImage)).toBeGreaterThan(4);
    // Restrained, not grayscale: dark emerald slime, purple fissures and an orange crater remain.
    expect(luminance(off.openWater.mean)).toBeLessThan(luminance(on.openWater.mean) * 0.8);
    expect(off.openWater.mean[1]).toBeGreaterThan(off.openWater.mean[0] * 1.5);
    expect(off.openWater.mean[1]).toBeGreaterThan(off.openWater.mean[2] * 1.5);
    expect(saturation(off.openWater.mean)).toBeGreaterThan(0.4);
    expect(off.crater.mean[0]).toBeGreaterThan(off.crater.mean[2] * 1.3);
    expect(off.crater.mean[0]).toBeGreaterThan(80);
    expect(off.flanks.peak[2]).toBeGreaterThan(off.flanks.peak[1] * 1.5);
    expect(luminance(off.flanks.peak)).toBeLessThan(luminance(on.flanks.peak));
    expect(luminance(off.aurora.mean)).toBeLessThan(luminance(on.aurora.mean) * 0.8);
    expect(luminance(off.aurora.mean)).toBeGreaterThan(luminance(off.zenith.mean));
    // No travelling hue or band accents: aurora bands cannot change the CHROMA OFF frame.
    await setRenderedInputs(page, { ...pose, auroraBass: 1, auroraMids: 1, auroraHighs: 1, moltenPulse: 1, moltenTrail: 1, sparkEnergy: 1 });
    const accents = imageDifference(await renderedImage(page), offImage);
    expect(accents).toBeLessThan(0.05);
    await toggle(page, "Chroma");
    await setRenderedInputs(page, { ...pose, auroraBass: 1, auroraMids: 1, auroraHighs: 1, moltenPulse: 1, moltenTrail: 1, sparkEnergy: 1 });
    expect(imageDifference(await renderedImage(page), onImage)).toBeGreaterThan(0.3);
    await testInfo.attach("toxic-horizon-chroma", { body: JSON.stringify({ on, off, accents }), contentType: "application/json" });
  });

  test("real demo drives bands, mute settles them, MOTION freezes clocks independently and pause freezes all", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(60_000);
    await page.getByLabel("Signal source").selectOption("demo-psychedelic-experience");
    const initial = await renderedUniforms(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => {
      const values = await renderedUniforms(page);
      return Math.min(values.auroraBass, values.auroraMids, values.auroraHighs, values.fissureGlow, values.sparkEnergy);
    }, { timeout: 20_000 }).toBeGreaterThan(0.03);
    await expect.poll(async () => (await renderedUniforms(page)).moltenTrail, { timeout: 20_000 }).toBeGreaterThan(0.03);
    const musical = await renderedUniforms(page);
    for (const name of ["time", "skyTime", "magmaTime"] as const) expect(musical[name]).toBeGreaterThan(initial[name]);
    expect(musical.turbulence).toBeGreaterThan(0.7);
    expect(musical.turbulence).toBeLessThanOrEqual(1.55);
    // Sustained high energy and ordinary kicks never start an eruption by themselves.
    expect((await runtime(page)).environment.surgeCount).toBe(0);
    await page.getByRole("slider", { name: "Volume" }).fill("0");
    await expect.poll(async () => {
      const values = await renderedUniforms(page);
      return Math.max(values.auroraBass, values.auroraMids, values.auroraHighs, values.fissureGlow, values.moltenPulse, values.moltenTrail, values.sparkEnergy, values.waterEnergy);
    }, { timeout: 20_000 }).toBeLessThan(0.005);
    const muted = await renderedUniforms(page);
    await page.waitForTimeout(400);
    // The quiet baseline still breathes: water, sky and magma keep their slow ambient drift.
    const drifting = await renderedUniforms(page);
    for (const name of ["time", "skyTime", "magmaTime"] as const) expect(drifting[name]).toBeGreaterThan(muted[name]);
    await page.getByRole("slider", { name: "Volume" }).fill("1");
    await expect.poll(async () => (await renderedUniforms(page)).fissureGlow, { timeout: 20_000 }).toBeGreaterThan(0.05);
    await toggle(page, "Motion");
    const frozen = await renderedUniforms(page);
    await page.waitForTimeout(450);
    expect(await renderedUniforms(page)).toEqual(frozen);
    // CHROMA OFF removes the independent colour response, leaving a fully still frame.
    await toggle(page, "Chroma");
    const still = await renderedImage(page);
    await page.waitForTimeout(350);
    expect(await renderedImage(page)).toEqual(still);
    await toggle(page, "Chroma");
    await toggle(page, "Motion");
    await expect(page.getByLabel("Motion")).toBeChecked();
    await expect.poll(async () => (await renderedUniforms(page)).magmaTime).toBeGreaterThan(frozen.magmaTime);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForTimeout(150);
    const paused = await renderedUniforms(page);
    const pausedImage = await renderedImage(page);
    await page.waitForTimeout(400);
    expect(await renderedUniforms(page)).toEqual(paused);
    expect(await renderedImage(page)).toEqual(pausedImage);
    await expect(page.getByLabel("Motion")).toBeChecked();
    await testInfo.attach("toxic-horizon-real-audio", { body: JSON.stringify({ musical, muted, frozen, paused }), contentType: "application/json" });
    expect(pageErrors).toEqual([]);
  });

  test("real demo qualifies one eruption near 26 seconds and freezes it with playback and Motion", async ({ page, pageErrors }, testInfo) => {
    test.setTimeout(100_000);
    await page.getByLabel("Signal source").selectOption("demo-psychedelic-experience");
    await page.setViewportSize(desktop);
    if (await page.getByLabel("Toggle signal info").isChecked()) await toggle(page, "Info");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await renderedUniforms(page)).eruptionFountain,
      { timeout: 45_000, intervals: [50] }).toBeGreaterThan(0.9);
    const triggerTime = Number(await page.getByLabel("Seek playback").inputValue());
    expect(triggerTime).toBeGreaterThan(23);
    expect(triggerTime).toBeLessThan(31);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForTimeout(150);
    const paused = await renderedUniforms(page);
    expect(paused.eruption).toBeGreaterThan(0.5);
    expect(paused.eruptionAge).toBeGreaterThan(0.5);
    expect(paused.eruptionAge).toBeLessThan(TOXIC_SURGE.durationSeconds);
    const image = await renderedImage(page);
    await page.waitForTimeout(400);
    expect(await renderedUniforms(page)).toEqual(paused);
    expect(await renderedImage(page)).toEqual(image);
    await expect.poll(async () => (await runtime(page)).environment.surgeCount).toBe(1);
    const telemetry = (await runtime(page)).environment;
    // The capped simulation clock may lag media playback on slow renderers.
    expect(telemetry.lastSurgeAt).toBeGreaterThan(0);
    expect(telemetry.lastSurgeAt).toBeLessThanOrEqual(triggerTime * 1000);
    await page.screenshot({ path: testInfo.outputPath("toxic-eruption-real-demo.png"), style: hideControls });
    // Compare the held eruption with the ambient frame in alternating windows of the same paused
    // scene, so unrelated load on the test machine cannot skew one side.
    const held: Record<string, number | number[]> = { eruptionSeed: [1, toxicEruptionPhases(paused.eruptionAge).flash] };
    for (const name of UNIFORMS) if (name.startsWith("eruption")) held[name] = paused[name];
    const performance = [];
    for (const viewport of [desktop, mobile]) {
      await page.setViewportSize(viewport);
      const fps = { eruption: [] as number[], ambient: [] as number[] };
      for (let round = 0; round < 2; round++) {
        for (const phase of ["eruption", "ambient"] as const) {
          await setRenderedInputs(page, phase === "eruption" ? held : eruptionInputs(TOXIC_SURGE.durationSeconds));
          await page.waitForTimeout(2200);
          const sample = (await runtime(page)).environment.renderFps;
          expect(sample).toBeGreaterThan(0);
          fps[phase].push(sample!);
        }
      }
      expect(Math.max(...fps.eruption), JSON.stringify(fps)).toBeGreaterThan(Math.max(...fps.ambient) * 0.65);
      performance.push({ viewport, ...fps });
    }
    await page.setViewportSize(desktop);
    // Hand the real, unchanged uniform values back before releasing the override.
    await setRenderedInputs(page, held);
    await page.waitForTimeout(150);
    await setRenderedInputs(page, {});
    expect(await renderedUniforms(page)).toEqual(paused);
    // MOTION OFF holds the same event age while playback resumes; CHROMA cannot advance it either.
    await toggle(page, "Motion");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForTimeout(500);
    expect(await renderedUniforms(page)).toEqual(paused);
    await toggle(page, "Chroma");
    await page.waitForTimeout(350);
    expect(await renderedUniforms(page)).toEqual(paused);
    await toggle(page, "Chroma");
    // An OS reduced-motion preference cannot override the explicit choice in either direction.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(350);
    expect(await renderedUniforms(page)).toEqual(paused);
    await expect(page.getByLabel("Motion")).not.toBeChecked();
    await toggle(page, "Motion");
    await expect(page.getByLabel("Motion")).toBeChecked();
    await expect.poll(async () => (await renderedUniforms(page)).eruptionAge).toBeGreaterThan(paused.eruptionAge);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // The remaining eligible time plays out and every eruption input returns to zero.
    await expect.poll(async () => (await renderedUniforms(page)).eruption, { intervals: [100] }).toBe(0);
    const finished = await renderedUniforms(page);
    for (const name of ["eruptionPressure", "eruptionFountain", "eruptionFlare", "eruptionFront", "eruptionAurora", "eruptionLightning"] as const) {
      expect(finished[name], name).toBe(0);
    }
    expect(finished.eruptionAge).toBeCloseTo(TOXIC_SURGE.durationSeconds, 5);
    expect((await runtime(page)).environment.surgeCount).toBe(1);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await testInfo.attach("toxic-real-eruption", { body: JSON.stringify({ triggerTime, paused, telemetry, performance }), contentType: "application/json" });
    // Switching away clears the scene and its telemetry; returning starts a fresh event counter.
    await page.getByLabel("Visual environment").selectOption("minimal");
    await expect(canvas(page)).toHaveCount(0);
    await page.getByLabel("Visual environment").selectOption("toxic-horizon");
    await expect.poll(async () => (await runtime(page)).environment.surgeCount).toBe(0);
    expect(pageErrors).toEqual([]);
  });

  test("reduced motion defaults MOTION off, explicit ON animates and the preference survives the scene", async ({ page, pageErrors }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.getByLabel("Signal source").selectOption("demo-psychedelic-experience");
    await toggle(page, "Chroma");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(async () => (await runtime(page)).audio.smoothedEnergy, { timeout: 15_000 }).toBeGreaterThan(0.05);
    const frozen = await renderedImage(page);
    await page.waitForTimeout(400);
    expect(await renderedImage(page)).toEqual(frozen);
    await expect(page.getByLabel("Motion")).not.toBeChecked();
    const clocks = await renderedUniforms(page);
    await toggle(page, "Motion");
    await expect.poll(async () => (await renderedUniforms(page)).skyTime).toBeGreaterThan(clocks.skyTime);
    // Entering or leaving the scene never rewrites the user's MOTION choice.
    await page.getByLabel("Visual environment").selectOption("twilight-tides");
    await expect(page.getByLabel("Motion")).toBeChecked();
    await page.getByLabel("Visual environment").selectOption("toxic-horizon");
    await expect(page.getByLabel("Motion")).toBeChecked();
    expect(pageErrors).toEqual([]);
  });

  test("observes uninstrumented playback FPS on desktop and compact viewports", async ({ page }, testInfo) => {
    test.setTimeout(45_000);
    const observations = [];
    for (const viewport of [desktop, mobile]) {
      await page.setViewportSize(viewport);
      await page.reload();
      await page.getByLabel("Signal source").selectOption("demo-psychedelic-experience");
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
    await testInfo.attach("toxic-horizon-uninstrumented-fps", { body: JSON.stringify(observations), contentType: "application/json" });
  });

  test("keeps rendering the same frame after WebGL context restoration", async ({ page, pageErrors }) => {
    const before = await renderedImage(page);
    await canvas(page).evaluate((element) => new Promise<void>((resolve) => {
      const gl = (element as HTMLCanvasElement).getContext("webgl2")!;
      const extension = gl.getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("Context-loss testing requires WEBGL_lose_context");
      element.addEventListener("webglcontextrestored", () => resolve(), { once: true });
      extension.loseContext();
      setTimeout(() => extension.restoreContext(), 250);
    }));
    // Generated textures and the per-frame reflection bake rebuild themselves.
    await expect.poll(() => renderedImage(page)).toEqual(before);
    await expect.poll(async () => (await runtime(page)).environment.renderFps).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  test("releases GPU resources and its owning loop across repeated switches and StrictMode-style remounts", async ({ page, pageErrors }) => {
    await page.addInitScript(() => {
      const resources = { frames: new Set<number>(), buffers: new Map<WebGLBuffer, WebGL2RenderingContext>(), textures: new Map<WebGLTexture, WebGL2RenderingContext>(), programs: new Map<WebGLProgram, WebGL2RenderingContext>(), framebuffers: new Map<WebGLFramebuffer, WebGL2RenderingContext>() };
      window.__TOXIC_RESOURCES__ = resources;
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
      const resources = window.__TOXIC_RESOURCES__;
      const active = (values: Map<unknown, WebGL2RenderingContext>) => [...values.values()].filter((context) => !context.isContextLost()).length;
      return { frames: resources.frames.size, buffers: active(resources.buffers), textures: active(resources.textures),
        programs: active(resources.programs), framebuffers: active(resources.framebuffers) };
    });
    const selector = page.getByLabel("Visual environment");
    const fps = page.locator(".visual-feed-window__fps .visual-feed-window__metric-value");
    await selector.selectOption("minimal");
    const baseline = await counts();
    let first: Awaited<ReturnType<typeof counts>> | null = null;
    for (const away of ["minimal", "twilight-tides", "minimal"]) {
      await selector.selectOption("toxic-horizon");
      await expect(canvas(page)).toHaveCount(1);
      await expect.poll(async () => Number(await fps.textContent())).toBeGreaterThan(0);
      const mounted = await counts();
      // One owning loop, three programs (sky, water, reflection bake) and one small bake target.
      expect(mounted.frames).toBe(baseline.frames + 1);
      expect(mounted.programs).toBe(baseline.programs + 3);
      expect(mounted.framebuffers).toBeGreaterThan(baseline.framebuffers);
      expect(mounted.textures).toBeGreaterThan(baseline.textures);
      first ??= mounted;
      expect(mounted).toEqual(first);
      // A full eruption allocates nothing: every effect is analytic and bounded.
      await setRenderedInputs(page, eruptionInputs(1.25));
      await page.waitForTimeout(250);
      expect(await counts()).toEqual(mounted);
      await setRenderedInputs(page, {});
      await selector.selectOption(away);
      await expect(page.getByLabel("Toxic Horizon environment")).toHaveCount(0);
      if (away === "minimal") {
        await expect(fps).toHaveText("---");
        await expect.poll(counts).toEqual(baseline);
      } else {
        // Twilight Tides still mounts and reports beside its new sibling.
        await expect(page.getByLabel("Twilight Tides canvas")).toHaveCount(1);
        await expect.poll(async () => (await runtime(page)).environment.id).toBe("twilight-tides");
        await selector.selectOption("minimal");
        await expect.poll(counts).toEqual(baseline);
      }
    }
    expect(pageErrors).toEqual([]);
  });
});
