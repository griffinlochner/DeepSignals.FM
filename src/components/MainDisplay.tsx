import type { PlaybackState } from '../app/playerTypes'
import DefaultDisplayFrame from './DefaultDisplayFrame'

type MainDisplayProps = {
  isPlaying: PlaybackState | boolean
  signalLabel: string | null
  displayMode: 'standby'
}

function MainDisplay({ isPlaying, signalLabel, displayMode }: MainDisplayProps) {
  let headline = 'NO ACTIVE TRANSMISSION'
  let subheading = 'AWAITING SIGNAL SOURCE'

  if (signalLabel) {
    if (isPlaying) {
      headline = 'RECEIVING TEST TRANSMISSION'
      subheading = signalLabel
    } else {
      headline = 'SIGNAL READY'
      subheading = 'PRESS PLAY TO CONNECT'
    }
  }

  if (displayMode === 'standby') {
    return (
      <DefaultDisplayFrame displayMode={displayMode}>
        <div className="main-display__content">
          <p className="main-display__headline">{headline}</p>
          <h2 className="main-display__subheading">{subheading}</h2>
        </div>
      </DefaultDisplayFrame>
    )
  }

  return <DefaultDisplayFrame displayMode={displayMode}><div /></DefaultDisplayFrame>
}

export default MainDisplay
