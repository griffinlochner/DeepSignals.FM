import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AUDIO_SOURCES,
  DEMO_AUDIO_SOURCES,
  GLOBULAR_FOR_THE_TIME_BEING_AUDIO_SOURCE,
  PUBLIC_EXTERNAL_AUDIO_SOURCES,
  formatAudioSourceLabel,
} from "./audioSources";
import AudioAnalysisDiagnostics from "../components/AudioAnalysisDiagnostics";
import FloatingPlayerPanel from "../components/FloatingPlayerPanel";
import SignalTelemetryPanel from "../components/SignalTelemetryPanel";
import StationIdentOverlay from "../components/StationIdentOverlay";
import VisualFeedWindow from "../components/VisualFeedWindow";
import { themeRegistry } from "../themes/themeRegistry";
import type {
  ImageDepthSceneCounters,
  ReactivePreviewTelemetry,
  SignalSource,
  SignalSourceGroup,
} from "./playerTypes";
import type { ThemeId, ThemeSceneProps } from "../themes/themeTypes";
import { preloadImageDepthTextures } from "../themes/image-depth/imageDepthTextureCache";
import { imageDepthEnvironmentCatalog } from "../themes/image-depth/environmentCatalog";
import { useAudioAnalysis } from "./useAudioAnalysis";
import { usePersistentAudioController } from "./usePersistentAudioController";
import { usePsyStreamNowPlaying } from "./usePsyStreamNowPlaying";
import { usePsyBrazilNowPlaying } from "./usePsyBrazilNowPlaying";
import { useDumangueNowPlaying } from "./useDumangueNowPlaying";
import { useDeepTripNowPlaying } from "./useDeepTripNowPlaying";
import {
  mapSignalTarget,
  resolveShortestHueDeltaDegrees,
  stepSmoothedValue,
  wrapSignedDegrees,
} from "./reactiveBehaviorMapping";
import {
  FULLON_BUILT_IN_PRESET,
  resolveSnapshotSignal,
} from "./reactiveBehaviorPresetSchema";
import "../styles/player.css";

type PlayerShellProps = {
  className?: string;
};

type PlayerPreferences = {
  selectedThemeId: ThemeId;
  selectedAudioSourceId: string;
  volume: number;
  motionEnabled: boolean;
  visualFeedOpen: boolean;
  colorEnabled?: boolean;
};

type PlayerPanelSize = {
  width: number;
  height: number;
};

type TelemetryLayoutMode = "tablet" | "compact-desktop" | "desktop";

type TelemetryPanelMeasurement = {
  height: number;
  layoutMode: TelemetryLayoutMode | null;
};

type AuxPanelKey = "visual-feed" | "telemetry";

const PLAYER_PANEL_SIZE_EPSILON = 0.75;

type VisualFeedDockMode = "right" | "bottom";

const PLAYER_PREFERENCES_STORAGE_KEY_V3 = "deepsignals.player.preferences.v3";
const SIGNAL_TELEMETRY_VISIBLE_STORAGE_KEY_V2 =
  "deepsignals.player.signal-telemetry.visible.v2";

const DEFAULT_PLAYER_THEME_ID = "signal-runner";
const DEFAULT_PLAYER_AUDIO_SOURCE_ID =
  GLOBULAR_FOR_THE_TIME_BEING_AUDIO_SOURCE.id;
const PUBLIC_PLAYER_ENVIRONMENT_IDS = [
  "signal-runner",
  "minimal",
  "cosmic-nexus",
  "uv-reactive-jungle",
  "analog-signal-laboratory",
  "bioluminescent-psy-reef",
  "crystal-cavern",
  "slime-cavern",
  "dark-psy-temple",
] as const;
const publicPlayerEnvironmentIds = new Set<string>(
  PUBLIC_PLAYER_ENVIRONMENT_IDS,
);
// Kept selectable via persisted/dev state, but hidden from the visible Environment dropdown.
const HIDDEN_ENVIRONMENT_DROPDOWN_IDS = new Set<string>(["slime-cavern"]);
// Short, user-facing labels for the Environment dropdown; underlying theme names/ids are unchanged.
const PUBLIC_ENVIRONMENT_DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "cosmic-nexus": "Nexus",
  "uv-reactive-jungle": "Psy Jungle",
  "analog-signal-laboratory": "Analog Lab",
  "bioluminescent-psy-reef": "Psy Reef",
};
const PUBLIC_DEMO_SOURCE_EXCLUSIONS = new Set([
  "demo-dfectv-spcyht-no-name",
  "demo-dfectv-the-maze",
  "demo-dfectv-starfire-beyond-the-boundries",
  "demo-dfectv-its-a-trap",
]);
// Additional PsyBrazil network station ids can be added here as they are onboarded.
const PSYBRAZIL_NETWORK_SOURCE_IDS = new Set(["psybrazil", "psybrazil-dumangue"]);
const PSYBRAZIL_NETWORK_GROUP_LABEL = "PSYBRAZIL ENTERTAINMENT NETWORK";

const PLAYER_EDGE_GAP = 22;
const PLAYER_PANEL_FALLBACK_WIDTH = 430;
const PLAYER_PANEL_FALLBACK_HEIGHT = 560;
const VISUAL_FEED_MODULE_WIDTH = 240;
const VISUAL_FEED_ASPECT_RATIO = 9 / 16;
const VISUAL_FEED_HEADER_HEIGHT = 52;
const TELEMETRY_BOTTOM_DOCK_FALLBACK_HEIGHT = 224;
const TELEMETRY_BOTTOM_DOCK_FALLBACK_HEIGHT_COMPACT = 210;
const TELEMETRY_BOTTOM_DOCK_FALLBACK_HEIGHT_TABLET = 264;
const TELEMETRY_VISIBILITY_HYSTERESIS_PX = 12;

const FULLON_STOP_SETTLE_DEPTH = 0.5;
const FULLON_STOP_SETTLE_HUE_DEGREES = 0;
const FULLON_STOP_SETTLE_SATURATION = 1;

const availableAudioSourceIds = new Set(
  AUDIO_SOURCES.map((source) => source.id),
);

function sanitizeThemeId(value: unknown): ThemeId {
  if (typeof value !== "string") {
    return DEFAULT_PLAYER_THEME_ID;
  }

  return publicPlayerEnvironmentIds.has(value) &&
    themeRegistry.some((theme) => theme.id === value)
    ? value
    : DEFAULT_PLAYER_THEME_ID;
}

