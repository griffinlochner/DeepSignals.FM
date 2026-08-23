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
import { usePsyBrazilProgressiveNowPlaying } from "./usePsyBrazilProgressiveNowPlaying";
import { usePsyBrazilLoFiNowPlaying } from "./usePsyBrazilLoFiNowPlaying";
import { usePsyBrazilLowBpmNowPlaying } from "./usePsyBrazilLowBpmNowPlaying";
import { usePsyBrazilElectroNowPlaying } from "./usePsyBrazilElectroNowPlaying";
import { useDeepTripNowPlaying } from "./useDeepTripNowPlaying";
import { publishRuntimeTestSnapshot } from "./runtimeTestBridge";
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
  infoOpen: boolean;
  colorEnabled?: boolean;
};

type PlayerPanelSize = {
  width: number;
  height: number;
};

const PLAYER_PANEL_SIZE_EPSILON = 0.75;

type VisualFeedDockMode = "right" | "bottom";

const PLAYER_PREFERENCES_STORAGE_KEY_V3 = "deepsignals.player.preferences.v3";

const DEFAULT_PLAYER_THEME_ID = "signal-runner";
const DEFAULT_PLAYER_AUDIO_SOURCE_ID =
  GLOBULAR_FOR_THE_TIME_BEING_AUDIO_SOURCE.id;
