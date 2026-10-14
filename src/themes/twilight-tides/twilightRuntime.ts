import type { AudioReactiveSnapshot } from "../../app/playerTypes";

type TwilightAudio = Pick<AudioReactiveSnapshot, "isActive" | "smoothedEnergy">;

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
  return { time: 0, waterEnergy: 0, colorEnergy: 0 };
}

export function updateTwilightState(
  state: ReturnType<typeof createTwilightState>,
  deltaSeconds: number,
  controls: { isPlaying: boolean; motionEnabled: boolean; reducedMotion: boolean },
  snapshot?: TwilightAudio | null,
) {
  const dt = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(deltaSeconds, 0.05)) : 0;
  const energy = snapshot?.isActive && Number.isFinite(snapshot.smoothedEnergy)
    ? Math.max(0, Math.min(1, snapshot.smoothedEnergy)) : 0;
  const response = 1 - Math.exp(-dt * 1.2);
  if (controls.isPlaying) {
    state.colorEnergy += (energy - state.colorEnergy) * response;
  }
  if (controls.isPlaying && controls.motionEnabled && !controls.reducedMotion) {
    state.waterEnergy += (energy - state.waterEnergy) * response;
    state.time += dt * (0.75 + state.waterEnergy * 0.18);
  }
}
