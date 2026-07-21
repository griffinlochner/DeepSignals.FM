import type { ChangeEvent } from "react";
import { MAX_SURFACE_GLOW_HOTSPOTS } from "../constants";
import { ENVIRONMENT_BEHAVIOR_PRESETS } from "../presets";
import type {
  EnvironmentBehaviorPreset,
  EnvironmentDiagnostics,
  EnvironmentPlaybackState,
  ImageEnvironmentAsset,
  ImageEnvironmentScenePreset,
  SurfaceGlowPulseMode,
} from "../types";

type EnvironmentLabControlsProps = {
  playbackState: EnvironmentPlaybackState;
  scenePreset: ImageEnvironmentScenePreset;
  selectedBehaviorPresetId: string;
  selectedScenePresetId: string;
  reducedMotionActive: boolean;
  diagnostics: EnvironmentDiagnostics;
  surfaceGlowPlacementModeEnabled: boolean;
  surfaceGlowCapacityReached: boolean;
  importText: string;
  feedbackMessage: string;
  feedbackTone: "idle" | "success" | "error";
  behaviorPresets: EnvironmentBehaviorPreset[];
  assets: ImageEnvironmentAsset[];
  scenePresets: ImageEnvironmentScenePreset[];
  onPlaybackStateChange: (value: EnvironmentPlaybackState) => void;
  onScenePresetChange: (next: ImageEnvironmentScenePreset) => void;
  onLoadBehaviorPreset: (presetId: string) => void;
  onLoadScenePreset: (presetId: string) => void;
  onAssetChange: (assetId: string) => void;
  onSurfaceGlowPlacementModeChange: (enabled: boolean) => void;
  onClearSurfaceGlowHotspots: () => void;
  onRandomizeSurfaceGlowPhases: () => void;
  onApplySurfaceGlowDefaultsToAll: () => void;
  onResetScene: () => void;
  onCopySceneJson: () => void;
  onImportTextChange: (value: string) => void;
  onApplyImportedScene: () => void;
};

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

