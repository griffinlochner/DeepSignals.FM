import FloatingPlayerPanel from '../../components/FloatingPlayerPanel'
import type { ThemePlayerOverlayProps } from '../themeTypes'

function UvReactiveJunglePlayerPanel({
  selectedThemeId,
  selectedThemeName,
  themeOptions,
  selectedSignalId,
  signals,
  signalLabel,
  isPlaying,
  volume,
  motionEnabled,
  displayMode,
  onThemeChange,
  onSignalChange,
  onPlayToggle,
  onVolumeChange,
  onMotionToggle,
  onDisplayModeChange,
}: ThemePlayerOverlayProps) {
  const visualFeedOpen = displayMode === 'video' || displayMode === 'artwork'
  const feedExpanded = displayMode === 'video'

  return (
    <>
      <FloatingPlayerPanel
        environmentName={selectedThemeName}
        environmentOptions={themeOptions}
        selectedEnvironmentId={selectedThemeId}
        onEnvironmentChange={onThemeChange}
        signalOptions={signals}
        selectedSignalId={selectedSignalId}
        onSignalChange={onSignalChange}
        signalLabel={signalLabel}
        isPlaying={isPlaying}
        onPlayToggle={onPlayToggle}
        volume={volume}
        onVolumeChange={onVolumeChange}
        motionEnabled={motionEnabled}
        onMotionToggle={onMotionToggle}
        visualFeedOpen={visualFeedOpen}
        onVisualFeedChange={(enabled) => onDisplayModeChange(enabled ? 'video' : 'standby')}
      />

      {visualFeedOpen && (
        <section className="uv-jungle-feed" aria-label="Visual feed panel">
          <header className="uv-jungle-feed__header">
            <p>Visual Feed</p>
            <div className="uv-jungle-feed__actions">
              <button
                type="button"
                onClick={() => onDisplayModeChange('artwork')}
                className="uv-jungle-feed__action"
                aria-label="Collapse feed"
                disabled={!feedExpanded}
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={() => onDisplayModeChange('video')}
                className="uv-jungle-feed__action"
                aria-label="Expand feed"
                disabled={feedExpanded}
              >
                Expand
              </button>
              <button
                type="button"
                onClick={() => onDisplayModeChange('standby')}
                className="uv-jungle-feed__action"
                aria-label="Close feed"
              >
                Close
              </button>
            </div>
          </header>

          {feedExpanded ? (
            <div className="uv-jungle-feed__viewport" role="img" aria-label="Video feed placeholder">
              <p>No video source configured.</p>
              <span>Attach a live capture endpoint to activate this feed.</span>
            </div>
          ) : (
            <div className="uv-jungle-feed__collapsed">Feed collapsed</div>
          )}
        </section>
      )}
    </>
  )
}

export default UvReactiveJunglePlayerPanel
