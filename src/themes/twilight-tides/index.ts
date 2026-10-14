import type { ThemeDefinition } from "../themeTypes";
import TwilightTidesTheme from "./TwilightTidesTheme";

const TwilightTidesDefinition: ThemeDefinition = {
  id: "twilight-tides",
  name: "Twilight Tides",
  description: "Twin suns, drifting clouds and sparse starlight over a psychedelic, music-responsive twilight ocean.",
  className: "theme-twilight-tides",
  performanceTier: "standard",
  Scene: TwilightTidesTheme,
  supportsChroma: true,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default TwilightTidesDefinition;
