import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import {
  createSharedSurgeQualificationState,
  updateSharedSurgeQualification,
} from "../../app/sharedSurgeQualification";

export const RUNNER = {
  seed: 23017, regionLength: 480, regionCount: 3, rocksPerRegion: 36,
  gatesPerRegion: 3, starCount: 900, far: 340, normalMax: 80,
  surgeMax: 240, surgeDurationMs: 3200, gateRadius: 13,
  rockStretch: 1.35, maxBank: 0.065,
} as const;

export type RunnerEncounter = "open-warp" | "asteroid-field" | "signal-gates";
export type RunnerAudio = Partial<Pick<AudioReactiveSnapshot,
  "isActive" | "smoothedEnergy" | "bass" | "mids" | "highs" | "kickPulseAcceptedEventSequence"
>>;

export function runnerUnit(value: number | undefined) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value!)) : 0;
}

export function runnerRandom(index: number, seed: number = RUNNER.seed): number {
  let value = Math.imul(index + seed, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function runnerEncounter(index: number, seed: number = RUNNER.seed): RunnerEncounter {
  if (index % 2 === 0) return "open-warp";
  return (Math.floor(index / 2) + seed) % 2 === 1 ? "asteroid-field" : "signal-gates";
}

function baselineX(distance: number) { return Math.sin(distance / 170) * 2.2; }
function baselineY(distance: number) { return Math.sin(distance / 231) * 1.1; }

export function runnerMajorSize(region: number, seed: number = RUNNER.seed) {
  return 12 + runnerRandom(region * 251 + 1, seed) * 6;
}

function avoidanceOffset(distance: number, vertical: boolean, seed: number) {
  const index = Math.floor(distance / RUNNER.regionLength);
  if (runnerEncounter(index, seed) !== "asteroid-field") return 0;
  const phase = (distance - index * RUNNER.regionLength) / RUNNER.regionLength;
  const angle = runnerRandom(index * 251, seed) * Math.PI * 2;
  const amplitude = runnerMajorSize(index, seed) * RUNNER.rockStretch + 9;
  // C3-continuous at region boundaries; the crest clears the obstacle's swept sphere.
  return Math.sin(phase * Math.PI) ** 4 * amplitude * (vertical ? Math.sin(angle) : Math.cos(angle));
}

export function runnerPathX(distance: number, seed: number = RUNNER.seed) {
  return baselineX(distance) + avoidanceOffset(distance, false, seed);
}
export function runnerPathY(distance: number, seed: number = RUNNER.seed) {
  return baselineY(distance) + avoidanceOffset(distance, true, seed);
}

export function createRunnerFlight() { return { x: 0, y: 0, yaw: 0, pitch: 0, roll: 0 }; }

export function sampleRunnerFlight(distance: number, seed: number, flight: ReturnType<typeof createRunnerFlight>) {
  flight.x = runnerPathX(distance, seed);
  flight.y = runnerPathY(distance, seed);
  const dx = (runnerPathX(distance + 38, seed) - flight.x) / 38;
  const dy = (runnerPathY(distance + 38, seed) - flight.y) / 38;
  flight.yaw = -Math.atan(dx) * 0.55;
  flight.pitch = Math.atan(dy) * 0.4;
  flight.roll = Math.max(-RUNNER.maxBank, Math.min(RUNNER.maxBank, -dx * 0.23));
  return flight;
}

export function runnerRegionWeight(distance: number, index: number) {
  const local = distance - index * RUNNER.regionLength;
  const edge = Math.min(runnerUnit((local + 160) / 260), runnerUnit((640 - local) / 260));
  return edge * edge * (3 - 2 * edge);
}

export function createRunnerTraffic() { return { visible: false, x: 0, y: 0, z: 0, fade: 0 }; }

export function sampleRunnerTraffic(distance: number, traffic: ReturnType<typeof createRunnerTraffic>) {
  const index = Math.floor(distance / RUNNER.regionLength);
  const local = distance - index * RUNNER.regionLength;
  traffic.visible = index % 8 === 2 && local >= 40 && local <= 430;
  const progress = (local - 40) / 390;
  traffic.x = -145 + progress * 290;
  traffic.y = 22 + Math.sin(progress * Math.PI) * 8;
  traffic.z = -(460 - local);
  traffic.fade = traffic.visible ? Math.min(1, (local - 40) / 55, (430 - local) / 55) : 0;
  return traffic;
}

function createRock() {
  return { distance: 0, x: 0, y: 0, size: 0, phase: 0, spin: 0, spinY: 0, spinZ: 0, accent: 0 };
}

function populateRegion(region: RunnerRegion, index: number, seed: number) {
  region.index = index;
  region.kind = runnerEncounter(index, seed);
  region.start = index * RUNNER.regionLength;
  for (let i = 0; i < region.rocks.length; i += 1) {
    const rock = region.rocks[i];
    const key = index * 251 + i * 7;
    const angle = runnerRandom(key, seed) * Math.PI * 2;
    rock.size = 0.5 + runnerRandom(key + 1, seed) ** 2 * 8;
    // Peripheral debris stays outside the entire avoidance sweep, not just its centerline.
    const radius = rock.size * RUNNER.rockStretch + 44 + runnerRandom(key + 2, seed) * 30;
    rock.distance = region.start + 85 + runnerRandom(key + 3, seed) * 310;
    rock.x = baselineX(rock.distance) + Math.cos(angle) * radius;
    rock.y = baselineY(rock.distance) + Math.sin(angle) * radius;
    if (i === 0) {
      rock.size = runnerMajorSize(index, seed);
      rock.distance = region.start + RUNNER.regionLength / 2;
      rock.x = baselineX(rock.distance);
      rock.y = baselineY(rock.distance);
    } else if (i <= 4) {
      const bypassAngle = runnerRandom(index * 251, seed) * Math.PI * 2;
      const debrisRadius = runnerMajorSize(index, seed) * RUNNER.rockStretch + 5 + i;
      rock.size = 0.5 + runnerRandom(key + 1, seed) * 1.3;
      rock.distance = region.start + RUNNER.regionLength / 2 + (i - 2) * 9;
      rock.x = baselineX(rock.distance) - Math.cos(bypassAngle) * debrisRadius;
      rock.y = baselineY(rock.distance) - Math.sin(bypassAngle) * debrisRadius;
    }
    rock.phase = runnerRandom(key + 4, seed) * Math.PI * 2;
    rock.spin = (runnerRandom(key + 5, seed) - 0.5) * 0.075;
    rock.spinY = (runnerRandom(key + 6, seed) - 0.5) * 0.065;
    rock.spinZ = (runnerRandom(key + 8, seed) - 0.5) * 0.045;
    rock.accent = i % 3;
  }
}

type RunnerRegion = {
  index: number; kind: RunnerEncounter; start: number;
  rocks: ReturnType<typeof createRock>[];
};

export function createRunnerJourney(seed: number = RUNNER.seed) {
  const regions: RunnerRegion[] = Array.from({ length: RUNNER.regionCount }, () => ({
    index: 0, kind: "open-warp", start: 0,
    rocks: Array.from({ length: RUNNER.rocksPerRegion }, createRock),
  }));
  for (let i = 0; i < regions.length; i += 1) populateRegion(regions[i], i, seed);
  return { seed, distance: 0, recycled: 0, regions };
}

export function advanceRunnerJourney(journey: ReturnType<typeof createRunnerJourney>, distance: number) {
  journey.distance += distance;
  for (const region of journey.regions) {
    if (region.start + RUNNER.regionLength >= journey.distance - 30) continue;
    const jumps = Math.ceil((journey.distance - 30 - region.start - RUNNER.regionLength)
      / (RUNNER.regionCount * RUNNER.regionLength));
    populateRegion(region, region.index + jumps * RUNNER.regionCount, journey.seed);
    journey.recycled += jumps;
  }
}

export function runnerSurgeEnvelope(ageMs: number) {
  if (ageMs < 0 || ageMs >= RUNNER.surgeDurationMs) return 0;
  const ramp = Math.min(1, ageMs / 250, (RUNNER.surgeDurationMs - ageMs) / 1400);
  return ramp * ramp * (3 - 2 * ramp);
}

export function runnerGateActivation(ahead: number, surgeAgeMs: number, surge: number) {
  const approach = runnerUnit(1 - Math.abs(ahead - 18) / 230);
  const wave = runnerUnit(1 - Math.abs(ahead - (310 - surgeAgeMs * 0.18)) / 65);
  return Math.min(1, approach * 0.65 + surge * (0.35 + wave));
}

export function createRunnerMotion() {
  return {
    elapsedMs: 0, animationSeconds: 0, speed: 0, targetSpeed: 0, energy: 0,
    bass: 0, mids: 0, highs: 0, surge: 0, surgeCount: 0, surgeStartedAt: -Infinity,
    lastQualificationAt: -Infinity,
    qualification: createSharedSurgeQualificationState(),
    qualificationInput: { nowMs: 0, smoothedEnergy: 0, acceptedSequence: 0, isPlaying: false, motionEnabled: false },
  };
}

export function updateRunnerMotion(
  state: ReturnType<typeof createRunnerMotion>, deltaSeconds: number,
  isPlaying: boolean, motionEnabled: boolean, reducedMotion: boolean, snapshot?: RunnerAudio | null,
) {
  const moving = isPlaying && motionEnabled && !reducedMotion;
  const usable = Boolean(snapshot?.isActive) && Number.isFinite(snapshot?.smoothedEnergy);
  const input = state.qualificationInput;
  input.isPlaying = isPlaying && usable;
  input.motionEnabled = moving;
  input.smoothedEnergy = usable ? runnerUnit(snapshot?.smoothedEnergy) : 0;
  input.acceptedSequence = Number.isFinite(snapshot?.kickPulseAcceptedEventSequence)
    ? Math.max(0, snapshot!.kickPulseAcceptedEventSequence!) : 0;
  if (!moving) {
    if (state.qualification.armed || state.qualification.lowSinceMs !== null) {
      state.qualification = updateSharedSurgeQualification(state.qualification, input).state;
    }
    return 0;
  }
  const delta = Number.isFinite(deltaSeconds) ? Math.min(0.05, Math.max(0, deltaSeconds)) : 0;
  state.elapsedMs += delta * 1000;
  state.energy = Math.pow(runnerUnit((input.smoothedEnergy - 0.012) / 0.708), 1.45);
  const smoothing = 1 - Math.exp(-delta * 6);
  state.bass += ((usable ? runnerUnit(snapshot?.bass) : 0) - state.bass) * smoothing;
  state.mids += ((usable ? runnerUnit(snapshot?.mids) : 0) - state.mids) * smoothing;
  state.highs += ((usable ? runnerUnit(snapshot?.highs) : 0) - state.highs) * smoothing;
  if (state.elapsedMs - state.lastQualificationAt >= 50) {
    input.nowMs = state.elapsedMs;
    const result = updateSharedSurgeQualification(state.qualification, input);
    state.qualification = result.state;
    state.lastQualificationAt = state.elapsedMs;
    if (result.triggered && state.elapsedMs - state.surgeStartedAt >= RUNNER.surgeDurationMs) {
      state.surgeStartedAt = state.elapsedMs;
      state.surgeCount += 1;
    }
  }
  state.surge = runnerSurgeEnvelope(state.elapsedMs - state.surgeStartedAt) * state.energy;
  state.targetSpeed = RUNNER.normalMax * state.energy + (RUNNER.surgeMax - RUNNER.normalMax) * state.surge;
  state.speed += (state.targetSpeed - state.speed) * (1 - Math.exp(-delta * 2.8));
  if (state.targetSpeed === 0 && state.speed < 0.01) state.speed = 0;
  state.animationSeconds += delta * Math.min(1, state.speed / 12);
  return state.speed * delta;
}
