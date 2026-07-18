import type { PropsWithChildren } from 'react'

type DepthLabOverlayProps = PropsWithChildren<{
  status: string
}>

function DepthLabOverlay({ status, children }: DepthLabOverlayProps) {
  return (
    <aside className="depth-lab__overlay">
      <p className="depth-lab__eyebrow">DEEPSIGNALS.FM DEPTH LAB</p>
      <h1 className="depth-lab__title">Environment motion and immersion study</h1>
      <p className="depth-lab__caption">
        Compare conservative depth motion profiles for spherical panorama and displaced-image staging.
      </p>
      {children}
      <p className="depth-lab__status">{status}</p>
    </aside>
  )
}

export default DepthLabOverlay
