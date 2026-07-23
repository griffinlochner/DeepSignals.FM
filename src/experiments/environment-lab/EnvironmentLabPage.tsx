import { useEffect, useMemo, useState } from "react";
import { MAX_SURFACE_GLOW_HOTSPOTS } from "./constants";
import EnvironmentLabShell from "./EnvironmentLabShell";
import {
  ANALOG_SIGNAL_LABORATORY_PRODUCTION_SCENE_PRESET,
  BIOLUMINESCENT_PSY_FOREST_PRODUCTION_SCENE_PRESET,
  BIOLUMINESCENT_PSY_REEF_PRODUCTION_SCENE_PRESET,
  CRYSTAL_CAVERN_PRODUCTION_SCENE_PRESET,
  FEMALE_DJ_1_PRODUCTION_SCENE_PRESET,
  FEMALE_DJ_2_PRODUCTION_SCENE_PRESET,
  SLIME_CAVERN_PRODUCTION_SCENE_PRESET,
  UV_JUNGLE_PRODUCTION_SCENE_PRESET,
} from "../../themes/image-depth/productionScenePresets";
import {
  applyBehaviorPreset,
  cloneBehaviorSettings,
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
  EnvironmentBehaviorSettings,
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

function normalizeNumber(value: number) {
  return Number(value.toFixed(6));
}

function normalizeBehaviorForComparison(behavior: EnvironmentBehaviorSettings) {
  return {
    depth: {
      motionIntensity: normalizeNumber(behavior.depth.motionIntensity),
      depthStrength: normalizeNumber(behavior.depth.depthStrength),
      staticDepth: normalizeNumber(behavior.depth.staticDepth),
      breathingMin: normalizeNumber(behavior.depth.breathingMin),
      breathingMax: normalizeNumber(behavior.depth.breathingMax),
      breathingCycleSeconds: normalizeNumber(behavior.depth.breathingCycleSeconds),
      pointerParallaxEnabled: behavior.depth.pointerParallaxEnabled,
      pointerParallaxStrength: normalizeNumber(behavior.depth.pointerParallaxStrength),
      ambientMotionEnabled: behavior.depth.ambientMotionEnabled,
    },
    color: {
      driftEnabled: behavior.color.driftEnabled,
      hueRangeDegrees: normalizeNumber(behavior.color.hueRangeDegrees),
      cycleSeconds: normalizeNumber(behavior.color.cycleSeconds),
      saturation: normalizeNumber(behavior.color.saturation),
      glowPulseEnabled: behavior.color.glowPulseEnabled,
      glowPulseAmount: normalizeNumber(behavior.color.glowPulseAmount),
      glowPulseCycleSeconds: normalizeNumber(behavior.color.glowPulseCycleSeconds),
    },
    saturationPulse: {
      enabled: behavior.saturationPulse.enabled,
      minimumSaturation: normalizeNumber(behavior.saturationPulse.minimumSaturation),
      maximumSaturation: normalizeNumber(behavior.saturationPulse.maximumSaturation),
      cycleSeconds: normalizeNumber(behavior.saturationPulse.cycleSeconds),
      phaseOffset: normalizeNumber(behavior.saturationPulse.phaseOffset),
      syncToDepthBreathing: behavior.saturationPulse.syncToDepthBreathing,
    },
  };
}

function normalizeSceneForComparison(scene: ImageEnvironmentScenePreset) {
  return {
    assetId: scene.assetId,
    behavior: normalizeBehaviorForComparison(scene.behavior),
    surfaceGlows: {
      enabled: scene.surfaceGlows.enabled,
      defaults: {
        color: scene.surfaceGlows.defaults.color,
        radius: normalizeNumber(scene.surfaceGlows.defaults.radius),
        softness: normalizeNumber(scene.surfaceGlows.defaults.softness),
        intensity: normalizeNumber(scene.surfaceGlows.defaults.intensity),
        pulseEnabled: scene.surfaceGlows.defaults.pulseEnabled,
        pulseMode: scene.surfaceGlows.defaults.pulseMode,
        pulseAmount: normalizeNumber(scene.surfaceGlows.defaults.pulseAmount),
        minimumIntensityMultiplier: normalizeNumber(
          scene.surfaceGlows.defaults.minimumIntensityMultiplier,
        ),
        maximumIntensityMultiplier: normalizeNumber(
          scene.surfaceGlows.defaults.maximumIntensityMultiplier,
        ),
        radiusExpansionMultiplier: normalizeNumber(
          scene.surfaceGlows.defaults.radiusExpansionMultiplier,
        ),
        pulseCycleSeconds: normalizeNumber(scene.surfaceGlows.defaults.pulseCycleSeconds),
        hueDriftEnabled: scene.surfaceGlows.defaults.hueDriftEnabled,
        hueDriftRangeDegrees: normalizeNumber(scene.surfaceGlows.defaults.hueDriftRangeDegrees),
        hueDriftCycleSeconds: normalizeNumber(scene.surfaceGlows.defaults.hueDriftCycleSeconds),
      },
      hotspots: scene.surfaceGlows.hotspots.map((hotspot) => ({
        id: hotspot.id,
        u: normalizeNumber(hotspot.u),
        v: normalizeNumber(hotspot.v),
        color: hotspot.color,
        radius: normalizeNumber(hotspot.radius),
        softness: normalizeNumber(hotspot.softness),
        intensity: normalizeNumber(hotspot.intensity),
        pulseEnabled: hotspot.pulseEnabled,
        pulseMode: hotspot.pulseMode,
        pulseAmount: normalizeNumber(hotspot.pulseAmount),
        minimumIntensityMultiplier: normalizeNumber(hotspot.minimumIntensityMultiplier),
        maximumIntensityMultiplier: normalizeNumber(hotspot.maximumIntensityMultiplier),
        radiusExpansionMultiplier: normalizeNumber(hotspot.radiusExpansionMultiplier),
        pulseCycleSeconds: normalizeNumber(hotspot.pulseCycleSeconds),
        hueDriftEnabled: hotspot.hueDriftEnabled,
        hueDriftRangeDegrees: normalizeNumber(hotspot.hueDriftRangeDegrees),
        hueDriftCycleSeconds: normalizeNumber(hotspot.hueDriftCycleSeconds),
        phase: normalizeNumber(hotspot.phase),
      })),
    },
  };
}

function behaviorSettingsMatch(a: EnvironmentBehaviorSettings, b: EnvironmentBehaviorSettings) {
  return (
    JSON.stringify(normalizeBehaviorForComparison(a)) ===
    JSON.stringify(normalizeBehaviorForComparison(b))
  );
}

function sceneAuthoringDataMatch(a: ImageEnvironmentScenePreset, b: ImageEnvironmentScenePreset) {
  return (
    JSON.stringify(normalizeSceneForComparison(a)) === JSON.stringify(normalizeSceneForComparison(b))
  );
}

function EnvironmentLabPage() {
  const [session, setSession] = useState<EnvironmentLabSessionState>({
    playbackState: "stopped",
    geometryMotionPreviewEnabled: true,
    surfaceGlowPlacementModeEnabled: false,
    framingMode: "player-preview",
  });
  const [scenePreset, setScenePreset] = useState<ImageEnvironmentScenePreset>(() =>
    cloneScenePreset(NEUTRAL_BASELINE_SCENE_PRESET),
  );
  const [selectedScenePresetId, setSelectedScenePresetId] = useState(
    NEUTRAL_BASELINE_SCENE_PRESET.id,
  );
  const [selectedScenePresetImported, setSelectedScenePresetImported] = useState(false);
  const [baselineScenePreset, setBaselineScenePreset] = useState<ImageEnvironmentScenePreset>(() =>
    cloneScenePreset(NEUTRAL_BASELINE_SCENE_PRESET),
  );
  const [loadingState, setLoadingState] = useState<EnvironmentLoadingState>("loading");
  const [reducedMotionActive, setReducedMotionActive] = useState(false);
  const [diagnostics, setDiagnostics] = useState<EnvironmentDiagnostics>(INITIAL_DIAGNOSTICS);
  const [selectedSurfaceGlowId, setSelectedSurfaceGlowId] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("Scene authoring controls ready.");
  const [feedbackTone, setFeedbackTone] = useState<"idle" | "success" | "error">("idle");

  const productionBehaviorByAssetId = useMemo(() => {
    return new Map<string, EnvironmentBehaviorSettings>([
      [
        UV_JUNGLE_PRODUCTION_SCENE_PRESET.assetId,
        cloneBehaviorSettings(UV_JUNGLE_PRODUCTION_SCENE_PRESET.behavior),
      ],
      [
        ANALOG_SIGNAL_LABORATORY_PRODUCTION_SCENE_PRESET.assetId,
        cloneBehaviorSettings(ANALOG_SIGNAL_LABORATORY_PRODUCTION_SCENE_PRESET.behavior),
      ],
      [
        BIOLUMINESCENT_PSY_FOREST_PRODUCTION_SCENE_PRESET.assetId,
        cloneBehaviorSettings(BIOLUMINESCENT_PSY_FOREST_PRODUCTION_SCENE_PRESET.behavior),
      ],
      [
        BIOLUMINESCENT_PSY_REEF_PRODUCTION_SCENE_PRESET.assetId,
        cloneBehaviorSettings(BIOLUMINESCENT_PSY_REEF_PRODUCTION_SCENE_PRESET.behavior),
      ],
      [
        CRYSTAL_CAVERN_PRODUCTION_SCENE_PRESET.assetId,
        cloneBehaviorSettings(CRYSTAL_CAVERN_PRODUCTION_SCENE_PRESET.behavior),
      ],
      [
        SLIME_CAVERN_PRODUCTION_SCENE_PRESET.assetId,
        cloneBehaviorSettings(SLIME_CAVERN_PRODUCTION_SCENE_PRESET.behavior),
      ],
      [
        FEMALE_DJ_1_PRODUCTION_SCENE_PRESET.assetId,
        cloneBehaviorSettings(FEMALE_DJ_1_PRODUCTION_SCENE_PRESET.behavior),
      ],
      [
        FEMALE_DJ_2_PRODUCTION_SCENE_PRESET.assetId,
        cloneBehaviorSettings(FEMALE_DJ_2_PRODUCTION_SCENE_PRESET.behavior),
      ],
    ]);
  }, []);

  const selectedAsset = useMemo<ImageEnvironmentAsset | null>(
    () => getImageEnvironmentAssetById(scenePreset.assetId),
    [scenePreset.assetId],
  );

  const activeBehaviorPreset = useMemo(() => {
    return (
      ENVIRONMENT_BEHAVIOR_PRESETS.find((preset) =>
        behaviorSettingsMatch(preset.settings, scenePreset.behavior),
      ) ?? null
    );
  }, [scenePreset.behavior]);

  const activeBehaviorStatusLabel = activeBehaviorPreset?.name ?? "Custom";
  const activeBehaviorPresetId = activeBehaviorPreset?.id ?? null;

  const sceneModified = useMemo(
    () => !sceneAuthoringDataMatch(scenePreset, baselineScenePreset),
    [baselineScenePreset, scenePreset],
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

  const activeSelectedSurfaceGlowId =
    selectedSurfaceGlowId &&
    scenePreset.surfaceGlows.hotspots.some((hotspot) => hotspot.id === selectedSurfaceGlowId)
      ? selectedSurfaceGlowId
      : null;

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

  const resetAssetDiagnosticsForReload = () => {
    setLoadingState("loading");
    setDiagnostics((current) => ({
      ...current,
      assetDiagnostics: EMPTY_ASSET_DIAGNOSTICS,
    }));
  };

  const loadBehaviorPreset = (behaviorPresetId: string) => {
    const behaviorPreset = getBehaviorPresetById(behaviorPresetId);
    if (!behaviorPreset) {
      setFeedback(`Unknown behavior preset: ${behaviorPresetId}`, "error");
      return;
    }

    setScenePreset((current) => applyBehaviorPreset(current, behaviorPreset));
    setFeedback(`Applied behavior preset: ${behaviorPreset.name}`, "success");
  };

  const loadScenePreset = (scenePresetId: string) => {
    const preset = getScenePresetById(scenePresetId);
    if (!preset) {
      setFeedback(`Unknown full scene preset: ${scenePresetId}`, "error");
      return;
    }

    if (sceneModified) {
      const shouldReplace = window.confirm(
        `Load existing complete scene "${preset.name}"? This replaces current behavior and Surface Glow authoring changes.`,
      );

      if (!shouldReplace) {
        return;
      }
    }

    const nextScenePreset = cloneScenePreset(preset);
  resetAssetDiagnosticsForReload();
    setScenePreset(nextScenePreset);
    setBaselineScenePreset(cloneScenePreset(nextScenePreset));
    setSelectedScenePresetId(preset.id);
    setSelectedScenePresetImported(false);
    setSession((current) => ({
      ...current,
      surfaceGlowPlacementModeEnabled: false,
    }));
    setSelectedSurfaceGlowId(null);
    setFeedback(`Loaded full scene preset: ${preset.name}`, "success");
  };

  const handleAssetChange = (assetId: string) => {
    const selected = getImageEnvironmentAssetById(assetId);
    if (!selected) {
      setFeedback(`Unknown asset: ${assetId}`, "error");
      return;
    }

    const neutralScene = createNeutralScenePresetForAsset(selected.id);
  resetAssetDiagnosticsForReload();
    setScenePreset(neutralScene);
    setBaselineScenePreset(cloneScenePreset(neutralScene));
    setSelectedScenePresetId(neutralScene.id);
    setSelectedScenePresetImported(false);
    setSession((current) => ({
      ...current,
      surfaceGlowPlacementModeEnabled: false,
    }));
    setSelectedSurfaceGlowId(null);
    setFeedback(`Switched asset to ${selected.name} in neutral state.`, "success");
  };

  const handleCopySceneJson = async () => {
    const serialized = JSON.stringify(scenePreset, null, 2);

    try {
      await navigator.clipboard.writeText(serialized);
      setFeedback("Full scene JSON copied.", "success");
    } catch {
      setImportText(serialized);
      setFeedback(
        "Clipboard access failed. Full scene JSON was placed in the import textarea instead.",
        "error",
      );
    }
  };

  const handleCopyProductionSceneJson = async () => {
    const activeAsset = getImageEnvironmentAssetById(scenePreset.assetId);

    if (!activeAsset) {
      setFeedback(`Unknown asset: ${scenePreset.assetId}`, "error");
      return;
    }

    const sharedProductionBehavior =
      productionBehaviorByAssetId.get(activeAsset.id) ?? cloneBehaviorSettings(scenePreset.behavior);

    const productionScene: ImageEnvironmentScenePreset = {
      id: `${activeAsset.id}-default`,
      name: activeAsset.name,
      assetId: activeAsset.id,
      behavior: cloneBehaviorSettings(sharedProductionBehavior),
      surfaceGlows: {
        enabled: scenePreset.surfaceGlows.enabled,
        defaults: { ...scenePreset.surfaceGlows.defaults },
        hotspots: scenePreset.surfaceGlows.hotspots.map((hotspot) => ({ ...hotspot })),
      },
    };

    const serialized = JSON.stringify(productionScene, null, 2);

    try {
      await navigator.clipboard.writeText(serialized);
      setFeedback("Production scene JSON copied.", "success");
    } catch {
      setFeedback(
        "Clipboard access failed. Could not copy production scene JSON.",
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

    const importedScene = cloneScenePreset(parsed.preset);
  resetAssetDiagnosticsForReload();
    setScenePreset(importedScene);
    setBaselineScenePreset(cloneScenePreset(importedScene));
    setSelectedScenePresetId(importedScene.id);
    setSelectedScenePresetImported(true);
    setSession((current) => ({
      ...current,
      surfaceGlowPlacementModeEnabled: false,
    }));
    setSelectedSurfaceGlowId(null);

    if (parsed.warnings.length > 0) {
      setFeedback(`Imported full scene with warning: ${parsed.warnings.join(" ")}`, "success");
      return;
    }

    setFeedback(`Imported full scene: ${importedScene.name}`, "success");
  };

  const atSurfaceGlowCapacity =
    scenePreset.surfaceGlows.hotspots.length >= MAX_SURFACE_GLOW_HOTSPOTS;

  const mostRecentSurfaceGlow =
    scenePreset.surfaceGlows.hotspots[scenePreset.surfaceGlows.hotspots.length - 1] ?? null;

  return (
    <EnvironmentLabShell
      playbackState={session.playbackState}
      geometryMotionPreviewEnabled={session.geometryMotionPreviewEnabled}
      surfaceGlowPlacementModeEnabled={session.surfaceGlowPlacementModeEnabled}
      selectedSurfaceGlowId={activeSelectedSurfaceGlowId}
      framingMode={session.framingMode}
      surfaceGlowCapacityReached={atSurfaceGlowCapacity}
      scenePreset={scenePreset}
      activeBehaviorPresetId={activeBehaviorPresetId}
      activeBehaviorStatusLabel={activeBehaviorStatusLabel}
      selectedScenePresetId={selectedScenePresetId}
      selectedScenePresetImported={selectedScenePresetImported}
      baselineSceneName={baselineScenePreset.name}
      baselineSceneId={baselineScenePreset.id}
      sceneModified={sceneModified}
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
      loadingState={loadingState}
      onPlaybackStateChange={(value) =>
        setSession((current) => ({ ...current, playbackState: value }))
      }
      onGeometryMotionPreviewChange={(enabled) =>
        setSession((current) => ({ ...current, geometryMotionPreviewEnabled: enabled }))
      }
      onSurfaceGlowPlacementModeChange={(enabled) => {
        if (enabled && atSurfaceGlowCapacity) {
          setFeedback(
            `Maximum of ${MAX_SURFACE_GLOW_HOTSPOTS} Surface Glow Hotspots reached.`,
            "error",
          );
          return;
        }

        setSession((current) => ({
          ...current,
          surfaceGlowPlacementModeEnabled: enabled,
          framingMode: enabled ? "full-artwork" : current.framingMode,
        }));
      }}
      onFramingModeChange={(mode) =>
        setSession((current) => ({
          ...current,
          framingMode: mode,
        }))
      }
      onScenePresetChange={setScenePreset}
      onLoadBehaviorPreset={loadBehaviorPreset}
      onLoadScenePreset={loadScenePreset}
      onAssetChange={handleAssetChange}
      onCreateSurfaceGlowHotspot={(u, v, phase) => {
        let blocked = false;
        let createdHotspotId: string | null = null;

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
          createdHotspotId = nextHotspot.id;

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
          return;
        }

        setSelectedSurfaceGlowId(createdHotspotId);
      }}
      onSelectSurfaceGlowHotspot={setSelectedSurfaceGlowId}
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
        setSelectedSurfaceGlowId(null);
        setFeedback("Cleared all Surface Glow hotspots.", "success");
      }}
      onDeleteSelectedSurfaceGlowHotspot={() => {
        if (!activeSelectedSurfaceGlowId) {
          return;
        }

        setScenePreset((current) => ({
          ...current,
          surfaceGlows: {
            ...current.surfaceGlows,
            defaults: { ...current.surfaceGlows.defaults },
            hotspots: current.surfaceGlows.hotspots.filter(
              (hotspot) => hotspot.id !== activeSelectedSurfaceGlowId,
            ),
          },
        }));
        setSelectedSurfaceGlowId(null);
        setFeedback("Deleted selected Surface Glow hotspot.", "success");
      }}
      onUndoLastSurfaceGlowHotspot={() => {
        let removed = false;

        setScenePreset((current) => {
          if (current.surfaceGlows.hotspots.length === 0) {
            return current;
          }

          removed = true;
          return {
            ...current,
            surfaceGlows: {
              ...current.surfaceGlows,
              defaults: { ...current.surfaceGlows.defaults },
              hotspots: current.surfaceGlows.hotspots.slice(0, -1),
            },
          };
        });

        if (removed) {
          setFeedback("Removed most recent Surface Glow hotspot.", "success");
        }
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
        const activeAsset = getImageEnvironmentAssetById(scenePreset.assetId);
        if (!activeAsset) {
          setFeedback(`Unknown asset: ${scenePreset.assetId}`, "error");
          return;
        }

        const shouldReset = window.confirm(
          `Reset current scene for ${activeAsset.name}? This will restore neutral behavior and clear Surface Glow hotspots for this asset.`,
        );

        if (!shouldReset) {
          return;
        }

        const neutralScene = createNeutralScenePresetForAsset(scenePreset.assetId);
  resetAssetDiagnosticsForReload();
        setScenePreset(neutralScene);
        setBaselineScenePreset(cloneScenePreset(neutralScene));
        setSelectedScenePresetId(neutralScene.id);
        setSelectedScenePresetImported(false);
        setSession((current) => ({
          ...current,
          surfaceGlowPlacementModeEnabled: false,
        }));
        setSelectedSurfaceGlowId(null);
        setFeedback(`Reset current scene for ${activeAsset.name}.`, "success");
      }}
      onCopySceneJson={handleCopySceneJson}
      onCopyProductionSceneJson={handleCopyProductionSceneJson}
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
