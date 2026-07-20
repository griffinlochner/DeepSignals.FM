import EnvironmentLabControls from "./components/EnvironmentLabControls";
import EnvironmentLabOverlay from "./components/EnvironmentLabOverlay";
import EnvironmentLabScene from "./scenes/EnvironmentLabScene";
import type {
  EnvironmentDiagnostics,
  EnvironmentLoadingState,
  EnvironmentPlaybackState,
  ImageEnvironmentAsset,
  ImageEnvironmentPreset,
} from "./types";
import "./environmentLab.css";

type EnvironmentLabShellProps = {
  playbackState: EnvironmentPlaybackState;
  twinklePlacementModeEnabled: boolean;
  surfaceGlowPlacementModeEnabled: boolean;
  hazeMotionPreview4xEnabled: boolean;
  surfaceGlowCapacityReached: boolean;
  preset: ImageEnvironmentPreset;
  selectedBuiltinPresetId: string;
  reducedMotionActive: boolean;
  status: string;
  diagnostics: EnvironmentDiagnostics;
  importText: string;
  feedbackMessage: string;
  feedbackTone: "idle" | "success" | "error";
  onPlaybackStateChange: (value: EnvironmentPlaybackState) => void;
  onTwinklePlacementModeChange: (enabled: boolean) => void;
  onSurfaceGlowPlacementModeChange: (enabled: boolean) => void;
  onHazeMotionPreview4xChange: (enabled: boolean) => void;
  onPresetChange: (next: ImageEnvironmentPreset) => void;
  onLoadBuiltinPreset: (presetId: string) => void;
  onCreateTwinkleHotspot: (u: number, v: number, phase: number) => void;
  onRemoveNearestTwinkleHotspot: (u: number, v: number) => void;
  onCreateSurfaceGlowHotspot: (u: number, v: number, phase: number) => void;
  onSurfaceGlowCapacityReached: () => void;
  onRemoveNearestSurfaceGlowHotspot: (u: number, v: number) => void;
  onClearHotspots: () => void;
  onRandomizeHotspotPhases: () => void;
  onClearSurfaceGlowHotspots: () => void;
  onRandomizeSurfaceGlowPhases: () => void;
  onApplySurfaceGlowDefaultsToAll: () => void;
  onResetPreset: () => void;
  onCopyPresetJson: () => void;
  onImportTextChange: (value: string) => void;
  onApplyImportedPreset: () => void;
  onDiagnosticsChange: (diagnostics: EnvironmentDiagnostics) => void;
  onLoadingStateChange: (state: EnvironmentLoadingState) => void;
  sceneAsset: ImageEnvironmentAsset | null;
  fallbackAsset: ImageEnvironmentAsset | null;
};

function EnvironmentLabShell({
  playbackState,
  twinklePlacementModeEnabled,
  surfaceGlowPlacementModeEnabled,
  hazeMotionPreview4xEnabled,
  surfaceGlowCapacityReached,
  preset,
  selectedBuiltinPresetId,
  reducedMotionActive,
  status,
  diagnostics,
  importText,
  feedbackMessage,
  feedbackTone,
  onPlaybackStateChange,
  onTwinklePlacementModeChange,
  onSurfaceGlowPlacementModeChange,
  onHazeMotionPreview4xChange,
  onPresetChange,
  onLoadBuiltinPreset,
  onCreateTwinkleHotspot,
  onRemoveNearestTwinkleHotspot,
  onCreateSurfaceGlowHotspot,
  onSurfaceGlowCapacityReached,
  onRemoveNearestSurfaceGlowHotspot,
  onClearHotspots,
  onRandomizeHotspotPhases,
  onClearSurfaceGlowHotspots,
  onRandomizeSurfaceGlowPhases,
  onApplySurfaceGlowDefaultsToAll,
  onResetPreset,
  onCopyPresetJson,
  onImportTextChange,
  onApplyImportedPreset,
  onDiagnosticsChange,
  onLoadingStateChange,
  sceneAsset,
  fallbackAsset,
}: EnvironmentLabShellProps) {
  const activeAsset = sceneAsset ?? fallbackAsset;

  if (!activeAsset) {
    return null;
  }

  return (
    <main className="environment-lab">
      <div className="environment-lab__viewport" aria-hidden="true">
        <EnvironmentLabScene
          playbackState={playbackState}
          twinklePlacementModeEnabled={twinklePlacementModeEnabled}
          surfaceGlowPlacementModeEnabled={surfaceGlowPlacementModeEnabled}
          hazeMotionPreview4xEnabled={hazeMotionPreview4xEnabled}
          preset={preset}
          asset={activeAsset}
          reducedMotionActive={reducedMotionActive}
          onCreateTwinkleHotspot={onCreateTwinkleHotspot}
          onRemoveNearestTwinkleHotspot={onRemoveNearestTwinkleHotspot}
          onCreateSurfaceGlowHotspot={onCreateSurfaceGlowHotspot}
          onSurfaceGlowCapacityReached={onSurfaceGlowCapacityReached}
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
            hazeMotionPreview4xEnabled={hazeMotionPreview4xEnabled}
            surfaceGlowCapacityReached={surfaceGlowCapacityReached}
            selectedBuiltinPresetId={selectedBuiltinPresetId}
            importText={importText}
            feedbackMessage={feedbackMessage}
            feedbackTone={feedbackTone}
            onPlaybackStateChange={onPlaybackStateChange}
            onPresetChange={onPresetChange}
            onLoadBuiltinPreset={onLoadBuiltinPreset}
            onTwinklePlacementModeChange={onTwinklePlacementModeChange}
            onSurfaceGlowPlacementModeChange={onSurfaceGlowPlacementModeChange}
            onHazeMotionPreview4xChange={onHazeMotionPreview4xChange}
            onClearHotspots={onClearHotspots}
            onRandomizeHotspotPhases={onRandomizeHotspotPhases}
            onClearSurfaceGlowHotspots={onClearSurfaceGlowHotspots}
            onRandomizeSurfaceGlowPhases={onRandomizeSurfaceGlowPhases}
            onApplySurfaceGlowDefaultsToAll={onApplySurfaceGlowDefaultsToAll}
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
