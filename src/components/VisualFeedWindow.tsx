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
  const { status, metadata } = useTrackSignalMetadata(selectedTrackSource)

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
  const hasArtwork = Boolean(metadata?.artworkUrl)
  const isLoading = status === 'loading'
  const fallbackLabel = isLoading
    ? `Loading cover artwork for ${resolvedTitle}`
    : `Cover artwork unavailable for ${resolvedTitle}`

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
          <div className="visual-feed-window__viewport" aria-label="Signal feed artwork">
            <div className="visual-feed-window__artwork-shell">
              {hasArtwork ? (
                <img
                  className="visual-feed-window__artwork"
                  src={metadata?.artworkUrl}
                  alt={`Cover artwork for ${resolvedTitle}`}
                />
              ) : (
                <div
                  className="visual-feed-window__artwork-fallback"
                  role="img"
                  aria-label={fallbackLabel}
                >
                  <span className="visual-feed-window__artwork-fallback-grid" />
                </div>
              )}
            </div>
          </div>
        </FrameComponent>
      </div>
    </section>
  )
}

export default VisualFeedWindow
