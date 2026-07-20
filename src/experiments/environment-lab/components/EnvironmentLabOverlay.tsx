import type { PropsWithChildren } from "react";

type EnvironmentLabOverlayProps = PropsWithChildren<{
  status: string;
}>;

function EnvironmentLabOverlay({ status, children }: EnvironmentLabOverlayProps) {
  return (
    <aside className="environment-lab__overlay">
      <p className="environment-lab__eyebrow">DEEPSIGNALS.FM ENVIRONMENT LABORATORY</p>
      <h1 className="environment-lab__title">
        Depth, motion, color, and atmospheric environment authoring
      </h1>
      <p className="environment-lab__caption">
        Tune reusable immersive environment presets with depth-image behavior plus
        atmospheric effects for future scene authoring.
      </p>
      {children}
      <p className="environment-lab__status">{status}</p>
    </aside>
  );
}

export default EnvironmentLabOverlay;
