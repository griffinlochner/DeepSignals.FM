import type { ThemeDefinition } from "../themeTypes";
import CrystalCavernTheme from "./CrystalCavernTheme";

const CrystalCavernDefinition: ThemeDefinition = {
  id: "crystal-cavern",
  name: "Crystal Cavern",
  description:
    "Production image-depth crystal cavern environment authored through the shared runtime.",
  className: "theme-crystal-cavern",
  performanceTier: "enhanced",
  Scene: CrystalCavernTheme,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: true,
};

export default CrystalCavernDefinition;