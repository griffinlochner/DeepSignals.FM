import { useEffect, useId, type ComponentType } from 'react'
import './visualFeedWindow.css'
import type { ThemeVisualFeedFrameProps } from '../themes/themeTypes'

type VisualFeedWindowProps = {
  open: boolean
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

function VisualFeedWindow({ open, onClose, Frame, className }: VisualFeedWindowProps) {
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
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <section className={['visual-feed-window', className].filter(Boolean).join(' ')} aria-label="Visual feed panel">
      <header className="visual-feed-window__header">
        <p className="visual-feed-window__title">Visual Feed</p>
        <button
          type="button"
          className="visual-feed-window__close"
          onClick={onClose}
          aria-label="Close visual feed"
          title="Close visual feed"
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
