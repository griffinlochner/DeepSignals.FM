import { useEffect, useState, type ChangeEvent } from "react";
import { MAX_SURFACE_GLOW_HOTSPOTS } from "../constants";
import { ENVIRONMENT_BEHAVIOR_PRESETS } from "../presets";
import type {
  EnvironmentBehaviorPreset,
  EnvironmentDiagnostics,
  EnvironmentFramingMode,
  EnvironmentLoadingState,
  EnvironmentPlaybackState,
  ImageEnvironmentAsset,
  ImageEnvironmentScenePreset,
  SurfaceGlowDefaultSettings,
  SurfaceGlowPulseMode,
} from "../types";

type EnvironmentLabControlsProps = {
  playbackState: EnvironmentPlaybackState;
  geometryMotionPreviewEnabled: boolean;
  scenePreset: ImageEnvironmentScenePreset;
  activeBehaviorPresetId: string | null;
  activeBehaviorStatusLabel: string;
  selectedScenePresetId: string;
  selectedScenePresetImported: boolean;
  selectedSurfaceGlowId: string | null;
  baselineSceneName: string;
  baselineSceneId: string;
  sceneModified: boolean;
  reducedMotionActive: boolean;
  diagnostics: EnvironmentDiagnostics;
  loadingState: EnvironmentLoadingState;
  surfaceGlowPlacementModeEnabled: boolean;
  surfaceGlowCapacityReached: boolean;
  framingMode: EnvironmentFramingMode;
  importText: string;
  feedbackMessage: string;
  feedbackTone: "idle" | "success" | "error";
  behaviorPresets: EnvironmentBehaviorPreset[];
  assets: ImageEnvironmentAsset[];
  scenePresets: ImageEnvironmentScenePreset[];
  onPlaybackStateChange: (value: EnvironmentPlaybackState) => void;
  onGeometryMotionPreviewChange: (enabled: boolean) => void;
  onScenePresetChange: (next: ImageEnvironmentScenePreset) => void;
  onLoadBehaviorPreset: (presetId: string) => void;
  onLoadScenePreset: (presetId: string) => void;
  onAssetChange: (assetId: string) => void;
  onSurfaceGlowPlacementModeChange: (enabled: boolean) => void;
  onFramingModeChange: (mode: EnvironmentFramingMode) => void;
  onSelectSurfaceGlowHotspot: (id: string | null) => void;
  onDeleteSelectedSurfaceGlowHotspot: () => void;
  onUndoLastSurfaceGlowHotspot: () => void;
  onClearSurfaceGlowHotspots: () => void;
  onRandomizeSurfaceGlowPhases: () => void;
  onApplySurfaceGlowDefaultsToAll: () => void;
  onResetScene: () => void;
  onCopySceneJson: () => void;
  onCopyProductionSceneJson: () => void;
  onImportTextChange: (value: string) => void;
  onApplyImportedScene: () => void;
};

type GlowDotPresetDefinition = {
  id: "soft-bloom" | "slow-pulse" | "twinkle" | "reactive-beacon";
  label: string;
  description: string;
  defaults: Partial<SurfaceGlowDefaultSettings>;
};

const GLOW_DOT_PRESETS: GlowDotPresetDefinition[] = [
  {
    id: "soft-bloom",
    label: "SOFT BLOOM",
    description: "Broad gentle halo with subtle breathing.",
    defaults: {
      radius: 0.02,
      softness: 0.82,
      intensity: 0.95,
      pulseEnabled: true,
      pulseMode: "brightness-bloom",
      pulseAmount: 0.2,
      minimumIntensityMultiplier: 0.85,
      maximumIntensityMultiplier: 1.1,
      radiusExpansionMultiplier: 1.08,
      pulseCycleSeconds: 8,
      hueDriftEnabled: false,
      hueDriftRangeDegrees: 0,
      hueDriftCycleSeconds: 20,
    },
  },
  {
    id: "slow-pulse",
    label: "SLOW PULSE",
    description: "Smooth expand and fade for emitters and medium glows.",
    defaults: {
      radius: 0.013,
      softness: 0.7,
      intensity: 1.2,
      pulseEnabled: true,
      pulseMode: "brightness-bloom",
      pulseAmount: 0.58,
      minimumIntensityMultiplier: 0.65,
      maximumIntensityMultiplier: 1.45,
      radiusExpansionMultiplier: 1.28,
      pulseCycleSeconds: 4.6,
      hueDriftEnabled: false,
      hueDriftRangeDegrees: 0,
      hueDriftCycleSeconds: 20,
    },
  },
  {
    id: "twinkle",
    label: "TWINKLE",
    description: "Small intermittent blink for tiny lights and spores.",
    defaults: {
      radius: 0.006,
      softness: 0.35,
      intensity: 1.8,
      pulseEnabled: true,
      pulseMode: "soft-blink",
      pulseAmount: 0.9,
      minimumIntensityMultiplier: 0.15,
      maximumIntensityMultiplier: 1.8,
      radiusExpansionMultiplier: 1.1,
      pulseCycleSeconds: 1.8,
      hueDriftEnabled: true,
      hueDriftRangeDegrees: 7,
      hueDriftCycleSeconds: 11,
    },
  },
  {
    id: "reactive-beacon",
    label: "REACTIVE BEACON",
    description: "Stronger bloom pulse for key focal lights.",
    defaults: {
      radius: 0.015,
      softness: 0.62,
      intensity: 2.2,
      pulseEnabled: true,
      pulseMode: "brightness-bloom",
      pulseAmount: 0.85,
      minimumIntensityMultiplier: 0.55,
      maximumIntensityMultiplier: 2.3,
      radiusExpansionMultiplier: 1.55,
      pulseCycleSeconds: 2.4,
      hueDriftEnabled: true,
      hueDriftRangeDegrees: 10,
      hueDriftCycleSeconds: 16,
    },
  },
];

