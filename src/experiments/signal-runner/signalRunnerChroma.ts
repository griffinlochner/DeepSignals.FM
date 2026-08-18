export const SIGNAL_RUNNER_CHROMA_HUE_MIN_DEGREES = -180;
export const SIGNAL_RUNNER_CHROMA_HUE_MAX_DEGREES = 180;
export const SIGNAL_RUNNER_CHROMA_HUE_RESPONSE = 0.08;

export function mapSignalRunnerChromaHue(smoothedEnergy: number) {
  const clampedEnergy = Math.min(1, Math.max(0, smoothedEnergy));

  return (
    SIGNAL_RUNNER_CHROMA_HUE_MIN_DEGREES +
    (SIGNAL_RUNNER_CHROMA_HUE_MAX_DEGREES - SIGNAL_RUNNER_CHROMA_HUE_MIN_DEGREES) *
      clampedEnergy
  );
}