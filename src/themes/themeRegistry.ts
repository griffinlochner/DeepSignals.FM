import type { ThemeDefinition } from "./themeTypes";
import CosmicNexusDefinition from "./cosmic-nexus";
import { imageDepthThemeDefinitions } from "./image-depth/imageDepthThemeDefinitions";
import MinimalDefinition from "./minimal";
import NeonHyperRacerDefinition from "./neon-hyper-racer";
import SignalGradientDefinition from "./signal-gradient";
import SignalRainDefinition from "./signal-rain";
import SignalRunnerDefinition from "./signal-runner";
import CosmicRollerCoasterDefinition from "./cosmic-roller-coaster";
import SignalTunnelDefinition from "./signal-tunnel";

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  SignalGradientDefinition,
  SignalRainDefinition,
  CosmicNexusDefinition,
  NeonHyperRacerDefinition,
  SignalRunnerDefinition,
  CosmicRollerCoasterDefinition,
  SignalTunnelDefinition,
  ...imageDepthThemeDefinitions,
];

export const defaultThemeId = "minimal" as const;
