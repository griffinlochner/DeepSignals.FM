import { Vector3 } from "three";
import type { AudioReactiveSnapshot } from "../../app/playerTypes";

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
  return { energy: 0, bass: 0, intensity: 0.48, interplay: 0 };
}

function unit(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function updateTransitLighting(
  lighting: ReturnType<typeof createTransitLighting>,
  deltaSeconds: number,
  isPlaying: boolean,
  chromaEnabled: boolean,
  snapshot?: AudioReactiveSnapshot | null,
) {
  const active = isPlaying && chromaEnabled && snapshot?.isActive;
  const energy = active ? unit(snapshot.smoothedEnergy) * 0.75 + unit(snapshot.energy) * 0.25 : 0;
  const bass = active ? unit(snapshot.bass) : 0;
  const delta = Number.isFinite(deltaSeconds) ? Math.min(0.05, Math.max(0, deltaSeconds)) : 0;
  const blend = 1 - Math.exp(-delta * 3);
  lighting.energy = active ? lighting.energy + (energy - lighting.energy) * blend : 0;
  lighting.bass = active ? lighting.bass + (bass - lighting.bass) * blend : 0;
  lighting.intensity = chromaEnabled ? 0.85 + lighting.energy * 0.65 + lighting.bass * 0.2 : 0.48;
  lighting.interplay = chromaEnabled ? 0.32 + lighting.energy * 0.48 : 0;
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
) {
  if (!isPlaying || !motionEnabled || reducedMotion) return;
  const delta = Number.isFinite(deltaSeconds) ? Math.min(Math.max(deltaSeconds, 0), 0.05) : 0;
  sampleTransitDirection(world.distance, direction);
  world.distance += TRANSIT.speed * delta / direction.length();
  world.animationSeconds += delta;
  for (const encounter of world.encounters) {
    if (encounter.distance < world.distance - TRANSIT.behind) {
      encounter.distance += TRANSIT.spacing * TRANSIT.poolSize;
      placeTransitEncounter(encounter);
      world.recycled += 1;
    }
  }
}