function EnvironmentLabControls({
  playbackState,
  scenePreset,
  selectedBehaviorPresetId,
  selectedScenePresetId,
  reducedMotionActive,
  diagnostics,
  surfaceGlowPlacementModeEnabled,
  surfaceGlowCapacityReached,
  importText,
  feedbackMessage,
  feedbackTone,
  behaviorPresets,
  assets,
  scenePresets,
  onPlaybackStateChange,
  onScenePresetChange,
  onLoadBehaviorPreset,
  onLoadScenePreset,
  onAssetChange,
  onSurfaceGlowPlacementModeChange,
  onClearSurfaceGlowHotspots,
  onRandomizeSurfaceGlowPhases,
  onApplySurfaceGlowDefaultsToAll,
  onResetScene,
  onCopySceneJson,
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

  const handleRangeChange = (
    event: ChangeEvent<HTMLInputElement>,
    onChange: (value: number) => void,
  ) => {
    onChange(Number(event.target.value));
  };

  const activeBehaviorPreset =
    behaviorPresets.find((preset) => preset.id === selectedBehaviorPresetId) ??
    ENVIRONMENT_BEHAVIOR_PRESETS[0];
  const latestHotspot =
    scenePreset.surfaceGlows.hotspots[scenePreset.surfaceGlows.hotspots.length - 1] ?? null;

  return (
    <div className="environment-lab__controls">
      <details className="environment-lab__group" open>
        <summary>Playback &amp; Depth</summary>

        <label className="environment-lab__field">
          <span>State</span>
          <select
            value={playbackState}
            onChange={(event) =>
              onPlaybackStateChange(event.target.value as EnvironmentPlaybackState)
            }
          >
            <option value="stopped">Stopped</option>
            <option value="playing">Playing</option>
          </select>
        </label>

        <p className="environment-lab__hint">Animation requires Playing + Ambient Motion.</p>

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

        <label className="environment-lab__toggle">
          <span>Pointer parallax</span>
          <input
            type="checkbox"
            checked={scenePreset.behavior.depth.pointerParallaxEnabled}
            onChange={(event) =>
              updateBehaviorDepth("pointerParallaxEnabled", event.target.checked)
            }
          />
        </label>

        <label className="environment-lab__field">
          <span>Pointer parallax strength</span>
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

        <label className="environment-lab__toggle">
          <span>Ambient Motion</span>
          <input
            type="checkbox"
            checked={scenePreset.behavior.depth.ambientMotionEnabled}
            onChange={(event) => updateBehaviorDepth("ambientMotionEnabled", event.target.checked)}
          />
        </label>

        <p className="environment-lab__diagnostic">
          Effective depth: {diagnostics.effectiveDepth.toFixed(3)}
        </p>
      </details>

      <details className="environment-lab__group">
        <summary>Color Evolution</summary>

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
          <span>Global Glow Pulse enabled</span>
          <input
            type="checkbox"
            checked={scenePreset.behavior.color.glowPulseEnabled}
            onChange={(event) => updateBehaviorColor("glowPulseEnabled", event.target.checked)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Pulse amount</span>
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
          <span>Pulse cycle duration (seconds)</span>
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

      <details className="environment-lab__group">
        <summary>Surface Glow Hotspots</summary>

        <label className="environment-lab__toggle">
          <span>Enabled</span>
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

        <label className="environment-lab__toggle">
          <span>Surface Glow Placement Mode</span>
          <input
            type="checkbox"
            checked={surfaceGlowPlacementModeEnabled}
            disabled={surfaceGlowCapacityReached}
            onChange={(event) => onSurfaceGlowPlacementModeChange(event.target.checked)}
          />
        </label>

        <p className="environment-lab__diagnostic">
          Surface hotspots: {scenePreset.surfaceGlows.hotspots.length} / {MAX_SURFACE_GLOW_HOTSPOTS}
        </p>

        {latestHotspot && (
          <p className="environment-lab__diagnostic">
            Latest hotspot UV: {latestHotspot.u.toFixed(4)}, {latestHotspot.v.toFixed(4)}
          </p>
        )}

        {surfaceGlowCapacityReached && (
          <p className="environment-lab__motion-note">
            Maximum of {MAX_SURFACE_GLOW_HOTSPOTS} Surface Glow Hotspots reached.
          </p>
        )}

        <label className="environment-lab__field">
          <span>Default color</span>
          <input
            type="color"
            value={scenePreset.surfaceGlows.defaults.color}
            onChange={(event) => updateSurfaceGlowDefaults("color", event.target.value)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Radius (fraction of shorter visible image dimension)</span>
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
          <span>Softness</span>
          <input
            type="range"
            min="0.05"
            max="0.98"
            step="0.01"
            value={scenePreset.surfaceGlows.defaults.softness}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateSurfaceGlowDefaults("softness", value))
            }
          />
          <strong>{scenePreset.surfaceGlows.defaults.softness.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Intensity</span>
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

        <label className="environment-lab__toggle">
          <span>Pulse enabled</span>
          <input
            type="checkbox"
            checked={scenePreset.surfaceGlows.defaults.pulseEnabled}
            onChange={(event) => updateSurfaceGlowDefaults("pulseEnabled", event.target.checked)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Pulse mode</span>
          <select
            value={scenePreset.surfaceGlows.defaults.pulseMode}
            onChange={(event) =>
              updateSurfaceGlowDefaults("pulseMode", event.target.value as SurfaceGlowPulseMode)
            }
          >
            <option value="brightness">Brightness</option>
            <option value="bloom">Bloom</option>
            <option value="brightness-bloom">Brightness + Bloom</option>
            <option value="soft-blink">Soft Blink</option>
          </select>
          <strong>{pulseModeLabel(scenePreset.surfaceGlows.defaults.pulseMode)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Pulse amount / depth</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={scenePreset.surfaceGlows.defaults.pulseAmount}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateSurfaceGlowDefaults("pulseAmount", value))
            }
          />
          <strong>{scenePreset.surfaceGlows.defaults.pulseAmount.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Minimum intensity multiplier</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={scenePreset.surfaceGlows.defaults.minimumIntensityMultiplier}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlowDefaults("minimumIntensityMultiplier", value),
              )
            }
          />
          <strong>{scenePreset.surfaceGlows.defaults.minimumIntensityMultiplier.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Maximum intensity multiplier</span>
          <input
            type="range"
            min="0.1"
            max="3.5"
            step="0.01"
            value={scenePreset.surfaceGlows.defaults.maximumIntensityMultiplier}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlowDefaults("maximumIntensityMultiplier", value),
              )
            }
          />
          <strong>{scenePreset.surfaceGlows.defaults.maximumIntensityMultiplier.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Radius expansion multiplier</span>
          <input
            type="range"
            min="1"
            max="2.5"
            step="0.01"
            value={scenePreset.surfaceGlows.defaults.radiusExpansionMultiplier}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlowDefaults("radiusExpansionMultiplier", value),
              )
            }
          />
          <strong>{scenePreset.surfaceGlows.defaults.radiusExpansionMultiplier.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Pulse cycle (seconds)</span>
          <input
            type="range"
            min="0.2"
            max="20"
            step="0.1"
            value={scenePreset.surfaceGlows.defaults.pulseCycleSeconds}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlowDefaults("pulseCycleSeconds", value),
              )
            }
          />
          <strong>{scenePreset.surfaceGlows.defaults.pulseCycleSeconds.toFixed(1)}s</strong>
        </label>

        <label className="environment-lab__toggle">
          <span>Hotspot Hue Drift enabled</span>
          <input
            type="checkbox"
            checked={scenePreset.surfaceGlows.defaults.hueDriftEnabled}
            onChange={(event) =>
              updateSurfaceGlowDefaults("hueDriftEnabled", event.target.checked)
            }
          />
        </label>

        <label className="environment-lab__field">
          <span>Hue drift range (degrees)</span>
          <input
            type="range"
            min="0"
            max="180"
            step="0.5"
            value={scenePreset.surfaceGlows.defaults.hueDriftRangeDegrees}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlowDefaults("hueDriftRangeDegrees", value),
              )
            }
          />
          <strong>{scenePreset.surfaceGlows.defaults.hueDriftRangeDegrees.toFixed(1)}deg</strong>
        </label>

        <label className="environment-lab__field">
          <span>Hue drift cycle (seconds)</span>
          <input
            type="range"
            min="0.5"
            max="120"
            step="0.1"
            value={scenePreset.surfaceGlows.defaults.hueDriftCycleSeconds}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlowDefaults("hueDriftCycleSeconds", value),
              )
            }
          />
          <strong>{scenePreset.surfaceGlows.defaults.hueDriftCycleSeconds.toFixed(1)}s</strong>
        </label>

        <div className="environment-lab__button-row">
          <button type="button" onClick={onClearSurfaceGlowHotspots}>
            Clear All
          </button>
          <button type="button" onClick={onRandomizeSurfaceGlowPhases}>
            Randomize Phases
          </button>
          <button type="button" onClick={onApplySurfaceGlowDefaultsToAll}>
            Apply current animation settings to all hotspots
          </button>
        </div>

        <p className="environment-lab__diagnostic">
          Surface Glow Animation: {diagnostics.surfaceGlowAnimationStatus}
        </p>
        <p className="environment-lab__diagnostic">
          Current pulse factor: {diagnostics.surfaceGlowPulseFactor.toFixed(3)}
        </p>
        <p className="environment-lab__hint">
          Placement mode: click to add glow. Hold Shift or Alt while clicking to remove nearest glow. Capacity: {MAX_SURFACE_GLOW_HOTSPOTS}.
        </p>
      </details>

      <details className="environment-lab__group">
        <summary>Behavior Presets</summary>

        <p className="environment-lab__hint">
          Behavior presets affect global depth, motion, and color only. Behavior presets do not alter scene-specific Surface Glow locations.
        </p>

        <div className="environment-lab__button-row">
          {behaviorPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onLoadBehaviorPreset(preset.id)}
              aria-pressed={selectedBehaviorPresetId === preset.id}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <p className="environment-lab__diagnostic">Active behavior: {activeBehaviorPreset.name}</p>
        {activeBehaviorPreset.description && (
          <p className="environment-lab__hint">{activeBehaviorPreset.description}</p>
        )}
      </details>

      <details className="environment-lab__group">
        <summary>Full Scene Preset &amp; Diagnostics</summary>

        <p className="environment-lab__hint">
          Full scene preset includes asset, global behavior, and Surface Glow positions/settings.
        </p>

        <label className="environment-lab__field">
          <span>Registered image/depth asset</span>
          <select
            value={scenePreset.assetId}
            onChange={(event) => onAssetChange(event.target.value)}
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>

        <label className="environment-lab__field">
          <span>Built-in full scene</span>
          <select
            value={selectedScenePresetId}
            onChange={(event) => onLoadScenePreset(event.target.value)}
          >
            {scenePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        <div className="environment-lab__button-row">
          {scenePresets.map((preset) => (
            <button key={preset.id} type="button" onClick={() => onLoadScenePreset(preset.id)}>
              Load {preset.name}
            </button>
          ))}
          <button type="button" onClick={onResetScene}>
            Reset Full Scene
          </button>
        </div>

        <div className="environment-lab__button-row">
          <button type="button" onClick={onCopySceneJson}>
            Copy Full Scene JSON
          </button>
          <button type="button" onClick={onApplyImportedScene}>
            Apply Imported Scene
          </button>
        </div>

        <label className="environment-lab__field">
          <span>Import Full Scene JSON</span>
          <textarea
            rows={7}
            value={importText}
            onChange={(event) => onImportTextChange(event.target.value)}
          />
        </label>

        <p
          className={`environment-lab__feedback environment-lab__feedback--${feedbackTone}`}
          aria-live="polite"
        >
          {feedbackMessage}
        </p>

        <ul className="environment-lab__stats" aria-label="Laboratory diagnostics">
          <li>Approx FPS: {diagnostics.fps.toFixed(1)}</li>
          <li>Surface hotspot count: {diagnostics.surfaceGlowCount}</li>
          <li>Current hue offset: {diagnostics.hueOffsetDegrees.toFixed(2)}deg</li>
          <li>Current saturation: {diagnostics.currentSaturation.toFixed(2)}</li>
          <li>Default glow intensity: {diagnostics.surfaceGlowDefaultIntensity.toFixed(2)}</li>
          <li>Shader hotspot capacity: {diagnostics.shaderSurfaceGlowCapacity}</li>
          <li>Automatic motion active: {diagnostics.automaticMotionActive ? "yes" : "no"}</li>
          <li>
            Most recent hotspot UV: {diagnostics.mostRecentSurfaceGlowU?.toFixed(4) ?? "-"}, {diagnostics.mostRecentSurfaceGlowV?.toFixed(4) ?? "-"}
          </li>
          <li>
            Color asset: {diagnostics.assetDiagnostics.colorWidth}x{diagnostics.assetDiagnostics.colorHeight}
          </li>
          <li>
            Depth asset: {diagnostics.assetDiagnostics.depthWidth}x{diagnostics.assetDiagnostics.depthHeight}
          </li>
          <li>
            Color aspect: {diagnostics.assetDiagnostics.colorAspectRatio.toFixed(4)}
          </li>
          <li>
            Depth aspect: {diagnostics.assetDiagnostics.depthAspectRatio.toFixed(4)}
          </li>
          <li>
            Dimension match: {diagnostics.assetDiagnostics.dimensionsMatch ? "yes" : "no"}
          </li>
          <li>
            Aspect match: {diagnostics.assetDiagnostics.aspectMatch ? "yes" : "no"}
          </li>
          {import.meta.env.DEV && (
            <>
              <li>
                Pick canvas XY: {diagnostics.surfaceGlowPickCanvasX?.toFixed(3) ?? "-"}, {diagnostics.surfaceGlowPickCanvasY?.toFixed(3) ?? "-"}
              </li>
              <li>
                Pick decoded UV: {diagnostics.surfaceGlowPickU?.toFixed(3) ?? "-"}, {diagnostics.surfaceGlowPickV?.toFixed(3) ?? "-"}
              </li>
              <li>
                Pick found plane: {diagnostics.surfaceGlowPickFoundPlane ? "yes" : "no"}
              </li>
              <li>
                Pick effective depth: {diagnostics.surfaceGlowPickEffectiveDepth?.toFixed(3) ?? "-"}
              </li>
            </>
          )}
        </ul>

        {!diagnostics.assetDiagnostics.dimensionsMatch && (
          <p className="environment-lab__motion-note">
            Warning: color and depth dimensions do not match.
          </p>
        )}

        {!diagnostics.assetDiagnostics.aspectMatch && (
          <p className="environment-lab__motion-note">
            Warning: color and depth aspect ratios do not match.
          </p>
        )}

        {reducedMotionActive && (
          <p className="environment-lab__motion-note">
            Reduced motion preference detected: automatic ambient motion is frozen.
          </p>
        )}
      </details>
    </div>
  );
}

export default EnvironmentLabControls;
