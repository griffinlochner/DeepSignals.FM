import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

type MarqueeState = 'no-signal' | 'ready' | 'playing'

type TrackMarqueeProps = {
  signalLabel: string | null
  marqueeState: MarqueeState
}

// Pixels per second, so loop speed stays constant regardless of title length.
const SCROLL_SPEED: Record<MarqueeState, number> = {
  'no-signal': 16,
  ready: 22,
  playing: 29,
}

function TrackMarquee({ signalLabel, marqueeState }: TrackMarqueeProps) {
  const [isReducedMotion, setIsReducedMotion] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const [copy, setCopy] = useState<HTMLSpanElement | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [copyWidth, setCopyWidth] = useState(0)

  const content = useMemo(() => {
    if (!signalLabel) {
      return 'NO ACTIVE TRANSMISSION'
    }

    return signalLabel
  }, [signalLabel])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => {
      setIsReducedMotion(mediaQuery.matches)
    }

    updatePreference()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference)
      return () => mediaQuery.removeEventListener('change', updatePreference)
    }

    mediaQuery.addListener(updatePreference)
    return () => mediaQuery.removeListener(updatePreference)
  }, [])

  useLayoutEffect(() => {
    if (!viewport || !copy) {
      return
    }

    const measure = () => {
      setViewportWidth(viewport.getBoundingClientRect().width)
      setCopyWidth(copy.getBoundingClientRect().width)
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(copy)
    return () => observer.disconnect()
  }, [content, copy, viewport])

  const setCopyRef = useCallback((element: HTMLSpanElement | null) => {
    setCopy(element)
  }, [])

  // Enough copies that the tail always covers the viewport while the head slides
  // out, so there is never an empty frame at the loop boundary.
  const copyCount = copyWidth > 0 ? Math.max(2, Math.ceil(viewportWidth / copyWidth) + 1) : 2
  const duration = copyWidth > 0 ? copyWidth / SCROLL_SPEED[marqueeState] : 0
  const scrollStyle: CSSProperties = {
    // Translate by exactly one copy width (not a percentage of the whole strip) so
    // the loop stays seamless even when the copy count changes on resize.
    '--marquee-period': `${copyWidth}px`,
    '--marquee-duration': duration > 0 ? `${duration}s` : '0s',
  } as CSSProperties

  return (
    <div className="track-marquee" data-marquee-state={marqueeState} tabIndex={0}>
      <div
        ref={setViewport}
        className={`track-marquee__viewport${isReducedMotion ? ' track-marquee__viewport--reduced' : ''}`}
        aria-hidden="true"
      >
        {isReducedMotion ? (
          <span className="track-marquee__text track-marquee__text--reduced">{content}</span>
        ) : (
          <div
            // Remount on a genuinely new title so the animation restarts from zero
            // instead of continuing mid-cycle against a stale width.
            key={content}
            className="track-marquee__scroll"
            data-measured={copyWidth > 0 ? 'true' : 'false'}
            style={scrollStyle}
          >
            {Array.from({ length: copyCount }, (_, index) => (
              <span
                key={index}
                ref={index === 0 ? setCopyRef : undefined}
                className="track-marquee__text track-marquee__text--animated"
              >
                {content}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="track-marquee__live" aria-live="polite" aria-atomic="true">
        {content}
      </span>
    </div>
  )
}

export default TrackMarquee
