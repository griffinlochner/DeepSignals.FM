import type { ComponentType } from 'react'
import type { PlaybackState } from '../app/playerTypes'
import type { MainDisplayMode, ThemeDisplayFrameProps } from '../themes/themeTypes'
import DefaultDisplayFrame from './DefaultDisplayFrame'

type MainDisplayProps = {
  isPlaying: PlaybackState | boolean
  signalLabel: string | null
  displayMode: MainDisplayMode
  DisplayFrame?: ComponentType<ThemeDisplayFrameProps>
}

function MainDisplay({ isPlaying, signalLabel, displayMode, DisplayFrame }: MainDisplayProps) {
  const playing = isPlaying === true || isPlaying === 'playing'
  const Frame = DisplayFrame ?? DefaultDisplayFrame

  let headline = 'NO ACTIVE TRANSMISSION'
  let subheading = 'AWAITING SIGNAL SOURCE'

  if (signalLabel) {
    if (playing) {
      headline = 'RECEIVING TEST TRANSMISSION'
      subheading = signalLabel
    } else {
      headline = 'SIGNAL READY'
      subheading = 'PRESS PLAY TO CONNECT'
    }
  }

  if (displayMode === 'standby') {
    return (
      <Frame displayMode={displayMode} isPlaying={playing}>
        <div className="main-display__content">
          <p className="main-display__headline">{headline}</p>
          <h2 className="main-display__subheading">{subheading}</h2>
        </div>
      </Frame>
    )
  }

  return (
    <Frame displayMode={displayMode} isPlaying={playing}>
      <div />
    </Frame>
  )
}

export default MainDisplay
