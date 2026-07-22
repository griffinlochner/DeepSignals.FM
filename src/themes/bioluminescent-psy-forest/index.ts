import type { ThemeDefinition } from "../themeTypes";
import BioluminescentPsyForestTheme from "./BioluminescentPsyForestTheme";

const BioluminescentPsyForestDefinition: ThemeDefinition = {
  id: "bioluminescent-psy-forest",
  name: "Bioluminescent Psy Forest",
  description: "Production image-depth forest environment authored in the Environment Laboratory and promoted through the shared runtime.",
  className: "theme-bioluminescent-psy-forest",
  performanceTier: "enhanced",
  Scene: BioluminescentPsyForestTheme,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: true,
};

export default BioluminescentPsyForestDefinition;