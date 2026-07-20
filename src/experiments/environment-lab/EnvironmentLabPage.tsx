import { useEffect, useMemo, useState } from "react";
import { MAX_SURFACE_GLOW_HOTSPOTS } from "./constants";
import EnvironmentLabShell from "./EnvironmentLabShell";
import {
  cloneEnvironmentPreset,
  getImageEnvironmentAssetById,
  IMAGE_ENVIRONMENT_PRESETS,
  NEUTRAL_BASELINE_PRESET,
  UV_JUNGLE_SHOWCASE_PRESET,
} from "./presets";
import type {
  EnvironmentDiagnostics,
  EnvironmentLoadingState,
  EnvironmentLabSessionState,
  ImageEnvironmentAsset,
  ImageEnvironmentPreset,
  SurfaceGlowHotspot,
  TwinkleHotspot,
} from "./types";
import { parseEnvironmentPresetJson } from "./validation";

const EMPTY_ASSET_DIAGNOSTICS = {
  colorWidth: 0,
  colorHeight: 0,
  depthWidth: 0,
  depthHeight: 0,
  colorAspectRatio: 0,
  depthAspectRatio: 0,
  dimensionsMatch: false,
  aspectMatch: false,
};

const INITIAL_DIAGNOSTICS: EnvironmentDiagnostics = {
  fps: 0,
  effectiveDepth: 0,
  twinkleCount: 0,
  surfaceGlowCount: 0,
  particleCount: 0,
  hueOffsetDegrees: 0,
  currentSaturation: 1,
  shaderSurfaceGlowCapacity: MAX_SURFACE_GLOW_HOTSPOTS,
  surfaceGlowDefaultIntensity: 0,
  surfaceGlowAnimationActive: false,
  automaticMotionActive: false,
  surfaceGlowAnimationStatus: "Disabled",
  surfaceGlowPulseFactor: 1,
  hazeAnimationStatus: "Disabled",
  hazeOffsetX: 0,
  hazeOffsetY: 0,
  assetDiagnostics: EMPTY_ASSET_DIAGNOSTICS,
  surfaceGlowPickCanvasX: -1,
  surfaceGlowPickCanvasY: -1,
  surfaceGlowPickU: -1,
  surfaceGlowPickV: -1,
  surfaceGlowPickFoundPlane: false,
  surfaceGlowPickEffectiveDepth: 0,
};

