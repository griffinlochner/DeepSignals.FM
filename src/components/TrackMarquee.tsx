import { useEffect, useMemo, useState } from 'react'

type TrackMarqueeProps = {
  signalLabel: string | null
  marqueeState: 'no-signal' | 'ready' | 'playing'
}

function TrackMarquee({ signalLabel, marqueeState }: TrackMarqueeProps) {
  const [isReducedMotion, setIsReducedMotion] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  const content = useMemo(() => {
    if (!signalLabel) {
      return 'NO ACTIVE TRANSMISSION'
    }

    if (marqueeState === 'playing') {
      return `DEEPSIGNALS TEST ARRAY - ${signalLabel.toUpperCase()}`
    }

    return 'TEST SIGNAL READY'
  }, [marqueeState, signalLabel])

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

  return (
    <div className="track-marquee" data-marquee-state={marqueeState} tabIndex={0}>
      <div className={`track-marquee__viewport${isReducedMotion ? ' track-marquee__viewport--reduced' : ''}`} aria-hidden="true">
        {isReducedMotion ? (
          <span className="track-marquee__text track-marquee__text--reduced">{content}</span>
        ) : (
          <div className="track-marquee__scroll">
            <span className="track-marquee__text track-marquee__text--animated" aria-hidden="true">
              {content}
            </span>
            <span className="track-marquee__text track-marquee__text--animated track-marquee__text--duplicate" aria-hidden="true">
              {content}
            </span>
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
