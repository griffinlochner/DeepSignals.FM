import type { ThemeVisualFeedFrameProps } from '../themeTypes'
import './cosmicNexus.css'

function CosmicNexusVisualFeedFrame({ children }: ThemeVisualFeedFrameProps) {
  return (
    <div className="cosmic-nexus-display-frame cosmic-nexus-visual-feed-frame">
      <div className="cosmic-nexus-display-frame__halo" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__grid" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__scan-beam" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__corner cosmic-nexus-display-frame__corner--top-left" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__corner cosmic-nexus-display-frame__corner--top-right" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__corner cosmic-nexus-display-frame__corner--bottom-left" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__corner cosmic-nexus-display-frame__corner--bottom-right" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__node cosmic-nexus-display-frame__node--left" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__node cosmic-nexus-display-frame__node--right" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__node cosmic-nexus-display-frame__node--top" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__node cosmic-nexus-display-frame__node--bottom" aria-hidden="true" />
      <div className="cosmic-nexus-display-frame__content cosmic-nexus-visual-feed-frame__content">{children}</div>
    </div>
  )
}

export default CosmicNexusVisualFeedFrame
