import { useEffect, useMemo, useState } from "react";
import EnvironmentLabShell from "./EnvironmentLabShell";
import { cloneEnvironmentPreset, UV_JUNGLE_LAB_PRESET } from "./presets";
import type {
  EnvironmentDiagnostics,
  EnvironmentLoadingState,
  EnvironmentPlaybackState,
  EnvironmentPreset,
  TwinkleHotspot,
} from "./types";
import { parseEnvironmentPresetJson } from "./validation";

const INITIAL_DIAGNOSTICS: EnvironmentDiagnostics = {
  fps: 0,
  effectiveDepth: 0,
  twinkleCount: 0,
  particleCount: 0,
  hueOffsetDegrees: 0,
  automaticMotionActive: false,
};

function removeNearestHotspot(
  hotspots: TwinkleHotspot[],
  u: number,
  v: number,
  threshold: number,
) {
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  hotspots.forEach((hotspot, index) => {
    const distance = Math.hypot(hotspot.u - u, hotspot.v - v);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  if (nearestIndex < 0 || nearestDistance > threshold) {
    return hotspots;
  }

  return hotspots.filter((_, index) => index !== nearestIndex);
}

function EnvironmentLabPage() {
  const [playbackState, setPlaybackState] =
    useState<EnvironmentPlaybackState>("stopped");
  const [preset, setPreset] = useState<EnvironmentPreset>(() =>
    cloneEnvironmentPreset(UV_JUNGLE_LAB_PRESET),
  );
  const [placementModeEnabled, setPlacementModeEnabled] = useState(false);
  const [loadingState, setLoadingState] =
    useState<EnvironmentLoadingState>("loading");
  const [reducedMotionActive, setReducedMotionActive] = useState(false);
  const [diagnostics, setDiagnostics] = useState<EnvironmentDiagnostics>(
    INITIAL_DIAGNOSTICS,
  );
  const [importText, setImportText] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState(
    "Laboratory preset controls ready.",
  );
  const [feedbackTone, setFeedbackTone] = useState<"idle" | "success" | "error">(
    "idle",
  );

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const syncReducedMotion = () => setReducedMotionActive(reducedMotionQuery.matches);

    syncReducedMotion();
    reducedMotionQuery.addEventListener("change", syncReducedMotion);

    return () => {
      reducedMotionQuery.removeEventListener("change", syncReducedMotion);
    };
  }, []);

  const status = useMemo(() => {
    const playbackLabel = playbackState === "playing" ? "Playing" : "Stopped";
    const loadingLabel =
      loadingState === "loading"
        ? "loading"
        : loadingState === "ready"
          ? "live"
          : "asset error";

    return `Environment Lab · ${playbackLabel} · ${loadingLabel}`;
  }, [loadingState, playbackState]);

  const setFeedback = (
    message: string,
    tone: "idle" | "success" | "error" = "idle",
  ) => {
    setFeedbackTone(tone);
    setFeedbackMessage(message);
  };

  const handleCopyPresetJson = async () => {
    const serialized = JSON.stringify(preset, null, 2);

    try {
      await navigator.clipboard.writeText(serialized);
      setFeedback("Preset JSON copied to clipboard.", "success");
    } catch {
      setImportText(serialized);
      setFeedback(
        "Clipboard access failed. Preset JSON was placed in the import textarea instead.",
        "error",
      );
    }
  };

  const handleApplyImportedPreset = () => {
    const parsed = parseEnvironmentPresetJson(importText);

    if (!parsed.ok) {
      setFeedback(parsed.error, "error");
      return;
    }

    setPreset(parsed.preset);
    setFeedback(`Imported preset: ${parsed.preset.name}`, "success");
  };

  return (
    <EnvironmentLabShell
      playbackState={playbackState}
      placementModeEnabled={placementModeEnabled}
      preset={preset}
      reducedMotionActive={reducedMotionActive}
      status={status}
      diagnostics={diagnostics}
      importText={importText}
      feedbackMessage={feedbackMessage}
      feedbackTone={feedbackTone}
      onPlaybackStateChange={setPlaybackState}
      onPlacementModeChange={setPlacementModeEnabled}
      onPresetChange={setPreset}
      onCreateHotspot={(u, v, phase) => {
        setPreset((current) => {
          const nextHotspot: TwinkleHotspot = {
            id: `twk-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
            u,
            v,
            phase,
          };

          return {
            ...current,
            twinkles: {
              ...current.twinkles,
              hotspots: [...current.twinkles.hotspots, nextHotspot],
            },
          };
        });
      }}
      onRemoveNearestHotspot={(u, v) => {
        setPreset((current) => ({
          ...current,
          twinkles: {
            ...current.twinkles,
            hotspots: removeNearestHotspot(current.twinkles.hotspots, u, v, 0.08),
          },
        }));
      }}
      onClearHotspots={() => {
        setPreset((current) => ({
          ...current,
          twinkles: {
            ...current.twinkles,
            hotspots: [],
          },
        }));
        setFeedback("Cleared all twinkle hotspots.", "success");
      }}
      onRandomizeHotspotPhases={() => {
        setPreset((current) => ({
          ...current,
          twinkles: {
            ...current.twinkles,
            hotspots: current.twinkles.hotspots.map((hotspot) => ({
              ...hotspot,
              phase: Math.random(),
            })),
          },
        }));
        setFeedback("Randomized twinkle hotspot phases.", "success");
      }}
      onResetPreset={() => {
        setPreset(cloneEnvironmentPreset(UV_JUNGLE_LAB_PRESET));
        setFeedback("Reset to UV Jungle laboratory defaults.", "success");
      }}
      onCopyPresetJson={handleCopyPresetJson}
      onImportTextChange={setImportText}
      onApplyImportedPreset={handleApplyImportedPreset}
      onDiagnosticsChange={setDiagnostics}
      onLoadingStateChange={setLoadingState}
    />
  );
}

export default EnvironmentLabPage;
