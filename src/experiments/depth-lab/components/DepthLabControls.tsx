import type { ChangeEvent } from 'react'
import type { DepthLabEnvironment, DepthLabPlaybackState, DepthLabSettings } from '../types'

type DepthLabControlsProps = {
  settings: DepthLabSettings
  onEnvironmentChange: (environment: DepthLabEnvironment) => void
  onPlaybackStateChange: (state: DepthLabPlaybackState) => void
  onMotionIntensityChange: (value: number) => void
  onDepthStrengthChange: (value: number) => void
  onPointerParallaxChange: (enabled: boolean) => void
  onAutoMotionChange: (enabled: boolean) => void
}

function DepthLabControls({
  settings,
  onEnvironmentChange,
  onPlaybackStateChange,
  onMotionIntensityChange,
  onDepthStrengthChange,
  onPointerParallaxChange,
  onAutoMotionChange,
}: DepthLabControlsProps) {
  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>, onChange: (value: number) => void) => {
    onChange(Number(event.target.value))
  }

  return (
    <div className="depth-lab__controls">
      <label className="depth-lab__field">
        <span>Environment</span>
        <select
          value={settings.environment}
          onChange={(event) => onEnvironmentChange(event.target.value as DepthLabEnvironment)}
        >
          <option value="beach-panorama">Beach Panorama</option>
          <option value="jungle-depth">Jungle Depth Image</option>
        </select>
      </label>

      <label className="depth-lab__field">
        <span>State</span>
        <select
          value={settings.playbackState}
          onChange={(event) => onPlaybackStateChange(event.target.value as DepthLabPlaybackState)}
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
          onChange={(event) => handleSliderChange(event, onMotionIntensityChange)}
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
    </div>
  )
}

export default DepthLabControls
