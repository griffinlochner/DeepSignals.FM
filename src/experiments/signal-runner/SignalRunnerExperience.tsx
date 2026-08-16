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
  motionEnabled,
  chromaEnabled,
  getLatestAudioSnapshot,
  onDriveTelemetry,
}: SignalRunnerExperienceProps) {
  return (
    <div
      className="signal-runner"
      data-playing={isPlaying}
      data-chroma-enabled={chromaEnabled}
    >
      <div className="signal-runner__canopy" aria-label="Spaceflight windshield">
        <div className="signal-runner__windshield">
          <SignalRunnerScene
            controlMode={controlMode}
            flightSpeed={manualFlightSpeed}
            isPlaying={isPlaying}
            volume={volume}
            signalId={signalId}
            motionEnabled={motionEnabled}
            getLatestAudioSnapshot={getLatestAudioSnapshot}
            onDriveTelemetry={onDriveTelemetry}
          />
          <div className="signal-runner__glass" aria-hidden="true" />
        </div>
      </div>

      <div className="signal-runner__cockpit" aria-hidden="true">
        <div className="signal-runner__upper-frame">
          <div className="signal-runner__status-lights signal-runner__status-lights--upper">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <span>CANOPY SEAL // NOMINAL</span>
        </div>
      </div>

      <div className="signal-runner__lower-console">
        <div className="signal-runner__console-bank signal-runner__console-bank--green" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="signal-runner__console-display" aria-hidden="true">
          <span>DEEPSIGNALS.FM</span>
          <strong>SIGNAL RUNNER</strong>
          <small>FLIGHT SYSTEM // EXPERIMENTAL</small>
        </div>
        <aside className="signal-runner__controls" aria-label="Signal Runner controls">
          {controlMode === "audio" ? (
            <div className="signal-runner__audio-drive-active">
              <span>AUDIO DRIVE ACTIVE</span>
              <strong>CONTROLLED BY SIGNAL</strong>
              <small>MANUAL FLIGHT SPEED INACTIVE</small>
            </div>
          ) : (
            <>
              <div className="signal-runner__control-heading">
                <label htmlFor="signal-runner-speed">FLIGHT SPEED</label>
                <output htmlFor="signal-runner-speed">{Math.round(manualFlightSpeed)}%</output>
              </div>
              <input
                id="signal-runner-speed"
                type="range"
                min="0"
                max="100"
                step="1"
                value={manualFlightSpeed}
                onChange={(event) => onManualFlightSpeedChange(Number(event.target.value))}
              />
              <div className="signal-runner__scale" aria-hidden="true">
                <span>DRIFT</span>
                <span>CRUISE</span>
                <span>HYPER</span>
              </div>
            </>
          )}
        </aside>
        <div className="signal-runner__drive-status" aria-hidden="true">
          <span>{controlMode === "audio" ? "AUDIO DRIVE" : "MANUAL DRIVE"}</span>
          <strong>
            {controlMode === "audio"
              ? "SIG"
              : Math.round(manualFlightSpeed).toString().padStart(3, "0")}
          </strong>
        </div>
        <div className="signal-runner__console-bank signal-runner__console-bank--salmon" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export default SignalRunnerExperience;