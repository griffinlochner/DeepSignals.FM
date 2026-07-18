export const UV_JUNGLE_PLAYBACK_VISUAL_LERP = 0.055;

export function stepUvJunglePlaybackVisualMix(
  currentMix: number,
  isPlaying: boolean,
  reducedMotion: boolean,
) {
  const targetMix = isPlaying ? 1 : 0;

  if (reducedMotion) {
    return targetMix;
  }

  return currentMix + (targetMix - currentMix) * UV_JUNGLE_PLAYBACK_VISUAL_LERP;
}

export function formatUvJunglePlaybackFilter(playbackVisualMix: number) {
  const grayscale = 1 - playbackVisualMix;
  const saturation = playbackVisualMix;
  const brightness = 0.85 + playbackVisualMix * 0.15;

  return `grayscale(${grayscale.toFixed(3)}) saturate(${saturation.toFixed(3)}) brightness(${brightness.toFixed(3)})`;
}
