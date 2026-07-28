import type { TelemetrySignalField } from './reactiveBehaviorPresetSchema'
import { resolveSnapshotSignal } from './reactiveBehaviorPresetSchema'
import type { AudioReactiveSnapshot } from './playerTypes'

export function clampUnit(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

export function mapSignalTarget(signalValue: number, minimum: number, maximum: number) {
  return minimum + signalValue * (maximum - minimum)
}

export function mapSnapshotSignalTarget(
  snapshot: AudioReactiveSnapshot,
  signalField: TelemetrySignalField,
  minimum: number,
  maximum: number,
) {
  return mapSignalTarget(resolveSnapshotSignal(snapshot, signalField), minimum, maximum)
}

export function stepSmoothedValue(current: number, target: number, smoothingFactor: number) {
  return current + (target - current) * smoothingFactor
}

export function wrapSignedDegrees(value: number) {
  let wrapped = value % 360

  if (wrapped <= -180) {
    wrapped += 360
  }

  if (wrapped > 180) {
    wrapped -= 360
  }

  return wrapped
}

export function resolveShortestHueDeltaDegrees(fromDegrees: number, toDegrees: number) {
  return wrapSignedDegrees(toDegrees - fromDegrees)
}

export function stepSmoothedHueDegrees(current: number, target: number, smoothingFactor: number) {
  const shortestDelta = resolveShortestHueDeltaDegrees(current, target)
  return wrapSignedDegrees(current + shortestDelta * smoothingFactor)
}
