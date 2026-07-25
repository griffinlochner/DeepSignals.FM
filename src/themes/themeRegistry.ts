import type { ThemeDefinition } from "./themeTypes";
import CosmicNexusDefinition from "./cosmic-nexus";
import { imageDepthThemeDefinitions } from "./image-depth/imageDepthThemeDefinitions";
import MinimalDefinition from "./minimal";

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  CosmicNexusDefinition,
  ...imageDepthThemeDefinitions,
];

export const defaultThemeId = "minimal" as const;
