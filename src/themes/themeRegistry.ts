import type { ThemeDefinition } from "./themeTypes";
import CosmicNexusDefinition from "./cosmic-nexus";
import MinimalDefinition from "./minimal";
import UvReactiveJungleDefinition from "./uv-reactive-jungle";

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  CosmicNexusDefinition,
  UvReactiveJungleDefinition,
];

export const defaultThemeId = "minimal" as const;
