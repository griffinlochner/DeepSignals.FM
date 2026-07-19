import { useEffect } from 'react'
import FloatingPlayerPanel from '../../components/FloatingPlayerPanel'
import type { ThemePlayerOverlayProps } from '../themeTypes'

type CloseIconProps = {
  className?: string
}

function CloseIcon({ className }: CloseIconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.25 3.25L12.75 12.75" />
      <path d="M12.75 3.25L3.25 12.75" />
    </svg>
  )
}

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
  const visualFeedOpen = displayMode === 'video'

  useEffect(() => {
    if (!visualFeedOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDisplayModeChange('standby')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onDisplayModeChange, visualFeedOpen])

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
            <button
              type="button"
              className="uv-jungle-feed__close"
              onClick={() => onDisplayModeChange('standby')}
              aria-label="Close visual feed"
              title="Close visual feed"
            >
              <CloseIcon className="uv-jungle-feed__close-icon" />
            </button>
          </header>

          <div className="uv-jungle-feed__viewport" role="img" aria-label="Video feed placeholder">
            <p>No video source configured.</p>
            <span>Attach a live capture endpoint to activate this feed.</span>
          </div>
        </section>
      )}
    </>
  )
}

export default UvReactiveJunglePlayerPanel