function pulseModeLabel(mode: SurfaceGlowPulseMode): string {
  if (mode === "brightness") {
    return "Brightness";
  }

  if (mode === "bloom") {
    return "Bloom";
  }

  if (mode === "brightness-bloom") {
    return "Brightness + Bloom";
  }

  return "Soft Blink";
}

function getFilenameFromUrl(url: string) {
  const chunks = url.split("/");
  return chunks[chunks.length - 1] ?? url;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function pulseSpeedToCycleSeconds(speed: number) {
  const normalized = clamp01(speed);
  return 12 - normalized * (12 - 0.25);
}

function pulseCycleSecondsToSpeed(cycleSeconds: number) {
  return clamp01((12 - cycleSeconds) / (12 - 0.25));
}

function EnvironmentLabControls({
  playbackState,
  geometryMotionPreviewEnabled,
  scenePreset,
  activeBehaviorPresetId,
  activeBehaviorStatusLabel,
  selectedScenePresetId,
  selectedScenePresetImported,
  selectedSurfaceGlowId,
  baselineSceneName,
  baselineSceneId,
  sceneModified,
  reducedMotionActive,
  diagnostics,
  loadingState,
  surfaceGlowPlacementModeEnabled,
  surfaceGlowCapacityReached,
  framingMode,
  importText,
  feedbackMessage,
  feedbackTone,
  behaviorPresets,
  assets,
  scenePresets,
  onPlaybackStateChange,
  onGeometryMotionPreviewChange,
  onScenePresetChange,
  onLoadBehaviorPreset,
  onLoadScenePreset,
  onAssetChange,
  onSurfaceGlowPlacementModeChange,
  onFramingModeChange,
  onSelectSurfaceGlowHotspot,
  onDeleteSelectedSurfaceGlowHotspot,
  onUndoLastSurfaceGlowHotspot,
  onClearSurfaceGlowHotspots,
  onRandomizeSurfaceGlowPhases,
  onApplySurfaceGlowDefaultsToAll,
  onResetScene,
  onCopySceneJson,
  onCopyProductionSceneJson,
  onImportTextChange,
  onApplyImportedScene,
}: EnvironmentLabControlsProps) {
  const updateBehaviorDepth = <K extends keyof ImageEnvironmentScenePreset["behavior"]["depth"]>(
    key: K,
    value: ImageEnvironmentScenePreset["behavior"]["depth"][K],
  ) => {
    onScenePresetChange({
      ...scenePreset,
      behavior: {
        ...scenePreset.behavior,
        depth: {
          ...scenePreset.behavior.depth,
          [key]: value,
        },
        color: { ...scenePreset.behavior.color },
        saturationPulse: { ...scenePreset.behavior.saturationPulse },
      },
      surfaceGlows: {
        ...scenePreset.surfaceGlows,
        defaults: { ...scenePreset.surfaceGlows.defaults },
        hotspots: scenePreset.surfaceGlows.hotspots.map((hotspot) => ({ ...hotspot })),
      },
    });
  };

  const updateBehaviorColor = <K extends keyof ImageEnvironmentScenePreset["behavior"]["color"]>(
    key: K,
    value: ImageEnvironmentScenePreset["behavior"]["color"][K],
  ) => {
    onScenePresetChange({
      ...scenePreset,
      behavior: {
        ...scenePreset.behavior,
        depth: { ...scenePreset.behavior.depth },
        color: {
          ...scenePreset.behavior.color,
          [key]: value,
        },
        saturationPulse: { ...scenePreset.behavior.saturationPulse },
      },
      surfaceGlows: {
        ...scenePreset.surfaceGlows,
        defaults: { ...scenePreset.surfaceGlows.defaults },
        hotspots: scenePreset.surfaceGlows.hotspots.map((hotspot) => ({ ...hotspot })),
      },
    });
  };

  const updateSaturationPulse = <
    K extends keyof ImageEnvironmentScenePreset["behavior"]["saturationPulse"],
  >(
    key: K,
    value: ImageEnvironmentScenePreset["behavior"]["saturationPulse"][K],
  ) => {
    onScenePresetChange({
      ...scenePreset,
      behavior: {
        ...scenePreset.behavior,
        depth: { ...scenePreset.behavior.depth },
        color: { ...scenePreset.behavior.color },
        saturationPulse: {
          ...scenePreset.behavior.saturationPulse,
          [key]: value,
        },
      },
      surfaceGlows: {
        ...scenePreset.surfaceGlows,
        defaults: { ...scenePreset.surfaceGlows.defaults },
        hotspots: scenePreset.surfaceGlows.hotspots.map((hotspot) => ({ ...hotspot })),
      },
    });
  };

  const updateSurfaceGlowDefaults = <
    K extends keyof ImageEnvironmentScenePreset["surfaceGlows"]["defaults"],
  >(
    key: K,
    value: ImageEnvironmentScenePreset["surfaceGlows"]["defaults"][K],
  ) => {
    onScenePresetChange({
      ...scenePreset,
      behavior: {
        depth: { ...scenePreset.behavior.depth },
        color: { ...scenePreset.behavior.color },
        saturationPulse: { ...scenePreset.behavior.saturationPulse },
      },
      surfaceGlows: {
        ...scenePreset.surfaceGlows,
        defaults: {
          ...scenePreset.surfaceGlows.defaults,
          [key]: value,
        },
        hotspots: scenePreset.surfaceGlows.hotspots.map((hotspot) => ({ ...hotspot })),
      },
    });
  };

  const updateSelectedHotspot = (
    updates: Partial<ImageEnvironmentScenePreset["surfaceGlows"]["hotspots"][number]>,
  ) => {
    if (!selectedSurfaceGlowId) {
      return;
    }

    onScenePresetChange({
      ...scenePreset,
      behavior: {
        depth: { ...scenePreset.behavior.depth },
        color: { ...scenePreset.behavior.color },
        saturationPulse: { ...scenePreset.behavior.saturationPulse },
      },
      surfaceGlows: {
        ...scenePreset.surfaceGlows,
        defaults: { ...scenePreset.surfaceGlows.defaults },
        hotspots: scenePreset.surfaceGlows.hotspots.map((hotspot) =>
          hotspot.id === selectedSurfaceGlowId ? { ...hotspot, ...updates } : { ...hotspot },
        ),
      },
    });
  };

  const handleRangeChange = (
    event: ChangeEvent<HTMLInputElement>,
    onChange: (value: number) => void,
  ) => {
    onChange(Number(event.target.value));
  };

  const activeBehaviorPreset =
    (activeBehaviorPresetId
      ? behaviorPresets.find((preset) => preset.id === activeBehaviorPresetId)
      : null) ?? ENVIRONMENT_BEHAVIOR_PRESETS[0];
  const activeAsset = assets.find((asset) => asset.id === scenePreset.assetId) ?? assets[0];
  const selectedHotspot =
    scenePreset.surfaceGlows.hotspots.find((hotspot) => hotspot.id === selectedSurfaceGlowId) ?? null;
  const existingSceneOptions =
    !selectedScenePresetImported || scenePresets.some((preset) => preset.id === selectedScenePresetId)
      ? scenePresets
      : [
          ...scenePresets,
          {
            ...scenePreset,
            id: selectedScenePresetId,
            name: `${scenePreset.name} (Imported)`,
          },
        ];

  const [existingSceneSelectionOverride, setExistingSceneSelectionOverride] = useState<
    string | null
  >(null);
  const [importToolsOpen, setImportToolsOpen] = useState(false);
  const [selectedGlowDotPresetId, setSelectedGlowDotPresetId] =
    useState<GlowDotPresetDefinition["id"]>("soft-bloom");

  const existingSceneSelection = existingSceneSelectionOverride ?? selectedScenePresetId;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (event.key === "Escape" && surfaceGlowPlacementModeEnabled) {
        event.preventDefault();
        onSurfaceGlowPlacementModeChange(false);
        return;
      }

      if (!selectedSurfaceGlowId || typingTarget) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onDeleteSelectedSurfaceGlowHotspot();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    onDeleteSelectedSurfaceGlowHotspot,
    onSurfaceGlowPlacementModeChange,
    selectedSurfaceGlowId,
    surfaceGlowPlacementModeEnabled,
  ]);

  const applyGlowDotPreset = (presetId: GlowDotPresetDefinition["id"]) => {
    const preset = GLOW_DOT_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    const nextDefaults = {
      ...scenePreset.surfaceGlows.defaults,
      ...preset.defaults,
    };

    onScenePresetChange({
      ...scenePreset,
      behavior: {
        depth: { ...scenePreset.behavior.depth },
        color: { ...scenePreset.behavior.color },
        saturationPulse: { ...scenePreset.behavior.saturationPulse },
      },
      surfaceGlows: {
        ...scenePreset.surfaceGlows,
        enabled: true,
        defaults: nextDefaults,
        hotspots: scenePreset.surfaceGlows.hotspots.map((hotspot) => ({ ...hotspot })),
      },
    });
  };

  const hasKnownDimensions =
    diagnostics.assetDiagnostics.colorWidth > 0 &&
    diagnostics.assetDiagnostics.colorHeight > 0 &&
    diagnostics.assetDiagnostics.depthWidth > 0 &&
    diagnostics.assetDiagnostics.depthHeight > 0;

  const dimensionsSummary =
    loadingState === "loading"
      ? "Loading dimensions..."
      : loadingState === "error"
        ? "Dimension load failed"
        : hasKnownDimensions
          ? `${diagnostics.assetDiagnostics.colorWidth} x ${diagnostics.assetDiagnostics.colorHeight}`
          : "Waiting for decoded dimensions";

  const dimensionsMatchLabel =
    loadingState === "loading"
      ? "Pending"
      : loadingState === "error"
        ? "Error"
        : hasKnownDimensions
          ? diagnostics.assetDiagnostics.dimensionsMatch
            ? "Match"
            : "Mismatch"
          : "Unknown";

  const productionSceneIdentity = `${activeAsset.id}-default`;

  return (
    <div className="environment-lab__controls">
      <section className="environment-lab__workflow-summary" aria-label="Current scene summary">
        <h2 className="environment-lab__workflow-summary-title">Current Scene</h2>
        <ul className="environment-lab__stats">
          <li>Environment: {activeAsset.name}</li>
          <li>Behavior: {activeBehaviorStatusLabel}</li>
          <li>
            Glow Dots: {scenePreset.surfaceGlows.hotspots.length} / {MAX_SURFACE_GLOW_HOTSPOTS}
          </li>
          <li>Status: {sceneModified ? "Modified" : "Saved baseline"}</li>
          <li>
            Preview: {playbackState === "playing" ? "Playing" : "Stopped"} · Motion{" "}
            {geometryMotionPreviewEnabled ? "On" : "Off"}
          </li>
        </ul>
      </section>

      <details className="environment-lab__group" open>
        <summary>1. Artwork</summary>

        <p className="environment-lab__hint">
          Choose a matched color and depth image pair for this environment.
        </p>

        <label className="environment-lab__field">
          <span>Artwork</span>
          <select value={scenePreset.assetId} onChange={(event) => onAssetChange(event.target.value)}>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>

        <ul className="environment-lab__stats" aria-label="Active asset summary">
          <li>Active artwork: {activeAsset.name}</li>
          <li>Color file: {getFilenameFromUrl(activeAsset.colorImageUrl)}</li>
          <li>Depth file: {getFilenameFromUrl(activeAsset.depthMapUrl)}</li>
          <li>Dimensions: {dimensionsSummary}</li>
          <li>Dimension match: {dimensionsMatchLabel}</li>
        </ul>

        {hasKnownDimensions && !diagnostics.assetDiagnostics.dimensionsMatch && (
          <p className="environment-lab__motion-note">
            Warning: color and depth dimensions do not match. Glow Dot placement may misalign.
          </p>
        )}
      </details>

      <details className="environment-lab__group" open>
        <summary>2. Preview</summary>

        <p className="environment-lab__hint">
          Use compact preview controls without changing shared production profile constants.
        </p>

        <div className="environment-lab__segmented">
          <p className="environment-lab__segment-label">Framing</p>
          <div className="environment-lab__button-row environment-lab__button-row--segmented" role="group" aria-label="Framing">
            <button
              type="button"
              aria-pressed={framingMode === "full-artwork"}
              onClick={() => onFramingModeChange("full-artwork")}
            >
              Full Artwork
            </button>
            <button
              type="button"
              aria-pressed={framingMode === "player-preview"}
              onClick={() => onFramingModeChange("player-preview")}
            >
              Player Preview
            </button>
          </div>
        </div>

        <div className="environment-lab__segmented">
          <p className="environment-lab__segment-label">Behavior</p>
          <div className="environment-lab__button-row environment-lab__button-row--segmented" role="group" aria-label="Behavior">
            <button
              type="button"
              aria-pressed={activeBehaviorPresetId === "chill"}
              onClick={() => onLoadBehaviorPreset("chill")}
            >
              Chill
            </button>
            <button
              type="button"
              aria-pressed={activeBehaviorPresetId === "full-on"}
              onClick={() => onLoadBehaviorPreset("full-on")}
            >
              Full On
            </button>
          </div>
        </div>

        <div className="environment-lab__segmented">
          <p className="environment-lab__segment-label">State</p>
          <div className="environment-lab__button-row environment-lab__button-row--segmented" role="group" aria-label="State">
            <button
              type="button"
              aria-pressed={playbackState === "stopped"}
              onClick={() => onPlaybackStateChange("stopped")}
            >
              Stopped
            </button>
            <button
              type="button"
              aria-pressed={playbackState === "playing"}
              onClick={() => onPlaybackStateChange("playing")}
            >
              Playing
            </button>
          </div>
        </div>

        <div className="environment-lab__segmented">
          <p className="environment-lab__segment-label">Motion</p>
          <div className="environment-lab__button-row environment-lab__button-row--segmented" role="group" aria-label="Motion">
            <button
              type="button"
              aria-pressed={!geometryMotionPreviewEnabled}
              onClick={() => onGeometryMotionPreviewChange(false)}
            >
              Off
            </button>
            <button
              type="button"
              aria-pressed={geometryMotionPreviewEnabled}
              onClick={() => onGeometryMotionPreviewChange(true)}
            >
              On
            </button>
          </div>
        </div>

        <p className="environment-lab__hint">
          Player Preview uses the production framing path. Full Artwork is recommended while placing Glow Dots.
        </p>
      </details>

      <details className="environment-lab__group" open>
        <summary>3. Glow Dots</summary>

        <p className="environment-lab__hint">
          Place optional Glow Dots with friendly presets, then refine selected dots with basic controls.
        </p>

        <ul className="environment-lab__stats">
          <li>
            Glow Dot count: {scenePreset.surfaceGlows.hotspots.length} / {MAX_SURFACE_GLOW_HOTSPOTS}
          </li>
          <li>Placement: {surfaceGlowPlacementModeEnabled ? "On" : "Off"}</li>
          <li>Selected Glow Dot: {selectedHotspot?.id ?? "None"}</li>
        </ul>

        {surfaceGlowCapacityReached && (
          <p className="environment-lab__motion-note">
            Maximum of {MAX_SURFACE_GLOW_HOTSPOTS} Glow Dots reached.
          </p>
        )}

        <label className="environment-lab__toggle">
          <span>Glow Dots enabled</span>
          <input
            type="checkbox"
            checked={scenePreset.surfaceGlows.enabled}
            onChange={(event) => {
              onScenePresetChange({
                ...scenePreset,
                behavior: {
                  depth: { ...scenePreset.behavior.depth },
                  color: { ...scenePreset.behavior.color },
                  saturationPulse: { ...scenePreset.behavior.saturationPulse },
                },
                surfaceGlows: {
                  ...scenePreset.surfaceGlows,
                  enabled: event.target.checked,
                  defaults: { ...scenePreset.surfaceGlows.defaults },
                  hotspots: scenePreset.surfaceGlows.hotspots.map((hotspot) => ({ ...hotspot })),
                },
              });
            }}
          />
        </label>

        <label className="environment-lab__field">
          <span>Glow Dot Preset</span>
          <select
            value={selectedGlowDotPresetId}
            onChange={(event) => {
              const nextPresetId = event.target.value as GlowDotPresetDefinition["id"];
              setSelectedGlowDotPresetId(nextPresetId);
              applyGlowDotPreset(nextPresetId);
            }}
          >
            {GLOW_DOT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <p className="environment-lab__hint">
          {GLOW_DOT_PRESETS.find((preset) => preset.id === selectedGlowDotPresetId)?.description}
        </p>

        <details className="environment-lab__subgroup" open>
          <summary>New Dot Settings</summary>

          <label className="environment-lab__field">
            <span>Color</span>
            <input
              type="color"
              value={scenePreset.surfaceGlows.defaults.color}
              onChange={(event) => updateSurfaceGlowDefaults("color", event.target.value)}
            />
          </label>

          <label className="environment-lab__field">
            <span>Size</span>
            <input
              type="range"
              min="0.002"
              max="0.09"
              step="0.001"
              value={scenePreset.surfaceGlows.defaults.radius}
              onChange={(event) =>
                handleRangeChange(event, (value) => updateSurfaceGlowDefaults("radius", value))
              }
            />
            <strong>{scenePreset.surfaceGlows.defaults.radius.toFixed(3)}</strong>
          </label>

          <label className="environment-lab__field">
            <span>Strength</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.01"
              value={scenePreset.surfaceGlows.defaults.intensity}
              onChange={(event) =>
                handleRangeChange(event, (value) => updateSurfaceGlowDefaults("intensity", value))
              }
            />
            <strong>{scenePreset.surfaceGlows.defaults.intensity.toFixed(2)}</strong>
          </label>

          <label className="environment-lab__field">
            <span>Pulse Speed</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={pulseCycleSecondsToSpeed(scenePreset.surfaceGlows.defaults.pulseCycleSeconds)}
              onChange={(event) =>
                handleRangeChange(event, (value) =>
                  updateSurfaceGlowDefaults("pulseCycleSeconds", pulseSpeedToCycleSeconds(value)),
                )
              }
            />
            <strong>{scenePreset.surfaceGlows.defaults.pulseCycleSeconds.toFixed(1)}s cycle</strong>
          </label>
        </details>

        <details className="environment-lab__subgroup" open>
          <summary>Selected Glow Dot</summary>

          {!selectedHotspot && <p className="environment-lab__hint">Click a Glow Dot to edit it.</p>}

          {selectedHotspot && (
            <>
              <label className="environment-lab__field">
                <span>Color</span>
                <input
                  type="color"
                  value={selectedHotspot.color}
                  onChange={(event) => updateSelectedHotspot({ color: event.target.value })}
                />
              </label>

              <label className="environment-lab__field">
                <span>Size</span>
                <input
                  type="range"
                  min="0.002"
                  max="0.09"
                  step="0.001"
                  value={selectedHotspot.radius}
                  onChange={(event) =>
                    handleRangeChange(event, (value) => updateSelectedHotspot({ radius: value }))
                  }
                />
                <strong>{selectedHotspot.radius.toFixed(3)}</strong>
              </label>

              <label className="environment-lab__field">
                <span>Strength</span>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.01"
                  value={selectedHotspot.intensity}
                  onChange={(event) =>
                    handleRangeChange(event, (value) => updateSelectedHotspot({ intensity: value }))
                  }
                />
                <strong>{selectedHotspot.intensity.toFixed(2)}</strong>
              </label>

              <label className="environment-lab__field">
                <span>Pulse Speed</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={pulseCycleSecondsToSpeed(selectedHotspot.pulseCycleSeconds)}
                  onChange={(event) =>
                    handleRangeChange(event, (value) =>
                      updateSelectedHotspot({ pulseCycleSeconds: pulseSpeedToCycleSeconds(value) }),
                    )
                  }
                />
                <strong>{selectedHotspot.pulseCycleSeconds.toFixed(1)}s cycle</strong>
              </label>

              <details className="environment-lab__subgroup">
                <summary>Per-dot Advanced</summary>

                <label className="environment-lab__toggle">
                  <span>Pulse enabled</span>
                  <input
                    type="checkbox"
                    checked={selectedHotspot.pulseEnabled}
                    onChange={(event) => updateSelectedHotspot({ pulseEnabled: event.target.checked })}
                  />
                </label>

                <label className="environment-lab__field">
                  <span>Pulse mode</span>
                  <select
                    value={selectedHotspot.pulseMode}
                    onChange={(event) =>
                      updateSelectedHotspot({ pulseMode: event.target.value as SurfaceGlowPulseMode })
                    }
                  >
                    <option value="brightness">Brightness</option>
                    <option value="bloom">Bloom</option>
                    <option value="brightness-bloom">Brightness + Bloom</option>
                    <option value="soft-blink">Soft Blink</option>
                  </select>
                  <strong>{pulseModeLabel(selectedHotspot.pulseMode)}</strong>
                </label>

                <label className="environment-lab__field">
                  <span>Softness</span>
                  <input
                    type="range"
                    min="0.05"
                    max="0.98"
                    step="0.01"
                    value={selectedHotspot.softness}
                    onChange={(event) =>
                      handleRangeChange(event, (value) => updateSelectedHotspot({ softness: value }))
                    }
                  />
                  <strong>{selectedHotspot.softness.toFixed(2)}</strong>
                </label>

                <label className="environment-lab__field">
                  <span>Pulse amount</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedHotspot.pulseAmount}
                    onChange={(event) =>
                      handleRangeChange(event, (value) => updateSelectedHotspot({ pulseAmount: value }))
                    }
                  />
                  <strong>{selectedHotspot.pulseAmount.toFixed(2)}</strong>
                </label>
              </details>
            </>
          )}
        </details>

        <div className="environment-lab__button-row">
          <button
            type="button"
            aria-pressed={surfaceGlowPlacementModeEnabled}
            onClick={() => onSurfaceGlowPlacementModeChange(!surfaceGlowPlacementModeEnabled)}
            disabled={surfaceGlowCapacityReached && !surfaceGlowPlacementModeEnabled}
          >
            {surfaceGlowPlacementModeEnabled ? "Stop Placing Glow Dots" : "Place Glow Dots"}
          </button>
          <button
            type="button"
            onClick={onDeleteSelectedSurfaceGlowHotspot}
            disabled={!selectedSurfaceGlowId}
          >
            Delete Selected
          </button>
          <button
            type="button"
            onClick={onUndoLastSurfaceGlowHotspot}
            disabled={scenePreset.surfaceGlows.hotspots.length === 0}
          >
            Undo Last Dot
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectSurfaceGlowHotspot(null);
              onClearSurfaceGlowHotspots();
            }}
            disabled={scenePreset.surfaceGlows.hotspots.length === 0}
          >
            Clear All Glow Dots
          </button>
        </div>

        <p className="environment-lab__hint">
          Escape exits placement mode. Delete or Backspace removes selected Glow Dot while focus is outside form fields.
        </p>

        <details className="environment-lab__subgroup">
          <summary>Glow Dot List</summary>
          <ul className="environment-lab__stats">
            {scenePreset.surfaceGlows.hotspots.length === 0 ? (
              <li>No Glow Dots placed yet.</li>
            ) : (
              scenePreset.surfaceGlows.hotspots.map((hotspot, index) => (
                <li key={hotspot.id}>
                  <button
                    type="button"
                    aria-pressed={hotspot.id === selectedSurfaceGlowId}
                    onClick={() => onSelectSurfaceGlowHotspot(hotspot.id)}
                  >
                    Dot {index + 1}: ({hotspot.u.toFixed(4)}, {hotspot.v.toFixed(4)})
                  </button>
                </li>
              ))
            )}
          </ul>
        </details>
      </details>

      <details className="environment-lab__group" open>
        <summary>4. Review &amp; Export</summary>

        <p className="environment-lab__hint">
          Export static environment content and Glow Dots for production scene registration.
        </p>

        <ul className="environment-lab__stats">
          <li>Environment: {activeAsset.name}</li>
          <li>Glow Dots: {scenePreset.surfaceGlows.hotspots.length}</li>
          <li>Status: {sceneModified ? "Modified" : "Saved baseline"}</li>
          <li>Production identity: {productionSceneIdentity}</li>
        </ul>

        <div className="environment-lab__button-row">
          <button
            type="button"
            className="environment-lab__button--primary"
            onClick={onCopyProductionSceneJson}
          >
            Copy Production Scene JSON
          </button>
        </div>

        <p className="environment-lab__hint">
          This export keeps static scene content and Glow Dot definitions, while inheriting centralized shared Behavior profiles.
        </p>

        <p
          className={`environment-lab__feedback environment-lab__feedback--${feedbackTone}`}
          aria-live="polite"
        >
          {feedbackMessage}
        </p>
      </details>

      <details className="environment-lab__group">
        <summary>Advanced Tools</summary>

        <details className="environment-lab__subgroup">
          <summary>Advanced Behavior Tuning</summary>

          <p className="environment-lab__hint">
            Shared-engine development area. These controls are optional and are not required for normal environment authoring.
          </p>

          <div className="environment-lab__button-row">
            <button type="button" onClick={() => onLoadBehaviorPreset("neutral")}>Neutral</button>
            <button type="button" onClick={() => onLoadBehaviorPreset("chill")}>Chill</button>
            <button type="button" onClick={() => onLoadBehaviorPreset("full-on")}>Full On</button>
          </div>

          <p className="environment-lab__diagnostic">Behavior status: {activeBehaviorStatusLabel}</p>
          {activeBehaviorStatusLabel === "Custom" ? (
            <p className="environment-lab__hint">
              Current values differ from Neutral, Chill, and Full On.
            </p>
          ) : (
            <p className="environment-lab__hint">{activeBehaviorPreset.description}</p>
          )}

          <details className="environment-lab__subgroup">
            <summary>Depth and Geometry</summary>

            <label className="environment-lab__field">
              <span>Motion intensity</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={scenePreset.behavior.depth.motionIntensity}
                onChange={(event) =>
                  handleRangeChange(event, (value) => updateBehaviorDepth("motionIntensity", value))
                }
              />
              <strong>{scenePreset.behavior.depth.motionIntensity.toFixed(2)}</strong>
            </label>

            <label className="environment-lab__field">
              <span>Depth strength</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={scenePreset.behavior.depth.depthStrength}
                onChange={(event) =>
                  handleRangeChange(event, (value) => updateBehaviorDepth("depthStrength", value))
                }
              />
              <strong>{scenePreset.behavior.depth.depthStrength.toFixed(2)}</strong>
            </label>

            <label className="environment-lab__field">
              <span>Static depth</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={scenePreset.behavior.depth.staticDepth}
                onChange={(event) =>
                  handleRangeChange(event, (value) => updateBehaviorDepth("staticDepth", value))
                }
              />
              <strong>{scenePreset.behavior.depth.staticDepth.toFixed(2)}</strong>
            </label>

            <label className="environment-lab__toggle">
              <span>Ambient Motion</span>
              <input
                type="checkbox"
                checked={scenePreset.behavior.depth.ambientMotionEnabled}
                onChange={(event) => updateBehaviorDepth("ambientMotionEnabled", event.target.checked)}
              />
            </label>

            <label className="environment-lab__toggle">
              <span>Pointer Parallax enabled</span>
              <input
                type="checkbox"
                checked={scenePreset.behavior.depth.pointerParallaxEnabled}
                onChange={(event) =>
                  updateBehaviorDepth("pointerParallaxEnabled", event.target.checked)
                }
              />
            </label>

            <label className="environment-lab__field">
              <span>Pointer strength</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={scenePreset.behavior.depth.pointerParallaxStrength}
                onChange={(event) =>
                  handleRangeChange(event, (value) =>
                    updateBehaviorDepth("pointerParallaxStrength", value),
                  )
                }
              />
              <strong>{scenePreset.behavior.depth.pointerParallaxStrength.toFixed(2)}</strong>
            </label>

            <p className="environment-lab__diagnostic">
              Effective depth: {diagnostics.effectiveDepth.toFixed(3)}
            </p>
          </details>

          <details className="environment-lab__subgroup">
            <summary>Timing</summary>

            <label className="environment-lab__field">
              <span>Minimum breathing depth</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={scenePreset.behavior.depth.breathingMin}
                onChange={(event) =>
                  handleRangeChange(event, (value) => updateBehaviorDepth("breathingMin", value))
                }
              />
              <strong>{scenePreset.behavior.depth.breathingMin.toFixed(2)}</strong>
            </label>

            <label className="environment-lab__field">
              <span>Maximum breathing depth</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={scenePreset.behavior.depth.breathingMax}
                onChange={(event) =>
                  handleRangeChange(event, (value) => updateBehaviorDepth("breathingMax", value))
                }
              />
              <strong>{scenePreset.behavior.depth.breathingMax.toFixed(2)}</strong>
            </label>

            <label className="environment-lab__field">
              <span>Breathing cycle (seconds)</span>
              <input
                type="range"
                min="1"
                max="20"
                step="0.1"
                value={scenePreset.behavior.depth.breathingCycleSeconds}
                onChange={(event) =>
                  handleRangeChange(event, (value) =>
                    updateBehaviorDepth("breathingCycleSeconds", value),
                  )
                }
              />
              <strong>{scenePreset.behavior.depth.breathingCycleSeconds.toFixed(1)}s</strong>
            </label>

            <label className="environment-lab__field">
              <span>Saturation pulse cycle (seconds)</span>
              <input
                type="range"
                min="0.2"
                max="60"
                step="0.1"
                value={scenePreset.behavior.saturationPulse.cycleSeconds}
                onChange={(event) =>
                  handleRangeChange(event, (value) => updateSaturationPulse("cycleSeconds", value))
                }
              />
              <strong>{scenePreset.behavior.saturationPulse.cycleSeconds.toFixed(1)}s</strong>
            </label>
          </details>

          <details className="environment-lab__subgroup">
            <summary>Color and Hue</summary>

            <label className="environment-lab__toggle">
              <span>Color Drift enabled</span>
              <input
                type="checkbox"
                checked={scenePreset.behavior.color.driftEnabled}
                onChange={(event) => updateBehaviorColor("driftEnabled", event.target.checked)}
              />
            </label>

            <label className="environment-lab__field">
              <span>Hue range (degrees)</span>
              <input
                type="range"
                min="0"
                max="60"
                step="0.1"
                value={scenePreset.behavior.color.hueRangeDegrees}
                onChange={(event) =>
                  handleRangeChange(event, (value) => updateBehaviorColor("hueRangeDegrees", value))
                }
              />
              <strong>{scenePreset.behavior.color.hueRangeDegrees.toFixed(1)}deg</strong>
            </label>

            <label className="environment-lab__field">
              <span>Hue cycle duration (seconds)</span>
              <input
                type="range"
                min="10"
                max="240"
                step="0.5"
                value={scenePreset.behavior.color.cycleSeconds}
                onChange={(event) =>
                  handleRangeChange(event, (value) => updateBehaviorColor("cycleSeconds", value))
                }
              />
              <strong>{scenePreset.behavior.color.cycleSeconds.toFixed(1)}s</strong>
            </label>
          </details>

          <details className="environment-lab__subgroup">
            <summary>Saturation and Lighting</summary>

            <label className="environment-lab__field">
              <span>Base saturation</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={scenePreset.behavior.color.saturation}
                onChange={(event) =>
                  handleRangeChange(event, (value) => updateBehaviorColor("saturation", value))
                }
              />
              <strong>{scenePreset.behavior.color.saturation.toFixed(2)}</strong>
            </label>

            <label className="environment-lab__toggle">
              <span>Saturation Pulse enabled</span>
              <input
                type="checkbox"
                checked={scenePreset.behavior.saturationPulse.enabled}
                onChange={(event) => updateSaturationPulse("enabled", event.target.checked)}
              />
            </label>

            <label className="environment-lab__field">
              <span>Minimum saturation</span>
              <input
                type="range"
                min="0"
                max="2.4"
                step="0.01"
                value={scenePreset.behavior.saturationPulse.minimumSaturation}
                onChange={(event) =>
                  handleRangeChange(event, (value) =>
                    updateSaturationPulse("minimumSaturation", value),
                  )
                }
              />
              <strong>{scenePreset.behavior.saturationPulse.minimumSaturation.toFixed(2)}</strong>
            </label>

            <label className="environment-lab__field">
              <span>Maximum saturation</span>
              <input
                type="range"
                min="0"
                max="2.8"
                step="0.01"
                value={scenePreset.behavior.saturationPulse.maximumSaturation}
                onChange={(event) =>
                  handleRangeChange(event, (value) =>
                    updateSaturationPulse("maximumSaturation", value),
                  )
                }
              />
              <strong>{scenePreset.behavior.saturationPulse.maximumSaturation.toFixed(2)}</strong>
            </label>

            <label className="environment-lab__field">
              <span>Phase offset</span>
              <input
                type="range"
                min={(-Math.PI * 2).toFixed(2)}
                max={(Math.PI * 2).toFixed(2)}
                step="0.01"
                value={scenePreset.behavior.saturationPulse.phaseOffset}
                onChange={(event) =>
                  handleRangeChange(event, (value) => updateSaturationPulse("phaseOffset", value))
                }
              />
              <strong>{scenePreset.behavior.saturationPulse.phaseOffset.toFixed(2)} rad</strong>
            </label>

            <label className="environment-lab__toggle">
              <span>Sync to Depth Breathing</span>
              <input
                type="checkbox"
                checked={scenePreset.behavior.saturationPulse.syncToDepthBreathing}
                onChange={(event) =>
                  updateSaturationPulse("syncToDepthBreathing", event.target.checked)
                }
              />
            </label>
          </details>

          <details className="environment-lab__subgroup">
            <summary>Glow Response</summary>

            <label className="environment-lab__toggle">
              <span>Global Glow Pulse enabled</span>
              <input
                type="checkbox"
                checked={scenePreset.behavior.color.glowPulseEnabled}
                onChange={(event) => updateBehaviorColor("glowPulseEnabled", event.target.checked)}
              />
            </label>

            <label className="environment-lab__field">
              <span>Glow pulse amount</span>
              <input
                type="range"
                min="0"
                max="0.4"
                step="0.005"
                value={scenePreset.behavior.color.glowPulseAmount}
                onChange={(event) =>
                  handleRangeChange(event, (value) => updateBehaviorColor("glowPulseAmount", value))
                }
              />
              <strong>{scenePreset.behavior.color.glowPulseAmount.toFixed(3)}</strong>
            </label>

            <label className="environment-lab__field">
              <span>Glow pulse cycle (seconds)</span>
              <input
                type="range"
                min="2"
                max="60"
                step="0.2"
                value={scenePreset.behavior.color.glowPulseCycleSeconds}
                onChange={(event) =>
                  handleRangeChange(event, (value) =>
                    updateBehaviorColor("glowPulseCycleSeconds", value),
                  )
                }
              />
              <strong>{scenePreset.behavior.color.glowPulseCycleSeconds.toFixed(1)}s</strong>
            </label>

            <div className="environment-lab__button-row">
              <button type="button" onClick={onRandomizeSurfaceGlowPhases}>
                Randomize Dot Phases
              </button>
              <button type="button" onClick={onApplySurfaceGlowDefaultsToAll}>
                Apply New Dot Settings to All Dots
              </button>
            </div>
          </details>

          <details className="environment-lab__subgroup">
            <summary>Diagnostics</summary>

            <ul className="environment-lab__stats" aria-label="Laboratory diagnostics">
              <li>Approx FPS: {diagnostics.fps.toFixed(1)}</li>
              <li>Surface hotspot count: {diagnostics.surfaceGlowCount}</li>
              <li>Current hue offset: {diagnostics.hueOffsetDegrees.toFixed(2)}deg</li>
              <li>Current saturation: {diagnostics.currentSaturation.toFixed(2)}</li>
              <li>Default glow intensity: {diagnostics.surfaceGlowDefaultIntensity.toFixed(2)}</li>
              <li>Shader hotspot capacity: {diagnostics.shaderSurfaceGlowCapacity}</li>
              <li>Automatic motion active: {diagnostics.automaticMotionActive ? "yes" : "no"}</li>
              <li>
                Most recent hotspot UV: {diagnostics.mostRecentSurfaceGlowU?.toFixed(4) ?? "-"},{" "}
                {diagnostics.mostRecentSurfaceGlowV?.toFixed(4) ?? "-"}
              </li>
              <li>
                Color asset: {diagnostics.assetDiagnostics.colorWidth}x{diagnostics.assetDiagnostics.colorHeight}
              </li>
              <li>
                Depth asset: {diagnostics.assetDiagnostics.depthWidth}x{diagnostics.assetDiagnostics.depthHeight}
              </li>
              <li>Color aspect: {diagnostics.assetDiagnostics.colorAspectRatio.toFixed(4)}</li>
              <li>Depth aspect: {diagnostics.assetDiagnostics.depthAspectRatio.toFixed(4)}</li>
              <li>Dimension match: {diagnostics.assetDiagnostics.dimensionsMatch ? "yes" : "no"}</li>
              <li>Aspect match: {diagnostics.assetDiagnostics.aspectMatch ? "yes" : "no"}</li>
              {import.meta.env.DEV && (
                <>
                  <li>
                    Pick canvas XY: {diagnostics.surfaceGlowPickCanvasX?.toFixed(3) ?? "-"},{" "}
                    {diagnostics.surfaceGlowPickCanvasY?.toFixed(3) ?? "-"}
                  </li>
                  <li>
                    Pick decoded UV: {diagnostics.surfaceGlowPickU?.toFixed(3) ?? "-"},{" "}
                    {diagnostics.surfaceGlowPickV?.toFixed(3) ?? "-"}
                  </li>
                  <li>Pick found plane: {diagnostics.surfaceGlowPickFoundPlane ? "yes" : "no"}</li>
                  <li>
                    Pick effective depth: {diagnostics.surfaceGlowPickEffectiveDepth?.toFixed(3) ?? "-"}
                  </li>
                </>
              )}
            </ul>

            {reducedMotionActive && (
              <p className="environment-lab__motion-note">
                Reduced motion preference detected: automatic ambient motion is frozen.
              </p>
            )}
          </details>
        </details>

        <details className="environment-lab__subgroup">
          <summary>Editable Scene Import / Export</summary>

          <p className="environment-lab__hint">
            Use editable lab scenes for round-trip import and continued authoring.
          </p>

          <div className="environment-lab__button-row">
            <button type="button" onClick={onCopySceneJson}>
              Copy Editable Lab Scene JSON
            </button>
            <button
              type="button"
              onClick={() => setImportToolsOpen((current) => !current)}
              aria-expanded={importToolsOpen}
            >
              {importToolsOpen ? "Hide Import Editable Lab Scene" : "Import Editable Lab Scene"}
            </button>
          </div>

          {importToolsOpen && (
            <>
              <label className="environment-lab__field">
                <span>Import Editable Lab Scene JSON</span>
                <textarea
                  rows={7}
                  value={importText}
                  onChange={(event) => onImportTextChange(event.target.value)}
                />
              </label>

              <div className="environment-lab__button-row">
                <button type="button" onClick={onApplyImportedScene}>
                  Import Scene
                </button>
                <button type="button" onClick={() => setImportToolsOpen(false)}>
                  Close Import
                </button>
              </div>
            </>
          )}
        </details>

        <details className="environment-lab__subgroup">
          <summary>Existing Complete Scenes</summary>

          <label className="environment-lab__field">
            <span>Existing complete scene</span>
            <select
              value={existingSceneSelection}
              onChange={(event) => setExistingSceneSelectionOverride(event.target.value)}
            >
              {existingSceneOptions.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>

          <div className="environment-lab__button-row">
            <button
              type="button"
              onClick={() => {
                onLoadScenePreset(existingSceneSelection);
                setExistingSceneSelectionOverride(null);
              }}
            >
              Load Existing Scene
            </button>
          </div>
        </details>

        <details className="environment-lab__subgroup">
          <summary>Reset</summary>

          <p className="environment-lab__hint">
            Restore the selected artwork to neutral behavior and remove all Glow Dots.
          </p>

          <div className="environment-lab__button-row">
            <button type="button" onClick={onResetScene}>
              Reset Current Scene
            </button>
          </div>
        </details>
      </details>

      <p className="environment-lab__hint">
        Scene: {scenePreset.name} ({scenePreset.id})
      </p>
      <p className="environment-lab__hint">
        Baseline: {baselineSceneName} ({baselineSceneId})
      </p>
    </div>
  );
}

export default EnvironmentLabControls;
