import { useEffect, useState } from "react";
import { AUDIO_SOURCES, formatAudioSourceLabel } from "../../app/audioSources";
import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import { useAudioAnalysis } from "../../app/useAudioAnalysis";
import { usePersistentAudioController } from "../../app/usePersistentAudioController";
import VolumeControl from "../../components/VolumeControl";
import SignalRunnerExperience from "../signal-runner/SignalRunnerExperience";
import type {
  SignalRunnerControlMode,
  SignalRunnerDriveTelemetry,
} from "../signal-runner/SignalRunnerScene";
import CosmicNexusDefinition from "../../themes/cosmic-nexus";
import type { ThemeSceneProps } from "../../themes/themeTypes";
import "./signalLab.css";

const INITIAL_VOLUME = 1;
const MONITOR_INTERVAL_MS = 100;
const CosmicNexusScene = CosmicNexusDefinition.Scene;
type SignalLabEnvironmentId = "cosmic-nexus" | "signal-runner";

const ZERO_RUNNER_TELEMETRY: SignalRunnerDriveTelemetry = {
  controlMode: "manual",
  smoothedEnergy: 0,
  targetSpeed: 42,
  actualSpeed: 42,
  travelVelocity: 0,
  hue: 0,
};

const ZERO_SNAPSHOT: AudioReactiveSnapshot = {
  energy: 0,
  smoothedEnergy: 0,
  bass: 0,
  kickPulse: 0,
  kickPulseAcceptedEvent: false,
  kickPulseAcceptedEventCount: 0,
  kickPulseAcceptedEventSequence: 0,
  bassPulse: 0,
  mids: 0,
  highs: 0,
  transient: 0,
  isActive: false,
};

const SIGNAL_ROWS: Array<{
  label: string;
  field: keyof Pick<
    AudioReactiveSnapshot,
    | "energy"
    | "smoothedEnergy"
    | "bass"
    | "kickPulse"
    | "bassPulse"
    | "mids"
    | "highs"
    | "transient"
  >;
}> = [
  { label: "ENERGY", field: "energy" },
  { label: "SMOOTH ENERGY", field: "smoothedEnergy" },
  { label: "BASS", field: "bass" },
  { label: "KICK", field: "kickPulse" },
  { label: "BASS PULSE", field: "bassPulse" },
  { label: "MIDS", field: "mids" },
  { label: "HIGHS", field: "highs" },
  { label: "TRANSIENT", field: "transient" },
];

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
}

