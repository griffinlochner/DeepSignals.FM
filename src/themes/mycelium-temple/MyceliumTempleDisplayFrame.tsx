import type { ThemeDisplayFrameProps } from '../themeTypes'

function MyceliumTempleDisplayFrame({ children, displayMode, isPlaying }: ThemeDisplayFrameProps) {
  return (
    <div
      className="mycelium-temple-display-frame"
      data-display-mode={displayMode}
      data-playing={isPlaying ? 'true' : 'false'}
    >
      <div className="mycelium-temple-display-frame__aura" aria-hidden="true" />
      <div className="mycelium-temple-display-frame__root mycelium-temple-display-frame__root--top" aria-hidden="true" />
      <div className="mycelium-temple-display-frame__root mycelium-temple-display-frame__root--right" aria-hidden="true" />
      <div className="mycelium-temple-display-frame__root mycelium-temple-display-frame__root--bottom" aria-hidden="true" />
      <div className="mycelium-temple-display-frame__root mycelium-temple-display-frame__root--left" aria-hidden="true" />
      <div className="mycelium-temple-display-frame__vine mycelium-temple-display-frame__vine--left" aria-hidden="true" />
      <div className="mycelium-temple-display-frame__vine mycelium-temple-display-frame__vine--right" aria-hidden="true" />
      <div className="mycelium-temple-display-frame__bud mycelium-temple-display-frame__bud--top-left" aria-hidden="true" />
      <div className="mycelium-temple-display-frame__bud mycelium-temple-display-frame__bud--top-right" aria-hidden="true" />
      <div className="mycelium-temple-display-frame__bud mycelium-temple-display-frame__bud--bottom-left" aria-hidden="true" />
      <div className="mycelium-temple-display-frame__bud mycelium-temple-display-frame__bud--bottom-right" aria-hidden="true" />

      <div className="mycelium-temple-display-frame__membrane">
        <div className="mycelium-temple-display-frame__cellular" aria-hidden="true" />
        <div className="mycelium-temple-display-frame__ripple" aria-hidden="true" />
        <div className="mycelium-temple-display-frame__content">{children}</div>
      </div>

      <div className="mycelium-temple-display-frame__status" aria-hidden="true">
        <span>MYCELIAL GATE // 03</span>
        <span className="mycelium-temple-display-frame__state-label" />
      </div>
    </div>
  )
}

export default MyceliumTempleDisplayFrame
