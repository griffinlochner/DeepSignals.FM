export const IMAGE_DEPTH_PLAYBACK_VISUAL_LERP = 0.055;
const PLAYBACK_VISUAL_SNAP_EPSILON = 0.001;

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

export function stepImageDepthPlaybackVisualMix(
  currentMix: number,
  isPlaying: boolean,
  reducedMotion: boolean,
) {
  const safeCurrentMix = finite(currentMix, 0);
  const targetMix = isPlaying ? 1 : 0;

  if (reducedMotion) {
    return targetMix;
  }

  const nextMix = safeCurrentMix + (targetMix - safeCurrentMix) * IMAGE_DEPTH_PLAYBACK_VISUAL_LERP;

  if (Math.abs(targetMix - nextMix) <= PLAYBACK_VISUAL_SNAP_EPSILON) {
    return targetMix;
  }

  return nextMix;
}

export function formatImageDepthPlaybackFilter(params: {
  playbackVisualMix: number;
  hueOffsetDegrees: number;
  currentSaturation: number;
  glowPulseAmount: number;
}) {
  const playbackVisualMix = finite(params.playbackVisualMix, 0);
  const hueOffsetDegrees = finite(params.hueOffsetDegrees, 0);
  const currentSaturation = finite(params.currentSaturation, 1);
  const glowPulseAmount = finite(params.glowPulseAmount, 0);

  const grayscale = 1 - playbackVisualMix;
  const brightness = 1 + glowPulseAmount;
  const saturation =
    playbackVisualMix * currentSaturation * (1 + glowPulseAmount * 0.7);

  return [
    `grayscale(${grayscale.toFixed(3)})`,
    `hue-rotate(${hueOffsetDegrees.toFixed(3)}deg)`,
    `saturate(${Math.max(saturation, 0).toFixed(3)})`,
    `brightness(${Math.max(brightness, 0).toFixed(3)})`,
  ].join(" ");
}
