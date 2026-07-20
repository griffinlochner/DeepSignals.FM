import type { ChangeEvent } from "react";
import type {
  EnvironmentDiagnostics,
  EnvironmentPlaybackState,
  EnvironmentPreset,
} from "../types";

type EnvironmentLabControlsProps = {
  playbackState: EnvironmentPlaybackState;
  preset: EnvironmentPreset;
  reducedMotionActive: boolean;
  diagnostics: EnvironmentDiagnostics;
  placementModeEnabled: boolean;
  importText: string;
  feedbackMessage: string;
  feedbackTone: "idle" | "success" | "error";
  onPlaybackStateChange: (value: EnvironmentPlaybackState) => void;
  onPresetChange: (next: EnvironmentPreset) => void;
  onPlacementModeChange: (enabled: boolean) => void;
  onClearHotspots: () => void;
  onRandomizeHotspotPhases: () => void;
  onResetPreset: () => void;
  onCopyPresetJson: () => void;
  onImportTextChange: (value: string) => void;
  onApplyImportedPreset: () => void;
};

function EnvironmentLabControls({
  playbackState,
  preset,
  reducedMotionActive,
  diagnostics,
  placementModeEnabled,
  importText,
  feedbackMessage,
  feedbackTone,
  onPlaybackStateChange,
  onPresetChange,
  onPlacementModeChange,
  onClearHotspots,
  onRandomizeHotspotPhases,
  onResetPreset,
  onCopyPresetJson,
  onImportTextChange,
  onApplyImportedPreset,
}: EnvironmentLabControlsProps) {
  const updateDepth = <K extends keyof EnvironmentPreset["depth"]>(
    key: K,
    value: EnvironmentPreset["depth"][K],
  ) => {
    onPresetChange({
      ...preset,
      depth: {
        ...preset.depth,
        [key]: value,
      },
    });
  };

  const updateColor = <K extends keyof EnvironmentPreset["color"]>(
    key: K,
    value: EnvironmentPreset["color"][K],
  ) => {
    onPresetChange({
      ...preset,
      color: {
        ...preset.color,
        [key]: value,
      },
    });
  };

  const updateTwinkles = <K extends keyof EnvironmentPreset["twinkles"]>(
    key: K,
    value: EnvironmentPreset["twinkles"][K],
  ) => {
    onPresetChange({
      ...preset,
      twinkles: {
        ...preset.twinkles,
        [key]: value,
      },
    });
  };

  const updateParticles = <K extends keyof EnvironmentPreset["particles"]>(
    key: K,
    value: EnvironmentPreset["particles"][K],
  ) => {
    onPresetChange({
      ...preset,
      particles: {
        ...preset.particles,
        [key]: value,
      },
    });
  };

  const updateHaze = <K extends keyof EnvironmentPreset["haze"]>(
    key: K,
    value: EnvironmentPreset["haze"][K],
  ) => {
    onPresetChange({
      ...preset,
      haze: {
        ...preset.haze,
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
          <span>Glow Pulse enabled</span>
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
            checked={placementModeEnabled}
            onChange={(event) => onPlacementModeChange(event.target.checked)}
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

        <label className="environment-lab__field">
          <span>Default size</span>
          <input
            type="range"
            min="0.04"
            max="0.5"
            step="0.01"
            value={preset.twinkles.defaultSize}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateTwinkles("defaultSize", value))
            }
          />
          <strong>{preset.twinkles.defaultSize.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Default intensity</span>
          <input
            type="range"
            min="0.05"
            max="2"
            step="0.01"
            value={preset.twinkles.defaultIntensity}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateTwinkles("defaultIntensity", value))
            }
          />
          <strong>{preset.twinkles.defaultIntensity.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Pulse speed</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.01"
            value={preset.twinkles.pulseSpeed}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateTwinkles("pulseSpeed", value))
            }
          />
          <strong>{preset.twinkles.pulseSpeed.toFixed(2)}</strong>
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
        <p className="environment-lab__hint">
          Placement mode: click to add. Hold Shift or Alt while clicking to remove the nearest hotspot.
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

        <label className="environment-lab__field">
          <span>Drift speed</span>
          <input
            type="range"
            min="0"
            max="0.35"
            step="0.001"
            value={preset.particles.speed}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateParticles("speed", value))
            }
          />
          <strong>{preset.particles.speed.toFixed(3)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Particle size</span>
          <input
            type="range"
            min="0.005"
            max="0.16"
            step="0.001"
            value={preset.particles.size}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateParticles("size", value))
            }
          />
          <strong>{preset.particles.size.toFixed(3)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Opacity</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={preset.particles.opacity}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateParticles("opacity", value))
            }
          />
          <strong>{preset.particles.opacity.toFixed(2)}</strong>
        </label>

        <label className="environment-lab__field">
          <span>Particle color</span>
          <input
            type="color"
            value={preset.particles.color}
            onChange={(event) => updateParticles("color", event.target.value)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Seed</span>
          <input
            type="number"
            min="0"
            max="1000000"
            value={preset.particles.seed}
            onChange={(event) =>
              updateParticles("seed", Math.max(0, Math.min(1_000_000, Number(event.target.value) || 0)))
            }
          />
        </label>

        <button
          type="button"
          onClick={() =>
            updateParticles("seed", Math.floor(Math.random() * 1_000_000))
          }
        >
          Randomize seed
        </button>

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
          <span>Haze blur amount (px)</span>
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

        <label className="environment-lab__field">
          <span>Haze drift cycle (seconds)</span>
          <input
            type="range"
            min="5"
            max="240"
            step="1"
            value={preset.haze.driftCycleSeconds}
            onChange={(event) =>
              handleRangeChange(event, (value) => updateHaze("driftCycleSeconds", value))
            }
          />
          <strong>{preset.haze.driftCycleSeconds.toFixed(0)}s</strong>
        </label>

        <label className="environment-lab__field">
          <span>Primary tint</span>
          <input
            type="color"
            value={preset.haze.primaryColor}
            onChange={(event) => updateHaze("primaryColor", event.target.value)}
          />
        </label>

        <label className="environment-lab__field">
          <span>Secondary tint</span>
          <input
            type="color"
            value={preset.haze.secondaryColor}
            onChange={(event) => updateHaze("secondaryColor", event.target.value)}
          />
        </label>
      </details>

      <details className="environment-lab__group">
        <summary>Preset &amp; Diagnostics</summary>

        <div className="environment-lab__button-row">
          <button type="button" onClick={onResetPreset}>
            Reset to UV Jungle defaults
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
          <li>Active particle count: {diagnostics.particleCount}</li>
          <li>Current hue offset: {diagnostics.hueOffsetDegrees.toFixed(2)}deg</li>
          <li>Automatic motion active: {diagnostics.automaticMotionActive ? "yes" : "no"}</li>
        </ul>

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
