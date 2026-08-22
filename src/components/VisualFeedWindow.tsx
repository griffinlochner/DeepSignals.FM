import { useEffect, useId, useState, type ComponentType } from 'react'
import './visualFeedWindow.css'
import { publicAssetUrl } from '../app/publicAssetUrl'
import type { AudioReactiveSnapshot, AudioSource } from '../app/playerTypes'
import type { TrackSignalMetadata } from '../app/trackSignalMetadata'
import { useTrackSignalMetadata } from '../app/useTrackSignalMetadata'
import type { ThemeVisualFeedFrameProps } from '../themes/themeTypes'

const BRAND_FALLBACK_ARTWORK_URL = publicAssetUrl('/branding/deepsignals-logo-square.png')

type VisualFeedWindowProps = {
  open: boolean
  dockMode: 'right' | 'bottom'
  onClose: () => void
  selectedTrackSource: AudioSource | null
  metadataOverride?: TrackSignalMetadata | null
  audioSnapshot?: AudioReactiveSnapshot
  getLatestSnapshot?: () => AudioReactiveSnapshot
  analysisStatus?: string
  playbackStatus?: string
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
  metadataOverride,
  audioSnapshot,
  getLatestSnapshot,
  Frame,
  className,
}: VisualFeedWindowProps) {
  const contentId = useId()
  const [failedArtworkUrls, setFailedArtworkUrls] = useState<Set<string>>(() => new Set())
  const [liveSnapshot, setLiveSnapshot] = useState(audioSnapshot)
  const FrameComponent = Frame ?? DefaultFrame
  const { status, metadata } = useTrackSignalMetadata(selectedTrackSource)

  useEffect(() => {
    if (!open || !getLatestSnapshot) {
      return
    }

    const publish = () => setLiveSnapshot(getLatestSnapshot())
    publish()
    const intervalHandle = window.setInterval(publish, 100)

    return () => window.clearInterval(intervalHandle)
  }, [getLatestSnapshot, open])

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
    metadataOverride?.title ||
    metadata?.title ||
    selectedTrackSource?.title ||
    selectedTrackSource?.displayName ||
    'Signal source unavailable'
  const artworkUrl = [
    metadataOverride?.artworkUrl,
    metadata?.artworkUrl,
    selectedTrackSource?.artworkUrl,
    BRAND_FALLBACK_ARTWORK_URL,
  ].find((candidate) => candidate && !failedArtworkUrls.has(candidate)) ?? null
  const isBrandFallback = artworkUrl === BRAND_FALLBACK_ARTWORK_URL
  const isLoading = status === 'loading'
  const fallbackLabel = isLoading
    ? `Loading cover artwork for ${resolvedTitle}`
    : `Cover artwork unavailable for ${resolvedTitle}`
  const externalSourceUrl =
    selectedTrackSource?.kind === 'live-stream'
      ? selectedTrackSource.sourceUrl
      : undefined
  const artworkImage = artworkUrl ? (
    <img
      className={[
        'visual-feed-window__artwork',
        selectedTrackSource?.kind === 'live-stream' && !isBrandFallback
          ? 'visual-feed-window__artwork--live-station'
          : '',
      ].filter(Boolean).join(' ')}
      src={artworkUrl}
      alt={isBrandFallback ? 'DeepSignals.FM' : `Cover artwork for ${resolvedTitle}`}
      onError={() => {
        setFailedArtworkUrls((current) => new Set(current).add(artworkUrl))
      }}
    />
  ) : null

  return (
    <section
      className={['visual-feed-window', `visual-feed-window--dock-${dockMode}`, className].filter(Boolean).join(' ')}
      aria-label="Signal info panel"
      data-stage="open"
      aria-hidden="false"
    >
      <header className="visual-feed-window__header">
        <p className="visual-feed-window__title">SIGNAL INFO</p>
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
          aria-label="Close signal info"
          title="Close signal info"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="visual-feed-window__body" id={contentId}>
        <FrameComponent>
          <div className="visual-feed-window__viewport" aria-label="Signal artwork">
            <div className="visual-feed-window__artwork-shell">
              {artworkImage && externalSourceUrl ? (
                <a
                  className="visual-feed-window__artwork-link"
                  href={externalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${resolvedTitle}`}
                  title={`Visit ${resolvedTitle}`}
                >
                  {artworkImage}
                </a>
              ) : artworkImage ? (
                artworkImage
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
          <div className="visual-feed-window__details">
            {externalSourceUrl ? (
              <a className="visual-feed-window__source-link" href={externalSourceUrl} target="_blank" rel="noopener noreferrer">
                Open source <span aria-hidden="true">↗</span>
              </a>
            ) : null}
            <section className="visual-feed-window__meters" aria-label="Signal levels">
              {[
                ['Energy', liveSnapshot?.energy ?? 0],
                ['Bass', liveSnapshot?.bass ?? 0],
                ['Kick', liveSnapshot?.kickPulse ?? 0],
                ['Mids', liveSnapshot?.mids ?? 0],
                ['Highs', liveSnapshot?.highs ?? 0],
              ].map(([label, value]) => {
                const normalized = Math.min(1, Math.max(0, Number(value) || 0))
                return (
                  <div className="visual-feed-window__meter" key={label as string}>
                    <span>{label}</span>
                    <span className="visual-feed-window__meter-track" aria-hidden="true">
                      <span style={{ width: `${normalized * 100}%` }} />
                    </span>
                    <span>{normalized.toFixed(3)}</span>
                  </div>
                )
              })}
            </section>
          </div>
        </FrameComponent>
      </div>
    </section>
  )
}

export default VisualFeedWindow
