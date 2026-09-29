import {
  createSharedSurgeQualificationState,
  updateSharedSurgeQualification,
} from "../../app/sharedSurgeQualification";
import { dampTunnelSpeed, tunnelAudioEnergy, TUNNEL, type TunnelAudioInput } from "./tunnelPath";

export function tunnelSurgeActivation(distanceAhead: number, ageSeconds: number, envelope: number) {
  let wave = 0;
  for (let index = 0; index < 4; index += 1) {
    const waveDistance = 150 + index * 28 - ageSeconds * 145;
    wave = Math.max(wave, Math.max(0, 1 - Math.abs(distanceAhead - waveDistance) / 24));
  }
  const nearby = Math.max(0, 1 - Math.abs(distanceAhead - 24) / 140);
  return Math.min(1, envelope * (nearby * 0.65 + wave));
}

export function createTunnelMotion() {
  return {
    elapsedMs: 0,
    animationMs: 0,
    speed: 0,
    targetSpeed: 0,
    energy: 0,
    surgeEnvelope: 0,
    surgeStartedAt: -Infinity,
    surgeCount: 0,
    lastQualificationAt: -Infinity,
    qualification: createSharedSurgeQualificationState(),
    qualificationInput: { nowMs: 0, smoothedEnergy: 0, acceptedSequence: 0, isPlaying: false, motionEnabled: true },
  };
}

export function updateTunnelMotion(
  state: ReturnType<typeof createTunnelMotion>,
  deltaSeconds: number,
  moving: boolean,
  isPlaying: boolean,
  snapshot?: TunnelAudioInput | null,
) {
  if (!moving || !isPlaying) return;
  const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
  state.energy = tunnelAudioEnergy(isPlaying, snapshot);
  state.elapsedMs += delta * 1000;
  state.animationMs += delta * 1000 * Math.min(1, state.energy * 3);
  const usable = isPlaying && Boolean(snapshot?.isActive) && Number.isFinite(snapshot?.smoothedEnergy);
  if (!usable) state.surgeStartedAt = -Infinity;
  if (state.elapsedMs - state.lastQualificationAt >= 50) {
    const input = state.qualificationInput;
    input.nowMs = state.elapsedMs;
    input.smoothedEnergy = usable ? snapshot!.smoothedEnergy : 0;
    input.acceptedSequence = snapshot?.kickPulseAcceptedEventSequence ?? 0;
    input.isPlaying = usable;
    const result = updateSharedSurgeQualification(state.qualification, input);
    state.qualification = result.state;
    state.lastQualificationAt = state.elapsedMs;
    if (result.triggered && state.elapsedMs - state.surgeStartedAt >= TUNNEL.surgeDurationMs) {
      state.surgeStartedAt = state.elapsedMs;
      state.surgeCount += 1;
    }
  }
  const age = (state.elapsedMs - state.surgeStartedAt) / TUNNEL.surgeDurationMs;
  state.surgeEnvelope = age >= 1 ? 0 : Math.min(1, age / 0.12, (1 - age) / 0.35) * state.energy;
  state.targetSpeed = (TUNNEL.speed + TUNNEL.maxSpeedBoost) * state.energy
    + TUNNEL.surgeBoost * state.surgeEnvelope;
  state.speed = dampTunnelSpeed(state.speed, state.targetSpeed, delta);
  if (state.targetSpeed === 0 && state.speed < 0.01) state.speed = 0;
}