function removeNearestHotspot<T extends { u: number; v: number }>(
  hotspots: T[],
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
  const [session, setSession] = useState<EnvironmentLabSessionState>({
    playbackState: "stopped",
    twinklePlacementModeEnabled: false,
    surfaceGlowPlacementModeEnabled: false,
    hazeMotionPreview4xEnabled: false,
  });
  const [preset, setPreset] = useState<ImageEnvironmentPreset>(() =>
    cloneEnvironmentPreset(NEUTRAL_BASELINE_PRESET),
  );
  const [selectedBuiltinPresetId, setSelectedBuiltinPresetId] =
    useState<string>(NEUTRAL_BASELINE_PRESET.id);
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

  const selectedAsset = useMemo<ImageEnvironmentAsset | null>(
    () => getImageEnvironmentAssetById(preset.assetId),
    [preset.assetId],
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
    const playbackLabel = session.playbackState === "playing" ? "Playing" : "Stopped";
    const loadingLabel =
      loadingState === "loading"
        ? "loading"
        : loadingState === "ready"
          ? "live"
          : "asset error";

    return `Environment Lab · ${playbackLabel} · ${loadingLabel}`;
  }, [loadingState, session.playbackState]);

  const setFeedback = (
    message: string,
    tone: "idle" | "success" | "error" = "idle",
  ) => {
    setFeedbackTone(tone);
    setFeedbackMessage(message);
  };

  const loadBuiltinPreset = (presetId: string) => {
    const found = IMAGE_ENVIRONMENT_PRESETS.find((entry) => entry.id === presetId);
    if (!found) {
      setFeedback(`Unknown built-in preset: ${presetId}`, "error");
      return;
    }

    setPreset(cloneEnvironmentPreset(found));
    setSelectedBuiltinPresetId(found.id);
    setSession((current) => ({
      ...current,
      playbackState: found.id === NEUTRAL_BASELINE_PRESET.id ? "stopped" : current.playbackState,
      twinklePlacementModeEnabled: false,
      surfaceGlowPlacementModeEnabled: false,
      hazeMotionPreview4xEnabled: false,
    }));
    setFeedback(`Loaded built-in preset: ${found.name}`, "success");
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
    setSession((current) => ({
      ...current,
      twinklePlacementModeEnabled: false,
      surfaceGlowPlacementModeEnabled: false,
      hazeMotionPreview4xEnabled: false,
    }));
    setSelectedBuiltinPresetId(parsed.preset.id);
    setFeedback(`Imported preset: ${parsed.preset.name}`, "success");
  };

  const atSurfaceGlowCapacity =
    preset.surfaceGlows.hotspots.length >= MAX_SURFACE_GLOW_HOTSPOTS;

  return (
    <EnvironmentLabShell
      playbackState={session.playbackState}
      twinklePlacementModeEnabled={session.twinklePlacementModeEnabled}
      surfaceGlowPlacementModeEnabled={session.surfaceGlowPlacementModeEnabled}
      hazeMotionPreview4xEnabled={session.hazeMotionPreview4xEnabled}
      surfaceGlowCapacityReached={atSurfaceGlowCapacity}
      preset={preset}
      selectedBuiltinPresetId={selectedBuiltinPresetId}
      reducedMotionActive={reducedMotionActive}
      status={status}
      diagnostics={diagnostics}
      importText={importText}
      feedbackMessage={feedbackMessage}
      feedbackTone={feedbackTone}
      onPlaybackStateChange={(value) =>
        setSession((current) => ({ ...current, playbackState: value }))
      }
      onTwinklePlacementModeChange={(enabled) =>
        setSession((current) => ({ ...current, twinklePlacementModeEnabled: enabled }))
      }
      onSurfaceGlowPlacementModeChange={(enabled) => {
        if (enabled && atSurfaceGlowCapacity) {
          setFeedback(
            `Maximum of ${MAX_SURFACE_GLOW_HOTSPOTS} Surface Glow Hotspots reached.`,
            "error",
          );
          return;
        }

        setSession((current) => ({ ...current, surfaceGlowPlacementModeEnabled: enabled }));
      }}
      onHazeMotionPreview4xChange={(enabled) =>
        setSession((current) => ({ ...current, hazeMotionPreview4xEnabled: enabled }))
      }
      onPresetChange={setPreset}
      onLoadBuiltinPreset={loadBuiltinPreset}
      onCreateTwinkleHotspot={(u, v, phase) => {
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
      onRemoveNearestTwinkleHotspot={(u, v) => {
        setPreset((current) => ({
          ...current,
          twinkles: {
            ...current.twinkles,
            hotspots: removeNearestHotspot(current.twinkles.hotspots, u, v, 0.08),
          },
        }));
      }}
      onCreateSurfaceGlowHotspot={(u, v, phase) => {
        let blocked = false;

        setPreset((current) => {
          if (current.surfaceGlows.hotspots.length >= MAX_SURFACE_GLOW_HOTSPOTS) {
            blocked = true;
            return current;
          }

          const nextHotspot: SurfaceGlowHotspot = {
            id: `surface-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
            u,
            v,
            color: current.surfaceGlows.defaultColor,
            radius: current.surfaceGlows.defaultRadius,
            softness: current.surfaceGlows.defaultSoftness,
            intensity: current.surfaceGlows.defaultIntensity,
            pulseEnabled: current.surfaceGlows.defaultPulseEnabled,
            pulseMode: current.surfaceGlows.defaultPulseMode,
            pulseAmount: current.surfaceGlows.defaultPulseAmount,
            minimumIntensityMultiplier:
              current.surfaceGlows.defaultMinimumIntensityMultiplier,
            maximumIntensityMultiplier:
              current.surfaceGlows.defaultMaximumIntensityMultiplier,
            radiusExpansionMultiplier:
              current.surfaceGlows.defaultRadiusExpansionMultiplier,
            pulseCycleSeconds: current.surfaceGlows.defaultPulseCycleSeconds,
            hueDriftEnabled: current.surfaceGlows.defaultHueDriftEnabled,
            hueDriftRangeDegrees: current.surfaceGlows.defaultHueDriftRangeDegrees,
            hueDriftCycleSeconds: current.surfaceGlows.defaultHueDriftCycleSeconds,
            phase,
          };

          return {
            ...current,
            surfaceGlows: {
              ...current.surfaceGlows,
              hotspots: [...current.surfaceGlows.hotspots, nextHotspot],
            },
          };
        });

        if (blocked) {
          setFeedback(
            `Maximum of ${MAX_SURFACE_GLOW_HOTSPOTS} Surface Glow Hotspots reached.`,
            "error",
          );
        }
      }}
      onSurfaceGlowCapacityReached={() =>
        setFeedback(
          `Maximum of ${MAX_SURFACE_GLOW_HOTSPOTS} Surface Glow Hotspots reached.`,
          "error",
        )
      }
      onRemoveNearestSurfaceGlowHotspot={(u, v) => {
        setPreset((current) => ({
          ...current,
          surfaceGlows: {
            ...current.surfaceGlows,
            hotspots: removeNearestHotspot(current.surfaceGlows.hotspots, u, v, 0.06),
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
      onClearSurfaceGlowHotspots={() => {
        setPreset((current) => ({
          ...current,
          surfaceGlows: {
            ...current.surfaceGlows,
            hotspots: [],
          },
        }));
        setFeedback("Cleared all surface glow hotspots.", "success");
      }}
      onRandomizeSurfaceGlowPhases={() => {
        setPreset((current) => ({
          ...current,
          surfaceGlows: {
            ...current.surfaceGlows,
            hotspots: current.surfaceGlows.hotspots.map((hotspot) => ({
              ...hotspot,
              phase: Math.random(),
            })),
          },
        }));
        setFeedback("Randomized surface glow phases.", "success");
      }}
      onApplySurfaceGlowDefaultsToAll={() => {
        setPreset((current) => ({
          ...current,
          surfaceGlows: {
            ...current.surfaceGlows,
            hotspots: current.surfaceGlows.hotspots.map((hotspot) => ({
              ...hotspot,
              pulseEnabled: current.surfaceGlows.defaultPulseEnabled,
              pulseMode: current.surfaceGlows.defaultPulseMode,
              pulseAmount: current.surfaceGlows.defaultPulseAmount,
              minimumIntensityMultiplier:
                current.surfaceGlows.defaultMinimumIntensityMultiplier,
              maximumIntensityMultiplier:
                current.surfaceGlows.defaultMaximumIntensityMultiplier,
              radiusExpansionMultiplier:
                current.surfaceGlows.defaultRadiusExpansionMultiplier,
              pulseCycleSeconds: current.surfaceGlows.defaultPulseCycleSeconds,
              hueDriftEnabled: current.surfaceGlows.defaultHueDriftEnabled,
              hueDriftRangeDegrees: current.surfaceGlows.defaultHueDriftRangeDegrees,
              hueDriftCycleSeconds: current.surfaceGlows.defaultHueDriftCycleSeconds,
            })),
          },
        }));
        setFeedback("Applied current Surface Glow animation settings to all hotspots.", "success");
      }}
      onResetPreset={() => {
        setPreset(cloneEnvironmentPreset(NEUTRAL_BASELINE_PRESET));
        setSelectedBuiltinPresetId(NEUTRAL_BASELINE_PRESET.id);
        setSession((current) => ({
          ...current,
          playbackState: "stopped",
          twinklePlacementModeEnabled: false,
          surfaceGlowPlacementModeEnabled: false,
          hazeMotionPreview4xEnabled: false,
        }));
        setFeedback("Reset to Neutral Baseline.", "success");
      }}
      onCopyPresetJson={handleCopyPresetJson}
      onImportTextChange={setImportText}
      onApplyImportedPreset={handleApplyImportedPreset}
      onDiagnosticsChange={setDiagnostics}
      onLoadingStateChange={setLoadingState}
      sceneAsset={selectedAsset}
      fallbackAsset={getImageEnvironmentAssetById(UV_JUNGLE_SHOWCASE_PRESET.assetId)}
    />
  );
}

export default EnvironmentLabPage;
