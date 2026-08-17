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

const DRIVE_SEGMENT_COUNT = 12;
const BLAST_OFF_ARM_SPEED = 68;
const BLAST_OFF_ARM_HOLD_MS = 400;
const BLAST_OFF_TRIGGER_SPEED = 99;
const BLAST_OFF_COOLDOWN_MS = 1500;
const BLAST_OFF_DISPLAY_MS = 1100;
const COIL_SIGNAL_INTERVAL_MS = 100;

type CoilSignal = {
  energy: number;
  kick: number;
  bassPulse: number;
};

const IDLE_COIL_SIGNAL: CoilSignal = { energy: 0, kick: 0, bassPulse: 0 };

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

function getDriveValueClass(speed: number) {
  switch (getDriveState(speed)) {
    case "DRIFT":
      return "signal-runner__actual-value--idle";
    case "CRUISE":
      return "signal-runner__actual-value--cyan";
    case "SURGE":
      return "signal-runner__actual-value--green";
    case "HYPER":
      return "signal-runner__actual-value--hyper";
  }
}

function ImpulseCoil({ signal }: { signal: CoilSignal }) {
  const style = {
    "--signal-runner-coil-energy": signal.energy,
    "--signal-runner-coil-kick": signal.kick,
    "--signal-runner-coil-bass": signal.bassPulse,
  } as CSSProperties;

  return (
    <section
      className="signal-runner__impulse-coil"
      data-kick-active={signal.kick > 0.2}
      data-bass-active={signal.bassPulse > 0.2}
      style={style}
      aria-label="Impulse coil"
    >
      <svg className="signal-runner__impulse-coil-chamber" viewBox="0 0 280 100" aria-hidden="true">
        <defs>
          <linearGradient id="signal-runner-coil-core" x1="0" x2="1">
            <stop offset="0" stopColor="#47f7ff" />
            <stop offset="0.52" stopColor="#e9f8ff" />
            <stop offset="1" stopColor="#9cff57" />
          </linearGradient>
          <filter id="signal-runner-coil-glow" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path className="signal-runner__coil-shell" d="M17 15H263L276 50 263 85H17L4 50Z" />
        <path className="signal-runner__coil-rail signal-runner__coil-rail--top" d="M26 30H254" />
        <path className="signal-runner__coil-rail signal-runner__coil-rail--bottom" d="M26 70H254" />
        <path className="signal-runner__coil-filament" d="M23 50 48 40 72 61 97 35 122 58 140 42 160 64 187 37 211 60 237 39 258 50" />
        <g className="signal-runner__coil-links">
          <rect x="38" y="43" width="12" height="14" />
          <rect x="78" y="43" width="12" height="14" />
          <rect x="118" y="43" width="12" height="14" />
          <rect x="158" y="43" width="12" height="14" />
          <rect x="198" y="43" width="12" height="14" />
          <rect x="230" y="43" width="12" height="14" />
        </g>
        <g className="signal-runner__coil-packets">
          <circle cx="64" cy="50" r="3" />
          <circle cx="140" cy="50" r="3.6" />
          <circle cx="216" cy="50" r="3" />
        </g>
        <path className="signal-runner__coil-discharge signal-runner__coil-discharge--left" d="M57 25 65 35 59 43 71 50" />
        <path className="signal-runner__coil-discharge signal-runner__coil-discharge--right" d="M222 75 214 65 221 57 209 50" />
      </svg>
    </section>
  );
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
  const [coilSignal, setCoilSignal] = useState<CoilSignal>(IDLE_COIL_SIGNAL);
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

  useEffect(() => {
    const updateCoilSignal = () => {
      const snapshot = getLatestAudioSnapshot?.();

      setCoilSignal({
        energy: isPlaying ? Math.min(1, Math.max(0, snapshot?.smoothedEnergy ?? 0)) : 0,
        kick: isPlaying ? Math.min(1, Math.max(0, snapshot?.kickPulse ?? 0)) : 0,
        bassPulse: isPlaying ? Math.min(1, Math.max(0, snapshot?.bassPulse ?? 0)) : 0,
      });
    };

    updateCoilSignal();
    const intervalId = window.setInterval(updateCoilSignal, COIL_SIGNAL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [getLatestAudioSnapshot, isPlaying]);

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
  const motionState =
    actualSpeed < targetSpeed - 3 ? "ACCEL" : actualSpeed > targetSpeed + 3 ? "DECEL" : "HOLD";
  const motionSymbol =
    motionState === "ACCEL" ? "▲" : motionState === "DECEL" ? "▼" : "•";
  const activeSegmentCount = Math.round(
    (actualSpeed / 100) * DRIVE_SEGMENT_COUNT,
  );
  const targetMarkerStyle = {
    "--signal-runner-target-position": `${targetSpeed}%`,
  } as CSSProperties;
  const actualSpeedClass = getDriveValueClass(actualSpeed);
  const targetSpeedClass = getDriveValueClass(targetSpeed);

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
          chromaEnabled={chromaEnabled}
          getLatestAudioSnapshot={getLatestAudioSnapshot}
          onDriveTelemetry={handleDriveTelemetry}
        />
        <div className="signal-runner__glass" aria-hidden="true" />
      </div>

      <div className="signal-runner__hud-pod">
        <div className="signal-runner__hud-content">
          <div className="signal-runner__hud-slot signal-runner__hud-slot--left">
            <ImpulseCoil signal={coilSignal} />
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
              <div className="signal-runner__vector-drive-status">
                <strong>{getDriveState(actualSpeed)}</strong>
                <span
                  className={`signal-runner__vector-drive-motion signal-runner__vector-drive-motion--${motionState.toLowerCase()}`}
                >
                  {motionSymbol} {motionState}
                </span>
              </div>
            </div>
            <div className="signal-runner__vector-drive-values">
              <p>
                <span>ACTUAL</span>
                <strong className={actualSpeedClass}>
                  {Math.round(actualSpeed).toString().padStart(3, "0")}
                </strong>
              </p>
              <p>
                <span>TARGET</span>
                <strong className={targetSpeedClass}>
                  {Math.round(targetSpeed).toString().padStart(3, "0")}
                </strong>
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

          <div className="signal-runner__hud-slot signal-runner__hud-slot--right" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export default SignalRunnerExperience;