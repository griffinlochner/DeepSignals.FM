import type { ThemeDefinition } from "../themeTypes";
import NeonHyperRacerTheme from "./NeonHyperRacerTheme";

const NeonHyperRacerDefinition: ThemeDefinition = {
  id: "neon-hyper-racer",
  name: "Neon Hyper-Racer",
  description: "A high-speed neon flythrough across a futuristic night corridor.",
  className: "theme-neon-hyper-racer",
  performanceTier: "standard",
  Scene: NeonHyperRacerTheme,
  supportsChroma: true,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default NeonHyperRacerDefinition;