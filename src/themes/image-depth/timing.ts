declare global {
  interface Window {
    __IMAGE_DEPTH_PARITY__?: {
      forcedElapsedSeconds?: number;
      stats?: Record<string, unknown>;
    };
  }
}

export function resolveImageDepthElapsedSeconds(timestamp: number, startedAt: number) {
  const forced = window.__IMAGE_DEPTH_PARITY__?.forcedElapsedSeconds;

  if (typeof forced === "number" && Number.isFinite(forced) && forced >= 0) {
    return forced;
  }

  return Math.max(0, (timestamp - startedAt) / 1000);
}

export function writeImageDepthParityStats(key: string, value: Record<string, unknown>) {
  if (!window.__IMAGE_DEPTH_PARITY__) {
    window.__IMAGE_DEPTH_PARITY__ = {};
  }

  if (!window.__IMAGE_DEPTH_PARITY__.stats) {
    window.__IMAGE_DEPTH_PARITY__.stats = {};
  }

  window.__IMAGE_DEPTH_PARITY__.stats[key] = value;
}
