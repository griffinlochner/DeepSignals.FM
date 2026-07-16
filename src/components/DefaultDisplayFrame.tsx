import type { ThemeDisplayFrameProps } from '../themes/themeTypes'

function DefaultDisplayFrame({ children }: ThemeDisplayFrameProps) {
  return <div className="default-display-frame">{children}</div>
}

export default DefaultDisplayFrame
