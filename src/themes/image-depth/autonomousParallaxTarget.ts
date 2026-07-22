type AutonomousParallaxBehavior = "chill" | "fullon";

type AutonomousParallaxProfile = {
  circuitSeconds: number;
  excursion: number;
};

const AUTONOMOUS_PARALLAX_PROFILES: Record<AutonomousParallaxBehavior, AutonomousParallaxProfile> = {
  chill: {
    circuitSeconds: 40,
    excursion: 0.58,
  },
  fullon: {
    circuitSeconds: 30,
    excursion: 0.88,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function resolveAutonomousParallaxTarget(
  elapsedSeconds: number,
  behavior: AutonomousParallaxBehavior,
) {
  const profile = AUTONOMOUS_PARALLAX_PROFILES[behavior];
  const phase = (elapsedSeconds / profile.circuitSeconds) * Math.PI * 2;

  const normalizedX =
    Math.sin(phase) * 0.76 +
    Math.sin(phase * 2.1 + 1.04) * 0.18 +
    Math.cos(phase * 0.47 + 0.6) * 0.06;
  const normalizedY =
    Math.sin(phase * 0.82 + Math.PI * 0.5) * 0.74 +
    Math.sin(phase * 1.9 + 0.3) * 0.2 +
    Math.cos(phase * 0.55 + 0.18) * 0.06;

  const targetX = clamp(normalizedX, -1, 1) * profile.excursion;
  const targetY = clamp(normalizedY, -1, 1) * profile.excursion;

  return {
    profile,
    targetX,
    targetY,
  };
}
