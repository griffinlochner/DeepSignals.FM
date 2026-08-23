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
  onRuntimeTelemetry,
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
      onDriveTelemetry={(telemetry) =>
        onRuntimeTelemetry?.({
          motionTargetSpeed: telemetry.targetSpeed,
          motionSpeed: telemetry.travelVelocity,
          hue: telemetry.hue,
        })
      }
    />
  );
}

export default SignalRunnerTheme;
