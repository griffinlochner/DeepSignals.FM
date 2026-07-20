import EnvironmentLabControls from "./components/EnvironmentLabControls";
import EnvironmentLabOverlay from "./components/EnvironmentLabOverlay";
import EnvironmentLabScene from "./scenes/EnvironmentLabScene";
import type {
  EnvironmentDiagnostics,
  EnvironmentLoadingState,
  EnvironmentPlaybackState,
  EnvironmentPreset,
} from "./types";
import "./environmentLab.css";

type EnvironmentLabShellProps = {
  playbackState: EnvironmentPlaybackState;
  twinklePlacementModeEnabled: boolean;
  surfaceGlowPlacementModeEnabled: boolean;
  preset: EnvironmentPreset;
  reducedMotionActive: boolean;
  status: string;
  diagnostics: EnvironmentDiagnostics;
  importText: string;
  feedbackMessage: string;
  feedbackTone: "idle" | "success" | "error";
  onPlaybackStateChange: (value: EnvironmentPlaybackState) => void;
  onTwinklePlacementModeChange: (enabled: boolean) => void;
  onSurfaceGlowPlacementModeChange: (enabled: boolean) => void;
  onPresetChange: (next: EnvironmentPreset) => void;
  onCreateTwinkleHotspot: (u: number, v: number, phase: number) => void;
  onRemoveNearestTwinkleHotspot: (u: number, v: number) => void;
  onCreateSurfaceGlowHotspot: (u: number, v: number, phase: number) => void;
  onRemoveNearestSurfaceGlowHotspot: (u: number, v: number) => void;
  onClearHotspots: () => void;
  onRandomizeHotspotPhases: () => void;
  onClearSurfaceGlowHotspots: () => void;
  onRandomizeSurfaceGlowPhases: () => void;
  onResetPreset: () => void;
  onCopyPresetJson: () => void;
  onImportTextChange: (value: string) => void;
  onApplyImportedPreset: () => void;
  onDiagnosticsChange: (diagnostics: EnvironmentDiagnostics) => void;
  onLoadingStateChange: (state: EnvironmentLoadingState) => void;
};

function EnvironmentLabShell({
  playbackState,
  twinklePlacementModeEnabled,
  surfaceGlowPlacementModeEnabled,
  preset,
  reducedMotionActive,
  status,
  diagnostics,
  importText,
  feedbackMessage,
  feedbackTone,
  onPlaybackStateChange,
  onTwinklePlacementModeChange,
  onSurfaceGlowPlacementModeChange,
  onPresetChange,
  onCreateTwinkleHotspot,
  onRemoveNearestTwinkleHotspot,
  onCreateSurfaceGlowHotspot,
  onRemoveNearestSurfaceGlowHotspot,
  onClearHotspots,
  onRandomizeHotspotPhases,
  onClearSurfaceGlowHotspots,
  onRandomizeSurfaceGlowPhases,
  onResetPreset,
  onCopyPresetJson,
  onImportTextChange,
  onApplyImportedPreset,
  onDiagnosticsChange,
  onLoadingStateChange,
}: EnvironmentLabShellProps) {
  return (
    <main className="environment-lab">
      <div className="environment-lab__viewport" aria-hidden="true">
        <EnvironmentLabScene
          playbackState={playbackState}
          twinklePlacementModeEnabled={twinklePlacementModeEnabled}
          surfaceGlowPlacementModeEnabled={surfaceGlowPlacementModeEnabled}
          preset={preset}
          reducedMotionActive={reducedMotionActive}
          onCreateTwinkleHotspot={onCreateTwinkleHotspot}
          onRemoveNearestTwinkleHotspot={onRemoveNearestTwinkleHotspot}
          onCreateSurfaceGlowHotspot={onCreateSurfaceGlowHotspot}
          onRemoveNearestSurfaceGlowHotspot={onRemoveNearestSurfaceGlowHotspot}
          onDiagnosticsChange={onDiagnosticsChange}
          onLoadingStateChange={onLoadingStateChange}
        />
      </div>

      <EnvironmentLabOverlay status={status}>
        <div className="environment-lab__panel-scroll">
          <EnvironmentLabControls
            playbackState={playbackState}
            preset={preset}
            reducedMotionActive={reducedMotionActive}
            diagnostics={diagnostics}
            twinklePlacementModeEnabled={twinklePlacementModeEnabled}
            surfaceGlowPlacementModeEnabled={surfaceGlowPlacementModeEnabled}
            importText={importText}
            feedbackMessage={feedbackMessage}
            feedbackTone={feedbackTone}
            onPlaybackStateChange={onPlaybackStateChange}
            onPresetChange={onPresetChange}
            onTwinklePlacementModeChange={onTwinklePlacementModeChange}
            onSurfaceGlowPlacementModeChange={onSurfaceGlowPlacementModeChange}
            onClearHotspots={onClearHotspots}
            onRandomizeHotspotPhases={onRandomizeHotspotPhases}
            onClearSurfaceGlowHotspots={onClearSurfaceGlowHotspots}
            onRandomizeSurfaceGlowPhases={onRandomizeSurfaceGlowPhases}
            onResetPreset={onResetPreset}
            onCopyPresetJson={onCopyPresetJson}
            onImportTextChange={onImportTextChange}
            onApplyImportedPreset={onApplyImportedPreset}
          />
        </div>
      </EnvironmentLabOverlay>
    </main>
  );
}

export default EnvironmentLabShell;
