import { useEffect, useRef, useState } from 'react'

type TrackMarqueeProps = {
  isPlaying: boolean
  signalLabel: string | null
}

function TrackMarquee({ isPlaying, signalLabel }: TrackMarqueeProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLSpanElement | null>(null)
  const [shouldScroll, setShouldScroll] = useState(false)
  const [isReducedMotion, setIsReducedMotion] = useState(false)

  let content = 'NO ACTIVE TRANSMISSION'

  if (signalLabel) {
    if (isPlaying) {
      content = `DEEPSIGNALS TEST ARRAY — ${signalLabel.toUpperCase()}`
    } else {
      content = 'TEST SIGNAL READY'
    }
  }

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

  useEffect(() => {
    const viewport = viewportRef.current
    const text = textRef.current

    if (!viewport || !text) {
      return
    }

    const measureOverflow = () => {
      setShouldScroll(!isReducedMotion && text.scrollWidth > viewport.clientWidth)
    }

    const frameId = window.requestAnimationFrame(measureOverflow)
    const resizeObserver = new ResizeObserver(measureOverflow)
    resizeObserver.observe(viewport)
    window.addEventListener('resize', measureOverflow)

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', measureOverflow)
    }
  }, [content, isReducedMotion])

  return (
    <div className="track-marquee" role="status" aria-live="polite">
      <div className={`track-marquee__viewport${isReducedMotion ? ' track-marquee__viewport--reduced' : ''}`} ref={viewportRef}>
        {shouldScroll && !isReducedMotion ? (
          <div className="track-marquee__scroll">
            <span ref={textRef} className="track-marquee__text">
              {content}
            </span>
            <span className="track-marquee__text track-marquee__text--duplicate">{content}</span>
          </div>
        ) : (
          <span ref={textRef} className={`track-marquee__text${isReducedMotion ? ' track-marquee__text--reduced' : ''}`}>
            {content}
          </span>
        )}
      </div>
    </div>
  )
}

export default TrackMarquee
