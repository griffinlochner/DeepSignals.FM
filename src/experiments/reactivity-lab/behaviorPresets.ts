export type TelemetrySignalField =
  | 'energy'
  | 'smoothedEnergy'
  | 'bass'
  | 'kickPulse'
  | 'bassPulse'
  | 'mids'
  | 'highs'
  | 'transient'

export type DepthMode = 'manual' | 'audio-mapped'
export type HueMode = 'off' | 'manual' | 'audio-mapped'
export type SaturationMode = 'off' | 'manual' | 'audio-mapped'

export const DEFAULT_SATURATION_PRESET_FIELDS = {
  mode: 'off' as SaturationMode,
  signal: 'smoothedEnergy' as TelemetrySignalField,
  min: 0.85,
  max: 1.15,
  smoothing: 0.05,
} as const

export type ReactivityLabBehaviorPresetV1 = {
  schemaVersion: 1
  name: string
  depth: {
    mode: DepthMode
    signal: TelemetrySignalField
    min: number
    max: number
    smoothing: number
  }
  hue: {
    mode: HueMode
    signal: TelemetrySignalField
    minDegrees: number
    maxDegrees: number
    smoothing: number
  }
}

export type ReactivityLabBehaviorPresetV2 = {
  schemaVersion: 2
  name: string
  depth: {
    mode: DepthMode
    signal: TelemetrySignalField
    min: number
    max: number
    smoothing: number
  }
  hue: {
    mode: HueMode
    signal: TelemetrySignalField
    minDegrees: number
    maxDegrees: number
    smoothing: number
  }
  saturation: {
    mode: SaturationMode
    signal: TelemetrySignalField
    min: number
    max: number
    smoothing: number
  }
}

export type ReactivityLabBehaviorPreset = ReactivityLabBehaviorPresetV2

export const REACTIVITY_LAB_PRESET_SCHEMA_VERSION = 2
export const REACTIVITY_LAB_BEHAVIOR_PRESETS_STORAGE_KEY = 'deepsignals.dev.reactivityLab.behaviorPresets.v1'

export const DEPTH_CONTROL_LIMITS = {
  min: 0,
  max: 1,
  smoothingMin: 0.02,
  smoothingMax: 0.5,
} as const

export const HUE_CONTROL_LIMITS = {
  minDegrees: -180,
  maxDegrees: 180,
  smoothingMin: 0.02,
  smoothingMax: 0.5,
} as const

export const SATURATION_CONTROL_LIMITS = {
  min: 0,
  max: 2,
  smoothingMin: 0.01,
  smoothingMax: 0.5,
} as const

const DEPTH_MODES: ReadonlyArray<DepthMode> = ['manual', 'audio-mapped']
const HUE_MODES: ReadonlyArray<HueMode> = ['off', 'manual', 'audio-mapped']
const SATURATION_MODES: ReadonlyArray<SaturationMode> = ['off', 'manual', 'audio-mapped']
const TELEMETRY_SIGNALS: ReadonlyArray<TelemetrySignalField> = [
  'energy',
  'smoothedEnergy',
  'bass',
  'kickPulse',
  'bassPulse',
  'mids',
  'highs',
  'transient',
]

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function inRange(value: number, minimum: number, maximum: number) {
  return value >= minimum && value <= maximum
}

