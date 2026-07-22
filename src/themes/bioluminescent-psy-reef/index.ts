import type { ThemeDefinition } from "../themeTypes";
import BioluminescentPsyReefTheme from "./BioluminescentPsyReefTheme";

const BioluminescentPsyReefDefinition: ThemeDefinition = {
  id: "bioluminescent-psy-reef",
  name: "Bioluminescent Psy Reef",
  description:
    "Production image-depth reef environment authored in the Environment Laboratory and promoted through the shared runtime.",
  className: "theme-bioluminescent-psy-reef",
  performanceTier: "enhanced",
  Scene: BioluminescentPsyReefTheme,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: true,
};

export default BioluminescentPsyReefDefinition;