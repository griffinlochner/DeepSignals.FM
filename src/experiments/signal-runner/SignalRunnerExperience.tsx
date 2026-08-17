import { useEffect, useRef, useState, type CSSProperties } from "react";
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

const DRIVE_SEGMENT_COUNT = 14;
const BLAST_OFF_ARM_SPEED = 68;
const BLAST_OFF_ARM_HOLD_MS = 400;
const BLAST_OFF_TRIGGER_SPEED = 99;
const BLAST_OFF_COOLDOWN_MS = 1500;
const BLAST_OFF_DISPLAY_MS = 1100;

function getDriveState(actualSpeed: number) {
  if (actualSpeed < 20) {
    return "DRIFT";
  }

  if (actualSpeed < 55) {
    return "CRUISE";
  }

  if (actualSpeed < 90) {
    return "SURGE";
  }

  return "HYPER";
}

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
  const [driveTelemetry, setDriveTelemetry] = useState<SignalRunnerDriveTelemetry>({
    controlMode,
    smoothedEnergy: 0,
    targetSpeed: isPlaying ? manualFlightSpeed : 0,
    actualSpeed: isPlaying ? manualFlightSpeed : 0,
  });
  const [blastOffVisible, setBlastOffVisible] = useState(false);
  const blastOffLowSinceRef = useRef<number | null>(null);
  const blastOffArmedRef = useRef(false);
  const blastOffCooldownUntilRef = useRef(0);
  const blastOffTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      return;
    }

    blastOffLowSinceRef.current = null;
    blastOffArmedRef.current = false;
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (blastOffTimeoutRef.current !== null) {
        window.clearTimeout(blastOffTimeoutRef.current);
      }
    };
  }, []);

  const handleDriveTelemetry = (telemetry: SignalRunnerDriveTelemetry) => {
    setDriveTelemetry(telemetry);
    onDriveTelemetry?.(telemetry);

    if (!isPlaying) {
      setBlastOffVisible(false);
      return;
    }

    const now = performance.now();

    if (telemetry.targetSpeed <= BLAST_OFF_ARM_SPEED) {
      blastOffLowSinceRef.current ??= now;

      if (now - blastOffLowSinceRef.current >= BLAST_OFF_ARM_HOLD_MS) {
        blastOffArmedRef.current = true;
      }

      return;
    }

    blastOffLowSinceRef.current = null;

    if (
      !blastOffArmedRef.current ||
      telemetry.targetSpeed < BLAST_OFF_TRIGGER_SPEED ||
      now < blastOffCooldownUntilRef.current
    ) {
      return;
    }

    blastOffArmedRef.current = false;
    blastOffCooldownUntilRef.current = now + BLAST_OFF_COOLDOWN_MS;
    setBlastOffVisible(true);

    if (blastOffTimeoutRef.current !== null) {
      window.clearTimeout(blastOffTimeoutRef.current);
    }

    blastOffTimeoutRef.current = window.setTimeout(() => {
      blastOffTimeoutRef.current = null;
      setBlastOffVisible(false);
    }, BLAST_OFF_DISPLAY_MS);
  };

  const actualSpeed = Math.max(0, Math.min(100, driveTelemetry.actualSpeed));
  const targetSpeed = Math.max(0, Math.min(100, driveTelemetry.targetSpeed));
  const activeSegmentCount = Math.round(
    (actualSpeed / 100) * DRIVE_SEGMENT_COUNT,
  );
  const targetMarkerStyle = {
    "--signal-runner-target-position": `${targetSpeed}%`,
  } as CSSProperties;

  return (
    <div
      className="signal-runner"
      data-playing={isPlaying}
      data-chroma-enabled={chromaEnabled}
    >
      <div className="signal-runner__viewscreen" aria-label="Spaceflight viewscreen">
        <SignalRunnerScene
          controlMode={controlMode}
          flightSpeed={manualFlightSpeed}
          isPlaying={isPlaying}
          volume={volume}
          signalId={signalId}
          motionEnabled={motionEnabled}
          getLatestAudioSnapshot={getLatestAudioSnapshot}
          onDriveTelemetry={handleDriveTelemetry}
        />
        <div className="signal-runner__glass" aria-hidden="true" />
      </div>

      <div className="signal-runner__hud-pod">
        {/* Reserved for future HUD widgets. */}
        <div className="signal-runner__hud-slot signal-runner__hud-slot--left">
          {controlMode === "manual" ? (
            <aside className="signal-runner__controls" aria-label="Signal Runner controls">
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
            </aside>
          ) : null}
        </div>

        <section className="signal-runner__vector-drive" aria-label="Vector drive">
          <div className="signal-runner__vector-drive-header">
            <span>VECTOR DRIVE</span>
            <strong>{getDriveState(actualSpeed)}</strong>
          </div>
          <div className="signal-runner__vector-drive-values">
            <p>
              <span>ACTUAL</span>
              <strong>{Math.round(actualSpeed).toString().padStart(3, "0")}</strong>
            </p>
            <p>
              <span>TARGET</span>
              <strong>{Math.round(targetSpeed).toString().padStart(3, "0")}</strong>
            </p>
          </div>
          <div className="signal-runner__drive-meter" style={targetMarkerStyle}>
            <span className="signal-runner__target-marker" aria-hidden="true" />
            <div className="signal-runner__drive-segments" aria-hidden="true">
              {Array.from({ length: DRIVE_SEGMENT_COUNT }, (_, index) => (
                <i
                  className={index < activeSegmentCount ? "is-active" : ""}
                  key={index}
                />
              ))}
            </div>
          </div>
          {isPlaying && blastOffVisible ? (
            <div className="signal-runner__blast-off" role="status">
              BLAST OFF!
            </div>
          ) : null}
        </section>

        {/* Reserved for future HUD widgets. */}
        <div
          className="signal-runner__hud-slot signal-runner__hud-slot--right"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export default SignalRunnerExperience;