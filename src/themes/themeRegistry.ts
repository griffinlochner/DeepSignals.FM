import type { ThemeDefinition } from "./themeTypes";
import CosmicNexusDefinition from "./cosmic-nexus";
import { imageDepthThemeDefinitions } from "./image-depth/imageDepthThemeDefinitions";
import MinimalDefinition from "./minimal";
import NeonHyperRacerDefinition from "./neon-hyper-racer";
import SignalRunnerDefinition from "./signal-runner";
import CosmicRollerCoasterDefinition from "./cosmic-roller-coaster";

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  CosmicNexusDefinition,
  NeonHyperRacerDefinition,
  SignalRunnerDefinition,
  CosmicRollerCoasterDefinition,
  ...imageDepthThemeDefinitions,
];

export const defaultThemeId = "minimal" as const;