function validatePresetCore(input: Record<string, unknown>): {
  valid: true
  base: {
    name: string
    depth: {
      mode: DepthMode
      signal: TelemetrySignalField
      min: number
      max: number
      smoothing: number
    }
    hue: {
      mode: HueMode
      signal: TelemetrySignalField
      minDegrees: number
      maxDegrees: number
      smoothing: number
    }
  }
} | { valid: false; error: string } {
  const name = input.name
  if (typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, error: 'Preset name must be a non-empty string.' }
  }

  const depth = input.depth
  if (!isObjectLike(depth)) {
    return { valid: false, error: 'Preset depth config is missing.' }
  }

  const hue = input.hue
  if (!isObjectLike(hue)) {
    return { valid: false, error: 'Preset hue config is missing.' }
  }

  if (!DEPTH_MODES.includes(depth.mode as DepthMode)) {
    return { valid: false, error: `Unknown depth.mode: ${String(depth.mode)}.` }
  }

  if (!HUE_MODES.includes(hue.mode as HueMode)) {
    return { valid: false, error: `Unknown hue.mode: ${String(hue.mode)}.` }
  }

  if (!TELEMETRY_SIGNALS.includes(depth.signal as TelemetrySignalField)) {
    return { valid: false, error: `Unknown depth.signal: ${String(depth.signal)}.` }
  }

  if (!TELEMETRY_SIGNALS.includes(hue.signal as TelemetrySignalField)) {
    return { valid: false, error: `Unknown hue.signal: ${String(hue.signal)}.` }
  }

  const depthMin = depth.min
  const depthMax = depth.max
  const depthSmoothing = depth.smoothing
  if (!isFiniteNumber(depthMin) || !isFiniteNumber(depthMax) || !isFiniteNumber(depthSmoothing)) {
    return { valid: false, error: 'Depth min/max/smoothing must be finite numbers.' }
  }

  if (depthMin > depthMax) {
    return { valid: false, error: 'Depth min must be less than or equal to depth max.' }
  }

  if (!inRange(depthMin, DEPTH_CONTROL_LIMITS.min, DEPTH_CONTROL_LIMITS.max) || !inRange(depthMax, DEPTH_CONTROL_LIMITS.min, DEPTH_CONTROL_LIMITS.max)) {
    return {
      valid: false,
      error: `Depth min/max must be within ${DEPTH_CONTROL_LIMITS.min}..${DEPTH_CONTROL_LIMITS.max}.`,
    }
  }

  if (!inRange(depthSmoothing, DEPTH_CONTROL_LIMITS.smoothingMin, DEPTH_CONTROL_LIMITS.smoothingMax)) {
    return {
      valid: false,
      error: `Depth smoothing must be within ${DEPTH_CONTROL_LIMITS.smoothingMin}..${DEPTH_CONTROL_LIMITS.smoothingMax}.`,
    }
  }

  const hueMin = hue.minDegrees
  const hueMax = hue.maxDegrees
  const hueSmoothing = hue.smoothing
  if (!isFiniteNumber(hueMin) || !isFiniteNumber(hueMax) || !isFiniteNumber(hueSmoothing)) {
    return { valid: false, error: 'Hue minDegrees/maxDegrees/smoothing must be finite numbers.' }
  }

  if (hueMin > hueMax) {
    return { valid: false, error: 'Hue minDegrees must be less than or equal to hue maxDegrees.' }
  }

  if (!inRange(hueMin, HUE_CONTROL_LIMITS.minDegrees, HUE_CONTROL_LIMITS.maxDegrees) || !inRange(hueMax, HUE_CONTROL_LIMITS.minDegrees, HUE_CONTROL_LIMITS.maxDegrees)) {
    return {
      valid: false,
      error: `Hue minDegrees/maxDegrees must be within ${HUE_CONTROL_LIMITS.minDegrees}..${HUE_CONTROL_LIMITS.maxDegrees}.`,
    }
  }

  if (!inRange(hueSmoothing, HUE_CONTROL_LIMITS.smoothingMin, HUE_CONTROL_LIMITS.smoothingMax)) {
    return {
      valid: false,
      error: `Hue smoothing must be within ${HUE_CONTROL_LIMITS.smoothingMin}..${HUE_CONTROL_LIMITS.smoothingMax}.`,
    }
  }

  return {
    valid: true,
    base: {
      name: name.trim(),
      depth: {
        mode: depth.mode as DepthMode,
        signal: depth.signal as TelemetrySignalField,
        min: depthMin,
        max: depthMax,
        smoothing: depthSmoothing,
      },
      hue: {
        mode: hue.mode as HueMode,
        signal: hue.signal as TelemetrySignalField,
        minDegrees: hueMin,
        maxDegrees: hueMax,
        smoothing: hueSmoothing,
      },
    },
  }
}

