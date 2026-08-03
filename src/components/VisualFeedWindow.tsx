import { useEffect, useId, type ComponentType } from 'react'
import './visualFeedWindow.css'
import type { ThemeVisualFeedFrameProps } from '../themes/themeTypes'

type VisualFeedWindowProps = {
  open: boolean
  dockMode: 'right' | 'bottom'
  onClose: () => void
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

function VisualFeedWindow({ open, dockMode, onClose, Frame, className }: VisualFeedWindowProps) {
  const contentId = useId()
  const FrameComponent = Frame ?? DefaultFrame

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
          <div className="visual-feed-window__viewport" role="img" aria-label="Video feed placeholder">
            <p>No video source configured.</p>
            <span>Attach a live capture endpoint to activate this feed.</span>
          </div>
        </FrameComponent>
      </div>
    </section>
  )
}

export default VisualFeedWindow
