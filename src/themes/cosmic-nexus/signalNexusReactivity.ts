import type { AudioReactiveSnapshot } from '../../app/playerTypes'
import {
  clampUnit,
  mapSignalTarget,
  resolveShortestHueDeltaDegrees,
  wrapSignedDegrees,
} from '../../app/reactiveBehaviorMapping'

export type SignalNexusReactiveState = {
  globalIntensity: number
  corePulse: number
  kickImpulse: number
  orbitIntensity: number
  particleIntensity: number
  hueOffset: number
  saturation: number
  emissiveIntensity: number
}

export const SIGNAL_NEXUS_REACTIVITY = {
  energy: {
    floor: 0.08,
    curve: 1.25,
    weight: 0.42,
  },
  bass: {
    floor: 0.12,
    curve: 1.35,
    coreWeight: 0.54,
    saturationWeight: 0.24,
  },
  kick: {
    floor: 0.1,
    curve: 0.92,
    impulseWeight: 0.9,
    orbitWeight: 0,
  },
  mids: {
    floor: 0.08,
    curve: 1.18,
    orbitWeight: 0.46,
  },
  highs: {
    floor: 0.06,
    curve: 1.1,
    particleWeight: 0.58,
    emissiveWeight: 0.08,
  },
  chroma: {
    hueRangeDegrees: 15,
    hueBiasTowardWarmRatio: 0.18,
    saturationBase: 1,
    saturationEnergyWeight: 0.1,
    emissiveBase: 1,
    emissiveEnergyWeight: 0.14,
    emissiveKickWeight: 0.1,
    hueSmoothing: 0.2,
  },
  motion: {
    travelerBaseRateScale: 1.05,
    travelerOrbitInfluence: 0.18,
    travelerGlobalInfluence: 0.08,
    satelliteOrbitBaseScale: 0.62,
    satelliteOrbitReactiveInfluence: 0.16,
    satelliteOrbitGlobalInfluence: 0.08,
    satelliteShellSpinBaseScale: 0.38,
    satelliteShellSpinReactiveInfluence: 0.18,
    shellSpinReactiveInfluence: 0.12,
    ringSpinReactiveInfluence: 0.14,
    coreBreathBaseAmplitude: 0.06,
    coreBreathReactiveAmplitude: 0.04,
    coreKickImpulseAmplitude: 0.025,
    travelerPulseBaseScale: 0.16,
    travelerPulseKickScale: 0.04,
    travelerGlowBaseScale: 1.15,
    travelerGlowParticleScale: 0.1,
  },
  smoothingPerSecond: {
    globalIntensity: { attack: 6, release: 2.2 },
    corePulse: { attack: 9.2, release: 2.8 },
    kickImpulse: { attack: 20, release: 6.8 },
    orbitIntensity: { attack: 7.2, release: 2.4 },
    particleIntensity: { attack: 8.6, release: 3.2 },
    saturation: { attack: 6.4, release: 3.2 },
    emissiveIntensity: { attack: 8.4, release: 4.1 },
  },
  bounds: {
    globalIntensity: { min: 0, max: 1 },
    corePulse: { min: 0, max: 1 },
    kickImpulse: { min: 0, max: 1 },
    orbitIntensity: { min: 0, max: 1 },
    particleIntensity: { min: 0, max: 1 },
    hueOffset: { min: -15, max: 15 },
    saturation: { min: 1, max: 1.42 },
    emissiveIntensity: { min: 1, max: 1.26 },
  },
  epsilon: 0.0005,
} as const

function finite(value: number) {
  return Number.isFinite(value) ? value : 0
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, finite(value)))
}

function normalizeWithFloor(value: number, floor: number) {
  const safeFloor = clamp(floor, 0, 0.99)
  const safeValue = finite(value)
  const denominator = Math.max(1 - safeFloor, 0.0001)
  return clamp((safeValue - safeFloor) / denominator, 0, 1)
}

function shapeCurve(value: number, exponent: number) {
  return Math.pow(clamp(value, 0, 1), Math.max(exponent, 0.0001))
}

function stepExp(
  current: number,
  target: number,
  deltaSeconds: number,
  attackPerSecond: number,
  releasePerSecond: number,
) {
  const safeCurrent = finite(current)
  const safeTarget = finite(target)
  const safeDelta = Math.max(0, finite(deltaSeconds))
  const rate = safeTarget > safeCurrent ? Math.max(0, attackPerSecond) : Math.max(0, releasePerSecond)
  const blend = 1 - Math.exp(-rate * safeDelta)
  return safeCurrent + (safeTarget - safeCurrent) * blend
}

