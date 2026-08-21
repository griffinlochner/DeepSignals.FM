export const CHROMA_HUE_MIN_DEGREES = -180;
export const CHROMA_HUE_MAX_DEGREES = 180;
export const CHROMA_HUE_RESPONSE = 0.08;

export const SIGNAL_RUNNER_CHROMA_HUE_MIN_DEGREES = CHROMA_HUE_MIN_DEGREES;
export const SIGNAL_RUNNER_CHROMA_HUE_MAX_DEGREES = CHROMA_HUE_MAX_DEGREES;
export const SIGNAL_RUNNER_CHROMA_HUE_RESPONSE = CHROMA_HUE_RESPONSE;

export function mapSmoothedEnergyToHue(smoothedEnergy: number) {
  const clampedEnergy = Math.min(1, Math.max(0, smoothedEnergy));

  return (
    CHROMA_HUE_MIN_DEGREES +
    (CHROMA_HUE_MAX_DEGREES - CHROMA_HUE_MIN_DEGREES) * clampedEnergy
  );
}

export function applyChromaHueResponse(
  currentHue: number,
  targetHue: number,
  response = CHROMA_HUE_RESPONSE,
) {
  return currentHue + (targetHue - currentHue) * response;
}

export function mapSignalRunnerChromaHue(smoothedEnergy: number) {
  return mapSmoothedEnergyToHue(smoothedEnergy);
}

export const mapSignalRunnerHue = mapSignalRunnerChromaHue;
