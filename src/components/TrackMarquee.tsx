import { useEffect, useLayoutEffect, useRef, useState } from 'react'

type TrackMarqueeProps = {
  isPlaying: boolean
  signalLabel: string | null
}

function TrackMarquee({ isPlaying, signalLabel }: TrackMarqueeProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLSpanElement | null>(null)
  const measureRef = useRef<HTMLSpanElement | null>(null)
  const [marqueeMode, setMarqueeMode] = useState<'fit' | 'scroll' | 'reduced'>('fit')
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

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const text = textRef.current
    const measureText = measureRef.current

    if (!viewport || !text || !measureText) {
      return
    }

    let cancelled = false
    let frameId = 0

    const measureOverflow = () => {
      if (cancelled) {
        return
      }

      const overflow = measureText.scrollWidth - viewport.clientWidth
      const shouldAnimate = !isReducedMotion && overflow > 2

      setMarqueeMode(shouldAnimate ? 'scroll' : 'fit')

      if (isReducedMotion && overflow > 2) {
        setMarqueeMode('reduced')
      }
    }

    const scheduleMeasurement = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        measureOverflow()
      })
    }

    scheduleMeasurement()

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleMeasurement) : null
    resizeObserver?.observe(viewport)
    window.addEventListener('resize', scheduleMeasurement)

    if (document.fonts?.ready) {
      void document.fonts.ready.then(scheduleMeasurement)
    }

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleMeasurement)
    }
  }, [content, isReducedMotion])

  return (
    <div className="track-marquee" role="status" aria-live="polite">
      <div className={`track-marquee__viewport${isReducedMotion ? ' track-marquee__viewport--reduced' : ''}`} ref={viewportRef}>
        {marqueeMode === 'scroll' ? (
          <div className="track-marquee__scroll">
            <span ref={textRef} className="track-marquee__text track-marquee__text--animated">
              {content}
            </span>
            <span className="track-marquee__text track-marquee__text--animated track-marquee__text--duplicate">{content}</span>
          </div>
        ) : (
          <span
            ref={textRef}
            className={`track-marquee__text${marqueeMode === 'reduced' ? ' track-marquee__text--reduced' : ' track-marquee__text--single'}`}
          >
            {content}
          </span>
        )}
      </div>
      <span ref={measureRef} className="track-marquee__measure" aria-hidden="true">
        {content}
      </span>
    </div>
  )
}

export default TrackMarquee
