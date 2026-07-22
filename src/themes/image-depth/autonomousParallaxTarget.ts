type AutonomousParallaxBehavior = "chill" | "fullon";

type AutonomousParallaxProfile = {
  circuitSeconds: number;
  horizontalExcursion: number;
  verticalExcursion: number;
};

const AUTONOMOUS_PARALLAX_PROFILES: Record<AutonomousParallaxBehavior, AutonomousParallaxProfile> = {
  chill: {
    circuitSeconds: 40,
    horizontalExcursion: 0.76,
    verticalExcursion: 0.28,
  },
  fullon: {
    circuitSeconds: 30,
    horizontalExcursion: 0.98,
    verticalExcursion: 0.38,
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
    Math.sin(phase) * 0.78 +
    Math.sin(phase * 2.1 + 1.04) * 0.17 +
    Math.cos(phase * 0.47 + 0.6) * 0.05;
  const normalizedY =
    Math.sin(phase * 0.82 + Math.PI * 0.5) * 0.62 +
    Math.sin(phase * 1.9 + 0.3) * 0.17 +
    Math.cos(phase * 0.55 + 0.18) * 0.05;

  const targetX = clamp(normalizedX, -1, 1) * profile.horizontalExcursion;
  const targetY = clamp(normalizedY, -1, 1) * profile.verticalExcursion;

  return {
    profile,
    targetX,
    targetY,
  };
}