function SignalLabShell() {
  const [selectedSourceId, setSelectedSourceId] = useState(
    AUDIO_SOURCES[0]?.id ?? "",
  );
  const [monitorSnapshot, setMonitorSnapshot] =
    useState<AudioReactiveSnapshot>(ZERO_SNAPSHOT);
  const [chromaEnabled, setChromaEnabled] = useState(true);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [selectedEnvironmentId, setSelectedEnvironmentId] =
    useState<SignalLabEnvironmentId>("signal-runner");
  const [runnerControlMode, setRunnerControlMode] =
    useState<SignalRunnerControlMode>("audio");
  const [manualFlightSpeed, setManualFlightSpeed] = useState(42);
  const [runnerTelemetry, setRunnerTelemetry] =
    useState<SignalRunnerDriveTelemetry>(ZERO_RUNNER_TELEMETRY);
  const controller = usePersistentAudioController(
    INITIAL_VOLUME,
    selectedSourceId,
  );
  const analysis = useAudioAnalysis({
    audioElement: controller.audioElement,
    playbackStatus: controller.playbackStatus,
    isSeeking: controller.isSeeking,
    audioSourceId: selectedSourceId,
    sourceBpm: controller.audioSource.bpm ?? null,
    publishDiagnostics: false,
  });
  const getLatestSnapshot = analysis.getLatestSnapshot;
  const sceneProps: ThemeSceneProps = {
    isPlaying: controller.playbackStatus === "playing",
    volume: controller.volume,
    signalId: selectedSourceId,
    audioLevel: 0,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    sourceBpm: controller.audioSource.bpm ?? null,
    motionEnabled,
    chromaEnabled,
    getLatestAudioSnapshot: getLatestSnapshot,
  };

  useEffect(() => {
    const publishSnapshot = () => {
      setMonitorSnapshot(getLatestSnapshot());
    };

    publishSnapshot();
    const intervalHandle = window.setInterval(
      publishSnapshot,
      MONITOR_INTERVAL_MS,
    );

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, [getLatestSnapshot]);

  const handlePlaybackToggle = async () => {
    if (controller.playbackStatus !== "playing") {
      await analysis.requestInitializationFromUserGesture();
    }

    await controller.togglePlay();
  };

  const isLoading = controller.playbackStatus === "loading";
  const signalRunnerSelected = selectedEnvironmentId === "signal-runner";
  const isLocalTrack = controller.audioSource.kind !== "live-stream";
  const hasDuration = controller.duration > 0;
  const scrubMax = hasDuration ? controller.duration : 0;
  const scrubValue = Math.min(controller.currentTime, scrubMax);
  const scrubDisabled = !controller.seekable || !hasDuration;

  return (
    <main className="signal-lab">
      <div className="signal-lab__shell">
        <header className="signal-lab__header">
          <p className="signal-lab__eyebrow">DEEPSIGNALS DEV</p>
          <h1>DEEPSIGNALS SIGNAL LAB</h1>
          <p className="signal-lab__subtitle">
            Universal production signal monitor
          </p>
        </header>

        <div className="signal-lab__layout">
          <div className="signal-lab__column signal-lab__column--controls">
            <section
              className="signal-lab__controls"
              aria-label="Audio controls"
            >
              <label className="signal-lab__field">
                <span>SOURCE</span>
                <select
                  value={selectedSourceId}
                  onChange={(event) => setSelectedSourceId(event.target.value)}
                >
                  {AUDIO_SOURCES.map((source) => (
                    <option key={source.id} value={source.id}>
                      {formatAudioSourceLabel(source)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="signal-lab__field">
                <span>PLAYBACK</span>
                <button
                  type="button"
                  onClick={() => void handlePlaybackToggle()}
                  disabled={isLoading || !selectedSourceId}
                >
                  {isLoading
                    ? "LOADING"
                    : controller.playbackStatus === "playing"
                      ? "PAUSE"
                      : "PLAY"}
                </button>
              </div>

              <div className="signal-lab__field signal-lab__field--volume">
                <span>VOLUME</span>
                <div className="signal-lab__volume-control">
                  <VolumeControl
                    value={controller.volume}
                    onChange={controller.setVolume}
                  />
                  <output>{controller.volume.toFixed(2)}</output>
                </div>
              </div>
            </section>

            {isLocalTrack ? (
              <section
                className="signal-lab__scrub"
                aria-label="Local track position"
              >
                <div className="signal-lab__scrub-heading">
                  <span>POSITION</span>
                  <output>
                    {formatClock(scrubValue)} /{" "}
                    {hasDuration ? formatClock(controller.duration) : "--:--"}
                  </output>
                </div>
                <div className="signal-lab__scrub-row">
                  <input
                    type="range"
                    min={0}
                    max={scrubMax || 1}
                    step={0.01}
                    value={scrubValue}
                    disabled={scrubDisabled}
                    aria-label="Seek local track"
                    onChange={(event) =>
                      controller.seekTo(Number(event.target.value))
                    }
                  />
                  <button
                    type="button"
                    className="signal-lab__scrub-restart"
                    disabled={scrubDisabled}
                    onClick={() => controller.seekTo(0)}
                  >
                    RESTART
                  </button>
                </div>
                {!hasDuration ? (
                  <p className="signal-lab__scrub-hint">WAITING FOR METADATA</p>
                ) : null}
              </section>
            ) : null}

            <section className="signal-lab__status" aria-label="Audio status">
              <p>
                <span>PLAYBACK</span>
                <strong data-state={controller.playbackStatus}>
                  {controller.playbackStatus.toUpperCase()}
                </strong>
              </p>
              <p>
                <span>ANALYSIS</span>
                <strong data-state={analysis.status}>
                  {analysis.status.toUpperCase()}
                </strong>
              </p>
              {controller.errorMessage ? (
                <p className="signal-lab__error" role="status">
                  PLAYBACK ERROR: {controller.errorMessage}
                </p>
              ) : null}
              {analysis.errorMessage ? (
                <p className="signal-lab__error" role="status">
                  ANALYSIS ERROR: {analysis.errorMessage}
                </p>
              ) : null}
            </section>

            <section
              className="signal-lab__monitor"
              aria-labelledby="signal-lab-monitor-title"
            >
              <div className="signal-lab__monitor-heading">
                <h2 id="signal-lab-monitor-title">UNIVERSAL SIGNALS</h2>
                <span className={monitorSnapshot.isActive ? "is-active" : ""}>
                  ACTIVE {monitorSnapshot.isActive ? "YES" : "NO"}
                </span>
              </div>

              <div className="signal-lab__meters">
                {SIGNAL_ROWS.map(({ label, field }) => {
                  const value = monitorSnapshot[field];

                  return (
                    <div className="signal-lab__meter" key={field}>
                      <span className="signal-lab__meter-label">{label}</span>
                      <div
                        className="signal-lab__meter-track"
                        aria-hidden="true"
                      >
                        <span style={{ width: `${value * 100}%` }} />
                      </div>
                      <output>{value.toFixed(3)}</output>
                    </div>
                  );
                })}
              </div>

              <div
                className="signal-lab__events"
                aria-label="Accepted kick events"
              >
                <p>
                  <span>ACCEPTED KICK COUNT</span>
                  <strong>{monitorSnapshot.kickPulseAcceptedEventCount}</strong>
                </p>
                <p>
                  <span>ACCEPTED KICK SEQUENCE</span>
                  <strong>
                    {monitorSnapshot.kickPulseAcceptedEventSequence}
                  </strong>
                </p>
              </div>
            </section>
          </div>

          <div className="signal-lab__column signal-lab__column--stage">
            <section
              className="signal-lab__environment"
              aria-labelledby="signal-lab-environment-title"
            >
              <div className="signal-lab__environment-heading">
                <div>
                  <p>NATIVE ENVIRONMENT</p>
                  <h2 id="signal-lab-environment-title">
                    {signalRunnerSelected
                      ? "SIGNAL RUNNER"
                      : "THE SIGNAL NEXUS"}
                  </h2>
                </div>
                <label className="signal-lab__environment-select">
                  <span>ENVIRONMENT</span>
                  <select
                    value={selectedEnvironmentId}
                    onChange={(event) =>
                      setSelectedEnvironmentId(
                        event.target.value as SignalLabEnvironmentId,
                      )
                    }
                  >
                    <option value="cosmic-nexus">The Signal Nexus</option>
                    <option value="signal-runner">Signal Runner</option>
                  </select>
                </label>
                <div
                  className="signal-lab__environment-toggles"
                  aria-label="Environment controls"
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={chromaEnabled}
                      onChange={(event) =>
                        setChromaEnabled(event.target.checked)
                      }
                    />
                    <span>CHROMA</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={motionEnabled}
                      onChange={(event) =>
                        setMotionEnabled(event.target.checked)
                      }
                    />
                    <span>MOTION</span>
                  </label>
                </div>
              </div>

              {signalRunnerSelected ? (
                <div className="signal-lab__runner-drive">
                  <label>
                    <span>CONTROL MODE</span>
                    <select
                      value={runnerControlMode}
                      onChange={(event) =>
                        setRunnerControlMode(
                          event.target.value as SignalRunnerControlMode,
                        )
                      }
                    >
                      <option value="manual">MANUAL</option>
                      <option value="audio">AUDIO</option>
                    </select>
                  </label>
                  <div>
                    <span>SMOOTH ENERGY</span>
                    <strong>{runnerTelemetry.smoothedEnergy.toFixed(3)}</strong>
                  </div>
                  <div>
                    <span>TARGET SPEED</span>
                    <strong>{Math.round(runnerTelemetry.targetSpeed)}</strong>
                  </div>
                  <div>
                    <span>ACTUAL SPEED</span>
                    <strong>{Math.round(runnerTelemetry.actualSpeed)}</strong>
                  </div>
                </div>
              ) : null}

              <div
                className={[
                  "signal-lab__preview",
                  signalRunnerSelected
                    ? "signal-lab__preview--runner"
                    : CosmicNexusDefinition.className,
                ].join(" ")}
              >
                {signalRunnerSelected ? (
                  <SignalRunnerExperience
                    controlMode={runnerControlMode}
                    manualFlightSpeed={manualFlightSpeed}
                    onManualFlightSpeedChange={setManualFlightSpeed}
                    isPlaying={sceneProps.isPlaying}
                    volume={sceneProps.volume}
                    signalId={sceneProps.signalId}
                    motionEnabled={sceneProps.motionEnabled ?? true}
                    chromaEnabled={sceneProps.chromaEnabled ?? true}
                    getLatestAudioSnapshot={sceneProps.getLatestAudioSnapshot}
                    onDriveTelemetry={setRunnerTelemetry}
                  />
                ) : (
                  <CosmicNexusScene {...sceneProps} />
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export default SignalLabShell;
