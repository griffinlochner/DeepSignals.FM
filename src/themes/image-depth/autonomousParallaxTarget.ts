type AutonomousParallaxBehavior = "chill" | "fullon";

type AutonomousParallaxProfile = {
  circuitSeconds: number;
  horizontalExcursion: number;
  verticalExcursion: number;
};

const AUTONOMOUS_PARALLAX_PROFILES: Record<AutonomousParallaxBehavior, AutonomousParallaxProfile> = {
  chill: {
    circuitSeconds: 40,
    horizontalExcursion: 0.88,
    verticalExcursion: 0.24,
  },
  fullon: {
    circuitSeconds: 30,
    horizontalExcursion: 1,
    verticalExcursion: 0.33,
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

  // Dominant full-range horizontal sweep with subtle odd harmonics for organic motion.
  const normalizedX =
    Math.sin(phase) * 1.03 +
    Math.sin(phase * 3 + 0.3) * 0.07 +
    Math.sin(phase * 5 - 0.45) * 0.03;
  const normalizedY =
    Math.sin(phase * 0.84 + Math.PI * 0.52) * 0.74 +
    Math.sin(phase * 1.86 + 0.24) * 0.16 +
    Math.cos(phase * 0.58 + 0.2) * 0.05;

  const targetX = clamp(normalizedX, -1, 1) * profile.horizontalExcursion;
  const targetY = clamp(normalizedY, -1, 1) * profile.verticalExcursion;

  return {
    profile,
    targetX,
    targetY,
  };
}
