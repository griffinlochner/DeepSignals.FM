import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import { createSharedSurgeQualificationState, updateSharedSurgeQualification } from "../../app/sharedSurgeQualification";

export const TOXIC_SURGE = { durationSeconds: 3.2, attackSeconds: 0.55, releaseSeconds: 1.75 } as const;
// Ages within one eruption; each flash is brief and uses its own bolt shapes.
export const TOXIC_LIGHTNING_FLASHES = [0.62, 1.04, 1.52] as const;
export const TOXIC_LIGHTNING_FLASH_SECONDS = 0.34;

function smooth(edge0: number, edge1: number, value: number) {
  const ramp = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return ramp * ramp * (3 - 2 * ramp);
}

export function toxicSurgeEnvelope(ageSeconds: number) {
  if (!(ageSeconds >= 0) || ageSeconds >= TOXIC_SURGE.durationSeconds) return 0;
  const ramp = Math.min(1, ageSeconds / TOXIC_SURGE.attackSeconds,
    (TOXIC_SURGE.durationSeconds - ageSeconds) / TOXIC_SURGE.releaseSeconds);
  return ramp * ramp * (3 - 2 * ramp);
}

export function createToxicEruptionPhases() {
  return { envelope: 0, pressure: 0, fountain: 0, flare: 0, front: 0, aurora: 0, lightning: 0, flash: 0 };
}

// Every phase is a pure function of event age, so freezing the age freezes the whole eruption.
export function toxicEruptionPhases(ageSeconds: number, phases = createToxicEruptionPhases()) {
  const end = TOXIC_SURGE.durationSeconds;
  const active = ageSeconds >= 0 && ageSeconds < end;
  const age = active ? ageSeconds : end;
  phases.envelope = toxicSurgeEnvelope(ageSeconds);
  // Crater pressure builds first, then the fountain, then energy travels down the fissures.
  phases.pressure = active ? smooth(0, 0.38, age) * (1 - smooth(1.5, end, age)) : 0;
  phases.fountain = active ? smooth(0.28, 0.85, age) * (1 - smooth(1.55, 2.9, age)) : 0;
  phases.flare = active ? smooth(0.3, 0.7, age) * (1 - smooth(1.9, end, age)) : 0;
  phases.front = active ? Math.max(0, Math.min(1, (age - 0.35) / 1.35)) : 0;
  phases.aurora = active ? smooth(0.35, 1.2, age) * (1 - smooth(1.7, end, age)) : 0;
  phases.lightning = 0;
  phases.flash = 0;
  if (active) {
    for (let index = 0; index < TOXIC_LIGHTNING_FLASHES.length; index++) {
      const since = age - TOXIC_LIGHTNING_FLASHES[index];
      if (since < 0 || since >= TOXIC_LIGHTNING_FLASH_SECONDS) continue;
      const strike = Math.min(1, since / 0.03) * Math.exp(-since / 0.085);
      const restrike = since > 0.1 ? 0.6 * Math.min(1, (since - 0.1) / 0.02) * Math.exp(-(since - 0.1) / 0.05) : 0;
      phases.lightning = Math.min(1, strike + restrike) * (1 - smooth(0.24, TOXIC_LIGHTNING_FLASH_SECONDS, since));
      phases.flash = index;
    }
  }
  return phases;
}

export function createToxicSurge() {
  return {
    elapsedMs: 0, startedAt: -Infinity, count: 0,
    ageSeconds: 0, phases: createToxicEruptionPhases(),
    lastQualificationAt: -Infinity,
    qualification: createSharedSurgeQualificationState(),
    qualificationInput: { nowMs: 0, smoothedEnergy: 0, acceptedSequence: 0, isPlaying: false, motionEnabled: false },
  };
}

export function updateToxicSurge(
  state: ReturnType<typeof createToxicSurge>,
  dt: number,
  moving: boolean,
  snapshot?: Partial<Pick<AudioReactiveSnapshot, "isActive" | "smoothedEnergy" | "kickPulseAcceptedEventSequence">> | null,
) {
  const usable = Boolean(snapshot?.isActive) && Number.isFinite(snapshot?.smoothedEnergy);
  if (!moving || !usable) {
    if (state.qualification.armed || state.qualification.lowSinceMs !== null) {
      state.qualification = updateSharedSurgeQualification(state.qualification, {
        ...state.qualificationInput, isPlaying: false, motionEnabled: moving,
      }).state;
    }
  }
  if (!moving || dt <= 0) return;
  // Unscaled eligible-playback clock: quiet music must not stretch the shared arming hold.
  state.elapsedMs += dt * 1000;
  if (state.elapsedMs - state.lastQualificationAt >= 50) {
    const input = state.qualificationInput;
    input.nowMs = state.elapsedMs;
    input.isPlaying = usable;
    input.motionEnabled = moving;
    input.smoothedEnergy = usable ? Math.max(0, Math.min(1, snapshot!.smoothedEnergy!)) : 0;
    const sequence = snapshot?.kickPulseAcceptedEventSequence;
    input.acceptedSequence = typeof sequence === "number" && Number.isFinite(sequence) ? Math.max(0, sequence) : 0;
    const result = updateSharedSurgeQualification(state.qualification, input);
    state.qualification = result.state;
    state.lastQualificationAt = state.elapsedMs;
    if (result.triggered && state.elapsedMs - state.startedAt >= TOXIC_SURGE.durationSeconds * 1000) {
      state.startedAt = state.elapsedMs;
      state.count++;
    }
  }
  state.ageSeconds = Math.min(TOXIC_SURGE.durationSeconds, (state.elapsedMs - state.startedAt) / 1000);
  toxicEruptionPhases(state.ageSeconds, state.phases);
}
