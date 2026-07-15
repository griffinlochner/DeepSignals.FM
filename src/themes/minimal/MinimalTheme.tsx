import type { ThemeSceneProps } from '../themeTypes'
import './minimal.css'

function MinimalTheme({ reducedMotion }: ThemeSceneProps) {
  return (
    <div
      className="minimal-scene"
      aria-hidden="true"
      style={{
        pointerEvents: 'none',
      }}
    >
      <div className="minimal-scene__background" />
      <div className={`minimal-scene__grid ${reducedMotion ? 'reduced-motion' : ''}`} />
    </div>
  )
}

export default MinimalTheme
