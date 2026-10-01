import type { ThemeDefinition } from "../themeTypes";
import AlienMegastructureTransitTheme from "./AlienMegastructureTransitTheme";

const AlienMegastructureTransitDefinition: ThemeDefinition = {
  id: "alien-megastructure-transit",
  name: "Deep Space Drift",
  description: "Open flight through colossal rotating halos, luminous monoliths and suspended alien machinery.",
  className: "theme-alien-megastructure-transit",
  performanceTier: "standard",
  Scene: AlienMegastructureTransitTheme,
  supportsChroma: true,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default AlienMegastructureTransitDefinition;