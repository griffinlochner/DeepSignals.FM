import type { AudioPlaybackStatus, AudioReactiveSnapshot } from "./playerTypes";

export type RuntimeSceneTelemetry = {
  motionTargetSpeed?: number;
  motionSpeed?: number;
  travelPosition?: number;
  hue?: number;
};

export type RuntimeTestSnapshot = {
  playback: AudioPlaybackStatus;
  audio: Pick<
    AudioReactiveSnapshot,
    "energy" | "bass" | "kickPulse" | "mids" | "highs" | "smoothedEnergy"
  >;
  controls: { chroma: boolean; motion: boolean; volume: number };
  environment: {
    id: string;
    motionTargetSpeed: number | null;
    motionSpeed: number | null;
    travelPosition: number | null;
    hue: number | null;
    surgeCount: number;
    lastSurgeAt: number | null;
  };
};

const initialSnapshot: RuntimeTestSnapshot = {
  playback: "idle",
  audio: {
    energy: 0,
    bass: 0,
    kickPulse: 0,
    mids: 0,
    highs: 0,
    smoothedEnergy: 0,
  },
  controls: { chroma: true, motion: true, volume: 1 },
  environment: {
    id: "",
    motionTargetSpeed: null,
    motionSpeed: null,
    travelPosition: null,
    hue: null,
    surgeCount: 0,
    lastSurgeAt: null,
  },
};

export function publishRuntimeTestSnapshot(update: {
  playback?: AudioPlaybackStatus;
  audio?: Partial<RuntimeTestSnapshot["audio"]>;
  controls?: Partial<RuntimeTestSnapshot["controls"]>;
  environment?: Partial<RuntimeTestSnapshot["environment"]>;
}) {
  if (typeof window === "undefined") return;
  const current = window.__DSFM_TEST__ ?? initialSnapshot;
  window.__DSFM_TEST__ = {
    ...current,
    ...update,
    audio: { ...current.audio, ...update.audio },
    controls: { ...current.controls, ...update.controls },
    environment: { ...current.environment, ...update.environment },
  };
}

declare global {
  interface Window {
    __DSFM_TEST__?: RuntimeTestSnapshot;
  }
}
