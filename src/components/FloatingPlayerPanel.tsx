import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type {
  AudioPlaybackStatus,
  AudioReactiveSnapshot,
  SignalSourceGroup,
} from "../app/playerTypes";
import {
  applyChromaHueResponse,
  mapSmoothedEnergyToHue,
} from "../app/sharedChroma";
import type { ThemeId } from "../themes/themeTypes";
import PanelChevronIcon from "./PanelChevronIcon";
import PlayStopButton from "./PlayStopButton";
import PublicBrandIdent from "./PublicBrandIdent";
import SignalSourceSelector from "./SignalSourceSelector";
import ThemeSelector from "./ThemeSelector";
import TrackMarquee from "./TrackMarquee";
import VolumeControl from "./VolumeControl";
import "./floatingPlayerPanel.css";

type FloatingPlayerPanelProps = {
  environmentName: string;
  environmentOptions: Array<{ id: ThemeId; name: string }>;
  selectedEnvironmentId: ThemeId;
  onEnvironmentChange: (id: ThemeId) => void;
  audioPlaybackStatus: AudioPlaybackStatus;
  audioReactiveSnapshot: AudioReactiveSnapshot;
  audioCurrentTime: number;
  audioDuration: number;
  audioSeekable: boolean;
  audioMetadataLoaded: boolean;
  audioErrorMessage: string | null;
  audioIsSeeking: boolean;
  onAudioTogglePlay: () => Promise<void>;
  onAudioSeek: (value: number) => void;
  signalGroups: SignalSourceGroup[];
  selectedSignalId: string | null;
  onSignalChange: (id: string) => void;
  signalLabel: string | null;
  isPlaying: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  motionEnabled: boolean;
  supportsMotion: boolean;
  onMotionToggle: (enabled: boolean) => void;
  chromaEnabled: boolean;
  supportsChroma: boolean;
  onChromaToggle: (enabled: boolean) => void;
  showSignalTelemetryControl: boolean;
  signalTelemetryVisible: boolean;
  onSignalTelemetryChange: (enabled: boolean) => void;
  signalTelemetryToggleRef?: RefObject<HTMLInputElement | null>;
  showVisualFeedControl: boolean;
  visualFeedOpen: boolean;
  onVisualFeedChange: (enabled: boolean) => void;
  visualFeedToggleRef?: RefObject<HTMLInputElement | null>;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

const FloatingPlayerPanel = forwardRef<HTMLElement, FloatingPlayerPanelProps>(function FloatingPlayerPanel(
  {
    environmentName,
    environmentOptions,
    selectedEnvironmentId,
    onEnvironmentChange,
    audioPlaybackStatus,
    audioReactiveSnapshot,
    audioCurrentTime,
    audioDuration,
    audioSeekable,
    audioMetadataLoaded,
    audioErrorMessage,
    audioIsSeeking,
    onAudioTogglePlay,
    onAudioSeek,
    signalGroups,
    selectedSignalId,
    onSignalChange,
    signalLabel,
    isPlaying,
    volume,
    onVolumeChange,
    motionEnabled,
    supportsMotion,
    onMotionToggle,
    chromaEnabled,
    supportsChroma,
    onChromaToggle,
    showSignalTelemetryControl,
    signalTelemetryVisible,
    onSignalTelemetryChange,
    signalTelemetryToggleRef,
    showVisualFeedControl,
    visualFeedOpen,
    onVisualFeedChange,
    visualFeedToggleRef,
    collapsed,
    onCollapsedChange,
  }: FloatingPlayerPanelProps,
  ref,
) {
  const contentId = useId();

  const marqueeState: "no-signal" | "ready" | "playing" = !selectedSignalId
    ? "no-signal"
    : isPlaying
      ? "playing"
      : "ready";

  const toggleLabel = collapsed
    ? "Expand player panel"
    : "Collapse player panel";
  const chromaReactive = chromaEnabled && audioPlaybackStatus === "playing";
  const [playerChromaHue, setPlayerChromaHue] = useState(0);
  const playerChromaHueRef = useRef(0);

  useEffect(() => {
    const targetHue = chromaReactive
      ? mapSmoothedEnergyToHue(audioReactiveSnapshot.smoothedEnergy)
      : 0;
    const nextHue = applyChromaHueResponse(
      playerChromaHueRef.current,
      targetHue,
    );

    playerChromaHueRef.current = nextHue;
    setPlayerChromaHue(nextHue);
  }, [audioReactiveSnapshot.smoothedEnergy, chromaReactive]);

  const reactiveEnergy = chromaReactive
    ? Math.max(0, Math.min(1, audioReactiveSnapshot.smoothedEnergy))
    : 0;
  const panelStyle = {
    "--player-reactive-energy": reactiveEnergy,
    "--player-chroma-hue": `${playerChromaHue}deg`,
  } as CSSProperties;

  return (
    <aside
      ref={ref}
      className="floating-player-panel"
      data-collapsed={collapsed}
      data-chroma-reactive={chromaReactive}
      style={panelStyle}
      aria-label={`${environmentName} controls`}
    >
      <header className="floating-player-panel__header">
        <PublicBrandIdent
          as="span"
          className="floating-player-panel__brand-ident"
        />

        <button
          type="button"
          className="floating-player-panel__toggle"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-controls={contentId}
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          <PanelChevronIcon collapsed={collapsed} expandDirection="down" />
        </button>
      </header>

      {collapsed ? (
        <div className="floating-player-panel__collapsed-body" id={contentId}>
          <div className="floating-player-panel__row floating-player-panel__signal-row">
            <p className="floating-player-panel__label">Signal</p>
            <SignalSourceSelector
              value={selectedSignalId || ""}
              groups={signalGroups}
              onChange={onSignalChange}
            />
          </div>

          <TrackMarquee signalLabel={signalLabel} marqueeState={marqueeState} />

          <PlayStopButton
            isPlaying={audioPlaybackStatus === "playing"}
            isLoading={audioPlaybackStatus === "loading"}
            isDisabled={!selectedSignalId}
            onToggle={() => void onAudioTogglePlay()}
          />
        </div>
      ) : (
        <div className="floating-player-panel__body" id={contentId}>
          <div className="floating-player-panel__row floating-player-panel__signal-row">
            <p className="floating-player-panel__label">Signal</p>
            <SignalSourceSelector
              value={selectedSignalId || ""}
              groups={signalGroups}
              onChange={onSignalChange}
            />
          </div>

          <div className="floating-player-panel__row floating-player-panel__transmission-row">
            <p className="floating-player-panel__label">Transmission</p>
            <TrackMarquee
              signalLabel={signalLabel}
              marqueeState={marqueeState}
            />
          </div>
          {audioErrorMessage ? (
            <p className="floating-player-panel__audio-error" role="status">
              {audioErrorMessage}
            </p>
          ) : null}

          <section
            className="floating-player-panel__controls"
            aria-label="Main controls"
          >
            <PlayStopButton
              isPlaying={audioPlaybackStatus === "playing"}
              isLoading={audioPlaybackStatus === "loading"}
              isDisabled={!selectedSignalId}
              onToggle={() => void onAudioTogglePlay()}
            />

            <section
              className="floating-player-panel__row"
              aria-label="Volume control"
            >
              <p className="floating-player-panel__label">Volume</p>
              <VolumeControl value={volume} onChange={onVolumeChange} />
            </section>

            {audioSeekable &&
            audioMetadataLoaded &&
            Number.isFinite(audioDuration) &&
            audioDuration > 0 ? (
              <section
                className="floating-player-panel__seek-row"
                aria-label="Playback progress"
              >
                <p className="floating-player-panel__label">Progress</p>
                <input
                  className="floating-player-panel__seek-slider"
                  type="range"
                  min={0}
                  max={Math.max(audioDuration, 1)}
                  step="0.01"
                  value={Math.min(
                    audioCurrentTime,
                    audioDuration || audioCurrentTime,
                  )}
                  onChange={(event) => onAudioSeek(Number(event.target.value))}
                  disabled={
                    audioIsSeeking || !audioMetadataLoaded || audioDuration <= 0
                  }
                  aria-label="Seek playback"
                />
                <p className="floating-player-panel__seek-time">
                  {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
                </p>
              </section>
            ) : null}

            <div className="floating-player-panel__row">
              <p className="floating-player-panel__label">Environment</p>
              <ThemeSelector
                value={selectedEnvironmentId}
                options={environmentOptions}
                onChange={onEnvironmentChange}
              />
            </div>

            <div
              className="floating-player-panel__toggle-row"
              role="group"
              aria-label="Environment controls"
            >
              <label
                className={[
                  "floating-player-panel__switch",
                  "floating-player-panel__chroma-switch",
                  !supportsChroma
                    ? "floating-player-panel__switch--disabled"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={
                  !supportsChroma
                    ? "Chroma is not available for this environment."
                    : undefined
                }
              >
                <input
                  className="floating-player-panel__switch-checkbox"
                  type="checkbox"
                  checked={chromaEnabled}
                  disabled={!supportsChroma}
                  onChange={(event) => onChromaToggle(event.target.checked)}
                  aria-label="Toggle environment chroma effects"
                />
                <span className="floating-player-panel__switch-label">
                  Chroma
                </span>
                <span
                  className="floating-player-panel__switch-track"
                  aria-hidden="true"
                >
                  <span className="floating-player-panel__switch-thumb" />
                </span>
              </label>

              <label
                className={[
                  "floating-player-panel__switch",
                  "floating-player-panel__motion-switch",
                  !supportsMotion
                    ? "floating-player-panel__switch--disabled"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={
                  !supportsMotion
                    ? "Motion is not available for this environment."
                    : undefined
                }
              >
                <input
                  className="floating-player-panel__switch-checkbox"
                  type="checkbox"
                  checked={motionEnabled}
                  disabled={!supportsMotion}
                  onChange={(event) => onMotionToggle(event.target.checked)}
                  aria-label="Motion"
                />
                <span className="floating-player-panel__switch-label">
                  Motion
                </span>
                <span
                  className="floating-player-panel__switch-track"
                  aria-hidden="true"
                >
                  <span className="floating-player-panel__switch-thumb" />
                </span>
              </label>
            </div>

            {showVisualFeedControl || showSignalTelemetryControl ? (
              <div
                className="floating-player-panel__toggle-row"
                role="group"
                aria-label="Display controls"
              >
                {showVisualFeedControl ? (
                  <label className="floating-player-panel__switch floating-player-panel__visual-switch">
                    <input
                      ref={visualFeedToggleRef}
                      className="floating-player-panel__switch-checkbox"
                      type="checkbox"
                      checked={visualFeedOpen}
                      onChange={(event) => onVisualFeedChange(event.target.checked)}
                      aria-label="Toggle signal feed"
                    />
                    <span className="floating-player-panel__switch-label">
                      Feed
                    </span>
                    <span
                      className="floating-player-panel__switch-track"
                      aria-hidden="true"
                    >
                      <span className="floating-player-panel__switch-thumb" />
                    </span>
                  </label>
                ) : null}

                {showSignalTelemetryControl ? (
                  <label className="floating-player-panel__switch floating-player-panel__telemetry-switch">
                    <input
                      ref={signalTelemetryToggleRef}
                      className="floating-player-panel__switch-checkbox"
                      type="checkbox"
                      checked={signalTelemetryVisible}
                      onChange={(event) =>
                        onSignalTelemetryChange(event.target.checked)
                      }
                      aria-label="Telemetry"
                    />
                    <span className="floating-player-panel__switch-label">
                      Telemetry
                    </span>
                    <span
                      className="floating-player-panel__switch-track"
                      aria-hidden="true"
                    >
                      <span className="floating-player-panel__switch-thumb" />
                    </span>
                  </label>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </aside>
  );
});

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default FloatingPlayerPanel;
