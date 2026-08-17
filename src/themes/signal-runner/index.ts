import type { ThemeDefinition } from "../themeTypes";
import SignalRunnerTheme from "./SignalRunnerTheme";

const SignalRunnerDefinition: ThemeDefinition = {
  id: "signal-runner",
  name: "Signal Runner",
  description: "Audio-reactive signal flight environment",
  className: "theme-signal-runner",
  performanceTier: "enhanced",
  Scene: SignalRunnerTheme,
  supportsChroma: true,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default SignalRunnerDefinition;