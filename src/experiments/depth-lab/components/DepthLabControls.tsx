import type { ChangeEvent } from "react";
import type { DepthLabPlaybackState, DepthLabSettings } from "../types";

type DepthLabControlsProps = {
  settings: DepthLabSettings;
  onPlaybackStateChange: (state: DepthLabPlaybackState) => void;
  onMotionIntensityChange: (value: number) => void;
  onDepthStrengthChange: (value: number) => void;
  onMinimumBreathingDepthChange: (value: number) => void;
  onMaximumBreathingDepthChange: (value: number) => void;
  onBreathingCycleDurationChange: (value: number) => void;
  onPointerParallaxChange: (enabled: boolean) => void;
  onAutoMotionChange: (enabled: boolean) => void;
  effectiveDepthDiagnostic: number;
  reducedMotionActive: boolean;
};

function DepthLabControls({
  settings,
  onPlaybackStateChange,
  onMotionIntensityChange,
  onDepthStrengthChange,
  onMinimumBreathingDepthChange,
  onMaximumBreathingDepthChange,
  onBreathingCycleDurationChange,
  onPointerParallaxChange,
  onAutoMotionChange,
  effectiveDepthDiagnostic,
  reducedMotionActive,
}: DepthLabControlsProps) {
  const handleSliderChange = (
    event: ChangeEvent<HTMLInputElement>,
    onChange: (value: number) => void,
  ) => {
    onChange(Number(event.target.value));
  };

  return (
    <div className="depth-lab__controls">
      <label className="depth-lab__field">
        <span>State</span>
        <select
          value={settings.playbackState}
          onChange={(event) =>
            onPlaybackStateChange(event.target.value as DepthLabPlaybackState)
          }
        >
          <option value="dormant">Dormant</option>
          <option value="armed">Armed</option>
          <option value="playing">Playing</option>
        </select>
      </label>

      <label className="depth-lab__field">
        <span>Motion intensity</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.motionIntensity}
          onChange={(event) =>
            handleSliderChange(event, onMotionIntensityChange)
          }
        />
        <strong>{settings.motionIntensity.toFixed(2)}</strong>
      </label>

      <label className="depth-lab__field">
        <span>Depth strength</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.depthStrength}
          onChange={(event) => handleSliderChange(event, onDepthStrengthChange)}
        />
        <strong>{settings.depthStrength.toFixed(2)}</strong>
      </label>

      <label className="depth-lab__field">
        <span>Minimum breathing depth</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.minimumBreathingDepth}
          onChange={(event) =>
            handleSliderChange(event, onMinimumBreathingDepthChange)
          }
        />
        <strong>{settings.minimumBreathingDepth.toFixed(2)}</strong>
      </label>

      <label className="depth-lab__field">
        <span>Maximum breathing depth</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.maximumBreathingDepth}
          onChange={(event) =>
            handleSliderChange(event, onMaximumBreathingDepthChange)
          }
        />
        <strong>{settings.maximumBreathingDepth.toFixed(2)}</strong>
      </label>

      <label className="depth-lab__field">
        <span>Breathing cycle (seconds)</span>
        <input
          type="range"
          min="1"
          max="12"
          step="0.1"
          value={settings.breathingCycleDurationSeconds}
          onChange={(event) =>
            handleSliderChange(event, onBreathingCycleDurationChange)
          }
        />
        <strong>{settings.breathingCycleDurationSeconds.toFixed(1)}s</strong>
      </label>

      <label className="depth-lab__toggle">
        <span>Pointer parallax</span>
        <input
          type="checkbox"
          checked={settings.pointerParallaxEnabled}
          onChange={(event) => onPointerParallaxChange(event.target.checked)}
        />
      </label>

      <label className="depth-lab__toggle">
        <span>Ambient motion</span>
        <input
          type="checkbox"
          checked={settings.autoMotionEnabled}
          onChange={(event) => onAutoMotionChange(event.target.checked)}
        />
      </label>

      <p className="depth-lab__diagnostic">
        Effective depth: {effectiveDepthDiagnostic.toFixed(3)}
      </p>
      {reducedMotionActive && (
        <p className="depth-lab__motion-note">
          Reduced motion preference detected: ambient animation is suppressed.
        </p>
      )}
    </div>
  );
}

export default DepthLabControls;
