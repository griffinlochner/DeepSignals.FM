import {
  createSharedSurgeQualificationState,
  updateSharedSurgeQualification,
} from "../../app/sharedSurgeQualification";
import { dampTunnelSpeed, tunnelAudioEnergy, TUNNEL, type TunnelAudioInput } from "./tunnelPath";

export function createTunnelMotion() {
  return {
    elapsedMs: 0,
    speed: TUNNEL.speed as number,
    targetSpeed: TUNNEL.speed as number,
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
  if (!moving) return;
  const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
  state.elapsedMs += delta * 1000;
  state.energy = tunnelAudioEnergy(isPlaying, snapshot);
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
  state.targetSpeed = TUNNEL.speed + TUNNEL.maxSpeedBoost * state.energy
    + TUNNEL.surgeBoost * state.surgeEnvelope;
  state.speed = dampTunnelSpeed(state.speed, state.targetSpeed, delta);
}