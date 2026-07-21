import { useEffect, useMemo, useState } from "react";
import { MAX_SURFACE_GLOW_HOTSPOTS } from "./constants";
import EnvironmentLabShell from "./EnvironmentLabShell";
import {
  applyBehaviorPreset,
  cloneScenePreset,
  createNeutralScenePresetForAsset,
  ENVIRONMENT_BEHAVIOR_PRESETS,
  getBehaviorPresetById,
  getImageEnvironmentAssetById,
  IMAGE_ENVIRONMENT_ASSETS,
  IMAGE_ENVIRONMENT_SCENE_PRESETS,
  getScenePresetById,
  NEUTRAL_BASELINE_SCENE_PRESET,
  UV_JUNGLE_SHOWCASE_SCENE_PRESET,
} from "./presets";
import type {
  EnvironmentDiagnostics,
  EnvironmentLabSessionState,
  EnvironmentLoadingState,
  ImageEnvironmentAsset,
  ImageEnvironmentScenePreset,
  SurfaceGlowHotspot,
} from "./types";
import { parseFullScenePresetJson } from "./validation";

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
  surfaceGlowCount: 0,
  hueOffsetDegrees: 0,
  currentSaturation: 1,
  shaderSurfaceGlowCapacity: MAX_SURFACE_GLOW_HOTSPOTS,
  surfaceGlowDefaultIntensity: 0,
  surfaceGlowAnimationActive: false,
  automaticMotionActive: false,
  surfaceGlowAnimationStatus: "Disabled",
  surfaceGlowPulseFactor: 1,
  assetDiagnostics: EMPTY_ASSET_DIAGNOSTICS,
  mostRecentSurfaceGlowU: undefined,
  mostRecentSurfaceGlowV: undefined,
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
    surfaceGlowPlacementModeEnabled: false,
  });
  const [scenePreset, setScenePreset] = useState<ImageEnvironmentScenePreset>(() =>
    cloneScenePreset(NEUTRAL_BASELINE_SCENE_PRESET),
  );
  const [selectedBehaviorPresetId, setSelectedBehaviorPresetId] = useState("neutral");
  const [selectedScenePresetId, setSelectedScenePresetId] = useState(
    NEUTRAL_BASELINE_SCENE_PRESET.id,
  );
  const [loadingState, setLoadingState] = useState<EnvironmentLoadingState>("loading");
  const [reducedMotionActive, setReducedMotionActive] = useState(false);
  const [diagnostics, setDiagnostics] = useState<EnvironmentDiagnostics>(INITIAL_DIAGNOSTICS);
  const [importText, setImportText] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("Scene authoring controls ready.");
  const [feedbackTone, setFeedbackTone] = useState<"idle" | "success" | "error">("idle");

  const selectedAsset = useMemo<ImageEnvironmentAsset | null>(
    () => getImageEnvironmentAssetById(scenePreset.assetId),
    [scenePreset.assetId],
  );

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
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

  const loadBehaviorPreset = (behaviorPresetId: string) => {
    const behaviorPreset = getBehaviorPresetById(behaviorPresetId);
    if (!behaviorPreset) {
      setFeedback(`Unknown behavior preset: ${behaviorPresetId}`, "error");
      return;
    }

    setScenePreset((current) => applyBehaviorPreset(current, behaviorPreset));
    setSelectedBehaviorPresetId(behaviorPreset.id);
    setFeedback(`Applied behavior preset: ${behaviorPreset.name}`, "success");
  };

  const loadScenePreset = (scenePresetId: string) => {
    const preset = getScenePresetById(scenePresetId);
    if (!preset) {
      setFeedback(`Unknown full scene preset: ${scenePresetId}`, "error");
      return;
    }

    setScenePreset(cloneScenePreset(preset));
    setSelectedScenePresetId(preset.id);
    setSession((current) => ({
      ...current,
      surfaceGlowPlacementModeEnabled: false,
    }));
    setFeedback(`Loaded full scene preset: ${preset.name}`, "success");
  };

  const handleAssetChange = (assetId: string) => {
    const selected = getImageEnvironmentAssetById(assetId);
    if (!selected) {
      setFeedback(`Unknown asset: ${assetId}`, "error");
      return;
    }

    const neutralScene = createNeutralScenePresetForAsset(selected.id);
    setScenePreset(neutralScene);
    setSelectedBehaviorPresetId("neutral");
    setSelectedScenePresetId(neutralScene.id);
    setSession((current) => ({
      ...current,
      surfaceGlowPlacementModeEnabled: false,
    }));
    setFeedback(`Switched asset to ${selected.name} in neutral state.`, "success");
  };

  const handleCopySceneJson = async () => {
    const serialized = JSON.stringify(scenePreset, null, 2);

    try {
      await navigator.clipboard.writeText(serialized);
      setFeedback("Full scene JSON copied to clipboard.", "success");
    } catch {
      setImportText(serialized);
      setFeedback(
        "Clipboard access failed. Full scene JSON was placed in the import textarea instead.",
        "error",
      );
    }
  };

  const handleApplyImportedScene = () => {
    const parsed = parseFullScenePresetJson(importText);

    if (!parsed.ok) {
      setFeedback(parsed.error, "error");
      return;
    }

    setScenePreset(parsed.preset);
    setSelectedScenePresetId(parsed.preset.id);
    setSession((current) => ({
      ...current,
      surfaceGlowPlacementModeEnabled: false,
    }));

    if (parsed.warnings.length > 0) {
      setFeedback(`Imported full scene with warning: ${parsed.warnings.join(" ")}`, "success");
      return;
    }

    setFeedback(`Imported full scene: ${parsed.preset.name}`, "success");
  };

  const atSurfaceGlowCapacity =
    scenePreset.surfaceGlows.hotspots.length >= MAX_SURFACE_GLOW_HOTSPOTS;

  const mostRecentSurfaceGlow =
    scenePreset.surfaceGlows.hotspots[scenePreset.surfaceGlows.hotspots.length - 1] ?? null;

  return (
    <EnvironmentLabShell
      playbackState={session.playbackState}
      surfaceGlowPlacementModeEnabled={session.surfaceGlowPlacementModeEnabled}
      surfaceGlowCapacityReached={atSurfaceGlowCapacity}
      scenePreset={scenePreset}
      selectedBehaviorPresetId={selectedBehaviorPresetId}
      selectedScenePresetId={selectedScenePresetId}
      reducedMotionActive={reducedMotionActive}
      status={status}
      diagnostics={{
        ...diagnostics,
        mostRecentSurfaceGlowU: mostRecentSurfaceGlow?.u,
        mostRecentSurfaceGlowV: mostRecentSurfaceGlow?.v,
      }}
      importText={importText}
      feedbackMessage={feedbackMessage}
      feedbackTone={feedbackTone}
      onPlaybackStateChange={(value) =>
        setSession((current) => ({ ...current, playbackState: value }))
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
      onScenePresetChange={setScenePreset}
      onLoadBehaviorPreset={loadBehaviorPreset}
      onLoadScenePreset={loadScenePreset}
      onAssetChange={handleAssetChange}
      onCreateSurfaceGlowHotspot={(u, v, phase) => {
        let blocked = false;

        setScenePreset((current) => {
          if (current.surfaceGlows.hotspots.length >= MAX_SURFACE_GLOW_HOTSPOTS) {
            blocked = true;
            return current;
          }

          const defaults = current.surfaceGlows.defaults;
          const nextHotspot: SurfaceGlowHotspot = {
            id: `surface-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
            u,
            v,
            color: defaults.color,
            radius: defaults.radius,
            softness: defaults.softness,
            intensity: defaults.intensity,
            pulseEnabled: defaults.pulseEnabled,
            pulseMode: defaults.pulseMode,
            pulseAmount: defaults.pulseAmount,
            minimumIntensityMultiplier: defaults.minimumIntensityMultiplier,
            maximumIntensityMultiplier: defaults.maximumIntensityMultiplier,
            radiusExpansionMultiplier: defaults.radiusExpansionMultiplier,
            pulseCycleSeconds: defaults.pulseCycleSeconds,
            hueDriftEnabled: defaults.hueDriftEnabled,
            hueDriftRangeDegrees: defaults.hueDriftRangeDegrees,
            hueDriftCycleSeconds: defaults.hueDriftCycleSeconds,
            phase,
          };

          return {
            ...current,
            surfaceGlows: {
              ...current.surfaceGlows,
              defaults: { ...current.surfaceGlows.defaults },
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
        setScenePreset((current) => ({
          ...current,
          surfaceGlows: {
            ...current.surfaceGlows,
            defaults: { ...current.surfaceGlows.defaults },
            hotspots: removeNearestHotspot(current.surfaceGlows.hotspots, u, v, 0.06),
          },
        }));
      }}
      onClearSurfaceGlowHotspots={() => {
        setScenePreset((current) => ({
          ...current,
          surfaceGlows: {
            ...current.surfaceGlows,
            defaults: { ...current.surfaceGlows.defaults },
            hotspots: [],
          },
        }));
        setFeedback("Cleared all Surface Glow hotspots.", "success");
      }}
      onRandomizeSurfaceGlowPhases={() => {
        setScenePreset((current) => ({
          ...current,
          surfaceGlows: {
            ...current.surfaceGlows,
            defaults: { ...current.surfaceGlows.defaults },
            hotspots: current.surfaceGlows.hotspots.map((hotspot) => ({
              ...hotspot,
              phase: Math.random(),
            })),
          },
        }));
        setFeedback("Randomized Surface Glow phases.", "success");
      }}
      onApplySurfaceGlowDefaultsToAll={() => {
        setScenePreset((current) => {
          const defaults = current.surfaceGlows.defaults;
          return {
            ...current,
            surfaceGlows: {
              ...current.surfaceGlows,
              defaults: { ...defaults },
              hotspots: current.surfaceGlows.hotspots.map((hotspot) => ({
                ...hotspot,
                pulseEnabled: defaults.pulseEnabled,
                pulseMode: defaults.pulseMode,
                pulseAmount: defaults.pulseAmount,
                minimumIntensityMultiplier: defaults.minimumIntensityMultiplier,
                maximumIntensityMultiplier: defaults.maximumIntensityMultiplier,
                radiusExpansionMultiplier: defaults.radiusExpansionMultiplier,
                pulseCycleSeconds: defaults.pulseCycleSeconds,
                hueDriftEnabled: defaults.hueDriftEnabled,
                hueDriftRangeDegrees: defaults.hueDriftRangeDegrees,
                hueDriftCycleSeconds: defaults.hueDriftCycleSeconds,
              })),
            },
          };
        });
        setFeedback("Applied current Surface Glow animation settings to all hotspots.", "success");
      }}
      onResetScene={() => {
        const neutralScene = createNeutralScenePresetForAsset(scenePreset.assetId);
        setScenePreset(neutralScene);
        setSelectedBehaviorPresetId("neutral");
        setSelectedScenePresetId(neutralScene.id);
        setSession({
          playbackState: "stopped",
          surfaceGlowPlacementModeEnabled: false,
        });
        setFeedback("Reset full scene to asset neutral baseline.", "success");
      }}
      onCopySceneJson={handleCopySceneJson}
      onImportTextChange={setImportText}
      onApplyImportedScene={handleApplyImportedScene}
      onDiagnosticsChange={setDiagnostics}
      onLoadingStateChange={setLoadingState}
      sceneAsset={selectedAsset}
      fallbackAsset={getImageEnvironmentAssetById(UV_JUNGLE_SHOWCASE_SCENE_PRESET.assetId)}
      behaviorPresets={ENVIRONMENT_BEHAVIOR_PRESETS}
      assets={IMAGE_ENVIRONMENT_ASSETS}
      scenePresets={IMAGE_ENVIRONMENT_SCENE_PRESETS}
    />
  );
}

export default EnvironmentLabPage;
