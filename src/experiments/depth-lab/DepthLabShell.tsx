import DepthLabControls from "./components/DepthLabControls";
import DepthLabOverlay from "./components/DepthLabOverlay";
import JungleDepthScene from "./scenes/JungleDepthScene";
import type {
  DepthLabLoadingState,
  DepthLabPlaybackState,
  DepthLabSettings,
} from "./types";
import "./depthLab.css";

type DepthLabShellProps = {
  settings: DepthLabSettings;
  status: string;
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
  onEffectiveDepthDiagnosticChange: (value: number) => void;
  onLoadingStateChange: (state: DepthLabLoadingState) => void;
};

function DepthLabShell({
  settings,
  status,
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
      </div>

      <DepthLabOverlay status={status}>
        <div className="depth-lab__panel-scroll">
          <DepthLabControls
            settings={settings}
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
        </div>
      </DepthLabOverlay>
    </main>
  );
}

export default DepthLabShell;
