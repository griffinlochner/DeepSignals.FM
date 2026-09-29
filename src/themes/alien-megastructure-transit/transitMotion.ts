import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import { createSharedSurgeQualificationState, updateSharedSurgeQualification } from "../../app/sharedSurgeQualification";

export const TRANSIT_MOTION = { normalMax: 420, surgeMax: 1100, surgeDurationMs: 4200 } as const;
export type TransitAudioInput = Partial<Pick<AudioReactiveSnapshot,
  "isActive" | "energy" | "smoothedEnergy" | "bass" | "mids" | "highs" | "kickPulse" | "bassPulse" | "transient" | "kickPulseAcceptedEventSequence"
>>;

export function transitUnit(value?: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value!)) : 0;
}

export function transitPropulsionEnergy(isPlaying: boolean, snapshot?: TransitAudioInput | null) {
  if (!isPlaying || !snapshot?.isActive || !Number.isFinite(snapshot.smoothedEnergy)) return 0;
  const energy = transitUnit(snapshot.smoothedEnergy) * 0.65 + transitUnit(snapshot.energy) * 0.35;
  return Math.pow(transitUnit((energy - 0.012) / 0.55), 2);
}

export function transitSurgeEnvelope(ageMs: number) {
  if (ageMs < 0 || ageMs >= TRANSIT_MOTION.surgeDurationMs) return 0;
  const ramp = Math.min(1, ageMs / 400, (TRANSIT_MOTION.surgeDurationMs - ageMs) / 1800);
  return ramp * ramp * (3 - 2 * ramp);
}

export function transitSurgeActivation(distanceFromOrigin: number, ageMs: number, envelope: number) {
  const wavePosition = 8200 - ageMs * 2.5;
  const wave = Math.max(0, 1 - Math.abs(distanceFromOrigin - wavePosition) / 1700);
  const nearby = Math.max(0, 1 - Math.abs(distanceFromOrigin - 1200) / 9500);
  return Math.min(1, envelope * (nearby * 0.3 + wave));
}

export function createTransitMotion() {
  return {
    elapsedMs: 0, speed: 0, targetSpeed: 0, energy: 0,
    surgeEnvelope: 0, surgeStartedAt: -Infinity, surgeOrigin: 0, surgeCount: 0,
    lastQualificationAt: -Infinity,
    qualification: createSharedSurgeQualificationState(),
    qualificationInput: { nowMs: 0, smoothedEnergy: 0, acceptedSequence: 0, isPlaying: false, motionEnabled: false },
  };
}

export function updateTransitMotion(
  state: ReturnType<typeof createTransitMotion>, deltaSeconds: number,
  isPlaying: boolean, motionEnabled: boolean, reducedMotion: boolean, distance: number,
  snapshot?: TransitAudioInput | null,
) {
  const moving = isPlaying && motionEnabled && !reducedMotion;
  const usable = isPlaying && Boolean(snapshot?.isActive) && Number.isFinite(snapshot?.smoothedEnergy);
  const delta = Number.isFinite(deltaSeconds) ? Math.min(0.05, Math.max(0, deltaSeconds)) : 0;
  const input = state.qualificationInput;
  input.isPlaying = usable;
  input.motionEnabled = moving;
  input.smoothedEnergy = usable ? transitUnit(snapshot?.smoothedEnergy) : 0;
  input.acceptedSequence = Number.isFinite(snapshot?.kickPulseAcceptedEventSequence)
    ? Math.max(0, snapshot!.kickPulseAcceptedEventSequence!) : 0;
  if (!moving) {
    state.speed = 0;
    state.targetSpeed = 0;
    if (state.qualification.armed || state.qualification.lowSinceMs !== null) {
      state.qualification = updateSharedSurgeQualification(state.qualification, input).state;
    }
    return;
  }
  state.elapsedMs += delta * 1000;
  state.energy = transitPropulsionEnergy(isPlaying, snapshot);
  if (state.elapsedMs - state.lastQualificationAt >= 50) {
    input.nowMs = state.elapsedMs;
    const result = updateSharedSurgeQualification(state.qualification, input);
    state.qualification = result.state;
    state.lastQualificationAt = state.elapsedMs;
    if (result.triggered && state.elapsedMs - state.surgeStartedAt >= TRANSIT_MOTION.surgeDurationMs) {
      state.surgeStartedAt = state.elapsedMs;
      state.surgeOrigin = distance;
      state.surgeCount += 1;
    }
  }
  state.surgeEnvelope = transitSurgeEnvelope(state.elapsedMs - state.surgeStartedAt);
  const ceiling = TRANSIT_MOTION.normalMax + (TRANSIT_MOTION.surgeMax - TRANSIT_MOTION.normalMax) * state.surgeEnvelope;
  state.targetSpeed = ceiling * state.energy;
  const rate = state.targetSpeed > state.speed ? 3 : 1.8;
  state.speed += (state.targetSpeed - state.speed) * (1 - Math.exp(-delta * rate));
  if (state.targetSpeed === 0 && state.speed < 0.05) state.speed = 0;
}