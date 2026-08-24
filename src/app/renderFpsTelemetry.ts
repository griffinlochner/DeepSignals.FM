export type RenderFpsSampleCallback = (fps: number) => void;

type RenderFpsSampler = {
  sample: (timestamp: number) => void;
  reset: () => void;
  dispose: () => void;
};

const SAMPLE_WINDOW_MS = 1000;
const MAX_FRAME_GAP_MS = 1500;

export function createRenderFpsSampler(
  onSample: RenderFpsSampleCallback,
): RenderFpsSampler {
  let frameCount = 0;
  let windowStartedAt = 0;
  let lastFrameAt = 0;
  let disposed = false;

  const reset = () => {
    frameCount = 0;
    windowStartedAt = 0;
    lastFrameAt = 0;
  };

  return {
    sample(timestamp) {
      if (disposed || !Number.isFinite(timestamp)) {
        return;
      }

      if (lastFrameAt > 0 && timestamp - lastFrameAt > MAX_FRAME_GAP_MS) {
        reset();
      }

      lastFrameAt = timestamp;
      if (windowStartedAt === 0) {
        windowStartedAt = timestamp;
      }
      frameCount += 1;

      const elapsed = timestamp - windowStartedAt;
      if (elapsed < SAMPLE_WINDOW_MS) {
        return;
      }

      onSample(Math.round((frameCount * 1000) / elapsed));
      reset();
    },
    reset,
    dispose() {
      disposed = true;
      reset();
    },
  };
}
