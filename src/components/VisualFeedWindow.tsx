import { useEffect, useId, type ComponentType } from 'react'
import './visualFeedWindow.css'
import type { AudioSource } from '../app/playerTypes'
import { useTrackSignalMetadata } from '../app/useTrackSignalMetadata'
import type { ThemeVisualFeedFrameProps } from '../themes/themeTypes'

type VisualFeedWindowProps = {
  open: boolean
  dockMode: 'right' | 'bottom'
  onClose: () => void
  selectedTrackSource: AudioSource | null
  Frame?: ComponentType<ThemeVisualFeedFrameProps>
  className?: string
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.25 3.25L12.75 12.75" />
      <path d="M12.75 3.25L3.25 12.75" />
    </svg>
  )
}

function DefaultFrame({ children }: ThemeVisualFeedFrameProps) {
  return <>{children}</>
}

function VisualFeedWindow({
  open,
  dockMode,
  onClose,
  selectedTrackSource,
  Frame,
  className,
}: VisualFeedWindowProps) {
  const contentId = useId()
  const FrameComponent = Frame ?? DefaultFrame
  const { status, metadata, errorMessage } = useTrackSignalMetadata(selectedTrackSource)

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  const resolvedTitle =
    metadata?.title ||
    selectedTrackSource?.title ||
    selectedTrackSource?.displayName ||
    'Signal source unavailable'
  const resolvedArtist =
    metadata?.artist || selectedTrackSource?.artist || selectedTrackSource?.displayName
  const resolvedAlbum = metadata?.album
  const resolvedYear = metadata?.year
  const hasArtwork = Boolean(metadata?.artworkUrl)
  const isLoading = status === 'loading'
  const isUnsupportedSource = status === 'unsupported-source'
  const showEmbeddedUnavailable = status === 'error' && Boolean(errorMessage)

  return (
    <section
      className={['visual-feed-window', `visual-feed-window--dock-${dockMode}`, className].filter(Boolean).join(' ')}
      aria-label="Signal feed panel"
      data-stage="open"
      aria-hidden="false"
    >
      <header className="visual-feed-window__header">
        <p className="visual-feed-window__title">Signal Feed</p>
        <a
          className="visual-feed-window__about-link"
          href="/about/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="About DeepSignals.FM - opens in a new tab"
        >
          <span>About</span>
          <span aria-hidden="true">↗</span>
        </a>
        <button
          type="button"
          className="visual-feed-window__close"
          onClick={onClose}
          aria-label="Close signal feed"
          title="Close signal feed"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="visual-feed-window__body" id={contentId}>
        <FrameComponent>
          <div className="visual-feed-window__viewport" aria-label="Signal feed metadata">
            {isUnsupportedSource ? (
              <div className="visual-feed-window__neutral-placeholder" role="status">
                <p>Signal Feed metadata for live streams is coming soon.</p>
                <span>Select a local demo track to preview embedded MP3 data.</span>
              </div>
            ) : (
              <article className="visual-feed-window__track-card" aria-label="Current track metadata">
                <div className="visual-feed-window__artwork-shell">
                  {hasArtwork ? (
                    <img
                      className="visual-feed-window__artwork"
                      src={metadata?.artworkUrl}
                      alt={`Cover artwork for ${resolvedTitle}`}
                    />
                  ) : (
                    <div className="visual-feed-window__artwork-fallback" aria-hidden="true">
                      <span className="visual-feed-window__artwork-fallback-grid" />
                    </div>
                  )}
                </div>

                <div className="visual-feed-window__metadata-stack">
                  <p className="visual-feed-window__kicker">NOW RECEIVING</p>
                  {isLoading ? (
                    <p className="visual-feed-window__loading">ACQUIRING TRACK DATA...</p>
                  ) : null}

                  {resolvedArtist ? (
                    <p className="visual-feed-window__artist">{resolvedArtist}</p>
                  ) : null}
                  <p className="visual-feed-window__track-title">{resolvedTitle}</p>

                  {resolvedAlbum ? (
                    <p className="visual-feed-window__meta-row">
                      <span className="visual-feed-window__meta-label">Album</span>
                      <span className="visual-feed-window__meta-value">{resolvedAlbum}</span>
                    </p>
                  ) : null}

                  {resolvedYear ? (
                    <p className="visual-feed-window__meta-row">
                      <span className="visual-feed-window__meta-label">Year</span>
                      <span className="visual-feed-window__meta-value">{resolvedYear}</span>
                    </p>
                  ) : null}

                  {showEmbeddedUnavailable ? (
                    <p className="visual-feed-window__unavailable">EMBEDDED TRACK DATA UNAVAILABLE</p>
                  ) : null}
                </div>
              </article>
            )}
          </div>
        </FrameComponent>
      </div>
    </section>
  )
}

export default VisualFeedWindow
