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
  placementModeEnabled: boolean;
  preset: EnvironmentPreset;
  reducedMotionActive: boolean;
  status: string;
  diagnostics: EnvironmentDiagnostics;
  importText: string;
  feedbackMessage: string;
  feedbackTone: "idle" | "success" | "error";
  onPlaybackStateChange: (value: EnvironmentPlaybackState) => void;
  onPlacementModeChange: (enabled: boolean) => void;
  onPresetChange: (next: EnvironmentPreset) => void;
  onCreateHotspot: (u: number, v: number, phase: number) => void;
  onRemoveNearestHotspot: (u: number, v: number) => void;
  onClearHotspots: () => void;
  onRandomizeHotspotPhases: () => void;
  onResetPreset: () => void;
  onCopyPresetJson: () => void;
  onImportTextChange: (value: string) => void;
  onApplyImportedPreset: () => void;
  onDiagnosticsChange: (diagnostics: EnvironmentDiagnostics) => void;
  onLoadingStateChange: (state: EnvironmentLoadingState) => void;
};

function EnvironmentLabShell({
  playbackState,
  placementModeEnabled,
  preset,
  reducedMotionActive,
  status,
  diagnostics,
  importText,
  feedbackMessage,
  feedbackTone,
  onPlaybackStateChange,
  onPlacementModeChange,
  onPresetChange,
  onCreateHotspot,
  onRemoveNearestHotspot,
  onClearHotspots,
  onRandomizeHotspotPhases,
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
          placementModeEnabled={placementModeEnabled}
          preset={preset}
          reducedMotionActive={reducedMotionActive}
          onCreateHotspot={onCreateHotspot}
          onRemoveNearestHotspot={onRemoveNearestHotspot}
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
            placementModeEnabled={placementModeEnabled}
            importText={importText}
            feedbackMessage={feedbackMessage}
            feedbackTone={feedbackTone}
            onPlaybackStateChange={onPlaybackStateChange}
            onPresetChange={onPresetChange}
            onPlacementModeChange={onPlacementModeChange}
            onClearHotspots={onClearHotspots}
            onRandomizeHotspotPhases={onRandomizeHotspotPhases}
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
