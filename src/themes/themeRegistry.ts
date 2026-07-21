import type { ThemeDefinition } from "./themeTypes";
import AnalogSignalLaboratoryDefinition from "./analog-signal-laboratory";
import CosmicNexusDefinition from "./cosmic-nexus";
import MinimalDefinition from "./minimal";
import UvReactiveJungleDefinition from "./uv-reactive-jungle";

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  CosmicNexusDefinition,
  UvReactiveJungleDefinition,
  AnalogSignalLaboratoryDefinition,
];

export const defaultThemeId = "minimal" as const;
