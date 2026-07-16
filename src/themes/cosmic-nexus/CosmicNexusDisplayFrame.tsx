import type { ThemeDisplayFrameProps } from '../themeTypes'

function CosmicNexusDisplayFrame({ children, displayMode, isPlaying }: ThemeDisplayFrameProps) {
  return (
    <div
      className="cosmic-nexus-display-frame"
      data-display-mode={displayMode}
      data-playing={isPlaying ? 'true' : 'false'}
    >
      <div className="cosmic-nexus-display-frame__halo" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__grid" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__corner cosmic-nexus-display-frame__corner--top-left" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__corner cosmic-nexus-display-frame__corner--top-right" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__corner cosmic-nexus-display-frame__corner--bottom-left" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__corner cosmic-nexus-display-frame__corner--bottom-right" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__node cosmic-nexus-display-frame__node--left" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__node cosmic-nexus-display-frame__node--right" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__content">{children}</div>
      <div className="cosmic-nexus-display-frame__status" aria-hidden="true">
        <span>APERTURE // 07</span>
        <span>{isPlaying ? 'SIGNAL LOCKED' : 'PASSIVE SCAN'}</span>
      </div>
    </div>
  )
}

export default CosmicNexusDisplayFrame
