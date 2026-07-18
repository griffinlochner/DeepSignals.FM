import { useEffect, useMemo, useState } from "react";
import DepthLabShell from "./DepthLabShell";
import type {
  DepthLabLoadingState,
  DepthLabPlaybackState,
  DepthLabSettings,
} from "./types";

const DEFAULT_SETTINGS: DepthLabSettings = {
  playbackState: "stopped",
  motionIntensity: 0.35,
  depthStrength: 0.45,
  minimumBreathingDepth: 0,
  maximumBreathingDepth: 1,
  breathingCycleDurationSeconds: 4,
  pointerParallaxEnabled: true,
  autoMotionEnabled: true,
};

const STATE_LABELS: Record<DepthLabPlaybackState, string> = {
  stopped: "Stopped",
  playing: "Playing",
};

function DepthLabPage() {
  const [settings, setSettings] = useState<DepthLabSettings>(DEFAULT_SETTINGS);
  const [loadingState, setLoadingState] =
    useState<DepthLabLoadingState>("loading");
  const [effectiveDepthDiagnostic, setEffectiveDepthDiagnostic] = useState(0);
  const [reducedMotionActive, setReducedMotionActive] = useState(false);

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const syncReducedMotion = () =>
      setReducedMotionActive(reducedMotionQuery.matches);

    syncReducedMotion();
    reducedMotionQuery.addEventListener("change", syncReducedMotion);

    return () => {
      reducedMotionQuery.removeEventListener("change", syncReducedMotion);
    };
  }, []);

  const status = useMemo(() => {
    const stateLabel = STATE_LABELS[settings.playbackState];
    const loadingLabel =
      loadingState === "loading"
        ? "loading"
        : loadingState === "ready"
          ? "live"
          : "asset error";

    return `Jungle Depth Image · ${stateLabel} · ${loadingLabel}`;
  }, [loadingState, settings.playbackState]);

  return (
    <DepthLabShell
      settings={settings}
      status={status}
      onPlaybackStateChange={(playbackState) =>
        setSettings((current) => ({ ...current, playbackState }))
      }
      onMotionIntensityChange={(motionIntensity) =>
        setSettings((current) => ({ ...current, motionIntensity }))
      }
      onDepthStrengthChange={(depthStrength) =>
        setSettings((current) => ({ ...current, depthStrength }))
      }
      onMinimumBreathingDepthChange={(minimumBreathingDepth) =>
        setSettings((current) => ({ ...current, minimumBreathingDepth }))
      }
      onMaximumBreathingDepthChange={(maximumBreathingDepth) =>
        setSettings((current) => ({ ...current, maximumBreathingDepth }))
      }
      onBreathingCycleDurationChange={(breathingCycleDurationSeconds) =>
        setSettings((current) => ({
          ...current,
          breathingCycleDurationSeconds,
        }))
      }
      onPointerParallaxChange={(pointerParallaxEnabled) =>
        setSettings((current) => ({ ...current, pointerParallaxEnabled }))
      }
      onAutoMotionChange={(autoMotionEnabled) =>
        setSettings((current) => ({ ...current, autoMotionEnabled }))
      }
      effectiveDepthDiagnostic={effectiveDepthDiagnostic}
      reducedMotionActive={reducedMotionActive}
      onEffectiveDepthDiagnosticChange={setEffectiveDepthDiagnostic}
      onLoadingStateChange={setLoadingState}
    />
  );
}

export default DepthLabPage;