export function createNeutralSignalNexusReactiveState(): SignalNexusReactiveState {
  return {
    globalIntensity: 0,
    corePulse: 0,
    kickImpulse: 0,
    orbitIntensity: 0,
    particleIntensity: 0,
    hueOffset: 0,
    saturation: SIGNAL_NEXUS_REACTIVITY.chroma.saturationBase,
    emissiveIntensity: SIGNAL_NEXUS_REACTIVITY.chroma.emissiveBase,
  }
}

export function resolveSignalNexusReactiveTarget(params: {
  isPlaying: boolean
  chromaEnabled: boolean
  snapshot: AudioReactiveSnapshot | null
  kickImpulseSeed: number
}): SignalNexusReactiveState {
  const neutral = createNeutralSignalNexusReactiveState()

  if (!params.isPlaying || !params.snapshot || params.snapshot.isActive !== true) {
    return neutral
  }

  const energy = shapeCurve(
    normalizeWithFloor(params.snapshot.smoothedEnergy, SIGNAL_NEXUS_REACTIVITY.energy.floor),
    SIGNAL_NEXUS_REACTIVITY.energy.curve,
  )
  const bass = shapeCurve(
    normalizeWithFloor(params.snapshot.bass, SIGNAL_NEXUS_REACTIVITY.bass.floor),
    SIGNAL_NEXUS_REACTIVITY.bass.curve,
  )
  const mids = shapeCurve(
    normalizeWithFloor(params.snapshot.mids, SIGNAL_NEXUS_REACTIVITY.mids.floor),
    SIGNAL_NEXUS_REACTIVITY.mids.curve,
  )
  const highs = shapeCurve(
    normalizeWithFloor(params.snapshot.highs, SIGNAL_NEXUS_REACTIVITY.highs.floor),
    SIGNAL_NEXUS_REACTIVITY.highs.curve,
  )
  const kickPulse = shapeCurve(
    normalizeWithFloor(params.snapshot.kickPulse, SIGNAL_NEXUS_REACTIVITY.kick.floor),
    SIGNAL_NEXUS_REACTIVITY.kick.curve,
  )

  const kickImpulse = clampUnit(
    Math.max(kickPulse, clamp(params.kickImpulseSeed, 0, 1)) * SIGNAL_NEXUS_REACTIVITY.kick.impulseWeight,
  )

  const globalIntensity = clampUnit(
    energy * SIGNAL_NEXUS_REACTIVITY.energy.weight +
      bass * 0.2 +
      mids * 0.15 +
      highs * 0.09 +
      kickImpulse * 0.06,
  )

  const corePulse = clampUnit(
    bass * SIGNAL_NEXUS_REACTIVITY.bass.coreWeight +
      energy * 0.28 +
      kickImpulse * 0.12,
  )

  const orbitIntensity = clampUnit(
    mids * SIGNAL_NEXUS_REACTIVITY.mids.orbitWeight +
      energy * 0.24 +
      kickImpulse * SIGNAL_NEXUS_REACTIVITY.kick.orbitWeight,
  )

  const particleIntensity = clampUnit(
    highs * SIGNAL_NEXUS_REACTIVITY.highs.particleWeight +
      energy * 0.16 +
      kickImpulse * 0.04,
  )

  const chromaTargetEnabled = params.chromaEnabled === true
  const hueSignal = clampUnit(mids * 0.56 + highs * 0.44)
  const warmBias = SIGNAL_NEXUS_REACTIVITY.chroma.hueBiasTowardWarmRatio * kickImpulse
  const hueOffset = chromaTargetEnabled
    ? clamp(
        mapSignalTarget(hueSignal, -SIGNAL_NEXUS_REACTIVITY.chroma.hueRangeDegrees, SIGNAL_NEXUS_REACTIVITY.chroma.hueRangeDegrees) +
          warmBias,
        SIGNAL_NEXUS_REACTIVITY.bounds.hueOffset.min,
        SIGNAL_NEXUS_REACTIVITY.bounds.hueOffset.max,
      )
    : 0

  const saturation = chromaTargetEnabled
    ? clamp(
        SIGNAL_NEXUS_REACTIVITY.chroma.saturationBase +
          bass * SIGNAL_NEXUS_REACTIVITY.bass.saturationWeight +
          energy * SIGNAL_NEXUS_REACTIVITY.chroma.saturationEnergyWeight,
        SIGNAL_NEXUS_REACTIVITY.bounds.saturation.min,
        SIGNAL_NEXUS_REACTIVITY.bounds.saturation.max,
      )
    : SIGNAL_NEXUS_REACTIVITY.chroma.saturationBase

  const emissiveIntensity = chromaTargetEnabled
    ? clamp(
        SIGNAL_NEXUS_REACTIVITY.chroma.emissiveBase +
          energy * SIGNAL_NEXUS_REACTIVITY.chroma.emissiveEnergyWeight +
          kickImpulse * SIGNAL_NEXUS_REACTIVITY.chroma.emissiveKickWeight +
          highs * SIGNAL_NEXUS_REACTIVITY.highs.emissiveWeight,
        SIGNAL_NEXUS_REACTIVITY.bounds.emissiveIntensity.min,
        SIGNAL_NEXUS_REACTIVITY.bounds.emissiveIntensity.max,
      )
    : SIGNAL_NEXUS_REACTIVITY.chroma.emissiveBase

  return {
    globalIntensity,
    corePulse,
    kickImpulse,
    orbitIntensity,
    particleIntensity,
    hueOffset,
    saturation,
    emissiveIntensity,
  }
}