const PUBLIC_PLAYER_ENVIRONMENT_IDS = [
  "signal-runner",
  "minimal",
  "cosmic-nexus",
  "neon-hyper-racer",
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
  "cosmic-nexus": "The Signal Nexus",
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
// Order is intentional (flagship first) rather than alphabetical.
const PSYBRAZIL_NETWORK_SOURCE_IDS = [
  "psybrazil",
  "psybrazil-dumangue",
  "psybrazil-progressive",
  "psybrazil-lofi",
  "psybrazil-lowbpm",
  "psybrazil-electro",
];
const PSYBRAZIL_NETWORK_SOURCE_ID_SET = new Set(PSYBRAZIL_NETWORK_SOURCE_IDS);
const PSYBRAZIL_NETWORK_GROUP_LABEL = "PSYBRAZIL ENTERTAINMENT NETWORK";

const PLAYER_EDGE_GAP = 22;
const PLAYER_PANEL_FALLBACK_WIDTH = 430;
const PLAYER_PANEL_FALLBACK_HEIGHT = 560;
const SIGNAL_INFO_COMPACT_WIDTH = 380;
const SIGNAL_INFO_COMPACT_HEIGHT = 360;

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
    infoOpen: true,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawV3 = window.localStorage.getItem(
      PLAYER_PREFERENCES_STORAGE_KEY_V3,
    );

    if (rawV3) {
      const parsed = JSON.parse(rawV3) as Partial<PlayerPreferences> & {
        visualFeedOpen?: unknown;
      };

      return {
        selectedThemeId: sanitizeThemeId(parsed.selectedThemeId),
        selectedAudioSourceId: sanitizeAudioSourceId(
          parsed.selectedAudioSourceId,
        ),
        volume: 1,
        motionEnabled: sanitizeBoolean(parsed.motionEnabled, true),
        colorEnabled: sanitizeBoolean(parsed.colorEnabled, true),
        infoOpen: sanitizeBoolean(
          parsed.infoOpen,
          sanitizeBoolean(parsed.visualFeedOpen, true),
        ),
      };
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
  const rightInfoHeight = SIGNAL_INFO_COMPACT_HEIGHT;
  const bottomFeedHeight = Math.round(playerWidth * (9 / 16)) + 220;

  const right =
    viewportWidth >=
      playerWidth + SIGNAL_INFO_COMPACT_WIDTH + PLAYER_EDGE_GAP * 4 + 8 &&
    viewportHeight >=
      Math.max(playerHeight, rightInfoHeight) + PLAYER_EDGE_GAP * 2;
  const bottom =
    viewportWidth >= playerWidth + PLAYER_EDGE_GAP * 2 &&
    viewportHeight >= playerHeight + bottomFeedHeight + PLAYER_EDGE_GAP * 2;

  return { right, bottom };
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
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 768 : window.innerHeight,
  }));
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [infoOpen, setInfoOpen] = useState(storedPreferences.infoOpen);
  const [playerPanelSize, setPlayerPanelSize] = useState<PlayerPanelSize>({
    width: PLAYER_PANEL_FALLBACK_WIDTH,
    height: PLAYER_PANEL_FALLBACK_HEIGHT,
  });
  const reactivePreviewTelemetryRef = useRef<ReactivePreviewTelemetry>(
    ZERO_REACTIVE_PREVIEW_TELEMETRY,
  );
  const playerPanelRef = useRef<HTMLElement | null>(null);
  const playerPanelMeasuredRef = useRef(false);
  const infoToggleRef = useRef<HTMLInputElement | null>(null);
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
  const psyBrazilProgressiveNowPlaying =
    usePsyBrazilProgressiveNowPlaying(selectedSignalId);
  const psyBrazilLoFiNowPlaying = usePsyBrazilLoFiNowPlaying(selectedSignalId);
  const psyBrazilLowBpmNowPlaying =
    usePsyBrazilLowBpmNowPlaying(selectedSignalId);
  const psyBrazilElectroNowPlaying =
    usePsyBrazilElectroNowPlaying(selectedSignalId);
  const deepTripNowPlaying = useDeepTripNowPlaying(selectedSignalId);
  const externalNowPlaying =
    psyStreamNowPlaying ??
    psyBrazilNowPlaying ??
    dumangueNowPlaying ??
    psyBrazilProgressiveNowPlaying ??
    psyBrazilLoFiNowPlaying ??
    psyBrazilLowBpmNowPlaying ??
    psyBrazilElectroNowPlaying ??
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

  useEffect(() => {
    const snapshot = audioAnalysis.snapshot;
    publishRuntimeTestSnapshot({
      playback: audioController.playbackStatus,
      audio: {
        energy: snapshot.energy,
        bass: snapshot.bass,
        kickPulse: snapshot.kickPulse,
        mids: snapshot.mids,
        highs: snapshot.highs,
        smoothedEnergy: snapshot.smoothedEnergy,
      },
      controls: {
        chroma: chromaEnabled,
        motion: motionEnabled,
        volume: audioController.volume,
      },
      environment: { id: selectedThemeId },
    });
  }, [
    audioAnalysis.snapshot,
    audioController.playbackStatus,
    audioController.volume,
    chromaEnabled,
    motionEnabled,
    selectedThemeId,
  ]);

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
        signals: PSYBRAZIL_NETWORK_SOURCE_IDS.flatMap((networkSourceId) => {
          const source = PUBLIC_EXTERNAL_AUDIO_SOURCES.find(
            (candidate) => candidate.id === networkSourceId,
          );

          return source
            ? [{ id: source.id, label: formatAudioSourceLabel(source) }]
            : [];
        }),
      },
      {
        label: "EXTERNAL SIGNALS",
        signals: PUBLIC_EXTERNAL_AUDIO_SOURCES.filter(
          (source) => !PSYBRAZIL_NETWORK_SOURCE_ID_SET.has(source.id),
        )
          .map((source) => ({
            id: source.id,
            label: formatAudioSourceLabel(source),
          }))
          .sort((left, right) => left.label.localeCompare(right.label)),
      },
      {
        label: "DEMO TRANSMISSIONS",
        signals: DEMO_AUDIO_SOURCES.filter(
          (source) => !PUBLIC_DEMO_SOURCE_EXCLUSIONS.has(source.id),
        )
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

        const theme = themeRegistry.find(
          (candidate) => candidate.id === themeId,
        );
        return theme
          ? [
              {
                id: theme.id,
                name:
                  PUBLIC_ENVIRONMENT_DISPLAY_NAME_OVERRIDES[theme.id] ??
                  theme.name,
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
  const supportsAudioReactiveBehavior =
    activeTheme?.supportsAudioReactiveBehavior ?? false;
  const productionFullOnActive = supportsAudioReactiveBehavior;
  const productionDepthMotionSuppressed =
    supportsAudioReactiveBehavior && !motionEnabled;
  const visualFeedFit = getVisualFeedFit(
    viewportSize.width,
    viewportSize.height,
    playerPanelSize,
  );
  const auxRightAvailable = visualFeedFit.right;
  const effectiveInfoOpen = infoOpen;
  const visualFeedDockMode: VisualFeedDockMode = auxRightAvailable
    ? "right"
    : "bottom";

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

      getVisualFeedFit(
        nextViewport.width,
        nextViewport.height,
        playerPanelSize,
      );
    };

    handleViewportChange();
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [infoOpen, playerPanelSize]);

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
  }, []);

  const handleSignalChange = (id: string) => {
    setSelectedSignalId(sanitizeAudioSourceId(id) || null);
  };

  const handleThemeChange = (themeId: ThemeId) => {
    setSelectedThemeId(themeId);
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
    onRuntimeTelemetry: (telemetry) => {
      const snapshot = audioAnalysis.getLatestSnapshot();
      publishRuntimeTestSnapshot({
        playback: audioController.playbackStatus,
        audio: {
          energy: snapshot.energy,
          bass: snapshot.bass,
          kickPulse: snapshot.kickPulse,
          mids: snapshot.mids,
          highs: snapshot.highs,
          smoothedEnergy: snapshot.smoothedEnergy,
        },
        controls: {
          chroma: chromaEnabled,
          motion: motionEnabled,
          volume: audioController.volume,
        },
        environment: {
          id: selectedThemeId,
          motionTargetSpeed: telemetry.motionTargetSpeed ?? null,
          motionSpeed: telemetry.motionSpeed ?? null,
          travelPosition: telemetry.travelPosition ?? null,
          hue: telemetry.hue ?? null,
        },
      });
    },
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
        infoOpen,
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
    infoOpen,
  ]);

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
          effectiveInfoOpen ? "player-shell__dock--info-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          {
            "--player-panel-height": `${playerPanelSize.height}px`,
          } as CSSProperties
        }
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
            getLatestAudioSnapshot={audioAnalysis.getLatestSnapshot}
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
            infoVisible={effectiveInfoOpen}
            onInfoChange={setInfoOpen}
            infoToggleRef={infoToggleRef}
            collapsed={panelCollapsed}
            onCollapsedChange={setPanelCollapsed}
          />
        </div>

        <VisualFeedWindow
          open={effectiveInfoOpen && visualFeedDockMode !== null}
          dockMode={visualFeedDockMode ?? "right"}
          playerCollapsed={panelCollapsed}
          selectedTrackSource={
            selectedSignalId ? audioController.audioSource : null
          }
          metadataOverride={externalNowPlaying}
          audioSnapshot={audioAnalysis.snapshot}
          getLatestSnapshot={audioAnalysis.getLatestSnapshot}
          analysisStatus={audioAnalysis.status}
          playbackStatus={audioController.playbackStatus}
          chromaEnabled={chromaEnabled}
          Frame={activeTheme.VisualFeedFrame}
        />
      </div>
    </div>
  );
}

export default PlayerShell;
