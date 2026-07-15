type TrackMarqueeProps = {
  isPlaying: boolean
  signalLabel: string | null
}

function TrackMarquee({ isPlaying, signalLabel }: TrackMarqueeProps) {
  let content = 'NO ACTIVE TRANSMISSION'

  if (signalLabel) {
    if (isPlaying) {
      content = `DEEPSIGNALS TEST ARRAY — ${signalLabel.toUpperCase()}`
    } else {
      content = 'TEST SIGNAL READY'
    }
  }

  const shouldScroll = content.length > 40

  return (
    <div className="track-marquee" role="status" aria-live="polite">
      {shouldScroll ? (
        <div className="track-marquee__scroll">
          <span>{content}</span>
          <span>{content}</span>
        </div>
      ) : (
        <div className="track-marquee__static">{content}</div>
      )}
    </div>
  )
}

export default TrackMarquee
