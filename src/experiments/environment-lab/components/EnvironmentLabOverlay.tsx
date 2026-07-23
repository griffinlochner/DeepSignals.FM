import type { PropsWithChildren } from "react";

type EnvironmentLabOverlayProps = PropsWithChildren<{
  status: string;
}>;

function EnvironmentLabOverlay({ status, children }: EnvironmentLabOverlayProps) {
  return (
    <aside className="environment-lab__overlay">
      <p className="environment-lab__eyebrow">DEEPSIGNALS.FM ENVIRONMENT LABORATORY</p>
      <h1 className="environment-lab__title">Environment artwork and Glow Dot authoring</h1>
      <p className="environment-lab__caption">
        Build production-ready image environments with shared framing, behavior preview, and
        image-relative Glow Dot placement.
      </p>
      {children}
      <p className="environment-lab__status">{status}</p>
    </aside>
  );
}

export default EnvironmentLabOverlay;
