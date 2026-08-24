import type { ThemeDefinition } from "../themeTypes";
import CosmicRollerCoasterTheme from "./CosmicRollerCoasterTheme";

const CosmicRollerCoasterDefinition: ThemeDefinition = {
  id: "cosmic-roller-coaster",
  name: "Cosmic Roller Coaster",
  description: "A calm, audio-reactive first-person coaster suspended in space.",
  className: "theme-cosmic-roller-coaster",
  performanceTier: "standard",
  Scene: CosmicRollerCoasterTheme,
  supportsChroma: true,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default CosmicRollerCoasterDefinition;