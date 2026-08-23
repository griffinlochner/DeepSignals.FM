import { test, expect } from "@playwright/test";
import {
  createSharedSurgeQualificationState,
  SHARED_SURGE_ARM_HOLD_MS,
  SHARED_SURGE_COOLDOWN_MS,
  updateSharedSurgeQualification,
} from "../../src/app/sharedSurgeQualification";

test("ordinary high-energy input without arming does not trigger SURGE", () => {
  const result = updateSharedSurgeQualification(
    createSharedSurgeQualificationState(),
    {
      nowMs: 1_000,
      smoothedEnergy: 1,
      acceptedSequence: 1,
      isPlaying: true,
    },
  );
  expect(result.triggered).toBe(false);
});

test("the production qualifier triggers after arming and respects cooldown", () => {
  let state = createSharedSurgeQualificationState();
  const armed = updateSharedSurgeQualification(state, {
    nowMs: 0,
    smoothedEnergy: 0,
    acceptedSequence: 0,
    isPlaying: true,
  });
  state = armed.state;
  state = updateSharedSurgeQualification(state, {
    nowMs: SHARED_SURGE_ARM_HOLD_MS,
    smoothedEnergy: 0,
    acceptedSequence: 0,
    isPlaying: true,
  }).state;

  const triggered = updateSharedSurgeQualification(state, {
    nowMs: SHARED_SURGE_ARM_HOLD_MS + 1,
    smoothedEnergy: 1,
    acceptedSequence: 1,
    isPlaying: true,
  });
  expect(triggered.triggered).toBe(true);

  const duringCooldown = updateSharedSurgeQualification(triggered.state, {
    nowMs: SHARED_SURGE_ARM_HOLD_MS + 1 + SHARED_SURGE_COOLDOWN_MS - 1,
    smoothedEnergy: 1,
    acceptedSequence: 2,
    isPlaying: true,
  });
  expect(duringCooldown.triggered).toBe(false);
});
