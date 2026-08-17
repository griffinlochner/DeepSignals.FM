import SignalRunnerExperience from "../../experiments/signal-runner/SignalRunnerExperience";
import type { ThemeSceneProps } from "../themeTypes";

const NOOP = () => {};

function SignalRunnerTheme({
  isPlaying,
  volume,
  signalId,
  motionEnabled = true,
  chromaEnabled = true,
  getLatestAudioSnapshot,
}: ThemeSceneProps) {
  return (
    <SignalRunnerExperience
      controlMode="audio"
      manualFlightSpeed={0}
      onManualFlightSpeedChange={NOOP}
      isPlaying={isPlaying}
      volume={volume}
      signalId={signalId}
      motionEnabled={motionEnabled}
      chromaEnabled={chromaEnabled}
      getLatestAudioSnapshot={getLatestAudioSnapshot}
    />
  );
}

export default SignalRunnerTheme;