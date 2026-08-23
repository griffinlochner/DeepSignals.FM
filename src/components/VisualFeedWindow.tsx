import { useEffect, useId, useState, type ComponentType } from "react";
import "./visualFeedWindow.css";
import { publicAssetUrl } from "../app/publicAssetUrl";
import type { AudioReactiveSnapshot, AudioSource } from "../app/playerTypes";
import type { TrackSignalMetadata } from "../app/trackSignalMetadata";
import { useTrackSignalMetadata } from "../app/useTrackSignalMetadata";
import type { ThemeVisualFeedFrameProps } from "../themes/themeTypes";

const BRAND_FALLBACK_ARTWORK_URL = publicAssetUrl(
  "/branding/deepsignals-logo-square.png",
);

type VisualFeedWindowProps = {
  open: boolean;
  dockMode: "right" | "bottom";
  playerCollapsed?: boolean;
  onClose: () => void;
  selectedTrackSource: AudioSource | null;
  metadataOverride?: TrackSignalMetadata | null;
  audioSnapshot?: AudioReactiveSnapshot;
  getLatestSnapshot?: () => AudioReactiveSnapshot;
  analysisStatus?: string;
  playbackStatus?: string;
  Frame?: ComponentType<ThemeVisualFeedFrameProps>;
  className?: string;
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.25 3.25L12.75 12.75" />
      <path d="M12.75 3.25L3.25 12.75" />
    </svg>
  );
}

function DefaultFrame({ children }: ThemeVisualFeedFrameProps) {
  return <>{children}</>;
}

const SIGNAL_RUNNER_MESSAGES = [
  { text: "WELCOME TO", color: "white", joined: false },
  { text: "DEEP", color: "green", joined: false },
  { text: "SIGNALS", color: "cyan", joined: true },
  { text: ".FM", color: "salmon", joined: true },
  { text: "TUNE IN.", color: "green", joined: false },
  { text: "TRANSMIT.", color: "cyan", joined: false },
  { text: "TRANSCEND.", color: "salmon", joined: false },
] as const;

function SignalInfoMarquee() {
  const renderMessage = (copyIndex: number) => (
    <span className="visual-feed-window__marquee-group" key={copyIndex}>
      {SIGNAL_RUNNER_MESSAGES.map((message) => (
        <span
          className={`visual-feed-window__marquee-part visual-feed-window__marquee-part--${message.color}${message.joined ? " visual-feed-window__marquee-part--joined" : ""}`}
          key={`${copyIndex}-${message.text}`}
        >
          {message.text}
        </span>
      ))}
    </span>
  );

  return (
    <div
      className="visual-feed-window__marquee"
      aria-label="DeepSignals.FM message"
    >
      <div className="visual-feed-window__marquee-track" aria-hidden="true">
        {renderMessage(0)}
        {renderMessage(1)}
      </div>
      <span className="visual-feed-window__marquee-live" aria-live="polite">
        WELCOME TO DEEPSIGNALS.FM // TUNE IN. TRANSMIT. TRANSCEND.
      </span>
    </div>
  );
}

