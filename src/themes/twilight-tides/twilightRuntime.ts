import type { AudioReactiveSnapshot } from "../../app/playerTypes";

type TwilightAudio = Pick<AudioReactiveSnapshot, "isActive" | "smoothedEnergy"> &
  Partial<Pick<AudioReactiveSnapshot, "bass" | "highs">>;

export const TWILIGHT_PALETTE_SECONDS = 300;
export const TWILIGHT_FIRST_METEOR_SECONDS = 8;

export const TWILIGHT_METEOR_PATHS = [
  [0.15, 0.38, -0.03, 0.29],
  [0.07, 0.35, 0.20, 0.27],
  [0.19, 0.37, 0.02, 0.28],
  [-0.18, 0.36, -0.02, 0.27],
  [-0.06, 0.39, -0.19, 0.30],
  [-0.14, 0.34, 0.03, 0.265],
] as const;

function unit(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function twilightMusicEnergy(snapshot?: TwilightAudio | null) {
  if (!snapshot?.isActive) return 0;
  return Math.pow(unit((unit(snapshot.smoothedEnergy) - 0.015) / 0.485), 0.75);
}

function damp(current: number, target: number, dt: number, attack: number, release: number) {
  return current + (target - current) * (1 - Math.exp(-dt * (target > current ? attack : release)));
}

export function twilightQuality(width: number, height: number, devicePixelRatio: number, constrained: boolean) {
  const compact = constrained || Math.min(width, height) < 600;
  const pixelBudget = compact ? 1_100_000 : 2_600_000;
  return {
    pixelRatio: Math.min(devicePixelRatio || 1, compact ? 1.25 : 1.6, Math.sqrt(pixelBudget / Math.max(1, width * height))),
    reflectionSize: compact ? 128 : 256,
    columns: compact ? 72 : 112,
    rows: compact ? 96 : 144,
  };
}

export function createTwilightState() {
  return {
    time: 0, skyTime: 0, paletteTime: 0,
    waterEnergy: 0, colorEnergy: 0, glintEnergy: 0,
    meteorWait: TWILIGHT_FIRST_METEOR_SECONDS, meteorProgress: 1, meteorCount: 0,
  };
}

export function updateTwilightState(
  state: ReturnType<typeof createTwilightState>,
  deltaSeconds: number,
  controls: { isPlaying: boolean; motionEnabled: boolean; reducedMotion: boolean; chromaEnabled?: boolean },
  snapshot?: TwilightAudio | null,
) {
  const dt = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(deltaSeconds, 0.05)) : 0;
  const energy = twilightMusicEnergy(snapshot);
  if (controls.isPlaying) {
    state.colorEnergy = damp(state.colorEnergy, energy, dt, 2.5, 1.5);
    const glint = energy * unit(unit(snapshot?.bass) * 0.65 + unit(snapshot?.highs) * 0.7);
    state.glintEnergy = damp(state.glintEnergy, glint, dt, 4, 2);
  }
  if (controls.isPlaying && controls.motionEnabled && !controls.reducedMotion) {
    const previousEnergy = state.waterEnergy;
    state.waterEnergy = damp(state.waterEnergy, energy, dt, 2.4, 1.6);
    const averageEnergy = (previousEnergy + state.waterEnergy) * 0.5;
    state.time += dt * (0.045 + averageEnergy * 1.10);
    state.skyTime += dt * (0.025 + averageEnergy * 0.40);
    if (controls.chromaEnabled !== false) state.paletteTime = (state.paletteTime + dt) % TWILIGHT_PALETTE_SECONDS;
    if (state.meteorProgress < 1) {
      state.meteorProgress = Math.min(1, state.meteorProgress + dt / 1.8);
    } else if (controls.chromaEnabled !== false && energy > 0.15) {
      state.meteorWait -= dt;
      if (state.meteorWait <= 0) {
        state.meteorCount += 1;
        state.meteorProgress = 0;
        state.meteorWait = state.meteorCount % 4 === 1 ? 2.8 : 8 + state.meteorCount * 7 % 9;
      }
    }
  }
}
