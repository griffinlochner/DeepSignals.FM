declare global {
  interface Window {
    __IMAGE_DEPTH_PARITY__?: {
      forcedElapsedSeconds?: number;
      stats?: Record<string, unknown>;
      counters?: {
        rendererInstances: number;
        sceneInstances: number;
      };
    };
  }
}

function ensureParityCounters() {
  if (!window.__IMAGE_DEPTH_PARITY__) {
    window.__IMAGE_DEPTH_PARITY__ = {};
  }

  if (!window.__IMAGE_DEPTH_PARITY__.counters) {
    window.__IMAGE_DEPTH_PARITY__.counters = {
      rendererInstances: 0,
      sceneInstances: 0,
    };
  }

  return window.__IMAGE_DEPTH_PARITY__.counters;
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

export function incrementImageDepthRendererInstance() {
  const counters = ensureParityCounters();
  counters.rendererInstances += 1;
}

export function decrementImageDepthRendererInstance() {
  const counters = ensureParityCounters();
  counters.rendererInstances = Math.max(0, counters.rendererInstances - 1);
}

export function incrementImageDepthSceneInstance() {
  const counters = ensureParityCounters();
  counters.sceneInstances += 1;
}

export function decrementImageDepthSceneInstance() {
  const counters = ensureParityCounters();
  counters.sceneInstances = Math.max(0, counters.sceneInstances - 1);
}

export function readImageDepthInstanceCounters() {
  const counters = ensureParityCounters();
  return {
    rendererInstances: counters.rendererInstances,
    sceneInstances: counters.sceneInstances,
  };
}
