export const SHARED_SURGE_ARM_SPEED = 68;
export const SHARED_SURGE_TRIGGER_SPEED = 99;
export const SHARED_SURGE_ARM_HOLD_MS = 400;
export const SHARED_SURGE_COOLDOWN_MS = 1500;

export type SharedSurgeQualificationState = {
  lowSinceMs: number | null;
  armed: boolean;
  cooldownUntilMs: number;
  lastAcceptedSequence: number;
  lastTriggeredSequence: number;
};

export function createSharedSurgeQualificationState(): SharedSurgeQualificationState {
  return {
    lowSinceMs: null,
    armed: false,
    cooldownUntilMs: 0,
    lastAcceptedSequence: 0,
    lastTriggeredSequence: 0,
  };
}

export function mapEnergyToSurgeTargetSpeed(smoothedEnergy: number) {
  const normalized = Math.min(
    1,
    Math.max(0, (smoothedEnergy - 0.04) / (0.72 - 0.04)),
  );

  return normalized * 100;
}

export function updateSharedSurgeQualification(
  state: SharedSurgeQualificationState,
  params: {
    nowMs: number;
    smoothedEnergy: number;
    acceptedSequence: number;
    isPlaying: boolean;
    motionEnabled?: boolean;
  },
): {
  triggered: boolean;
  sequence: number;
  state: SharedSurgeQualificationState;
} {
  const motionEnabled = params.motionEnabled ?? true;
  const nextState: SharedSurgeQualificationState = { ...state };

  if (!params.isPlaying || !motionEnabled) {
    nextState.lowSinceMs = null;
    nextState.armed = false;
    if (params.acceptedSequence > 0) {
      nextState.lastAcceptedSequence = params.acceptedSequence;
    }
    return {
      triggered: false,
      sequence: params.acceptedSequence,
      state: nextState,
    };
  }

  nextState.lastAcceptedSequence = params.acceptedSequence;
  const targetSpeed = mapEnergyToSurgeTargetSpeed(params.smoothedEnergy);

  if (targetSpeed <= SHARED_SURGE_ARM_SPEED) {
    nextState.lowSinceMs ??= params.nowMs;

    if (
      params.nowMs - (nextState.lowSinceMs ?? params.nowMs) >=
      SHARED_SURGE_ARM_HOLD_MS
    ) {
      nextState.armed = true;
    }

    return {
      triggered: false,
      sequence: params.acceptedSequence,
      state: nextState,
    };
  }

  nextState.lowSinceMs = null;

  if (
    !nextState.armed ||
    targetSpeed < SHARED_SURGE_TRIGGER_SPEED ||
    params.nowMs < nextState.cooldownUntilMs
  ) {
    return {
      triggered: false,
      sequence: params.acceptedSequence,
      state: nextState,
    };
  }

  nextState.armed = false;
  nextState.cooldownUntilMs = params.nowMs + SHARED_SURGE_COOLDOWN_MS;
  nextState.lastTriggeredSequence =
    params.acceptedSequence > 0
      ? params.acceptedSequence
      : nextState.lastTriggeredSequence;

  return {
    triggered: true,
    sequence: nextState.lastTriggeredSequence,
    state: nextState,
  };
}
