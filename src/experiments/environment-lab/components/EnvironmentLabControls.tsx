import type { ChangeEvent } from "react";
import { MAX_SURFACE_GLOW_HOTSPOTS } from "../constants";
import { IMAGE_ENVIRONMENT_PRESETS } from "../presets";
import type {
  EnvironmentDiagnostics,
  EnvironmentPlaybackState,
  ImageEnvironmentPreset,
  SurfaceGlowPulseMode,
} from "../types";

type EnvironmentLabControlsProps = {
  playbackState: EnvironmentPlaybackState;
  preset: ImageEnvironmentPreset;
  selectedBuiltinPresetId: string;
  reducedMotionActive: boolean;
  diagnostics: EnvironmentDiagnostics;
  twinklePlacementModeEnabled: boolean;
  surfaceGlowPlacementModeEnabled: boolean;
  hazeMotionPreview4xEnabled: boolean;
  surfaceGlowCapacityReached: boolean;
  importText: string;
  feedbackMessage: string;
  feedbackTone: "idle" | "success" | "error";
  onPlaybackStateChange: (value: EnvironmentPlaybackState) => void;
  onPresetChange: (next: ImageEnvironmentPreset) => void;
  onLoadBuiltinPreset: (presetId: string) => void;
  onTwinklePlacementModeChange: (enabled: boolean) => void;
  onSurfaceGlowPlacementModeChange: (enabled: boolean) => void;
  onHazeMotionPreview4xChange: (enabled: boolean) => void;
  onClearHotspots: () => void;
  onRandomizeHotspotPhases: () => void;
  onClearSurfaceGlowHotspots: () => void;
  onRandomizeSurfaceGlowPhases: () => void;
  onApplySurfaceGlowDefaultsToAll: () => void;
  onResetPreset: () => void;
  onCopyPresetJson: () => void;
  onImportTextChange: (value: string) => void;
  onApplyImportedPreset: () => void;
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
  preset,
  selectedBuiltinPresetId,
  reducedMotionActive,
  diagnostics,
  twinklePlacementModeEnabled,
  surfaceGlowPlacementModeEnabled,
  hazeMotionPreview4xEnabled,
  surfaceGlowCapacityReached,
  importText,
  feedbackMessage,
  feedbackTone,
  onPlaybackStateChange,
  onPresetChange,
  onLoadBuiltinPreset,
  onTwinklePlacementModeChange,
  onSurfaceGlowPlacementModeChange,
  onHazeMotionPreview4xChange,
  onClearHotspots,
  onRandomizeHotspotPhases,
  onClearSurfaceGlowHotspots,
  onRandomizeSurfaceGlowPhases,
  onApplySurfaceGlowDefaultsToAll,
  onResetPreset,
  onCopyPresetJson,
  onImportTextChange,
  onApplyImportedPreset,
}: EnvironmentLabControlsProps) {
  const updateDepth = <K extends keyof ImageEnvironmentPreset["depth"]>(
    key: K,
    value: ImageEnvironmentPreset["depth"][K],
  ) => {
    onPresetChange({
      ...preset,
      depth: {
        ...preset.depth,
        [key]: value,
      },
    });
  };

  const updateColor = <K extends keyof ImageEnvironmentPreset["color"]>(
    key: K,
    value: ImageEnvironmentPreset["color"][K],
  ) => {
    onPresetChange({
      ...preset,
      color: {
        ...preset.color,
        [key]: value,
      },
    });
  };

  const updateTwinkles = <K extends keyof ImageEnvironmentPreset["twinkles"]>(
    key: K,
    value: ImageEnvironmentPreset["twinkles"][K],
  ) => {
    onPresetChange({
      ...preset,
      twinkles: {
        ...preset.twinkles,
        [key]: value,
      },
    });
  };

  const updateParticles = <K extends keyof ImageEnvironmentPreset["particles"]>(
    key: K,
    value: ImageEnvironmentPreset["particles"][K],
  ) => {
    onPresetChange({
      ...preset,
      particles: {
        ...preset.particles,
        [key]: value,
      },
    });
  };

  const updateHaze = <K extends keyof ImageEnvironmentPreset["haze"]>(
    key: K,
    value: ImageEnvironmentPreset["haze"][K],
  ) => {
    onPresetChange({
      ...preset,
      haze: {
        ...preset.haze,
        [key]: value,
      },
    });
  };

  const updateSaturationPulse = <
    K extends keyof ImageEnvironmentPreset["saturationPulse"],
  >(
    key: K,
    value: ImageEnvironmentPreset["saturationPulse"][K],
  ) => {
    onPresetChange({
      ...preset,
      saturationPulse: {
        ...preset.saturationPulse,
        [key]: value,
      },
    });
  };

  const updateSurfaceGlows = <K extends keyof ImageEnvironmentPreset["surfaceGlows"]>(
    key: K,
    value: ImageEnvironmentPreset["surfaceGlows"][K],
  ) => {
    onPresetChange({
      ...preset,
      surfaceGlows: {
        ...preset.surfaceGlows,
        [key]: value,
      },
    });
  };

  const handleRangeChange = (
    event: ChangeEvent<HTMLInputElement>,
    onChange: (value: number) => void,
  ) => {
    onChange(Number(event.target.value));
  };

  return (
    <div className="environment-lab__controls">
      <details className="environment-lab__group" open>
        <summary>Built-in Presets</summary>

        <label className="environment-lab__field">
          <span>Preset</span>
          <select
            value={selectedBuiltinPresetId}
            onChange={(event) => onLoadBuiltinPreset(event.target.value)}
          >
            {IMAGE_ENVIRONMENT_PRESETS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <div className="environment-lab__button-row">
          <button type="button" onClick={() => onLoadBuiltinPreset("neutral-baseline")}>
            Load Neutral Baseline
          </button>
          <button type="button" onClick={() => onLoadBuiltinPreset("uv-jungle-showcase")}>
            Load UV Jungle Showcase
          </button>
        </div>
      </details>

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
            value={preset.depth.motionIntensity}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateDepth("motionIntensity", value))
            }
          />
          <strong>{preset.depth.motionIntensity.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Depth strength</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={preset.depth.depthStrength}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateDepth("depthStrength", value))
            }
          />
          <strong>{preset.depth.depthStrength.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Minimum breathing depth</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={preset.depth.breathingMin}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateDepth("breathingMin", value))
            }
          />
          <strong>{preset.depth.breathingMin.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Maximum breathing depth</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={preset.depth.breathingMax}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateDepth("breathingMax", value))
            }
          />
          <strong>{preset.depth.breathingMax.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Breathing cycle (seconds)</span>
          <input
            type="range"
            min="1"
            max="20"
            step="0.1"
            value={preset.depth.breathingCycleSeconds}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateDepth("breathingCycleSeconds", value))
            }
          />
          <strong>{preset.depth.breathingCycleSeconds.toFixed(1)}s</strong>
        </label>

        <label className="environment-lab__toggle">
          <span>Pointer parallax</span>
          <input
            type="checkbox"
            checked={preset.depth.pointerParallaxEnabled}
            onChange={(event) => updateDepth("pointerParallaxEnabled", event.target.checked)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Pointer parallax strength</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={preset.depth.pointerParallaxStrength}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateDepth("pointerParallaxStrength", value))
            }
          />
          <strong>{preset.depth.pointerParallaxStrength.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__toggle">
          <span>Ambient Motion</span>
          <input
            type="checkbox"
            checked={preset.depth.ambientMotionEnabled}
            onChange={(event) => updateDepth("ambientMotionEnabled", event.target.checked)}
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
            checked={preset.color.driftEnabled}
            onChange={(event) => updateColor("driftEnabled", event.target.checked)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Hue range (degrees)</span>
          <input
            type="range"
            min="0"
            max="60"
            step="0.1"
            value={preset.color.hueRangeDegrees}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateColor("hueRangeDegrees", value))
            }
          />
          <strong>{preset.color.hueRangeDegrees.toFixed(1)}deg</strong>
        </label>

        <label className="environment-lab__field">
          <span>Hue cycle duration (seconds)</span>
          <input
            type="range"
            min="10"
            max="240"
            step="0.5"
            value={preset.color.cycleSeconds}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateColor("cycleSeconds", value))
            }
          />
          <strong>{preset.color.cycleSeconds.toFixed(1)}s</strong>
        </label>

        <label className="environment-lab__field">
          <span>Base saturation</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={preset.color.saturation}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateColor("saturation", value))
            }
          />
          <strong>{preset.color.saturation.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__toggle">
          <span>Global Glow Pulse enabled</span>
          <input
            type="checkbox"
            checked={preset.color.glowPulseEnabled}
            onChange={(event) => updateColor("glowPulseEnabled", event.target.checked)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Pulse amount</span>
          <input
            type="range"
            min="0"
            max="0.4"
            step="0.005"
            value={preset.color.glowPulseAmount}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateColor("glowPulseAmount", value))
            }
          />
          <strong>{preset.color.glowPulseAmount.toFixed(3)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Pulse cycle duration (seconds)</span>
          <input
            type="range"
            min="2"
            max="60"
            step="0.2"
            value={preset.color.glowPulseCycleSeconds}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateColor("glowPulseCycleSeconds", value),
              )
            }
          />
          <strong>{preset.color.glowPulseCycleSeconds.toFixed(1)}s</strong>
        </label>

        <label className="environment-lab__toggle">
          <span>Saturation Pulse enabled</span>
          <input
            type="checkbox"
            checked={preset.saturationPulse.enabled}
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
            value={preset.saturationPulse.minimumSaturation}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSaturationPulse("minimumSaturation", value),
              )
            }
          />
          <strong>{preset.saturationPulse.minimumSaturation.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Maximum saturation</span>
          <input
            type="range"
            min="0"
            max="2.8"
            step="0.01"
            value={preset.saturationPulse.maximumSaturation}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSaturationPulse("maximumSaturation", value),
              )
            }
          />
          <strong>{preset.saturationPulse.maximumSaturation.toFixed(2)}</strong>
        </label>
      </details>

      <details className="environment-lab__group">
        <summary>Twinkle Hotspots</summary>

        <label className="environment-lab__toggle">
          <span>Twinkles enabled</span>
          <input
            type="checkbox"
            checked={preset.twinkles.enabled}
            onChange={(event) => updateTwinkles("enabled", event.target.checked)}
          />
        </label>

        <label className="environment-lab__toggle">
          <span>Placement mode enabled</span>
          <input
            type="checkbox"
            checked={twinklePlacementModeEnabled}
            onChange={(event) => onTwinklePlacementModeChange(event.target.checked)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Default color</span>
          <input
            type="color"
            value={preset.twinkles.defaultColor}
            onChange={(event) => updateTwinkles("defaultColor", event.target.value)}
          />
        </label>

        <div className="environment-lab__button-row">
          <button type="button" onClick={onClearHotspots}>
            Clear all hotspots
          </button>
          <button type="button" onClick={onRandomizeHotspotPhases}>
            Randomize hotspot phases
          </button>
        </div>

        <p className="environment-lab__diagnostic">
          hotspot count: {preset.twinkles.hotspots.length}
        </p>
      </details>

      <details className="environment-lab__group">
        <summary>Surface Glow Hotspots</summary>

        <label className="environment-lab__toggle">
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={preset.surfaceGlows.enabled}
            onChange={(event) => updateSurfaceGlows("enabled", event.target.checked)}
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
          Surface hotspots: {preset.surfaceGlows.hotspots.length} / {MAX_SURFACE_GLOW_HOTSPOTS}
        </p>

        {surfaceGlowCapacityReached && (
          <p className="environment-lab__motion-note">
            Maximum of {MAX_SURFACE_GLOW_HOTSPOTS} Surface Glow Hotspots reached.
          </p>
        )}

        <label className="environment-lab__field">
          <span>Color</span>
          <input
            type="color"
            value={preset.surfaceGlows.defaultColor}
            onChange={(event) => updateSurfaceGlows("defaultColor", event.target.value)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Radius (fraction of shorter visible image dimension)</span>
          <input
            type="range"
            min="0.002"
            max="0.09"
            step="0.001"
            value={preset.surfaceGlows.defaultRadius}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateSurfaceGlows("defaultRadius", value))
            }
          />
          <strong>{preset.surfaceGlows.defaultRadius.toFixed(3)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Softness</span>
          <input
            type="range"
            min="0.05"
            max="0.98"
            step="0.01"
            value={preset.surfaceGlows.defaultSoftness}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateSurfaceGlows("defaultSoftness", value))
            }
          />
          <strong>{preset.surfaceGlows.defaultSoftness.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Intensity</span>
          <input
            type="range"
            min="0"
            max="4"
            step="0.01"
            value={preset.surfaceGlows.defaultIntensity}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateSurfaceGlows("defaultIntensity", value))
            }
          />
          <strong>{preset.surfaceGlows.defaultIntensity.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__toggle">
          <span>Pulse enabled</span>
          <input
            type="checkbox"
            checked={preset.surfaceGlows.defaultPulseEnabled}
            onChange={(event) => updateSurfaceGlows("defaultPulseEnabled", event.target.checked)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Pulse mode</span>
          <select
            value={preset.surfaceGlows.defaultPulseMode}
            onChange={(event) =>
              updateSurfaceGlows("defaultPulseMode", event.target.value as SurfaceGlowPulseMode)
            }
          >
            <option value="brightness">Brightness</option>
            <option value="bloom">Bloom</option>
            <option value="brightness-bloom">Brightness + Bloom</option>
            <option value="soft-blink">Soft Blink</option>
          </select>
          <strong>{pulseModeLabel(preset.surfaceGlows.defaultPulseMode)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Pulse amount / depth</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={preset.surfaceGlows.defaultPulseAmount}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateSurfaceGlows("defaultPulseAmount", value))
            }
          />
          <strong>{preset.surfaceGlows.defaultPulseAmount.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Minimum intensity multiplier</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={preset.surfaceGlows.defaultMinimumIntensityMultiplier}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlows("defaultMinimumIntensityMultiplier", value),
              )
            }
          />
          <strong>{preset.surfaceGlows.defaultMinimumIntensityMultiplier.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Maximum intensity multiplier</span>
          <input
            type="range"
            min="0.1"
            max="3.5"
            step="0.01"
            value={preset.surfaceGlows.defaultMaximumIntensityMultiplier}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlows("defaultMaximumIntensityMultiplier", value),
              )
            }
          />
          <strong>{preset.surfaceGlows.defaultMaximumIntensityMultiplier.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Radius expansion multiplier</span>
          <input
            type="range"
            min="1"
            max="2.5"
            step="0.01"
            value={preset.surfaceGlows.defaultRadiusExpansionMultiplier}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlows("defaultRadiusExpansionMultiplier", value),
              )
            }
          />
          <strong>{preset.surfaceGlows.defaultRadiusExpansionMultiplier.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Pulse cycle (seconds)</span>
          <input
            type="range"
            min="0.2"
            max="20"
            step="0.1"
            value={preset.surfaceGlows.defaultPulseCycleSeconds}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlows("defaultPulseCycleSeconds", value),
              )
            }
          />
          <strong>{preset.surfaceGlows.defaultPulseCycleSeconds.toFixed(1)}s</strong>
        </label>

        <label className="environment-lab__toggle">
          <span>Hotspot Hue Drift enabled</span>
          <input
            type="checkbox"
            checked={preset.surfaceGlows.defaultHueDriftEnabled}
            onChange={(event) =>
              updateSurfaceGlows("defaultHueDriftEnabled", event.target.checked)
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
            value={preset.surfaceGlows.defaultHueDriftRangeDegrees}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlows("defaultHueDriftRangeDegrees", value),
              )
            }
          />
          <strong>{preset.surfaceGlows.defaultHueDriftRangeDegrees.toFixed(1)}deg</strong>
        </label>

        <label className="environment-lab__field">
          <span>Hue drift cycle (seconds)</span>
          <input
            type="range"
            min="0.5"
            max="120"
            step="0.1"
            value={preset.surfaceGlows.defaultHueDriftCycleSeconds}
            onChange={(event) =>
              handleRangeChange(event, (value) =>
                updateSurfaceGlows("defaultHueDriftCycleSeconds", value),
              )
            }
          />
          <strong>{preset.surfaceGlows.defaultHueDriftCycleSeconds.toFixed(1)}s</strong>
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
        <summary>Atmosphere</summary>

        <label className="environment-lab__toggle">
          <span>Particles enabled</span>
          <input
            type="checkbox"
            checked={preset.particles.enabled}
            onChange={(event) => updateParticles("enabled", event.target.checked)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Particle count</span>
          <input
            type="range"
            min="0"
            max="240"
            step="1"
            value={preset.particles.count}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateParticles("count", Math.round(value)))
            }
          />
          <strong>{preset.particles.count}</strong>
        </label>

        <label className="environment-lab__toggle">
          <span>Haze enabled</span>
          <input
            type="checkbox"
            checked={preset.haze.enabled}
            onChange={(event) => updateHaze("enabled", event.target.checked)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Haze opacity</span>
          <input
            type="range"
            min="0"
            max="0.4"
            step="0.005"
            value={preset.haze.opacity}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateHaze("opacity", value))
            }
          />
          <strong>{preset.haze.opacity.toFixed(3)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Haze Softness / Blur</span>
          <input
            type="range"
            min="0"
            max="120"
            step="1"
            value={preset.haze.blurPixels}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateHaze("blurPixels", value))
            }
          />
          <strong>{preset.haze.blurPixels.toFixed(0)}px</strong>
        </label>

        <p className="environment-lab__hint">
          Blur changes the softness of the haze gradients; it does not increase haze opacity.
        </p>

        <label className="environment-lab__field">
          <span>Drift Cycle (seconds)</span>
          <input
            type="range"
            min="2"
            max="120"
            step="0.1"
            value={preset.haze.driftCycleSeconds}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateHaze("driftCycleSeconds", value))
            }
          />
          <strong>{preset.haze.driftCycleSeconds.toFixed(1)}s</strong>
        </label>

        <label className="environment-lab__field">
          <span>Drift Distance</span>
          <input
            type="range"
            min="0"
            max="120"
            step="1"
            value={preset.haze.driftDistance}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateHaze("driftDistance", value))
            }
          />
          <strong>{preset.haze.driftDistance.toFixed(0)}px</strong>
        </label>

        <label className="environment-lab__field">
          <span>Horizontal drift bias</span>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={preset.haze.driftBiasX}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateHaze("driftBiasX", value))
            }
          />
          <strong>{preset.haze.driftBiasX.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Vertical drift bias</span>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={preset.haze.driftBiasY}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateHaze("driftBiasY", value))
            }
          />
          <strong>{preset.haze.driftBiasY.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__toggle">
          <span>4x Motion Preview</span>
          <input
            type="checkbox"
            checked={hazeMotionPreview4xEnabled}
            onChange={(event) => onHazeMotionPreview4xChange(event.target.checked)}
          />
        </label>

        <p className="environment-lab__diagnostic">
          Haze animation status: {diagnostics.hazeAnimationStatus}
        </p>
        <p className="environment-lab__diagnostic">
          Current haze offset: {diagnostics.hazeOffsetX.toFixed(2)}px, {diagnostics.hazeOffsetY.toFixed(2)}px
        </p>
      </details>

      <details className="environment-lab__group">
        <summary>Preset &amp; Diagnostics</summary>

        <div className="environment-lab__button-row">
          <button type="button" onClick={onResetPreset}>
            Reset to Neutral Baseline
          </button>
          <button type="button" onClick={onCopyPresetJson}>
            Copy preset JSON
          </button>
        </div>

        <label className="environment-lab__field">
          <span>Import preset JSON</span>
          <textarea
            rows={7}
            value={importText}
            onChange={(event) => onImportTextChange(event.target.value)}
          />
        </label>

        <button type="button" onClick={onApplyImportedPreset}>
          Apply imported preset
        </button>

        <p
          className={`environment-lab__feedback environment-lab__feedback--${feedbackTone}`}
          aria-live="polite"
        >
          {feedbackMessage}
        </p>

        <ul className="environment-lab__stats" aria-label="Laboratory diagnostics">
          <li>Approx FPS: {diagnostics.fps.toFixed(1)}</li>
          <li>Active twinkle count: {diagnostics.twinkleCount}</li>
          <li>Surface hotspot count: {diagnostics.surfaceGlowCount}</li>
          <li>Active particle count: {diagnostics.particleCount}</li>
          <li>Current hue offset: {diagnostics.hueOffsetDegrees.toFixed(2)}deg</li>
          <li>Current saturation: {diagnostics.currentSaturation.toFixed(2)}</li>
          <li>Default glow intensity: {diagnostics.surfaceGlowDefaultIntensity.toFixed(2)}</li>
          <li>Shader hotspot capacity: {diagnostics.shaderSurfaceGlowCapacity}</li>
          <li>Automatic motion active: {diagnostics.automaticMotionActive ? "yes" : "no"}</li>
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
                Pick canvas XY: {diagnostics.surfaceGlowPickCanvasX?.toFixed(3) ?? "-"},{" "}
                {diagnostics.surfaceGlowPickCanvasY?.toFixed(3) ?? "-"}
              </li>
              <li>
                Pick decoded UV: {diagnostics.surfaceGlowPickU?.toFixed(3) ?? "-"},{" "}
                {diagnostics.surfaceGlowPickV?.toFixed(3) ?? "-"}
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
