import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import { createToxicSurge, updateToxicSurge } from "./toxicSurge";

type ToxicAudio = Pick<AudioReactiveSnapshot, "isActive" | "smoothedEnergy"> &
  Partial<Pick<AudioReactiveSnapshot, "bass" | "mids" | "highs" | "bassPulse" | "kickPulse" | "transient" | "kickPulseAcceptedEventSequence">>;

// Tangent-plane units at the horizon (x / -z, y / -z), before the per-viewport volcano scale.
export const TOXIC_VOLCANO = { craterHeight: 0.184, peakHeight: 0.19, leftBase: 0.5, rightBase: 0.58 } as const;
export const TOXIC_CAMERA = { fov: 55, position: [0, 6, 0], target: [0, -3, -140] } as const;

function unit(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function toxicMusicEnergy(snapshot?: ToxicAudio | null) {
  if (!snapshot?.isActive) return 0;
  return Math.pow(unit((unit(snapshot.smoothedEnergy) - 0.015) / 0.485), 0.75);
}

function damp(current: number, target: number, dt: number, attack: number, release: number) {
  return current + (target - current) * (1 - Math.exp(-dt * (target > current ? attack : release)));
}

export function toxicQuality(width: number, height: number, devicePixelRatio: number, constrained: boolean) {
  const compact = constrained || Math.min(width, height) < 600;
  const pixelBudget = compact ? 1_100_000 : 2_600_000;
  return {
    pixelRatio: Math.min(devicePixelRatio || 1, compact ? 1.25 : 1.6, Math.sqrt(pixelBudget / Math.max(1, width * height))),
    noiseSize: compact ? 128 : 256,
    bakeWidth: compact ? 256 : 512,
    bakeHeight: compact ? 96 : 192,
    columns: compact ? 72 : 112,
    rows: compact ? 96 : 144,
    auroraLayers: compact ? 3 : 4,
    ejecta: compact ? 8 : 14,
  };
}

// Keeps the whole cone readable on portrait screens while it stays anchored to the horizon.
export function toxicVolcanoFrame(aspect: number) {
  const halfWidth = Math.tan(TOXIC_CAMERA.fov * Math.PI / 360) * (Number.isFinite(aspect) && aspect > 0 ? aspect : 1);
  return {
    centerX: Math.min(0.06, halfWidth * 0.1),
    scale: Math.max(0.6, Math.min(1, halfWidth / 0.4)),
  };
}

export function createToxicState() {
  return {
    time: 0, skyTime: 0, magmaTime: 0,
    waterEnergy: 0, colorEnergy: 0, glintEnergy: 0, swellEnergy: 0,
    auroraBass: 0, auroraMids: 0, auroraHighs: 0,
    fissureGlow: 0, moltenPulse: 0, moltenTrail: 0, sparkEnergy: 0,
    surge: createToxicSurge(),
  };
}

export function updateToxicState(
  state: ReturnType<typeof createToxicState>,
  deltaSeconds: number,
  controls: { isPlaying: boolean; motionEnabled: boolean; reducedMotion: boolean; chromaEnabled?: boolean },
  snapshot?: ToxicAudio | null,
) {
  const dt = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(deltaSeconds, 0.05)) : 0;
  const energy = toxicMusicEnergy(snapshot);
  const moving = controls.isPlaying && controls.motionEnabled && !controls.reducedMotion;
  updateToxicSurge(state.surge, dt, moving, snapshot);
  if (controls.isPlaying) {
    // Illumination may follow the music with MOTION off; pause holds it.
    state.colorEnergy = damp(state.colorEnergy, energy, dt, 2.5, 1.5);
    const glint = energy * unit(unit(snapshot?.bass) * 0.65 + unit(snapshot?.highs) * 0.7);
    state.glintEnergy = damp(state.glintEnergy, glint, dt, 4, 2);
  }
  if (!moving) return;
  const bass = unit(unit(snapshot?.bass) * 0.55 + unit(snapshot?.bassPulse) * 0.35 + unit(snapshot?.kickPulse) * 0.85);
  const highs = unit(unit(snapshot?.highs) * 0.8 + unit(snapshot?.transient) * 0.5);
  state.auroraBass = damp(state.auroraBass, energy * bass, dt, 9, 3);
  state.auroraMids = damp(state.auroraMids, energy * unit(snapshot?.mids), dt, 4, 2);
  state.auroraHighs = damp(state.auroraHighs, energy * highs, dt, 7, 3.5);
  state.fissureGlow = damp(state.fissureGlow, energy * unit(unit(snapshot?.bass) * 0.8 + unit(snapshot?.bassPulse) * 0.3), dt, 6, 2.5);
  // Kick accents stay on the mountain: a fast crater pulse and a slower echo further down the fissures.
  state.moltenPulse = damp(state.moltenPulse, energy * unit(unit(snapshot?.kickPulse) * 0.9 + unit(snapshot?.bassPulse) * 0.4), dt, 16, 5);
  state.moltenTrail = damp(state.moltenTrail, state.moltenPulse, dt, 5, 1.6);
  state.sparkEnergy = damp(state.sparkEnergy, energy * unit(unit(snapshot?.highs) * 0.8 + unit(snapshot?.transient) * 0.6), dt, 8, 3.5);
  state.swellEnergy = damp(state.swellEnergy, energy * unit(snapshot?.bass), dt, 2, 1.2);
  const previousEnergy = state.waterEnergy;
  state.waterEnergy = damp(state.waterEnergy, energy, dt, 2.4, 1.6);
  const averageEnergy = (previousEnergy + state.waterEnergy) * 0.5;
  state.time += dt * (0.045 + averageEnergy * 1.10);
  state.skyTime += dt * (0.025 + averageEnergy * 0.40);
  state.magmaTime += dt * (0.22 + averageEnergy * 0.90 + state.surge.phases.fountain * 2.4);
}
