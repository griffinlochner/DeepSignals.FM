import type { ThemeDefinition } from "./themeTypes";
import AnalogSignalLaboratoryDefinition from "./analog-signal-laboratory";
import BioluminescentPsyForestDefinition from "./bioluminescent-psy-forest";
import BioluminescentPsyReefDefinition from "./bioluminescent-psy-reef";
import CosmicNexusDefinition from "./cosmic-nexus";
import MinimalDefinition from "./minimal";
import UvReactiveJungleDefinition from "./uv-reactive-jungle";

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  CosmicNexusDefinition,
  UvReactiveJungleDefinition,
  AnalogSignalLaboratoryDefinition,
  BioluminescentPsyForestDefinition,
  BioluminescentPsyReefDefinition,
];

export const defaultThemeId = "minimal" as const;
