import EnvironmentLabControls from "./components/EnvironmentLabControls";
import EnvironmentLabOverlay from "./components/EnvironmentLabOverlay";
import EnvironmentLabScene from "./scenes/EnvironmentLabScene";
import type {
  EnvironmentBehaviorPreset,
  EnvironmentDiagnostics,
  EnvironmentFramingMode,
  EnvironmentLoadingState,
  EnvironmentPlaybackState,
  ImageEnvironmentAsset,
  ImageEnvironmentScenePreset,
} from "./types";
import "./environmentLab.css";

type EnvironmentLabShellProps = {
  playbackState: EnvironmentPlaybackState;
  geometryMotionPreviewEnabled: boolean;
  surfaceGlowPlacementModeEnabled: boolean;
  selectedSurfaceGlowId: string | null;
  framingMode: EnvironmentFramingMode;
  surfaceGlowCapacityReached: boolean;
  scenePreset: ImageEnvironmentScenePreset;
  activeBehaviorPresetId: string | null;
  activeBehaviorStatusLabel: string;
  selectedScenePresetId: string;
  selectedScenePresetImported: boolean;
  baselineSceneName: string;
  baselineSceneId: string;
  sceneModified: boolean;
  reducedMotionActive: boolean;
  status: string;
  diagnostics: EnvironmentDiagnostics;
  importText: string;
  feedbackMessage: string;
  feedbackTone: "idle" | "success" | "error";
  loadingState: EnvironmentLoadingState;
  behaviorPresets: EnvironmentBehaviorPreset[];
  onPlaybackStateChange: (value: EnvironmentPlaybackState) => void;
  onGeometryMotionPreviewChange: (enabled: boolean) => void;
  onSurfaceGlowPlacementModeChange: (enabled: boolean) => void;
  onFramingModeChange: (mode: EnvironmentFramingMode) => void;
  onScenePresetChange: (next: ImageEnvironmentScenePreset) => void;
  onLoadBehaviorPreset: (presetId: string) => void;
  onLoadScenePreset: (presetId: string) => void;
  onAssetChange: (assetId: string) => void;
  onCreateSurfaceGlowHotspot: (u: number, v: number, phase: number) => void;
  onSelectSurfaceGlowHotspot: (id: string | null) => void;
  onSurfaceGlowCapacityReached: () => void;
  onRemoveNearestSurfaceGlowHotspot: (u: number, v: number) => void;
  onDeleteSelectedSurfaceGlowHotspot: () => void;
  onUndoLastSurfaceGlowHotspot: () => void;
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
  geometryMotionPreviewEnabled,
  surfaceGlowPlacementModeEnabled,
  selectedSurfaceGlowId,
  framingMode,
  surfaceGlowCapacityReached,
  scenePreset,
  activeBehaviorPresetId,
  activeBehaviorStatusLabel,
  selectedScenePresetId,
  selectedScenePresetImported,
  baselineSceneName,
  baselineSceneId,
  sceneModified,
  reducedMotionActive,
  status,
  diagnostics,
  importText,
  feedbackMessage,
  feedbackTone,
  loadingState,
  behaviorPresets,
  onPlaybackStateChange,
  onGeometryMotionPreviewChange,
  onSurfaceGlowPlacementModeChange,
  onFramingModeChange,
  onScenePresetChange,
  onLoadBehaviorPreset,
  onLoadScenePreset,
  onAssetChange,
  onCreateSurfaceGlowHotspot,
  onSelectSurfaceGlowHotspot,
  onSurfaceGlowCapacityReached,
  onRemoveNearestSurfaceGlowHotspot,
  onDeleteSelectedSurfaceGlowHotspot,
  onUndoLastSurfaceGlowHotspot,
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
          geometryMotionPreviewEnabled={geometryMotionPreviewEnabled}
          surfaceGlowPlacementModeEnabled={surfaceGlowPlacementModeEnabled}
          selectedSurfaceGlowId={selectedSurfaceGlowId}
          framingMode={framingMode}
          preset={scenePreset}
          asset={activeAsset}
          reducedMotionActive={reducedMotionActive}
          onCreateSurfaceGlowHotspot={onCreateSurfaceGlowHotspot}
          onSelectSurfaceGlowHotspot={onSelectSurfaceGlowHotspot}
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
            geometryMotionPreviewEnabled={geometryMotionPreviewEnabled}
            scenePreset={scenePreset}
            activeBehaviorPresetId={activeBehaviorPresetId}
            activeBehaviorStatusLabel={activeBehaviorStatusLabel}
            selectedScenePresetId={selectedScenePresetId}
            selectedScenePresetImported={selectedScenePresetImported}
            baselineSceneName={baselineSceneName}
            baselineSceneId={baselineSceneId}
            sceneModified={sceneModified}
            reducedMotionActive={reducedMotionActive}
            diagnostics={diagnostics}
            surfaceGlowPlacementModeEnabled={surfaceGlowPlacementModeEnabled}
            selectedSurfaceGlowId={selectedSurfaceGlowId}
            surfaceGlowCapacityReached={surfaceGlowCapacityReached}
            framingMode={framingMode}
            importText={importText}
            feedbackMessage={feedbackMessage}
            feedbackTone={feedbackTone}
            loadingState={loadingState}
            behaviorPresets={behaviorPresets}
            onPlaybackStateChange={onPlaybackStateChange}
            onGeometryMotionPreviewChange={onGeometryMotionPreviewChange}
            onScenePresetChange={onScenePresetChange}
            onLoadBehaviorPreset={onLoadBehaviorPreset}
            onLoadScenePreset={onLoadScenePreset}
            onAssetChange={onAssetChange}
            onSurfaceGlowPlacementModeChange={onSurfaceGlowPlacementModeChange}
            onFramingModeChange={onFramingModeChange}
            onDeleteSelectedSurfaceGlowHotspot={onDeleteSelectedSurfaceGlowHotspot}
            onUndoLastSurfaceGlowHotspot={onUndoLastSurfaceGlowHotspot}
            onSelectSurfaceGlowHotspot={onSelectSurfaceGlowHotspot}
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