function sanitizeAudioSourceId(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_PLAYER_AUDIO_SOURCE_ID;
  }

  return availableAudioSourceIds.has(value)
    ? value
    : DEFAULT_PLAYER_AUDIO_SOURCE_ID;
}

function sanitizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeVolume(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

function readStoredPlayerPreferences(): PlayerPreferences {
  const fallback: PlayerPreferences = {
    selectedThemeId: DEFAULT_PLAYER_THEME_ID,
    selectedAudioSourceId: DEFAULT_PLAYER_AUDIO_SOURCE_ID,
    volume: 1,
    motionEnabled: true,
    colorEnabled: true,
    visualFeedOpen: true,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawV3 = window.localStorage.getItem(
      PLAYER_PREFERENCES_STORAGE_KEY_V3,
    );

    if (rawV3) {
      const parsed = JSON.parse(rawV3) as Partial<PlayerPreferences>;

      return {
        selectedThemeId: sanitizeThemeId(parsed.selectedThemeId),
        selectedAudioSourceId: sanitizeAudioSourceId(
          parsed.selectedAudioSourceId,
        ),
        volume: 1,
        motionEnabled: sanitizeBoolean(parsed.motionEnabled, true),
        colorEnabled: sanitizeBoolean(parsed.colorEnabled, true),
        visualFeedOpen: sanitizeBoolean(parsed.visualFeedOpen, true),
      };
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function readStoredSignalTelemetryVisiblePreference() {
  const fallback = false;

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(
      SIGNAL_TELEMETRY_VISIBLE_STORAGE_KEY_V2,
    );

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as { visible?: unknown } | unknown;

    if (typeof parsed === "object" && parsed !== null && "visible" in parsed) {
      return sanitizeBoolean(
        (parsed as { visible?: unknown }).visible,
        fallback,
      );
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function isAudioDebugEnabled() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("audioDebug") === "1";
}

function isIgnoreSourceBpmEnabled() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("ignoreSourceBpm") === "1";
}

function estimateVisualFeedWidth() {
  return VISUAL_FEED_MODULE_WIDTH;
}

function estimateVisualFeedHeight() {
  return (
    Math.round(
      estimateVisualFeedWidth() * VISUAL_FEED_ASPECT_RATIO,
    ) + VISUAL_FEED_HEADER_HEIGHT
  );
}

function getTelemetryLayoutMode(
  viewportWidth: number,
  viewportHeight: number,
): TelemetryLayoutMode {
  if (viewportWidth <= 1024) {
    return "tablet";
  }

  return viewportHeight <= 800 ? "compact-desktop" : "desktop";
}

function getTelemetryBottomDockHeight(
  viewportWidth: number,
  viewportHeight: number,
  measurement: TelemetryPanelMeasurement,
) {
  const layoutMode = getTelemetryLayoutMode(viewportWidth, viewportHeight);

  if (measurement.layoutMode === layoutMode && measurement.height > 0) {
    return Math.ceil(measurement.height);
  }

  if (layoutMode === "tablet") {
    return TELEMETRY_BOTTOM_DOCK_FALLBACK_HEIGHT_TABLET;
  }

  return layoutMode === "compact-desktop"
    ? TELEMETRY_BOTTOM_DOCK_FALLBACK_HEIGHT_COMPACT
    : TELEMETRY_BOTTOM_DOCK_FALLBACK_HEIGHT;
}

function getAvailabilityPlayerDimensions(
  viewportWidth: number,
  playerPanelSize: PlayerPanelSize,
) {
  const width = Math.min(
    playerPanelSize.width || PLAYER_PANEL_FALLBACK_WIDTH,
    PLAYER_PANEL_FALLBACK_WIDTH,
    Math.max(0, viewportWidth - PLAYER_EDGE_GAP * 2),
  );
  const height = Math.min(
    playerPanelSize.height || PLAYER_PANEL_FALLBACK_HEIGHT,
    PLAYER_PANEL_FALLBACK_HEIGHT,
  );

  return { width, height };
}

function getVisualFeedFit(
  viewportWidth: number,
  viewportHeight: number,
  playerPanelSize: PlayerPanelSize,
) {
  const { width: playerWidth, height: playerHeight } =
    getAvailabilityPlayerDimensions(viewportWidth, playerPanelSize);
  const rightFeedWidth = estimateVisualFeedWidth();
  const rightFeedHeight = estimateVisualFeedHeight();
  const bottomFeedHeight =
    Math.round(playerWidth * VISUAL_FEED_ASPECT_RATIO) +
    VISUAL_FEED_HEADER_HEIGHT;

  const right =
    viewportWidth >= playerWidth + rightFeedWidth + PLAYER_EDGE_GAP * 2 &&
    viewportHeight >=
      Math.max(playerHeight, rightFeedHeight) + PLAYER_EDGE_GAP * 2;
  const bottom =
    viewportWidth >= playerWidth + PLAYER_EDGE_GAP * 2 &&
    viewportHeight >= playerHeight + bottomFeedHeight + PLAYER_EDGE_GAP * 2;

  return { right, bottom };
}

function canFitTelemetryBelowPlayer(
  viewportWidth: number,
  viewportHeight: number,
  playerPanelSize: PlayerPanelSize,
  telemetryPanelMeasurement: TelemetryPanelMeasurement,
) {
  const { width: playerWidth, height: playerHeight } =
    getAvailabilityPlayerDimensions(viewportWidth, playerPanelSize);
  const telemetryHeight = getTelemetryBottomDockHeight(
    viewportWidth,
    viewportHeight,
    telemetryPanelMeasurement,
  );

  return (
    viewportWidth >= playerWidth + PLAYER_EDGE_GAP * 2 &&
    viewportHeight >=
      Math.ceil(playerHeight) + telemetryHeight + PLAYER_EDGE_GAP * 2
  );
}

function getTelemetryFitSlack(
  viewportWidth: number,
  viewportHeight: number,
  playerPanelSize: PlayerPanelSize,
  telemetryPanelMeasurement: TelemetryPanelMeasurement,
) {
  const { height: playerHeight } =
    getAvailabilityPlayerDimensions(viewportWidth, playerPanelSize);
  const telemetryHeight = getTelemetryBottomDockHeight(
    viewportWidth,
    viewportHeight,
    telemetryPanelMeasurement,
  );

  return (
    viewportHeight -
    (Math.ceil(playerHeight) + telemetryHeight + PLAYER_EDGE_GAP * 2)
  );
}

function canFitSharedBottomAuxSlot(
  viewportWidth: number,
  viewportHeight: number,
  playerPanelSize: PlayerPanelSize,
  supportsVisualFeed: boolean,
  telemetryPanelMeasurement: TelemetryPanelMeasurement,
) {
  const { width: playerWidth, height: playerHeight } =
    getAvailabilityPlayerDimensions(viewportWidth, playerPanelSize);
  const telemetryHeight = getTelemetryBottomDockHeight(
    viewportWidth,
    viewportHeight,
    telemetryPanelMeasurement,
  );
  const feedHeight = supportsVisualFeed
    ? Math.round(playerWidth * VISUAL_FEED_ASPECT_RATIO) +
      VISUAL_FEED_HEADER_HEIGHT
    : 0;
  const requiredAuxHeight = Math.max(telemetryHeight, feedHeight);

  return (
    viewportWidth >= playerWidth + PLAYER_EDGE_GAP * 2 &&
    viewportHeight >=
      Math.ceil(playerHeight) + requiredAuxHeight + PLAYER_EDGE_GAP * 2
  );
}

const ZERO_REACTIVE_PREVIEW_TELEMETRY: ReactivePreviewTelemetry = {
  selectedReactiveBehavior: "Chill",
  selectedDepthSignalField: "n/a",
  selectedHueSignalField: "n/a",
  selectedSaturationSignalField: "n/a",
  reactivePreviewEnabled: false,
  reactiveIsolationEnabled: false,
  reactiveTimingAuthorityActive: false,
  musicAuthorityActive: false,
  motionGateOpen: false,
  authoredCyclicBreathingEnabled: false,
  authoredDepthContribution: 0,
  authoredAmbientGeometryContribution: 0,
  depthSustainedContribution: 0,
  kickDrivenDepthContribution: 0,
  depthPulseContribution: 0,
  depthCombinedBeforeClamp: 0,
  configuredDepthMinimum: 0,
  configuredDepthMaximum: 0,
  depthFinalAfterClamp: 0,
  finalDisplacementScale: 0,
  kickPulse: 0,
  kickPulseAcceptedEvent: false,
  kickPulseAcceptedEventCount: 0,
  kickPulseAcceptedEventSequence: 0,
  rendererKickEventCountLastSeen: 0,
  rendererKickEventSequenceLastSeen: 0,
  sourceBpm: null,
  beatIntervalMs: null,
  acceptedEventMinimumIntervalMs: 0,
  millisecondsSincePreviousAcceptedEvent: 0,
  acceptedEventRatePerSecondRecent: 0,
  smoothedEnergy: 0,
  sectionIntensity: 0,
  fullOnPhase: "n/a",
  fullOnTargetDepth: 0,
  fullOnCurrentDepth: 0,
  fullOnTargetSaturation: 1,
  fullOnCurrentSaturation: 1,
  millisecondsSinceAcceptedKickEvent: 0,
  inactivityReturnActive: false,
  kickBreathEnvelope: 0,
  fullOnLowTargetDepth: 0,
  fullOnHighTargetDepth: 0,
  fullOnAttackDurationMs: 0,
  fullOnReleaseDurationMs: 0,
  kickBloomEnvelope: 0,
  hueEventStride: 1,
  hueEventStepAppliedDegrees: 0,
  reactiveHueTargetDegrees: 0,
  reactiveHueOffsetDegrees: 0,
  finalHueShiftDegrees: 0,
  authoredBaseSaturation: 1,
  authoredPeriodicSaturationContribution: 0,
  reactiveSaturationMultiplier: 1,
  finalSaturation: 1,
  grayscaleFilterActive: false,
  saturationBloomMultiplier: 1,
  saturationCap: 2,
  authoredBaseGlow: 1,
  reactiveKickBloom: 0,
  globalGlowMultiplier: 1,
  saturationMultiplier: 1,
  globalLightMultiplier: 1,
  finalGlobalGlowMultiplier: 1,
  authoredHueCycleSuppressed: false,
  authoredSaturationCycleSuppressed: false,
  authoredGlobalGlowCycleSuppressed: false,
  transientAccent: 0,
  geometryMotionActive: false,
};

const ZERO_IMAGE_DEPTH_SCENE_COUNTERS: ImageDepthSceneCounters = {
  sceneComponentMountCount: 0,
  sceneComponentUnmountCount: 0,
  rendererCreationCount: 0,
  textureLoadCount: 0,
  materialGeometryInitializationCount: 0,
  environmentChangeCount: 0,
  depthUpdateCount: 0,
};

function PlayerShell({ className }: PlayerShellProps) {
  const [audioDebugEnabled] = useState(() => isAudioDebugEnabled());
  const [ignoreSourceBpmEnabled] = useState(() => isIgnoreSourceBpmEnabled());
  const [storedPreferences] = useState<PlayerPreferences>(() =>
    readStoredPlayerPreferences(),
  );
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(
    storedPreferences.selectedThemeId,
  );
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(
    storedPreferences.selectedAudioSourceId,
  );
  const [motionEnabled, setMotionEnabled] = useState(
    storedPreferences.motionEnabled,
  );
  // Reserved for future environment chroma-effect wiring; currently UI preference only.
  const [chromaEnabled, setChromaEnabled] = useState(
    sanitizeBoolean(storedPreferences.colorEnabled, true),
  );
  const [signalTelemetryVisible, setSignalTelemetryVisible] = useState(() =>
    readStoredSignalTelemetryVisiblePreference(),
  );
  const [telemetryControlAvailable, setTelemetryControlAvailable] =
    useState(true);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 768 : window.innerHeight,
  }));
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [visualFeedOpen, setVisualFeedOpen] = useState(
    storedPreferences.visualFeedOpen,
  );
  const [lastActiveAuxPanel, setLastActiveAuxPanel] =
    useState<AuxPanelKey>("visual-feed");
  const [playerPanelSize, setPlayerPanelSize] = useState<PlayerPanelSize>({
    width: PLAYER_PANEL_FALLBACK_WIDTH,
    height: PLAYER_PANEL_FALLBACK_HEIGHT,
  });
  const [telemetryPanelMeasurement, setTelemetryPanelMeasurement] =
    useState<TelemetryPanelMeasurement>({ height: 0, layoutMode: null });
  const reactivePreviewTelemetryRef = useRef<ReactivePreviewTelemetry>(
    ZERO_REACTIVE_PREVIEW_TELEMETRY,
  );
  const playerPanelRef = useRef<HTMLElement | null>(null);
  const playerPanelMeasuredRef = useRef(false);
  const telemetryPanelRef = useRef<HTMLElement | null>(null);
  const signalTelemetryToggleRef = useRef<HTMLInputElement | null>(null);
  const visualFeedToggleRef = useRef<HTMLInputElement | null>(null);
  const [sceneCounters, setSceneCounters] = useState<ImageDepthSceneCounters>(
    ZERO_IMAGE_DEPTH_SCENE_COUNTERS,
  );
  const [fullOnDepthOverride, setFullOnDepthOverride] = useState(
    FULLON_STOP_SETTLE_DEPTH,
  );
  const [fullOnHueShiftOverrideDegrees, setFullOnHueShiftOverrideDegrees] =
    useState(FULLON_STOP_SETTLE_HUE_DEGREES);
  const [
    fullOnSaturationOverrideMultiplier,
    setFullOnSaturationOverrideMultiplier,
  ] = useState(FULLON_STOP_SETTLE_SATURATION);
  const fullOnDepthCurrentRef = useRef(FULLON_STOP_SETTLE_DEPTH);
  const fullOnHueCurrentRef = useRef(FULLON_STOP_SETTLE_HUE_DEGREES);
  const fullOnSaturationCurrentRef = useRef(FULLON_STOP_SETTLE_SATURATION);
  const audioController = usePersistentAudioController(
    storedPreferences.volume,
    selectedSignalId ?? undefined,
  );
  const psyStreamNowPlaying = usePsyStreamNowPlaying(selectedSignalId);
  const psyBrazilNowPlaying = usePsyBrazilNowPlaying(selectedSignalId);
  const dumangueNowPlaying = useDumangueNowPlaying(selectedSignalId);
  const deepTripNowPlaying = useDeepTripNowPlaying(selectedSignalId);
  const externalNowPlaying =
    psyStreamNowPlaying ??
    psyBrazilNowPlaying ??
    dumangueNowPlaying ??
    deepTripNowPlaying;
  const registrySourceBpm = audioController.audioSource.bpm ?? null;
  const effectiveReactiveBpm = ignoreSourceBpmEnabled
    ? null
    : registrySourceBpm;
  const audioAnalysis = useAudioAnalysis({
    audioElement: audioController.audioElement,
    playbackStatus: audioController.playbackStatus,
    isSeeking: audioController.isSeeking,
    audioSourceId: selectedSignalId,
    sourceBpm: effectiveReactiveBpm,
    publishDiagnostics: audioDebugEnabled,
  });

  const imageDepthAssetsByThemeId = useMemo(
    () =>
      new Map(
        imageDepthEnvironmentCatalog.map((environment) => [
          environment.id as ThemeId,
          environment.asset,
        ]),
      ),
    [],
  );

  useEffect(() => {
    const selectedAsset = imageDepthAssetsByThemeId.get(selectedThemeId);

    if (!selectedAsset) {
      return;
    }

    void preloadImageDepthTextures(selectedAsset);
  }, [selectedThemeId, imageDepthAssetsByThemeId]);

  const signals: SignalSource[] = useMemo(
    () =>
      AUDIO_SOURCES.map((source) => ({
        id: source.id,
        label: formatAudioSourceLabel(source),
      })),
    [],
  );

  const signalGroups: SignalSourceGroup[] = useMemo(
    () => [
      {
        label: "DEEPSIGNALS.FM",
        signals: [
          {
            id: "deepsignals-chillout-coming-soon",
            label: "DeepSignals.FM Chillout — COMING SOON",
            disabled: true,
          },
          {
            id: "deepsignals-psytrance-coming-soon",
            label: "DeepSignals.FM Psytrance — COMING SOON",
            disabled: true,
          },
        ],
      },
      {
        label: PSYBRAZIL_NETWORK_GROUP_LABEL,
        signals: PUBLIC_EXTERNAL_AUDIO_SOURCES
          .filter((source) => PSYBRAZIL_NETWORK_SOURCE_IDS.has(source.id))
          .map((source) => ({
            id: source.id,
            label: formatAudioSourceLabel(source),
          }))
          .sort((left, right) => left.label.localeCompare(right.label)),
      },
      {
        label: "EXTERNAL SIGNALS",
        signals: PUBLIC_EXTERNAL_AUDIO_SOURCES
          .filter((source) => !PSYBRAZIL_NETWORK_SOURCE_IDS.has(source.id))
          .map((source) => ({
            id: source.id,
            label: formatAudioSourceLabel(source),
          }))
          .sort((left, right) => left.label.localeCompare(right.label)),
      },
      {
        label: "DEMO TRANSMISSIONS",
        signals: DEMO_AUDIO_SOURCES
          .filter((source) => !PUBLIC_DEMO_SOURCE_EXCLUSIONS.has(source.id))
          .map((source) => ({
            id: source.id,
            label: formatAudioSourceLabel(source),
          }))
          .sort((left, right) => left.label.localeCompare(right.label)),
      },
    ],
    [],
  );

  const activeTheme = useMemo(() => {
    return themeRegistry.find((theme) => theme.id === selectedThemeId);
  }, [selectedThemeId]);

  const themeOptions = useMemo(
    () =>
      PUBLIC_PLAYER_ENVIRONMENT_IDS.flatMap((themeId) => {
        if (HIDDEN_ENVIRONMENT_DROPDOWN_IDS.has(themeId)) {
          return [];
        }

        const theme = themeRegistry.find((candidate) => candidate.id === themeId);
        return theme
          ? [
              {
                id: theme.id,
                name: PUBLIC_ENVIRONMENT_DISPLAY_NAME_OVERRIDES[theme.id] ?? theme.name,
              },
            ]
          : [];
      }).sort((left, right) => left.name.localeCompare(right.name)),
    [],
  );

  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.id === selectedSignalId),
    [selectedSignalId, signals],
  );

  const supportsChroma = activeTheme?.supportsChroma ?? true;
  const supportsMotion = activeTheme?.supportsMotion ?? true;
  const supportsVisualFeed = activeTheme?.supportsVisualFeed ?? true;
  const supportsAudioReactiveBehavior =
    activeTheme?.supportsAudioReactiveBehavior ?? false;
  const productionFullOnActive = supportsAudioReactiveBehavior;
  const productionDepthMotionSuppressed =
    supportsAudioReactiveBehavior && !motionEnabled;
  const visualFeedFit = supportsVisualFeed
    ? getVisualFeedFit(viewportSize.width, viewportSize.height, playerPanelSize)
    : { right: false, bottom: false };
  const canFitTelemetryBottom = canFitTelemetryBelowPlayer(
    viewportSize.width,
    viewportSize.height,
    playerPanelSize,
    telemetryPanelMeasurement,
  );
  const canFitSharedBottomSlot = canFitSharedBottomAuxSlot(
    viewportSize.width,
    viewportSize.height,
    playerPanelSize,
    supportsVisualFeed,
    telemetryPanelMeasurement,
  );
  const auxRightAvailable = supportsVisualFeed && visualFeedFit.right;
  const auxBottomAvailable = canFitSharedBottomSlot;
  const auxiliaryControlsVisible = auxRightAvailable || auxBottomAvailable;
  const usingSharedBottomSlot = !auxRightAvailable && auxBottomAvailable;

  const activeSharedAuxPanel: AuxPanelKey | null = !usingSharedBottomSlot
    ? null
    : visualFeedOpen && signalTelemetryVisible
      ? lastActiveAuxPanel
      : visualFeedOpen
        ? "visual-feed"
        : signalTelemetryVisible
          ? "telemetry"
          : null;

  const renderVisualFeedRight =
    supportsVisualFeed && visualFeedOpen && auxRightAvailable;
  const renderVisualFeedBottom =
    supportsVisualFeed &&
    usingSharedBottomSlot &&
    activeSharedAuxPanel === "visual-feed";
  const renderTelemetryBottom = usingSharedBottomSlot
    ? activeSharedAuxPanel === "telemetry"
    : signalTelemetryVisible && canFitTelemetryBottom;

  const effectiveVisualFeedOpen =
    renderVisualFeedRight || renderVisualFeedBottom;
  const effectiveSignalTelemetryVisible = renderTelemetryBottom;
  const visualFeedDockMode: VisualFeedDockMode | null = renderVisualFeedRight
    ? "right"
    : renderVisualFeedBottom
      ? "bottom"
      : null;

  const showVisualFeedControl = supportsVisualFeed && auxiliaryControlsVisible;
  const showSignalTelemetryControl = telemetryControlAvailable;

  const setVisualFeedOpenFromToggle = useCallback(
    (enabled: boolean) => {
      setVisualFeedOpen(enabled);

      if (!enabled) {
        return;
      }

      setLastActiveAuxPanel("visual-feed");

      if (usingSharedBottomSlot) {
        setSignalTelemetryVisible(false);
      }
    },
    [usingSharedBottomSlot],
  );

  const setSignalTelemetryVisibleFromToggle = useCallback(
    (enabled: boolean) => {
      setSignalTelemetryVisible(enabled);

      if (!enabled) {
        return;
      }

      setLastActiveAuxPanel("telemetry");

      if (usingSharedBottomSlot) {
        setVisualFeedOpen(false);
      }
    },
    [usingSharedBottomSlot],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleViewportChange = () => {
      const nextViewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      setViewportSize(nextViewport);

      const nextVisualFeedFit = supportsVisualFeed
        ? getVisualFeedFit(
            nextViewport.width,
            nextViewport.height,
            playerPanelSize,
          )
        : { right: false, bottom: false };
      const nextCanFitTelemetry = canFitTelemetryBelowPlayer(
        nextViewport.width,
        nextViewport.height,
        playerPanelSize,
        telemetryPanelMeasurement,
      );
      const nextTelemetryFitSlack = getTelemetryFitSlack(
        nextViewport.width,
        nextViewport.height,
        playerPanelSize,
        telemetryPanelMeasurement,
      );
      setTelemetryControlAvailable((current) =>
        current
          ? nextTelemetryFitSlack >= -TELEMETRY_VISIBILITY_HYSTERESIS_PX
          : nextTelemetryFitSlack >= TELEMETRY_VISIBILITY_HYSTERESIS_PX,
      );
      const nextSharedBottomSlot =
        !nextVisualFeedFit.right &&
        canFitSharedBottomAuxSlot(
          nextViewport.width,
          nextViewport.height,
          playerPanelSize,
          supportsVisualFeed,
          telemetryPanelMeasurement,
        );
      const nextSignalTelemetryVisible =
        signalTelemetryVisible &&
        (!playerPanelMeasuredRef.current || nextCanFitTelemetry);

      if (
        playerPanelMeasuredRef.current &&
        signalTelemetryVisible &&
        !nextCanFitTelemetry
      ) {
        setSignalTelemetryVisible(false);
      }

      if (
        !nextSharedBottomSlot ||
        !(visualFeedOpen && nextSignalTelemetryVisible)
      ) {
        return;
      }

      if (lastActiveAuxPanel === "visual-feed") {
        setSignalTelemetryVisible(false);
      } else {
        setVisualFeedOpen(false);
      }
    };

    handleViewportChange();
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [
    lastActiveAuxPanel,
    playerPanelSize,
    signalTelemetryVisible,
    supportsVisualFeed,
    telemetryPanelMeasurement,
    visualFeedOpen,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const playerPanelElement = playerPanelRef.current;

    if (!playerPanelElement) {
      return;
    }

    const updatePlayerPanelSize = () => {
      const nextRect = playerPanelElement.getBoundingClientRect();
      const nextWidth = Math.round(nextRect.width * 100) / 100;
      const nextHeight = Math.round(nextRect.height * 100) / 100;

      playerPanelMeasuredRef.current = true;

      if (
        signalTelemetryVisible &&
        !canFitTelemetryBelowPlayer(
          window.innerWidth,
          window.innerHeight,
          { width: nextWidth, height: nextHeight },
          telemetryPanelMeasurement,
        )
      ) {
        setSignalTelemetryVisible(false);
      }

      setPlayerPanelSize((current) => {
        const widthDelta = Math.abs(current.width - nextWidth);
        const heightDelta = Math.abs(current.height - nextHeight);

        if (
          widthDelta <= PLAYER_PANEL_SIZE_EPSILON &&
          heightDelta <= PLAYER_PANEL_SIZE_EPSILON
        ) {
          return current;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
    };

    updatePlayerPanelSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updatePlayerPanelSize);

      return () => {
        window.removeEventListener("resize", updatePlayerPanelSize);
      };
    }

    const observer = new ResizeObserver(() => {
      updatePlayerPanelSize();
    });

    observer.observe(playerPanelElement);
    window.addEventListener("resize", updatePlayerPanelSize);

    return () => {
      window.removeEventListener("resize", updatePlayerPanelSize);
      observer.disconnect();
    };
  }, [signalTelemetryVisible, telemetryPanelMeasurement]);

  useEffect(() => {
    const telemetryPanelElement = telemetryPanelRef.current;

    if (!telemetryPanelElement) {
      return;
    }

    const updateTelemetryPanelMeasurement = () => {
      const nextRect = telemetryPanelElement.getBoundingClientRect();
      const nextHeight = Math.round(nextRect.height * 100) / 100;
      const layoutMode = getTelemetryLayoutMode(
        window.innerWidth,
        window.innerHeight,
      );
      const nextMeasurement = { height: nextHeight, layoutMode };

      if (
        signalTelemetryVisible &&
        playerPanelRef.current &&
        !canFitTelemetryBelowPlayer(
          window.innerWidth,
          window.innerHeight,
          playerPanelRef.current.getBoundingClientRect(),
          nextMeasurement,
        )
      ) {
        setSignalTelemetryVisible(false);
      }

      setTelemetryPanelMeasurement((current) => {
        if (
          current.layoutMode === layoutMode &&
          Math.abs(current.height - nextHeight) <= PLAYER_PANEL_SIZE_EPSILON
        ) {
          return current;
        }

        return nextMeasurement;
      });
    };

    updateTelemetryPanelMeasurement();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateTelemetryPanelMeasurement);

      return () => {
        window.removeEventListener("resize", updateTelemetryPanelMeasurement);
      };
    }

    const observer = new ResizeObserver(updateTelemetryPanelMeasurement);
    observer.observe(telemetryPanelElement);

    return () => {
      observer.disconnect();
    };
  }, [effectiveSignalTelemetryVisible, signalTelemetryVisible]);

  const handleSignalChange = (id: string) => {
    setSelectedSignalId(sanitizeAudioSourceId(id) || null);
  };

  const handleThemeChange = (themeId: ThemeId) => {
    setSelectedThemeId(themeId);

    const nextTheme = themeRegistry.find((theme) => theme.id === themeId);

    if (!nextTheme?.supportsVisualFeed) {
      setVisualFeedOpen(false);
    }
  };

  const focusSignalTelemetryToggle = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      signalTelemetryToggleRef.current?.focus();
    });
  };

  const focusVisualFeedToggle = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      visualFeedToggleRef.current?.focus();
    });
  };

  const handleSignalTelemetryClose = () => {
    setSignalTelemetryVisible(false);
    focusSignalTelemetryToggle();
  };

  const handleVisualFeedClose = () => {
    setVisualFeedOpen(false);
    focusVisualFeedToggle();
  };

  useEffect(() => {
    const resetFullOnOverrides = () => {
      if (
        fullOnDepthCurrentRef.current === FULLON_STOP_SETTLE_DEPTH &&
        fullOnHueCurrentRef.current === FULLON_STOP_SETTLE_HUE_DEGREES &&
        fullOnSaturationCurrentRef.current === FULLON_STOP_SETTLE_SATURATION
      ) {
        return;
      }

      fullOnDepthCurrentRef.current = FULLON_STOP_SETTLE_DEPTH;
      fullOnHueCurrentRef.current = FULLON_STOP_SETTLE_HUE_DEGREES;
      fullOnSaturationCurrentRef.current = FULLON_STOP_SETTLE_SATURATION;
      setFullOnDepthOverride(FULLON_STOP_SETTLE_DEPTH);
      setFullOnHueShiftOverrideDegrees(FULLON_STOP_SETTLE_HUE_DEGREES);
      setFullOnSaturationOverrideMultiplier(FULLON_STOP_SETTLE_SATURATION);
    };

    if (!productionFullOnActive) {
      resetFullOnOverrides();
      return;
    }

    let rafId: number | null = null;
    const getLatestSnapshot = audioAnalysis.getLatestSnapshot;

    const tick = () => {
      const snapshot = getLatestSnapshot();
      const isPlayingNow = audioController.playbackStatus === "playing";

      const energySignal = resolveSnapshotSignal(
        snapshot,
        FULLON_BUILT_IN_PRESET.depth.signal,
      );
      const bassSignal = resolveSnapshotSignal(
        snapshot,
        FULLON_BUILT_IN_PRESET.saturation.signal,
      );

      const depthTarget = isPlayingNow
        ? mapSignalTarget(
            energySignal,
            FULLON_BUILT_IN_PRESET.depth.min,
            FULLON_BUILT_IN_PRESET.depth.max,
          )
        : FULLON_STOP_SETTLE_DEPTH;
      const hueTarget = isPlayingNow
        ? mapSignalTarget(
            energySignal,
            FULLON_BUILT_IN_PRESET.hue.minDegrees,
            FULLON_BUILT_IN_PRESET.hue.maxDegrees,
          )
        : FULLON_STOP_SETTLE_HUE_DEGREES;
      const saturationTarget = isPlayingNow
        ? mapSignalTarget(
            bassSignal,
            FULLON_BUILT_IN_PRESET.saturation.min,
            FULLON_BUILT_IN_PRESET.saturation.max,
          )
        : FULLON_STOP_SETTLE_SATURATION;

      const nextDepth = stepSmoothedValue(
        fullOnDepthCurrentRef.current,
        depthTarget,
        FULLON_BUILT_IN_PRESET.depth.smoothing,
      );
      const shortestHueDelta = resolveShortestHueDeltaDegrees(
        fullOnHueCurrentRef.current,
        hueTarget,
      );
      const nextHue = wrapSignedDegrees(
        stepSmoothedValue(
          fullOnHueCurrentRef.current,
          fullOnHueCurrentRef.current + shortestHueDelta,
          FULLON_BUILT_IN_PRESET.hue.smoothing,
        ),
      );
      const nextSaturation = Math.max(
        0,
        stepSmoothedValue(
          fullOnSaturationCurrentRef.current,
          saturationTarget,
          FULLON_BUILT_IN_PRESET.saturation.smoothing,
        ),
      );

      fullOnDepthCurrentRef.current =
        Math.abs(nextDepth - depthTarget) < 0.0005 ? depthTarget : nextDepth;
      fullOnHueCurrentRef.current =
        Math.abs(shortestHueDelta) < 0.05
          ? wrapSignedDegrees(hueTarget)
          : nextHue;
      fullOnSaturationCurrentRef.current =
        Math.abs(nextSaturation - saturationTarget) < 0.0005
          ? saturationTarget
          : nextSaturation;

      const effectiveRenderedDepth = productionDepthMotionSuppressed
        ? FULLON_STOP_SETTLE_DEPTH
        : fullOnDepthCurrentRef.current;

      setFullOnDepthOverride(effectiveRenderedDepth);
      setFullOnHueShiftOverrideDegrees(fullOnHueCurrentRef.current);
      setFullOnSaturationOverrideMultiplier(fullOnSaturationCurrentRef.current);

      reactivePreviewTelemetryRef.current = {
        ...reactivePreviewTelemetryRef.current,
        selectedReactiveBehavior: "Full On",
        selectedDepthSignalField: FULLON_BUILT_IN_PRESET.depth.signal,
        selectedHueSignalField: FULLON_BUILT_IN_PRESET.hue.signal,
        selectedSaturationSignalField: FULLON_BUILT_IN_PRESET.saturation.signal,
        reactivePreviewEnabled: true,
        fullOnTargetDepth: depthTarget,
        fullOnCurrentDepth: effectiveRenderedDepth,
        reactiveHueTargetDegrees: hueTarget,
        reactiveHueOffsetDegrees: fullOnHueCurrentRef.current,
        finalHueShiftDegrees: fullOnHueCurrentRef.current,
        fullOnTargetSaturation: saturationTarget,
        fullOnCurrentSaturation: fullOnSaturationCurrentRef.current,
        finalSaturation: fullOnSaturationCurrentRef.current,
      };

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [
    audioAnalysis.getLatestSnapshot,
    audioController.playbackStatus,
    productionDepthMotionSuppressed,
    productionFullOnActive,
  ]);

  const effectiveProductionDepthOverride = productionDepthMotionSuppressed
    ? FULLON_STOP_SETTLE_DEPTH
    : productionFullOnActive
      ? fullOnDepthOverride
      : undefined;

  const handleSceneCountersChange = useCallback(
    (nextCounters: ImageDepthSceneCounters) => {
      setSceneCounters((current) => {
        if (
          current.sceneComponentMountCount ===
            nextCounters.sceneComponentMountCount &&
          current.sceneComponentUnmountCount ===
            nextCounters.sceneComponentUnmountCount &&
          current.rendererCreationCount ===
            nextCounters.rendererCreationCount &&
          current.textureLoadCount === nextCounters.textureLoadCount &&
          current.materialGeometryInitializationCount ===
            nextCounters.materialGeometryInitializationCount &&
          current.environmentChangeCount ===
            nextCounters.environmentChangeCount &&
          current.depthUpdateCount === nextCounters.depthUpdateCount
        ) {
          return current;
        }

        return nextCounters;
      });
    },
    [],
  );

  const sceneProps: ThemeSceneProps = {
    isPlaying: audioController.playbackStatus === "playing",
    volume: audioController.volume,
    signalId: selectedSignalId,
    audioLevel: 0,
    sourceBpm: effectiveReactiveBpm,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    motionEnabled,
    chromaEnabled,
    getLatestAudioSnapshot: audioAnalysis.getLatestSnapshot,
    reactivePreviewEnabled:
      supportsAudioReactiveBehavior && !productionFullOnActive,
    reactiveBehavior: "chill",
    manualDepthOverride: effectiveProductionDepthOverride,
    manualHueShiftOverrideDegrees: productionFullOnActive
      ? fullOnHueShiftOverrideDegrees
      : null,
    manualSaturationOverrideMultiplier: productionFullOnActive
      ? fullOnSaturationOverrideMultiplier
      : null,
    onDevSceneCountersChange: handleSceneCountersChange,
    onReactivePreviewTelemetry: (telemetry) => {
      reactivePreviewTelemetryRef.current = productionFullOnActive
        ? {
            ...telemetry,
            selectedReactiveBehavior: "Full On",
            selectedDepthSignalField: FULLON_BUILT_IN_PRESET.depth.signal,
            selectedHueSignalField: FULLON_BUILT_IN_PRESET.hue.signal,
            selectedSaturationSignalField:
              FULLON_BUILT_IN_PRESET.saturation.signal,
            fullOnTargetDepth:
              reactivePreviewTelemetryRef.current.fullOnTargetDepth,
            fullOnCurrentDepth: productionDepthMotionSuppressed
              ? FULLON_STOP_SETTLE_DEPTH
              : reactivePreviewTelemetryRef.current.fullOnCurrentDepth,
            reactiveHueTargetDegrees:
              reactivePreviewTelemetryRef.current.reactiveHueTargetDegrees,
            reactiveHueOffsetDegrees:
              reactivePreviewTelemetryRef.current.reactiveHueOffsetDegrees,
            finalHueShiftDegrees:
              reactivePreviewTelemetryRef.current.finalHueShiftDegrees,
            fullOnTargetSaturation:
              reactivePreviewTelemetryRef.current.fullOnTargetSaturation,
            fullOnCurrentSaturation:
              reactivePreviewTelemetryRef.current.fullOnCurrentSaturation,
            finalSaturation:
              reactivePreviewTelemetryRef.current.fullOnCurrentSaturation,
          }
        : telemetry;
    },
  };

  const reactiveDiagnosticsEnabled = audioDebugEnabled;

  const getReactivePreviewTelemetry = useCallback(() => {
    return reactivePreviewTelemetryRef.current;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const payload: PlayerPreferences = {
        selectedThemeId: sanitizeThemeId(selectedThemeId),
        selectedAudioSourceId: sanitizeAudioSourceId(selectedSignalId),
        volume: sanitizeVolume(audioController.volume),
        motionEnabled,
        colorEnabled: chromaEnabled,
        visualFeedOpen: visualFeedOpen && supportsVisualFeed,
      };

      window.localStorage.setItem(
        PLAYER_PREFERENCES_STORAGE_KEY_V3,
        JSON.stringify(payload),
      );
    } catch {
      // Gracefully ignore localStorage write failures.
    }
  }, [
    audioController.volume,
    chromaEnabled,
    motionEnabled,
    selectedSignalId,
    selectedThemeId,
    supportsVisualFeed,
    visualFeedOpen,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        SIGNAL_TELEMETRY_VISIBLE_STORAGE_KEY_V2,
        JSON.stringify({ visible: signalTelemetryVisible }),
      );
    } catch {
      // Gracefully ignore localStorage write failures.
    }
  }, [signalTelemetryVisible]);

  const transmissionLabel = useMemo(() => {
    if (externalNowPlaying?.artist && externalNowPlaying.title) {
      return `${externalNowPlaying.artist} — ${externalNowPlaying.title}`;
    }

    if (externalNowPlaying?.title) {
      return externalNowPlaying.title;
    }

    return formatAudioSourceLabel(audioController.audioSource);
  }, [audioController.audioSource, externalNowPlaying]);

  const handleAudioTogglePlay = async () => {
    if (audioController.playbackStatus !== "playing") {
      await audioAnalysis.requestInitializationFromUserGesture();
    }

    await audioController.togglePlay();
  };

  if (!activeTheme) {
    return null;
  }

  const SceneComponent = activeTheme.Scene;
  const signalState = !selectedSignalId
    ? "dormant"
    : audioController.playbackStatus === "playing"
      ? "playing"
      : "armed";
  const dockStyle = {
    "--player-panel-width": `${playerPanelSize.width}px`,
  } as CSSProperties;

  return (
    <div
      className={["player-shell", activeTheme.className, className]
        .filter(Boolean)
        .join(" ")}
      data-theme={activeTheme.id}
      data-signal-state={signalState}
    >
      <div className="player-shell__scene" aria-hidden="true">
        <SceneComponent {...sceneProps} />
      </div>

      <StationIdentOverlay
        isAudioPlaying={audioController.playbackStatus === "playing"}
      />

      {audioDebugEnabled ? (
        <AudioAnalysisDiagnostics
          status={audioAnalysis.status}
          snapshot={audioAnalysis.snapshot}
          bassPulseDebug={audioAnalysis.bassPulseDebug}
          kickPulseDebug={audioAnalysis.kickPulseDebug}
          graphDetails={audioAnalysis.graphDetails}
          errorMessage={audioAnalysis.errorMessage}
          diagnosticsPublishHz={audioAnalysis.diagnosticsPublishHz}
          analysisCalculationMode={audioAnalysis.analysisCalculationMode}
          sourceBpm={registrySourceBpm}
          effectiveReactiveBpm={effectiveReactiveBpm}
          ignoreSourceBpmEnabled={ignoreSourceBpmEnabled}
          motionEnabled={motionEnabled}
          reactiveDiagnosticsEnabled={reactiveDiagnosticsEnabled}
          getReactivePreviewTelemetry={getReactivePreviewTelemetry}
          sceneCounters={sceneCounters}
        />
      ) : null}

      <div
        className={[
          "player-shell__dock",
          visualFeedDockMode ? `player-shell__dock--${visualFeedDockMode}` : "",
          effectiveSignalTelemetryVisible
            ? "player-shell__dock--telemetry-open"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={dockStyle}
      >
        <div className="player-shell__primary-column">
          <FloatingPlayerPanel
            ref={playerPanelRef}
            environmentName={activeTheme.name}
            environmentOptions={themeOptions}
            selectedEnvironmentId={selectedThemeId}
            onEnvironmentChange={handleThemeChange}
            audioPlaybackStatus={audioController.playbackStatus}
            audioReactiveSnapshot={audioAnalysis.snapshot}
            audioCurrentTime={audioController.currentTime}
            audioDuration={audioController.duration}
            audioSeekable={audioController.seekable}
            audioMetadataLoaded={audioController.metadataLoaded}
            audioErrorMessage={audioController.errorMessage}
            audioIsSeeking={audioController.isSeeking}
            onAudioTogglePlay={handleAudioTogglePlay}
            onAudioSeek={audioController.seekTo}
            signalGroups={signalGroups}
            selectedSignalId={selectedSignalId}
            onSignalChange={handleSignalChange}
            signalLabel={selectedSignal ? transmissionLabel : null}
            isPlaying={audioController.playbackStatus === "playing"}
            volume={audioController.volume}
            onVolumeChange={audioController.setVolume}
            motionEnabled={motionEnabled}
            supportsMotion={supportsMotion}
            onMotionToggle={setMotionEnabled}
            chromaEnabled={chromaEnabled}
            supportsChroma={supportsChroma}
            onChromaToggle={setChromaEnabled}
            showSignalTelemetryControl={showSignalTelemetryControl}
            signalTelemetryVisible={signalTelemetryVisible}
            onSignalTelemetryChange={setSignalTelemetryVisibleFromToggle}
            signalTelemetryToggleRef={signalTelemetryToggleRef}
            showVisualFeedControl={showVisualFeedControl}
            visualFeedOpen={supportsVisualFeed ? visualFeedOpen : false}
            onVisualFeedChange={setVisualFeedOpenFromToggle}
            visualFeedToggleRef={visualFeedToggleRef}
            collapsed={panelCollapsed}
            onCollapsedChange={setPanelCollapsed}
          />

          {!audioDebugEnabled && effectiveSignalTelemetryVisible ? (
            <SignalTelemetryPanel
              ref={telemetryPanelRef}
              analysisStatus={audioAnalysis.status}
              playbackStatus={audioController.playbackStatus}
              getLatestSnapshot={audioAnalysis.getLatestSnapshot}
              getLatestReactiveTelemetry={getReactivePreviewTelemetry}
              onClose={handleSignalTelemetryClose}
            />
          ) : null}
        </div>

        <VisualFeedWindow
          open={effectiveVisualFeedOpen && visualFeedDockMode !== null}
          dockMode={visualFeedDockMode ?? "right"}
          onClose={handleVisualFeedClose}
          selectedTrackSource={
            selectedSignalId ? audioController.audioSource : null
          }
          metadataOverride={externalNowPlaying}
          Frame={activeTheme.VisualFeedFrame}
        />
      </div>
    </div>
  );
}

export default PlayerShell;
