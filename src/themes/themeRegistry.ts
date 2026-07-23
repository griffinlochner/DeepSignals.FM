import type { ThemeDefinition } from "./themeTypes";
import AnalogSignalLaboratoryDefinition from "./analog-signal-laboratory";
import BioluminescentPsyForestDefinition from "./bioluminescent-psy-forest";
import BioluminescentPsyReefDefinition from "./bioluminescent-psy-reef";
import CosmicNexusDefinition from "./cosmic-nexus";
import CrystalCavernDefinition from "./crystal-cavern";
import FemaleDj1Definition from "./female-dj-1";
import FemaleDj2Definition from "./female-dj-2";
import MinimalDefinition from "./minimal";
import SlimeCavernDefinition from "./slime-cavern";
import UvReactiveJungleDefinition from "./uv-reactive-jungle";

export const themeRegistry: ThemeDefinition[] = [
  MinimalDefinition,
  CosmicNexusDefinition,
  UvReactiveJungleDefinition,
  AnalogSignalLaboratoryDefinition,
  BioluminescentPsyForestDefinition,
  BioluminescentPsyReefDefinition,
  CrystalCavernDefinition,
  SlimeCavernDefinition,
  FemaleDj1Definition,
  FemaleDj2Definition,
];

export const defaultThemeId = "minimal" as const;
