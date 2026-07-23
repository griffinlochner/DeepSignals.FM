import type { ThemeDefinition } from "../themeTypes";
import SlimeCavernTheme from "./SlimeCavernTheme";

const SlimeCavernDefinition: ThemeDefinition = {
  id: "slime-cavern",
  name: "Slime Cavern",
  description:
    "Production image-depth slime cavern environment authored through the shared runtime.",
  className: "theme-slime-cavern",
  performanceTier: "enhanced",
  Scene: SlimeCavernTheme,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: true,
};

export default SlimeCavernDefinition;