export function validateBehaviorPreset(input: unknown): { valid: true; preset: ReactivityLabBehaviorPreset } | { valid: false; error: string } {
  if (!isObjectLike(input)) {
    return { valid: false, error: 'Preset must be a JSON object.' }
  }

  const schemaVersion = input.schemaVersion
  if (schemaVersion !== 1 && schemaVersion !== REACTIVITY_LAB_PRESET_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Unsupported schemaVersion: ${String(schemaVersion)}. Expected 1 or ${REACTIVITY_LAB_PRESET_SCHEMA_VERSION}.`,
    }
  }

  const coreValidation = validatePresetCore(input)
  if (!coreValidation.valid) {
    return coreValidation
  }

  const saturationInput = schemaVersion === 1
    ? DEFAULT_SATURATION_PRESET_FIELDS
    : input.saturation

  if (!isObjectLike(saturationInput)) {
    return { valid: false, error: 'Preset saturation config is missing.' }
  }

  if (!SATURATION_MODES.includes(saturationInput.mode as SaturationMode)) {
    return { valid: false, error: `Unknown saturation.mode: ${String(saturationInput.mode)}.` }
  }

  if (!TELEMETRY_SIGNALS.includes(saturationInput.signal as TelemetrySignalField)) {
    return { valid: false, error: `Unknown saturation.signal: ${String(saturationInput.signal)}.` }
  }

  const saturationMin = saturationInput.min
  const saturationMax = saturationInput.max
  const saturationSmoothing = saturationInput.smoothing
  if (!isFiniteNumber(saturationMin) || !isFiniteNumber(saturationMax) || !isFiniteNumber(saturationSmoothing)) {
    return { valid: false, error: 'Saturation min/max/smoothing must be finite numbers.' }
  }

  if (saturationMin > saturationMax) {
    return { valid: false, error: 'Saturation min must be less than or equal to saturation max.' }
  }

  if (!inRange(saturationMin, SATURATION_CONTROL_LIMITS.min, SATURATION_CONTROL_LIMITS.max) || !inRange(saturationMax, SATURATION_CONTROL_LIMITS.min, SATURATION_CONTROL_LIMITS.max)) {
    return {
      valid: false,
      error: `Saturation min/max must be within ${SATURATION_CONTROL_LIMITS.min}..${SATURATION_CONTROL_LIMITS.max}.`,
    }
  }

  if (!inRange(saturationSmoothing, SATURATION_CONTROL_LIMITS.smoothingMin, SATURATION_CONTROL_LIMITS.smoothingMax)) {
    return {
      valid: false,
      error: `Saturation smoothing must be within ${SATURATION_CONTROL_LIMITS.smoothingMin}..${SATURATION_CONTROL_LIMITS.smoothingMax}.`,
    }
  }

  const preset: ReactivityLabBehaviorPreset = {
    schemaVersion: REACTIVITY_LAB_PRESET_SCHEMA_VERSION,
    name: coreValidation.base.name,
    depth: coreValidation.base.depth,
    hue: coreValidation.base.hue,
    saturation: {
      mode: saturationInput.mode as SaturationMode,
      signal: saturationInput.signal as TelemetrySignalField,
      min: saturationMin,
      max: saturationMax,
      smoothing: saturationSmoothing,
    },
  }

  return { valid: true, preset }
}

export function serializeBehaviorPreset(preset: ReactivityLabBehaviorPreset) {
  return JSON.stringify(preset, null, 2)
}

export function parseBehaviorPresetJson(jsonText: string): { valid: true; preset: ReactivityLabBehaviorPreset } | { valid: false; error: string } {
  const trimmed = jsonText.trim()
  if (!trimmed) {
    return { valid: false, error: 'Import JSON is empty.' }
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    return validateBehaviorPreset(parsed)
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Invalid JSON.' }
  }
}

export function readStoredBehaviorPresets(): ReactivityLabBehaviorPreset[] {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = window.localStorage.getItem(REACTIVITY_LAB_BEHAVIOR_PRESETS_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    const validPresets: ReactivityLabBehaviorPreset[] = []
    for (const candidate of parsed) {
      const validation = validateBehaviorPreset(candidate)
      if (validation.valid) {
        validPresets.push(validation.preset)
      }
    }

    return validPresets
  } catch {
    return []
  }
}

export function writeStoredBehaviorPresets(presets: ReactivityLabBehaviorPreset[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    REACTIVITY_LAB_BEHAVIOR_PRESETS_STORAGE_KEY,
    JSON.stringify(presets),
  )
}
