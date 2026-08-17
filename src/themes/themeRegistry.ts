import type { ThemeDefinition } from "./themeTypes";
import CosmicNexusDefinition from "./cosmic-nexus";
import { imageDepthThemeDefinitions } from "./image-depth/imageDepthThemeDefinitions";
import MinimalDefinition from "./minimal";
import SignalRunnerDefinition from "./signal-runner";

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  CosmicNexusDefinition,
  SignalRunnerDefinition,
  ...imageDepthThemeDefinitions,
];

export const defaultThemeId = "minimal" as const;
