import type { ThemeDefinition } from "./themeTypes";
import AnalogSignalLaboratoryDefinition from "./analog-signal-laboratory";
import BioluminescentPsyForestDefinition from "./bioluminescent-psy-forest";
import CosmicNexusDefinition from "./cosmic-nexus";
import MinimalDefinition from "./minimal";
import UvReactiveJungleDefinition from "./uv-reactive-jungle";

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  CosmicNexusDefinition,
  UvReactiveJungleDefinition,
  AnalogSignalLaboratoryDefinition,
  BioluminescentPsyForestDefinition,
];

export const defaultThemeId = "minimal" as const;
