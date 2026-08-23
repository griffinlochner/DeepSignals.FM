import type { ReactNode } from "react";
import type {
  AudioReactiveSnapshot,
  ImageDepthSceneCounters,
  ReactiveBehaviorId,
  ReactivePreviewTelemetry,
} from "../app/playerTypes";

export type ThemeId = string;

export type PerformanceTier = "minimal" | "standard" | "enhanced";

export type ThemeSceneProps = {
  isPlaying: boolean;
  volume: number;
  signalId: string | null;
  audioLevel: number;
  reducedMotion: boolean;
  sourceBpm?: number | null;
  motionEnabled?: boolean;
  chromaEnabled?: boolean;
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
  reactivePreviewEnabled?: boolean;
  reactiveBehavior?: ReactiveBehaviorId;
  reactiveDepthMode?: "default" | "stabilized-depth" | "lighting-only";
  onReactivePreviewTelemetry?: (telemetry: ReactivePreviewTelemetry) => void;
  onDevSceneCountersChange?: (counters: ImageDepthSceneCounters) => void;
  manualDepthOverride?: number;
  manualHueShiftOverrideDegrees?: number | null;
  manualSaturationOverrideMultiplier?: number | null;
  onRuntimeTelemetry?: (telemetry: {
    motionTargetSpeed?: number;
    motionSpeed?: number;
    travelPosition?: number;
    hue?: number;
  }) => void;
};

export type ThemeVisualFeedFrameProps = {
  children: ReactNode;
};

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  className: string;
  performanceTier: PerformanceTier;
  Scene: React.ComponentType<ThemeSceneProps>;
  VisualFeedFrame?: React.ComponentType<ThemeVisualFeedFrameProps>;
  supportsChroma: boolean;
  supportsMotion: boolean;
  supportsVisualFeed: boolean;
  supportsAudioReactiveBehavior: boolean;
};
