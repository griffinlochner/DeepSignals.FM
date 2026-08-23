import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import SignalRunnerScene, {
  type SignalRunnerControlMode,
  type SignalRunnerDriveTelemetry,
} from "./SignalRunnerScene";
import "./signalRunner.css";

type SignalRunnerExperienceProps = {
  controlMode: SignalRunnerControlMode;
  manualFlightSpeed: number;
  onManualFlightSpeedChange: (speed: number) => void;
  isPlaying: boolean;
  volume: number;
  signalId: string | null;
  motionEnabled: boolean;
  chromaEnabled: boolean;
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
  onDriveTelemetry?: (telemetry: SignalRunnerDriveTelemetry) => void;
};

function SignalRunnerExperience({
  controlMode,
  manualFlightSpeed,
  onManualFlightSpeedChange,
  isPlaying,
  volume,
  signalId,
  motionEnabled: motionSetting,
  chromaEnabled,
  getLatestAudioSnapshot,
  onDriveTelemetry,
}: SignalRunnerExperienceProps) {
  const handleDriveTelemetry = (telemetry: SignalRunnerDriveTelemetry) => {
    onDriveTelemetry?.(telemetry);
  };

  return (
    <div
      className="signal-runner"
      data-playing={isPlaying}
      data-chroma-enabled={chromaEnabled}
    >
      <div
        className="signal-runner__viewscreen"
        aria-label="Spaceflight viewscreen"
      >
        <SignalRunnerScene
          controlMode={controlMode}
          flightSpeed={manualFlightSpeed}
          isPlaying={isPlaying}
          volume={volume}
          signalId={signalId}
          motionEnabled={motionSetting}
          chromaEnabled={chromaEnabled}
          getLatestAudioSnapshot={getLatestAudioSnapshot}
          onDriveTelemetry={handleDriveTelemetry}
        />
      </div>

      {controlMode === "manual" ? (
        <aside
          className="signal-runner__controls"
          aria-label="Signal Runner controls"
        >
          <div className="signal-runner__control-heading">
            <label htmlFor="signal-runner-speed">FLIGHT SPEED</label>
            <output htmlFor="signal-runner-speed">
              {Math.round(manualFlightSpeed)}%
            </output>
          </div>
          <input
            id="signal-runner-speed"
            type="range"
            min="0"
            max="100"
            step="1"
            value={manualFlightSpeed}
            onChange={(event) =>
              onManualFlightSpeedChange(Number(event.target.value))
            }
          />
        </aside>
      ) : null}
    </div>
  );
}

export default SignalRunnerExperience;
