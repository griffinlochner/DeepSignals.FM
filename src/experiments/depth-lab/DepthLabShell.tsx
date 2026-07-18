import DepthLabControls from './components/DepthLabControls'
import DepthLabOverlay from './components/DepthLabOverlay'
import BeachPanoramaScene from './scenes/BeachPanoramaScene'
import JungleDepthScene from './scenes/JungleDepthScene'
import type { DepthLabEnvironment, DepthLabLoadingState, DepthLabPlaybackState, DepthLabSettings } from './types'
import './depthLab.css'

type DepthLabShellProps = {
  settings: DepthLabSettings
  status: string
  onEnvironmentChange: (environment: DepthLabEnvironment) => void
  onPlaybackStateChange: (state: DepthLabPlaybackState) => void
  onMotionIntensityChange: (value: number) => void
  onDepthStrengthChange: (value: number) => void
  onMinimumBreathingDepthChange: (value: number) => void
  onMaximumBreathingDepthChange: (value: number) => void
  onBreathingCycleDurationChange: (value: number) => void
  onPointerParallaxChange: (enabled: boolean) => void
  onAutoMotionChange: (enabled: boolean) => void
  effectiveDepthDiagnostic: number
  reducedMotionActive: boolean
  onEffectiveDepthDiagnosticChange: (value: number) => void
  onLoadingStateChange: (state: DepthLabLoadingState) => void
}

function DepthLabShell({
  settings,
  status,
  onEnvironmentChange,
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
  onEffectiveDepthDiagnosticChange,
  onLoadingStateChange,
}: DepthLabShellProps) {
  return (
    <main className="depth-lab">
      <div className="depth-lab__viewport" aria-hidden="true">
        {settings.environment === 'beach-panorama' ? (
          <BeachPanoramaScene
            key="beach-panorama"
            playbackState={settings.playbackState}
            motionIntensity={settings.motionIntensity}
            depthStrength={settings.depthStrength}
            minimumBreathingDepth={settings.minimumBreathingDepth}
            maximumBreathingDepth={settings.maximumBreathingDepth}
            breathingCycleDurationSeconds={settings.breathingCycleDurationSeconds}
            pointerParallaxEnabled={settings.pointerParallaxEnabled}
            autoMotionEnabled={settings.autoMotionEnabled}
            onEffectiveDepthDiagnosticChange={onEffectiveDepthDiagnosticChange}
            onLoadingStateChange={onLoadingStateChange}
          />
        ) : (
          <JungleDepthScene
            key="jungle-depth"
            playbackState={settings.playbackState}
            motionIntensity={settings.motionIntensity}
            depthStrength={settings.depthStrength}
            minimumBreathingDepth={settings.minimumBreathingDepth}
            maximumBreathingDepth={settings.maximumBreathingDepth}
            breathingCycleDurationSeconds={settings.breathingCycleDurationSeconds}
            pointerParallaxEnabled={settings.pointerParallaxEnabled}
            autoMotionEnabled={settings.autoMotionEnabled}
            onEffectiveDepthDiagnosticChange={onEffectiveDepthDiagnosticChange}
            onLoadingStateChange={onLoadingStateChange}
          />
        )}
      </div>

      <DepthLabOverlay status={status}>
        <DepthLabControls
          settings={settings}
          onEnvironmentChange={onEnvironmentChange}
          onPlaybackStateChange={onPlaybackStateChange}
          onMotionIntensityChange={onMotionIntensityChange}
          onDepthStrengthChange={onDepthStrengthChange}
          onMinimumBreathingDepthChange={onMinimumBreathingDepthChange}
          onMaximumBreathingDepthChange={onMaximumBreathingDepthChange}
          onBreathingCycleDurationChange={onBreathingCycleDurationChange}
          onPointerParallaxChange={onPointerParallaxChange}
          onAutoMotionChange={onAutoMotionChange}
          effectiveDepthDiagnostic={effectiveDepthDiagnostic}
          reducedMotionActive={reducedMotionActive}
        />
      </DepthLabOverlay>
    </main>
  )
}

export default DepthLabShell