function VisualFeedWindow({
  open,
  dockMode,
  playerCollapsed,
  onClose,
  selectedTrackSource,
  metadataOverride,
  audioSnapshot,
  getLatestSnapshot,
  Frame,
  className,
}: VisualFeedWindowProps) {
  const contentId = useId();
  const [failedArtworkUrls, setFailedArtworkUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const [liveSnapshot, setLiveSnapshot] = useState(audioSnapshot);
  const FrameComponent = Frame ?? DefaultFrame;
  const { status, metadata } = useTrackSignalMetadata(selectedTrackSource);

  useEffect(() => {
    if (!open || !getLatestSnapshot) {
      return;
    }

    const publish = () => setLiveSnapshot(getLatestSnapshot());
    publish();
    const intervalHandle = window.setInterval(publish, 100);

    return () => window.clearInterval(intervalHandle);
  }, [getLatestSnapshot, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const resolvedTitle =
    metadataOverride?.title ||
    metadata?.title ||
    selectedTrackSource?.title ||
    selectedTrackSource?.displayName ||
    "Signal source unavailable";
  const artworkUrl =
    [
      metadataOverride?.artworkUrl,
      metadata?.artworkUrl,
      selectedTrackSource?.artworkUrl,
      BRAND_FALLBACK_ARTWORK_URL,
    ].find((candidate) => candidate && !failedArtworkUrls.has(candidate)) ??
    null;
  const isBrandFallback = artworkUrl === BRAND_FALLBACK_ARTWORK_URL;
  const isLoading = status === "loading";
  const fallbackLabel = isLoading
    ? `Loading cover artwork for ${resolvedTitle}`
    : `Cover artwork unavailable for ${resolvedTitle}`;
  const externalSourceUrl =
    selectedTrackSource?.kind === "live-stream"
      ? selectedTrackSource.sourceUrl
      : undefined;
  const artworkImage = artworkUrl ? (
    <img
      className={[
        "visual-feed-window__artwork",
        selectedTrackSource?.kind === "live-stream" && !isBrandFallback
          ? "visual-feed-window__artwork--live-station"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      src={artworkUrl}
      alt={
        isBrandFallback
          ? "DeepSignals.FM"
          : `Cover artwork for ${resolvedTitle}`
      }
      onError={() => {
        setFailedArtworkUrls((current) => new Set(current).add(artworkUrl));
      }}
    />
  ) : null;

  return (
    <section
      className={[
        "visual-feed-window",
        `visual-feed-window--dock-${dockMode}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Signal info panel"
      data-stage="open"
      data-player-collapsed={playerCollapsed ? "true" : "false"}
      aria-hidden="false"
    >
      <header className="visual-feed-window__header">
        <p className="visual-feed-window__title">INFO</p>
        <div className="visual-feed-window__header-actions">
          {externalSourceUrl ? (
            <a
              className="visual-feed-window__source-link"
              href={externalSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open source for ${resolvedTitle}`}
            >
              SOURCE <span aria-hidden="true">↗</span>
            </a>
          ) : null}
          <button
            type="button"
            className="visual-feed-window__close"
            onClick={onClose}
            aria-label="Close signal info"
            title="Close signal info"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="visual-feed-window__body" id={contentId}>
        <FrameComponent>
          <div
            className="visual-feed-window__viewport"
            aria-label="Signal artwork"
          >
            <div className="visual-feed-window__artwork-shell">
              {artworkImage && externalSourceUrl ? (
                <a
                  className="visual-feed-window__artwork-link"
                  href={externalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${resolvedTitle}`}
                  title={`Visit ${resolvedTitle}`}
                >
                  {artworkImage}
                </a>
              ) : artworkImage ? (
                artworkImage
              ) : (
                <div
                  className="visual-feed-window__artwork-fallback"
                  role="img"
                  aria-label={fallbackLabel}
                >
                  <span className="visual-feed-window__artwork-fallback-grid" />
                </div>
              )}
            </div>
          </div>
          <div className="visual-feed-window__details">
            <section
              className="visual-feed-window__meters"
              aria-label="Signal levels"
            >
              {[
                ["energy", "⌁∆", "Energy", liveSnapshot?.energy ?? 0],
                ["bass", "◈∿", "Bass", liveSnapshot?.bass ?? 0],
                ["kick", "⊙↯", "Kick", liveSnapshot?.kickPulse ?? 0],
                ["mids", "∷≈", "Mids", liveSnapshot?.mids ?? 0],
                ["highs", "⋰⌁", "Highs", liveSnapshot?.highs ?? 0],
              ]
                .filter((meter) => {
                  // In collapsed mode, show only Energy and Kick
                  if (playerCollapsed) {
                    const signalId = meter[0] as string;
                    return signalId === "energy" || signalId === "kick";
                  }
                  return true;
                })
                .map(([signalId, glyph, semanticName, rawValue]) => {
                const normalized = Math.min(
                  1,
                  Math.max(0, Number(rawValue) || 0),
                );
                const valueTone =
                  normalized <= 0.333
                    ? "green"
                    : normalized <= 0.666
                      ? "cyan"
                      : "salmon";
                return (
                  <div
                    className="visual-feed-window__meter"
                    key={signalId as string}
                    data-testid={`signal-meter-${signalId}`}
                    aria-label={`${semanticName} signal level`}
                  >
                    <span
                      className="visual-feed-window__meter-label"
                      aria-hidden="true"
                    >
                      {glyph}
                    </span>
                    <span
                      className="visual-feed-window__meter-track"
                      aria-hidden="true"
                    >
                      <span style={{ width: `${normalized * 100}%` }} />
                    </span>
                    <span
                      className={`visual-feed-window__meter-value visual-feed-window__meter-value--${valueTone}`}
                    >
                      {normalized.toFixed(3)}
                    </span>
                  </div>
                );
              })}
            </section>
          </div>
        </FrameComponent>
      </div>
      <footer className="visual-feed-window__footer">
        <SignalInfoMarquee />
        <a
          className="visual-feed-window__about-link"
          href="/about/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="About DeepSignals.FM - opens in a new tab"
        >
          <span>ABOUT</span>
          <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </section>
  );
}

export default VisualFeedWindow;
