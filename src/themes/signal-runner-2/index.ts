import type { ThemeDefinition } from "../themeTypes";
import SignalRunner2Theme from "./SignalRunner2Theme";

const SignalRunner2Definition: ThemeDefinition = {
  id: "signal-runner-2",
  name: "Asteroid Runner",
  description: "An autopiloted deep-space journey past massive asteroids, engineered gateways and rare traffic",
  className: "theme-signal-runner-2",
  performanceTier: "enhanced",
  Scene: SignalRunner2Theme,
  supportsChroma: true,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default SignalRunner2Definition;
