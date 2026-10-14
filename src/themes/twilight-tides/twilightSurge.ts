import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import { createSharedSurgeQualificationState, updateSharedSurgeQualification } from "../../app/sharedSurgeQualification";

export const TWILIGHT_SURGE = { durationSeconds: 3.2, attackSeconds: 0.55, releaseSeconds: 1.75, peakScale: 1.5 } as const;

export function twilightSurgeEnvelope(ageSeconds: number) {
  if (ageSeconds < 0 || ageSeconds >= TWILIGHT_SURGE.durationSeconds) return 0;
  const ramp = Math.min(1, ageSeconds / TWILIGHT_SURGE.attackSeconds,
    (TWILIGHT_SURGE.durationSeconds - ageSeconds) / TWILIGHT_SURGE.releaseSeconds);
  return ramp * ramp * (3 - 2 * ramp);
}

export function createTwilightSurge() {
  return {
    elapsedMs: 0, startedAt: -Infinity, count: 0,
    ageSeconds: 0, envelope: 0, scale: 1,
    lastQualificationAt: -Infinity,
    qualification: createSharedSurgeQualificationState(),
    qualificationInput: { nowMs: 0, smoothedEnergy: 0, acceptedSequence: 0, isPlaying: false, motionEnabled: false },
  };
}

export function updateTwilightSurge(
  state: ReturnType<typeof createTwilightSurge>,
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
    if (result.triggered && state.elapsedMs - state.startedAt >= TWILIGHT_SURGE.durationSeconds * 1000) {
      state.startedAt = state.elapsedMs;
      state.count++;
    }
  }
  state.ageSeconds = Math.min(TWILIGHT_SURGE.durationSeconds, (state.elapsedMs - state.startedAt) / 1000);
  state.envelope = twilightSurgeEnvelope(state.ageSeconds);
  state.scale = 1 + (TWILIGHT_SURGE.peakScale - 1) * state.envelope;
}

// Directional light, shared by sky and rippled reflections; no particle pool or extra pass.
export const twilightSurgeShader = /* glsl */`
  uniform float solarSurge;
  uniform float solarSurgeTime;
  uniform float solarScale;

  vec3 solarSignal(vec3 d, vec3 center, vec3 radiance, float radius, float handedness, float pixelWidth) {
    vec3 right = normalize(cross(center, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, center);
    vec2 p = vec2(dot(d, right), dot(d, up)) / radius;
    float r = length(p);
    if (dot(d, center) < 0.0 || r > 3.8 || r < 0.8) return vec3(0.0);
    float angle = atan(p.y, p.x) * handedness;
    float curl = angle - (r - 1.0) * 1.6 + solarSurgeTime * 1.5
      + 0.18 * sin(angle * 2.0 + r * 1.3 - solarSurgeTime * 0.5);
    float aa = clamp(pixelWidth / radius * (3.0 / max(r, 1.0) + 6.0), 0.015, 1.4);
    float phase = curl * 3.0;
    float distanceToRibbon = abs(sin(phase * 0.5));
    float core = 1.0 - smoothstep(0.045, 0.17 + aa, distanceToRibbon);
    core *= 1.0 - smoothstep(0.3, 1.4, aa);
    float glow = exp(-distanceToRibbon * distanceToRibbon * 7.0);
    float reach = 1.5 + 2.2 * smoothstep(0.0, 1.0, solarSurgeTime);
    float taper = smoothstep(0.85, 1.12, r) * (1.0 - smoothstep(1.35, reach, r));
    float wave = 0.72 + 0.28 * sin(r * 4.0 - solarSurgeTime * 3.5);
    vec3 spectral = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + r * 1.8 - angle + solarSurgeTime * 0.65);
    spectral *= spectral;
    vec3 color = mix(radiance, spectral, chroma * smoothstep(1.0, 2.0, r) * 0.85);
    return color * (core * 1.15 + glow * 0.45) * taper * wave
      * solarSurge * (0.28 + chroma * 0.72) * smoothstep(0.002, 0.022, d.y);
  }
`;
