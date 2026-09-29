import { Matrix4, Vector3 } from "three";
import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import { mapEnergyToSurgeTargetSpeed } from "../../app/sharedSurgeQualification";

export const TUNNEL = {
  speed: 22,
  maxSpeedBoost: 24,
  surgeBoost: 26,
  speedAttack: 4.8,
  speedRelease: 2.2,
  surgeDurationMs: 1750,
  energyCeiling: 0.72,
  radius: 8,
  chamberRadius: 23,
  sectionLength: 640,
  spacing: 8,
  segmentCount: 40,
  behindDistance: 24,
  far: 240,
  doorStartDistance: 112,
  doorClearDistance: 32,
  safeRadius: 5.2,
  torusTube: 1.05,
  torusTilt: 0.3,
  portalLayers: 7,
} as const;

export function createTunnelSection() {
  return {
    radius: TUNNEL.radius as number, openness: 0, solid: false, gateway: false,
    door: false, torus: false, reentry: false,
    archetype: "spiral" as "spiral" | "rails" | "torus",
  };
}

export function sampleTunnelSection(distance: number, target: ReturnType<typeof createTunnelSection>) {
  const cycle = Math.floor(distance / TUNNEL.sectionLength);
  const phase = distance - cycle * TUNNEL.sectionLength;
  const entering = Math.min(1, Math.max(0, (phase - 160) / 96));
  const leaving = Math.min(1, Math.max(0, (480 - phase) / 96));
  target.openness = entering * entering * (3 - 2 * entering)
    * leaving * leaving * (3 - 2 * leaving);
  target.radius = (TUNNEL.radius + Math.sin(distance * 0.012)) * (1 - target.openness)
    + TUNNEL.chamberRadius * target.openness;
  const chapter = ((cycle % 3) + 3) % 3;
  target.archetype = chapter === 0 ? "spiral" : chapter === 1 ? "rails" : "torus";
  target.solid = (phase >= 48 && phase < 160) || (phase >= 480 && phase < 592);
  target.gateway = phase === 144 || phase === 160 || phase === 480 || phase === 496;
  target.door = phase === 112;
  target.torus = chapter === 2 && phase >= 256 && phase <= 384 && phase % 32 === 0;
  target.reentry = chapter === 2 && phase === 448;
  return target;
}

export function tunnelDoorOpening(distanceAhead: number) {
  const progress = Math.min(1, Math.max(0,
    (TUNNEL.doorStartDistance - distanceAhead) / (TUNNEL.doorStartDistance - TUNNEL.doorClearDistance),
  ));
  return progress * progress * (3 - 2 * progress);
}

export function tunnelDoorHalfGap(distanceAhead: number, radius: number) {
  return 0.35 + tunnelDoorOpening(distanceAhead) * (radius + 0.6);
}

export function tunnelTargetSpeed(
  isPlaying: boolean,
  snapshot?: TunnelAudioInput | null,
) {
  return (TUNNEL.speed + TUNNEL.maxSpeedBoost) * tunnelAudioEnergy(isPlaying, snapshot);
}

export type TunnelAudioInput = Pick<AudioReactiveSnapshot, "isActive" | "smoothedEnergy">
  & Partial<Pick<AudioReactiveSnapshot, "energy" | "bass" | "kickPulseAcceptedEventSequence">>;

export function tunnelAudioEnergy(isPlaying: boolean, snapshot?: TunnelAudioInput | null) {
  if (!isPlaying || !snapshot?.isActive || !Number.isFinite(snapshot.smoothedEnergy)) return 0;
  const raw = Number.isFinite(snapshot.energy) ? snapshot.energy! : snapshot.smoothedEnergy;
  const bass = Number.isFinite(snapshot.bass) ? snapshot.bass! : snapshot.smoothedEnergy;
  return (mapEnergyToSurgeTargetSpeed(0.6 * raw + 0.3 * snapshot.smoothedEnergy + 0.1 * bass) / 100) ** 1.35;
}

export function dampTunnelSpeed(current: number, target: number, deltaSeconds: number) {
  const damping = target > current ? TUNNEL.speedAttack : TUNNEL.speedRelease;
  const blend = 1 - Math.exp(-damping * Math.min(Math.max(deltaSeconds, 0), 0.05));
  return current + (target - current) * blend;
}

export function sampleCenterline(distance: number, target: Vector3) {
  return target.set(
    24 * Math.sin(distance * 0.008) + 9 * Math.sin(distance * 0.017),
    16 * Math.sin(distance * 0.009 + 0.7),
    -distance,
  );
}

export function sampleDirection(distance: number, target: Vector3) {
  return target.set(
    0.192 * Math.cos(distance * 0.008) + 0.153 * Math.cos(distance * 0.017),
    0.144 * Math.cos(distance * 0.009 + 0.7),
    -1,
  );
}

export function createChamberPointSampler() {
  const section = createTunnelSection();
  const center = new Vector3();
  const direction = new Vector3();
  const origin = new Vector3();
  const up = new Vector3(0, 1, 0);
  const frame = new Matrix4();
  return (distance: number, lane: number, archetype: "spiral" | "rails", target: Vector3, layer = 0) => {
    const radius = sampleTunnelSection(distance, section).radius * (layer === 0 ? 0.86 : 0.68);
    const spiral = archetype === "spiral";
    const angle = lane * Math.PI * 2 / (spiral ? 3 : 4) + Math.PI / 4
      + (spiral ? distance * 0.045 * (layer === 0 ? 1 : -1) : 0);
    sampleCenterline(distance, center);
    sampleDirection(distance, direction).normalize();
    frame.lookAt(origin, direction, up);
    return target.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
      .applyMatrix4(frame).add(center);
  };
}

export function createTunnelTravel() {
  return {
    distance: 0,
    recycled: 0,
    segments: Float64Array.from(
      { length: TUNNEL.segmentCount },
      (_, index) => index * TUNNEL.spacing - TUNNEL.behindDistance,
    ),
  };
}

export function advanceTunnel(
  travel: ReturnType<typeof createTunnelTravel>,
  deltaSeconds: number,
  enabled: boolean,
  direction: Vector3,
  speed: number = TUNNEL.speed,
) {
  if (!enabled) return;
  sampleDirection(travel.distance, direction);
  travel.distance +=
    (speed * Math.min(Math.max(deltaSeconds, 0), 0.05)) / direction.length();
  const poolLength = TUNNEL.segmentCount * TUNNEL.spacing;
  for (let index = 0; index < travel.segments.length; index += 1) {
    if (travel.segments[index] < travel.distance - TUNNEL.behindDistance) {
      travel.segments[index] += poolLength;
      travel.recycled += 1;
    }
  }
}