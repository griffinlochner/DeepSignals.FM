import type { ThemeDefinition } from "../themeTypes";
import SignalTunnelTheme from "./SignalTunnelTheme";

const SignalTunnelDefinition: ThemeDefinition = {
  id: "signal-tunnel",
  name: "Signal Tunnel",
  description: "Armored signal corridors, neon gateways and psychedelic chambers with music-driven surge waves.",
  className: "theme-signal-tunnel",
  performanceTier: "standard",
  Scene: SignalTunnelTheme,
  supportsChroma: true,
  supportsMotion: true,
  supportsVisualFeed: true,
  supportsAudioReactiveBehavior: false,
};

export default SignalTunnelDefinition;