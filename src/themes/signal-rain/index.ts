import type { ThemeDefinition } from "../themeTypes";
import SignalRainTheme from "./SignalRainTheme";

const SignalRainDefinition: ThemeDefinition = {
  id: "signal-rain",
  name: "Signal Rain",
  description: "Cryptic Canvas2D transmission rain in the DeepSignals palette.",
  className: "theme-signal-rain",
  performanceTier: "standard",
  Scene: SignalRainTheme,
  supportsChroma: true,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default SignalRainDefinition;