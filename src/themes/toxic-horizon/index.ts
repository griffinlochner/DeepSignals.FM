import type { ThemeDefinition } from "../themeTypes";
import ToxicHorizonTheme from "./ToxicHorizonTheme";

const ToxicHorizonDefinition: ThemeDefinition = {
  id: "toxic-horizon",
  name: "Toxic Horizon",
  description: "A neon slime ocean under a black alien sky, with toxic aurora and a magma volcano that erupts on SURGE.",
  className: "theme-toxic-horizon",
  performanceTier: "standard",
  Scene: ToxicHorizonTheme,
  supportsChroma: true,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default ToxicHorizonDefinition;
