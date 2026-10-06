import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import {
  createSharedSurgeQualificationState,
  updateSharedSurgeQualification,
} from "../../app/sharedSurgeQualification";

export const RUNNER = {
  seed: 23017, regionLength: 480, asteroidLength: 1440, regionCount: 3, rocksPerRegion: 108,
  gatesPerRegion: 3, starCount: 900, far: 340, normalMax: 80,
  surgeMax: 240, surgeDurationMs: 3200, gateRadius: 13,
  rockStretch: 1.35, maxBank: 0.065, bypassCount: 3, bypassHalfWidth: 300,
  heroMax: 30, exhaustCount: 64,
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

export function runnerRegionLength(index: number, seed: number = RUNNER.seed) {
  return runnerEncounter(index, seed) === "asteroid-field" ? RUNNER.asteroidLength : RUNNER.regionLength;
}

export function runnerRegionStart(index: number, seed: number = RUNNER.seed) {
  const cycle = Math.floor(index / 4);
  let start = cycle * (RUNNER.regionLength * 3 + RUNNER.asteroidLength);
  for (let i = cycle * 4; i < index; i += 1) start += runnerRegionLength(i, seed);
  return start;
}

export function runnerRegionIndex(distance: number, seed: number = RUNNER.seed) {
  let index = Math.floor(Math.max(0, distance) / (RUNNER.regionLength * 3 + RUNNER.asteroidLength)) * 4;
  let start = runnerRegionStart(index, seed);
  while (start + runnerRegionLength(index, seed) <= distance) {
    start += runnerRegionLength(index, seed);
    index += 1;
  }
  return index;
}

export function runnerMajorSize(region: number, seed: number = RUNNER.seed, obstacle = 0) {
  const hero = Math.floor(runnerRandom(region * 251 + 2, seed) * RUNNER.bypassCount);
  const variation = runnerRandom(region * 251 + obstacle * 17 + 1, seed);
  return obstacle === hero ? 26 + variation * (RUNNER.heroMax - 26) : 12 + variation * 6;
}

export function runnerBypassDistance(region: number, obstacle: number, seed: number = RUNNER.seed) {
  return runnerRegionStart(region, seed) + RUNNER.bypassHalfWidth
    + obstacle * (RUNNER.asteroidLength - RUNNER.bypassHalfWidth * 2) / (RUNNER.bypassCount - 1);
}

function bypassAngle(region: number, obstacle: number, seed: number) {
  const side = (Math.floor(runnerRandom(region * 251, seed) * 2) + obstacle) % 2;
  return side * Math.PI + (runnerRandom(region * 251 + obstacle * 17 + 3, seed) - 0.5) * 1.1;
}

function avoidanceOffset(distance: number, vertical: boolean, seed: number) {
  const index = runnerRegionIndex(distance, seed);
  if (runnerEncounter(index, seed) !== "asteroid-field") return 0;
  let offset = 0;
  for (let obstacle = 0; obstacle < RUNNER.bypassCount; obstacle += 1) {
    const local = distance - runnerBypassDistance(index, obstacle, seed);
    if (Math.abs(local) >= RUNNER.bypassHalfWidth) continue;
    const angle = bypassAngle(index, obstacle, seed);
    const amplitude = runnerMajorSize(index, seed, obstacle) * RUNNER.rockStretch + 9;
    // C3-continuous lobes overlap only at their quiet tails; each crest clears a swept sphere.
    offset += Math.cos(local / RUNNER.bypassHalfWidth * Math.PI / 2) ** 4
      * amplitude * (vertical ? Math.sin(angle) : Math.cos(angle));
  }
  return offset;
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

export function createRunnerTraffic() {
  return { visible: false, variant: 0, x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0, bank: 0, fade: 0 };
}

export function sampleRunnerTraffic(
  distance: number, traffic: ReturnType<typeof createRunnerTraffic>, seed: number = RUNNER.seed,
) {
  const index = runnerRegionIndex(distance, seed);
  const local = distance - runnerRegionStart(index, seed);
  traffic.visible = index % 8 === 2 && local >= 40 && local <= 430;
  const progress = runnerUnit((local - 40) / 390);
  traffic.variant = (Math.floor(index / 8) + seed % 6) % 6;
  const direction = traffic.variant % 2 === 0 ? 1 : -1;
  const diagonal = traffic.variant === 2 || traffic.variant === 3;
  const depth = traffic.variant < 2 ? 0 : traffic.variant < 4 ? 90 : 150;
  traffic.x = direction * (-155 + progress * 310);
  traffic.y = diagonal ? direction * (-42 + progress * 84) : 22 + Math.sin(progress * Math.PI) * 8;
  traffic.z = -220 + direction * (progress - 0.5) * depth;
  traffic.dx = direction * 310;
  traffic.dy = diagonal ? direction * 84 : Math.cos(progress * Math.PI) * Math.PI * 8;
  traffic.dz = direction * depth;
  traffic.bank = direction * 0.16;
  traffic.fade = traffic.visible ? Math.min(1, (local - 40) / 55, (430 - local) / 55) : 0;
  return traffic;
}

function createRock() {
  return { distance: 0, x: 0, y: 0, size: 0, phase: 0, spin: 0, spinY: 0, spinZ: 0, accent: 0 };
}

function populateRegion(region: RunnerRegion, index: number, seed: number) {
  region.index = index;
  region.kind = runnerEncounter(index, seed);
  region.start = runnerRegionStart(index, seed);
  region.length = runnerRegionLength(index, seed);
  for (let i = 0; i < region.rocks.length; i += 1) {
    const rock = region.rocks[i];
    const key = index * 251 + i * 7;
    const angle = runnerRandom(key, seed) * Math.PI * 2;
    rock.size = 0.5 + runnerRandom(key + 1, seed) ** 2 * 8;
    // Peripheral debris stays outside the entire avoidance sweep, not just its centerline.
    const radius = rock.size * RUNNER.rockStretch + RUNNER.heroMax * RUNNER.rockStretch
      + 20 + runnerRandom(key + 2, seed) * 30;
    // Stratified depth keeps density consistent over the longer field, without allocating more draws.
    rock.distance = region.start + 85 + (i + runnerRandom(key + 3, seed))
      / region.rocks.length * (RUNNER.asteroidLength - 170);
    rock.x = baselineX(rock.distance) + Math.cos(angle) * radius;
    rock.y = baselineY(rock.distance) + Math.sin(angle) * radius;
    if (i < RUNNER.bypassCount) {
      rock.size = runnerMajorSize(index, seed, i);
      rock.distance = runnerBypassDistance(index, i, seed);
      rock.x = baselineX(rock.distance);
      rock.y = baselineY(rock.distance);
    } else if (i < RUNNER.bypassCount * 5) {
      const obstacle = Math.floor((i - RUNNER.bypassCount) / 4);
      const debris = (i - RUNNER.bypassCount) % 4;
      const angle = bypassAngle(index, obstacle, seed);
      const debrisRadius = runnerMajorSize(index, seed, obstacle) * RUNNER.rockStretch + 6 + debris;
      rock.size = 0.5 + runnerRandom(key + 1, seed) * 1.3;
      rock.distance = runnerBypassDistance(index, obstacle, seed) + (debris - 1) * 9;
      rock.x = baselineX(rock.distance) - Math.cos(angle) * debrisRadius;
      rock.y = baselineY(rock.distance) - Math.sin(angle) * debrisRadius;
    }
    rock.phase = runnerRandom(key + 4, seed) * Math.PI * 2;
    rock.spin = (runnerRandom(key + 5, seed) - 0.5) * 0.075;
    rock.spinY = (runnerRandom(key + 6, seed) - 0.5) * 0.065;
    rock.spinZ = (runnerRandom(key + 8, seed) - 0.5) * 0.045;
    rock.accent = i % 3;
  }
}

type RunnerRegion = {
  index: number; kind: RunnerEncounter; start: number; length: number;
  rocks: ReturnType<typeof createRock>[];
};

export function createRunnerJourney(seed: number = RUNNER.seed) {
  const regions: RunnerRegion[] = Array.from({ length: RUNNER.regionCount }, () => ({
    index: 0, kind: "open-warp", start: 0, length: RUNNER.regionLength,
    rocks: Array.from({ length: RUNNER.rocksPerRegion }, createRock),
  }));
  for (let i = 0; i < regions.length; i += 1) populateRegion(regions[i], i, seed);
  return { seed, distance: 0, recycled: 0, regions };
}

export function advanceRunnerJourney(journey: ReturnType<typeof createRunnerJourney>, distance: number) {
  journey.distance += distance;
  for (const region of journey.regions) {
    if (region.start + region.length >= journey.distance - 30) continue;
    const firstNeeded = runnerRegionIndex(journey.distance - 30, journey.seed);
    const jumps = Math.ceil((firstNeeded - region.index) / RUNNER.regionCount);
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