export function stepSignalNexusReactiveState(
  current: SignalNexusReactiveState,
  target: SignalNexusReactiveState,
  deltaSeconds: number,
): SignalNexusReactiveState {
  const s = SIGNAL_NEXUS_REACTIVITY.smoothingPerSecond
  const bounds = SIGNAL_NEXUS_REACTIVITY.bounds

  const nextHue = wrapSignedDegrees(
    current.hueOffset +
      resolveShortestHueDeltaDegrees(current.hueOffset, target.hueOffset) *
        SIGNAL_NEXUS_REACTIVITY.chroma.hueSmoothing,
  )

  const next: SignalNexusReactiveState = {
    globalIntensity: clamp(
      stepExp(current.globalIntensity, target.globalIntensity, deltaSeconds, s.globalIntensity.attack, s.globalIntensity.release),
      bounds.globalIntensity.min,
      bounds.globalIntensity.max,
    ),
    corePulse: clamp(
      stepExp(current.corePulse, target.corePulse, deltaSeconds, s.corePulse.attack, s.corePulse.release),
      bounds.corePulse.min,
      bounds.corePulse.max,
    ),
    kickImpulse: clamp(
      stepExp(current.kickImpulse, target.kickImpulse, deltaSeconds, s.kickImpulse.attack, s.kickImpulse.release),
      bounds.kickImpulse.min,
      bounds.kickImpulse.max,
    ),
    orbitIntensity: clamp(
      stepExp(current.orbitIntensity, target.orbitIntensity, deltaSeconds, s.orbitIntensity.attack, s.orbitIntensity.release),
      bounds.orbitIntensity.min,
      bounds.orbitIntensity.max,
    ),
    particleIntensity: clamp(
      stepExp(current.particleIntensity, target.particleIntensity, deltaSeconds, s.particleIntensity.attack, s.particleIntensity.release),
      bounds.particleIntensity.min,
      bounds.particleIntensity.max,
    ),
    hueOffset: clamp(nextHue, bounds.hueOffset.min, bounds.hueOffset.max),
    saturation: clamp(
      stepExp(current.saturation, target.saturation, deltaSeconds, s.saturation.attack, s.saturation.release),
      bounds.saturation.min,
      bounds.saturation.max,
    ),
    emissiveIntensity: clamp(
      stepExp(current.emissiveIntensity, target.emissiveIntensity, deltaSeconds, s.emissiveIntensity.attack, s.emissiveIntensity.release),
      bounds.emissiveIntensity.min,
      bounds.emissiveIntensity.max,
    ),
  }

  if (
    Math.abs(next.globalIntensity - target.globalIntensity) <= SIGNAL_NEXUS_REACTIVITY.epsilon &&
    Math.abs(next.corePulse - target.corePulse) <= SIGNAL_NEXUS_REACTIVITY.epsilon &&
    Math.abs(next.kickImpulse - target.kickImpulse) <= SIGNAL_NEXUS_REACTIVITY.epsilon &&
    Math.abs(next.orbitIntensity - target.orbitIntensity) <= SIGNAL_NEXUS_REACTIVITY.epsilon &&
    Math.abs(next.particleIntensity - target.particleIntensity) <= SIGNAL_NEXUS_REACTIVITY.epsilon &&
    Math.abs(next.saturation - target.saturation) <= SIGNAL_NEXUS_REACTIVITY.epsilon &&
    Math.abs(resolveShortestHueDeltaDegrees(next.hueOffset, target.hueOffset)) <= 0.05 &&
    Math.abs(next.emissiveIntensity - target.emissiveIntensity) <= SIGNAL_NEXUS_REACTIVITY.epsilon
  ) {
    return {
      ...target,
      hueOffset: clamp(target.hueOffset, bounds.hueOffset.min, bounds.hueOffset.max),
      saturation: clamp(target.saturation, bounds.saturation.min, bounds.saturation.max),
      emissiveIntensity: clamp(target.emissiveIntensity, bounds.emissiveIntensity.min, bounds.emissiveIntensity.max),
    }
  }

  return next
}
