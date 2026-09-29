import { Vector3 } from "three";
import { transitUnit, type TransitAudioInput } from "./transitMotion";

export const TRANSIT = {
  speed: 240,
  spacing: 3200,
  firstEncounter: 1300,
  poolSize: 6,
  behind: 2100,
  far: 11000,
  safeRadius: 140,
  ringRadius: 850,
  ringTube: 90,
  ringDepthScale: 2.4,
  starCount: 420,
} as const;

export type TransitBody = {
  position: Vector3;
  size: Vector3;
  angle: number;
};

export function createTransitLighting() {
  return { energy: 0, bass: 0, mids: 0, highs: 0, intensity: 0.16, interplay: 0 };
}

export function updateTransitLighting(
  lighting: ReturnType<typeof createTransitLighting>,
  deltaSeconds: number,
  isPlaying: boolean,
  chromaEnabled: boolean,
  snapshot?: TransitAudioInput | null,
) {
  const active = isPlaying && chromaEnabled && snapshot?.isActive;
  const energy = active ? transitUnit(snapshot.smoothedEnergy) * 0.75 + transitUnit(snapshot.energy) * 0.25 : 0;
  const bass = active ? transitUnit(transitUnit(snapshot.bass) * 0.7 + transitUnit(snapshot.bassPulse) * 0.35 + transitUnit(snapshot.kickPulse) * 0.5) : 0;
  const mids = active ? transitUnit(snapshot.mids) : 0;
  const highs = active ? transitUnit(transitUnit(snapshot.highs) * 0.7 + transitUnit(snapshot.transient) * 0.5) : 0;
  const delta = Number.isFinite(deltaSeconds) ? Math.min(0.05, Math.max(0, deltaSeconds)) : 0;
  lighting.energy = active ? lighting.energy + (energy - lighting.energy) * (1 - Math.exp(-delta * 4)) : 0;
  lighting.bass = active ? lighting.bass + (bass - lighting.bass) * (1 - Math.exp(-delta * (bass > lighting.bass ? 18 : 5))) : 0;
  lighting.mids = active ? lighting.mids + (mids - lighting.mids) * (1 - Math.exp(-delta * 9)) : 0;
  lighting.highs = active ? lighting.highs + (highs - lighting.highs) * (1 - Math.exp(-delta * (highs > lighting.highs ? 24 : 7))) : 0;
  lighting.intensity = chromaEnabled ? 0.9 + lighting.energy * 1.8 : 0.16;
  lighting.interplay = chromaEnabled ? 0.45 + lighting.energy * 0.5 : 0;
}

export function sampleTransitPath(distance: number, target: Vector3) {
  return target.set(
    620 * Math.sin(distance * 0.00026),
    240 * Math.sin(distance * 0.00036 + 0.4),
    -distance,
  );
}

export function sampleTransitDirection(distance: number, target: Vector3) {
  return target.set(
    0.1612 * Math.cos(distance * 0.00026),
    0.0864 * Math.cos(distance * 0.00036 + 0.4),
    -1,
  );
}

export function createTransitEncounter(slot: number) {
  const kind = slot % 3 === 0 ? "ring" : slot % 3 === 1 ? "pylons" : "bridge";
  return {
    kind,
    distance: TRANSIT.firstEncounter + slot * TRANSIT.spacing,
    center: new Vector3(),
    bodies: Array.from({ length: kind === "ring" ? 12 : kind === "pylons" ? 8 : 5 }, () => ({
      position: new Vector3(), size: new Vector3(), angle: 0,
    })),
  };
}

export function placeTransitEncounter(encounter: ReturnType<typeof createTransitEncounter>) {
  sampleTransitPath(encounter.distance, encounter.center);
  if (encounter.kind === "ring") encounter.center.x += 330;
  for (let index = 0; index < encounter.bodies.length; index += 1) {
    const body = encounter.bodies[index];
    body.angle = 0;
    if (encounter.kind === "ring") {
      const angle = index * Math.PI / 6;
      body.position.copy(encounter.center);
      body.position.x += Math.cos(angle) * 970;
      body.position.y += Math.sin(angle) * 970;
      body.size.set(250, 140, index % 3 === 0 ? 540 : 320);
      body.angle = angle;
    } else if (encounter.kind === "pylons") {
      const lane = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      sampleTransitPath(encounter.distance + (row - 1.5) * 350, body.position);
      body.position.x += lane * (590 + row % 2 * 130);
      body.position.y += lane * 240;
      body.size.set(230, 2400 + row % 3 * 400, 210);
      body.angle = lane * 0.075;
    } else {
      sampleTransitPath(encounter.distance + (index - 2) * 290, body.position);
      body.position.y += 620;
      body.size.set(index % 2 === 0 ? 3000 : 2200, index % 2 === 0 ? 170 : 100, 180);
      body.angle = 0.12;
    }
  }
}

export function createTransitWorld() {
  const encounters = Array.from({ length: TRANSIT.poolSize }, (_, slot) => createTransitEncounter(slot));
  encounters.forEach(placeTransitEncounter);
  return { distance: 0, animationSeconds: 0, recycled: 0, encounters };
}

export function advanceTransitWorld(
  world: ReturnType<typeof createTransitWorld>,
  deltaSeconds: number,
  isPlaying: boolean,
  motionEnabled: boolean,
  reducedMotion: boolean,
  direction: Vector3,
  speed: number = TRANSIT.speed,
) {
  if (!isPlaying || !motionEnabled || reducedMotion) return;
  const delta = Number.isFinite(deltaSeconds) ? Math.min(Math.max(deltaSeconds, 0), 0.05) : 0;
  sampleTransitDirection(world.distance, direction);
  world.distance += (Number.isFinite(speed) ? Math.max(0, speed) : 0) * delta / direction.length();
  world.animationSeconds += delta;
  for (const encounter of world.encounters) {
    if (encounter.distance < world.distance - TRANSIT.behind) {
      encounter.distance += TRANSIT.spacing * TRANSIT.poolSize;
      placeTransitEncounter(encounter);
      world.recycled += 1;
    }
  }
}