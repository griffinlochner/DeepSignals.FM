import type { ThemeDefinition } from "../themeTypes";
import TwilightTidesTheme from "./TwilightTidesTheme";

const TwilightTidesDefinition: ThemeDefinition = {
  id: "twilight-tides",
  name: "Twilight Tides",
  description: "A quiet psychedelic twilight ocean with rippling reflections and gentle music-responsive light.",
  className: "theme-twilight-tides",
  performanceTier: "standard",
  Scene: TwilightTidesTheme,
  supportsChroma: true,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default TwilightTidesDefinition;
