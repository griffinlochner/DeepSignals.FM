import EnvironmentLabControls from "./components/EnvironmentLabControls";
import EnvironmentLabOverlay from "./components/EnvironmentLabOverlay";
import EnvironmentLabScene from "./scenes/EnvironmentLabScene";
import type {
  EnvironmentBehaviorPreset,
  EnvironmentDiagnostics,
  EnvironmentLoadingState,
  EnvironmentPlaybackState,
  ImageEnvironmentAsset,
  ImageEnvironmentScenePreset,
} from "./types";
import "./environmentLab.css";

type EnvironmentLabShellProps = {
  playbackState: EnvironmentPlaybackState;
  surfaceGlowPlacementModeEnabled: boolean;
  surfaceGlowCapacityReached: boolean;
  scenePreset: ImageEnvironmentScenePreset;
  activeBehaviorPresetId: string | null;
  activeBehaviorStatusLabel: string;
  selectedScenePresetId: string;
  baselineSceneName: string;
  baselineSceneId: string;
  sceneModified: boolean;
  reducedMotionActive: boolean;
  status: string;
  diagnostics: EnvironmentDiagnostics;
  importText: string;
  feedbackMessage: string;
  feedbackTone: "idle" | "success" | "error";
  behaviorPresets: EnvironmentBehaviorPreset[];
  onPlaybackStateChange: (value: EnvironmentPlaybackState) => void;
  onSurfaceGlowPlacementModeChange: (enabled: boolean) => void;
  onScenePresetChange: (next: ImageEnvironmentScenePreset) => void;
  onLoadBehaviorPreset: (presetId: string) => void;
  onLoadScenePreset: (presetId: string) => void;
  onAssetChange: (assetId: string) => void;
  onCreateSurfaceGlowHotspot: (u: number, v: number, phase: number) => void;
  onSurfaceGlowCapacityReached: () => void;
  onRemoveNearestSurfaceGlowHotspot: (u: number, v: number) => void;
  onClearSurfaceGlowHotspots: () => void;
  onRandomizeSurfaceGlowPhases: () => void;
  onApplySurfaceGlowDefaultsToAll: () => void;
  onResetScene: () => void;
  onCopySceneJson: () => void;
  onCopyProductionSceneJson: () => void;
  onImportTextChange: (value: string) => void;
  onApplyImportedScene: () => void;
  onDiagnosticsChange: (diagnostics: EnvironmentDiagnostics) => void;
  onLoadingStateChange: (state: EnvironmentLoadingState) => void;
  sceneAsset: ImageEnvironmentAsset | null;
  fallbackAsset: ImageEnvironmentAsset | null;
  assets: ImageEnvironmentAsset[];
  scenePresets: ImageEnvironmentScenePreset[];
};

function EnvironmentLabShell({
  playbackState,
  surfaceGlowPlacementModeEnabled,
  surfaceGlowCapacityReached,
  scenePreset,
  activeBehaviorPresetId,
  activeBehaviorStatusLabel,
  selectedScenePresetId,
  baselineSceneName,
  baselineSceneId,
  sceneModified,
  reducedMotionActive,
  status,
  diagnostics,
  importText,
  feedbackMessage,
  feedbackTone,
  behaviorPresets,
  onPlaybackStateChange,
  onSurfaceGlowPlacementModeChange,
  onScenePresetChange,
  onLoadBehaviorPreset,
  onLoadScenePreset,
  onAssetChange,
  onCreateSurfaceGlowHotspot,
  onSurfaceGlowCapacityReached,
  onRemoveNearestSurfaceGlowHotspot,
  onClearSurfaceGlowHotspots,
  onRandomizeSurfaceGlowPhases,
  onApplySurfaceGlowDefaultsToAll,
  onResetScene,
  onCopySceneJson,
  onCopyProductionSceneJson,
  onImportTextChange,
  onApplyImportedScene,
  onDiagnosticsChange,
  onLoadingStateChange,
  sceneAsset,
  fallbackAsset,
  assets,
  scenePresets,
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
          surfaceGlowPlacementModeEnabled={surfaceGlowPlacementModeEnabled}
          preset={scenePreset}
          asset={activeAsset}
          reducedMotionActive={reducedMotionActive}
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
            scenePreset={scenePreset}
            activeBehaviorPresetId={activeBehaviorPresetId}
            activeBehaviorStatusLabel={activeBehaviorStatusLabel}
            selectedScenePresetId={selectedScenePresetId}
            baselineSceneName={baselineSceneName}
            baselineSceneId={baselineSceneId}
            sceneModified={sceneModified}
            reducedMotionActive={reducedMotionActive}
            diagnostics={diagnostics}
            surfaceGlowPlacementModeEnabled={surfaceGlowPlacementModeEnabled}
            surfaceGlowCapacityReached={surfaceGlowCapacityReached}
            importText={importText}
            feedbackMessage={feedbackMessage}
            feedbackTone={feedbackTone}
            behaviorPresets={behaviorPresets}
            onPlaybackStateChange={onPlaybackStateChange}
            onScenePresetChange={onScenePresetChange}
            onLoadBehaviorPreset={onLoadBehaviorPreset}
            onLoadScenePreset={onLoadScenePreset}
            onAssetChange={onAssetChange}
            onSurfaceGlowPlacementModeChange={onSurfaceGlowPlacementModeChange}
            onClearSurfaceGlowHotspots={onClearSurfaceGlowHotspots}
            onRandomizeSurfaceGlowPhases={onRandomizeSurfaceGlowPhases}
            onApplySurfaceGlowDefaultsToAll={onApplySurfaceGlowDefaultsToAll}
            onResetScene={onResetScene}
            onCopySceneJson={onCopySceneJson}
            onCopyProductionSceneJson={onCopyProductionSceneJson}
            onImportTextChange={onImportTextChange}
            onApplyImportedScene={onApplyImportedScene}
            assets={assets}
            scenePresets={scenePresets}
          />
        </div>
      </EnvironmentLabOverlay>
    </main>
  );
}

export default EnvironmentLabShell;
