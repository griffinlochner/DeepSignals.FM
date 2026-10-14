import type { ThemeDefinition } from "../themeTypes";
import TwilightTidesTheme from "./TwilightTidesTheme";

const TwilightTidesDefinition: ThemeDefinition = {
  id: "twilight-tides",
  name: "Twilight Tides",
  description: "Musical aurora ribbons, twin suns and drifting clouds over a psychedelic twilight ocean.",
  className: "theme-twilight-tides",
  performanceTier: "standard",
  Scene: TwilightTidesTheme,
  supportsChroma: true,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default TwilightTidesDefinition;
