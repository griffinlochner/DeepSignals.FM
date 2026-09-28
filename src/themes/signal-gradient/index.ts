import type { ThemeDefinition } from "../themeTypes";
import SignalGradientTheme from "./SignalGradientTheme";

const SignalGradientDefinition: ThemeDefinition = {
  id: "signal-gradient",
  name: "Signal Gradient",
  description: "A minimal audio-reactive field of DeepSignals color.",
  className: "theme-signal-gradient",
  performanceTier: "minimal",
  Scene: SignalGradientTheme,
  supportsChroma: true,
  supportsMotion: false,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default SignalGradientDefinition;