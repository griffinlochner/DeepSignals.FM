import { useEffect, useMemo, useRef, useState } from "react";
import "./externalRadioProbe.css";

type ProbeMode = "idle" | "plain" | "reactive";
type ProbeOutcome = "untested" | "running" | "success" | "failed";

type AudioSnapshot = {
  readyState: number;
  networkState: number;
  currentTime: number;
  paused: boolean;
  ended: boolean;
};

type HeaderProbeResult = {
  attempted: boolean;
  succeeded: boolean;
  icyName: string | null;
  icyGenre: string | null;
  icyUrl: string | null;
  locationHeader: string | null;
  serverHeader: string | null;
  accessControlAllowOrigin: string | null;
  httpsEndpointHint: string | null;
  error: string | null;
};

type CountedMediaEvent =
  | "loadstart"
  | "playing"
  | "waiting"
  | "stalled"
  | "suspend"
  | "pause"
  | "ended"
  | "error"
  | "abort"
  | "emptied";

type EventCounts = Record<CountedMediaEvent, number>;

type MediaErrorSnapshot = {
  code: number | null;
  message: string | null;
};

const DEFAULT_STREAM_URL = "http://65.109.32.21:8010/stream";
const SILENCE_RMS_THRESHOLD = 0.006;
const RECONNECT_DELAYS_MS = [2000, 5000, 10000, 20000, 30000];
const WAITING_GRACE_MS = 5000;
const STABLE_PLAYBACK_RESET_MS = 12000;

const INITIAL_EVENT_COUNTS: EventCounts = {
  loadstart: 0,
  playing: 0,
  waiting: 0,
  stalled: 0,
  suspend: 0,
  pause: 0,
  ended: 0,
  error: 0,
  abort: 0,
  emptied: 0,
};

function mediaErrorToMessage(error: MediaError | null | undefined) {
  if (!error) {
    return "No media error reported.";
  }

  const codeMap: Record<number, string> = {
    1: "MEDIA_ERR_ABORTED",
    2: "MEDIA_ERR_NETWORK",
    3: "MEDIA_ERR_DECODE",
    4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
  };

  const codeLabel = codeMap[error.code] ?? `UNKNOWN_CODE_${error.code}`;
  return `${codeLabel}${error.message ? `: ${error.message}` : ""}`;
}

function protocolLabel(url: string) {
  try {
    return new URL(url).protocol.replace(":", "").toUpperCase();
  } catch {
    return "UNKNOWN";
  }
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return "0.00";
  }

  return seconds.toFixed(2);
}

function formatClock(millis: number | null) {
  if (!millis) {
    return "n/a";
  }

  return new Date(millis).toLocaleTimeString();
}

function readyStateLabel(value: number) {
  const labels = [
    "0 HAVE_NOTHING",
    "1 HAVE_METADATA",
    "2 HAVE_CURRENT_DATA",
    "3 HAVE_FUTURE_DATA",
    "4 HAVE_ENOUGH_DATA",
  ];

  return labels[value] ?? `${value} UNKNOWN`;
}

function networkStateLabel(value: number) {
  const labels = [
    "0 NETWORK_EMPTY",
    "1 NETWORK_IDLE",
    "2 NETWORK_LOADING",
    "3 NETWORK_NO_SOURCE",
  ];

  return labels[value] ?? `${value} UNKNOWN`;
}

function isCorsLikeError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("cors") ||
    lower.includes("cross-origin") ||
    lower.includes("origin") ||
    lower.includes("tainted") ||
    lower.includes("access-control")
  );
}

function isLikelyAutoplayPolicyError(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("notallowederror") || lower.includes("gesture") || lower.includes("autoplay");
}

function delayMsForAttempt(attemptIndex: number) {
  const boundedIndex = Math.min(Math.max(attemptIndex, 0), RECONNECT_DELAYS_MS.length - 1);
  return RECONNECT_DELAYS_MS[boundedIndex];
}

function ExternalRadioProbePage() {
  const [probeUrl, setProbeUrl] = useState(DEFAULT_STREAM_URL);
  const [runningMode, setRunningMode] = useState<ProbeMode>("idle");
  const [statusText, setStatusText] = useState("Idle");
  const [audioSnapshot, setAudioSnapshot] = useState<AudioSnapshot>({
    readyState: 0,
    networkState: 0,
    currentTime: 0,
    paused: true,
    ended: false,
  });
  const [plainOutcome, setPlainOutcome] = useState<ProbeOutcome>("untested");
  const [reactiveOutcome, setReactiveOutcome] = useState<ProbeOutcome>("untested");
  const [audioContextState, setAudioContextState] = useState("not-created");
  const [rmsLevel, setRmsLevel] = useState(0);
  const [avgFrequencyLevel, setAvgFrequencyLevel] = useState(0);
  const [maxRmsLevel, setMaxRmsLevel] = useState(0);
  const [analyzerActive, setAnalyzerActive] = useState<"untested" | "active" | "silent">(
    "untested",
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [eventCounts, setEventCounts] = useState<EventCounts>(INITIAL_EVENT_COUNTS);
  const [lastEventName, setLastEventName] = useState<string>("none");
  const [lastEventTimestamp, setLastEventTimestamp] = useState<number | null>(null);
  const [lastProgressTimestamp, setLastProgressTimestamp] = useState<number | null>(null);
  const [autoReconnectEnabled, setAutoReconnectEnabled] = useState(false);
  const [reconnectAttemptCount, setReconnectAttemptCount] = useState(0);
  const [currentRetryDelayMs, setCurrentRetryDelayMs] = useState<number | null>(null);
  const [stoppedByUser, setStoppedByUser] = useState(false);
  const [manualReconnectNeeded, setManualReconnectNeeded] = useState(false);
  const [browserOnline, setBrowserOnline] = useState<boolean>(navigator.onLine);
  const [mediaErrorSnapshot, setMediaErrorSnapshot] = useState<MediaErrorSnapshot>({
    code: null,
    message: null,
  });
  const [headerProbe, setHeaderProbe] = useState<HeaderProbeResult>({
    attempted: false,
    succeeded: false,
    icyName: null,
    icyGenre: null,
    icyUrl: null,
    locationHeader: null,
    serverHeader: null,
    accessControlAllowOrigin: null,
    httpsEndpointHint: null,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const analyserBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const frequencyBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const cleanupCallbacksRef = useRef<Array<() => void>>([]);
  const meterAnimationFrameRef = useRef<number | null>(null);
  const statusPollTimerRef = useRef<number | null>(null);
  const reconnectGraceTimerRef = useRef<number | null>(null);
  const reconnectDelayTimerRef = useRef<number | null>(null);
  const stablePlaybackTimerRef = useRef<number | null>(null);
  const maxRmsRef = useRef(0);
  const lastCurrentTimeRef = useRef(0);
  const lastProgressTimestampRef = useRef<number | null>(null);
  const reconnectSequenceRef = useRef(0);
  const userRequestedPlaybackRef = useRef(false);
  const manualStopRef = useRef(false);
  const activeModeRef = useRef<ProbeMode>("idle");
  const reconnectSameElementRef = useRef<(reason: string) => Promise<void>>(async () => {});
  const stopProbeSessionRef = useRef<(reason: string, byUser: boolean) => Promise<void>>(async () => {});

  const protocol = useMemo(() => protocolLabel(probeUrl), [probeUrl]);
  const isHttpUrl = protocol === "HTTP";
  const httpsCandidateUrl = useMemo(() => {
    if (!probeUrl.startsWith("http://")) {
      return probeUrl;
    }

    return `https://${probeUrl.slice("http://".length)}`;
  }, [probeUrl]);

  const interpretation = useMemo(() => {
    if (plainOutcome === "failed" && reactiveOutcome !== "success") {
      return "Stream playback unsupported or unavailable";
    }

    if (
      plainOutcome === "success" &&
      (reactiveOutcome === "failed" || analyzerActive === "silent") &&
      (lastError ? isCorsLikeError(lastError) : false)
    ) {
      return "Plain playback works; Web Audio blocked by CORS";
    }

    if (plainOutcome === "success" && reactiveOutcome === "success" && analyzerActive === "active") {
      return "Plain playback and reactive analysis both work";
    }

    if (isHttpUrl && (plainOutcome === "success" || reactiveOutcome === "success")) {
      return "HTTP-only stream works locally but is unsuitable for the HTTPS production page";
    }

    return "Probe in progress or inconclusive";
  }, [analyzerActive, isHttpUrl, lastError, plainOutcome, reactiveOutcome]);

  const corsAssessment = useMemo(() => {
    if (!lastError) {
      return "No explicit CORS error captured yet.";
    }

    if (isCorsLikeError(lastError)) {
      return `CORS-likely failure: ${lastError}`;
    }

    if (reactiveOutcome === "failed" && plainOutcome === "success") {
      return `Reactive-only failure (check CORS headers): ${lastError}`;
    }

    return `Non-CORS error: ${lastError}`;
  }, [lastError, plainOutcome, reactiveOutcome]);

  const clearReconnectTimers = () => {
    if (reconnectGraceTimerRef.current !== null) {
      window.clearTimeout(reconnectGraceTimerRef.current);
      reconnectGraceTimerRef.current = null;
    }

    if (reconnectDelayTimerRef.current !== null) {
      window.clearTimeout(reconnectDelayTimerRef.current);
      reconnectDelayTimerRef.current = null;
    }

    if (stablePlaybackTimerRef.current !== null) {
      window.clearTimeout(stablePlaybackTimerRef.current);
      stablePlaybackTimerRef.current = null;
    }
  };

  const pushEvent = (eventText: string) => {
    const line = `${new Date().toLocaleTimeString()} ${eventText}`;
    setEventLog((previous) => [line, ...previous].slice(0, 24));
  };

  const updateAudioSnapshot = () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setAudioSnapshot({
      readyState: audio.readyState,
      networkState: audio.networkState,
      currentTime: audio.currentTime,
      paused: audio.paused,
      ended: audio.ended,
    });

    if (audio.currentTime > lastCurrentTimeRef.current + 0.01) {
      const now = Date.now();
      lastCurrentTimeRef.current = audio.currentTime;
      lastProgressTimestampRef.current = now;
      setLastProgressTimestamp(now);

      if (activeModeRef.current === "plain") {
        setPlainOutcome((previous) => (previous === "success" ? previous : "success"));
      }

      if (activeModeRef.current === "reactive") {
        setReactiveOutcome((previous) => (previous === "success" ? previous : "success"));
      }
    }

    const context = audioContextRef.current;
    if (context) {
      setAudioContextState(context.state);
    }
  };

  const clearTimers = () => {
    if (meterAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(meterAnimationFrameRef.current);
      meterAnimationFrameRef.current = null;
    }

    if (statusPollTimerRef.current !== null) {
      window.clearInterval(statusPollTimerRef.current);
      statusPollTimerRef.current = null;
    }

    clearReconnectTimers();
  };

  const clearWebAudioGraph = async () => {
    if (mediaSourceNodeRef.current) {
      try {
        mediaSourceNodeRef.current.disconnect();
      } catch {
        // Ignore disconnect errors for already-disconnected nodes.
      }
      mediaSourceNodeRef.current = null;
    }

    if (analyserNodeRef.current) {
      try {
        analyserNodeRef.current.disconnect();
      } catch {
        // Ignore disconnect errors for already-disconnected nodes.
      }
      analyserNodeRef.current = null;
    }

    analyserBufferRef.current = null;
    frequencyBufferRef.current = null;

    if (audioContextRef.current) {
      const context = audioContextRef.current;
      audioContextRef.current = null;
      try {
        await context.close();
      } catch (error) {
        setLastError(`AudioContext close error: ${String(error)}`);
      }
      setAudioContextState("closed");
    } else {
      setAudioContextState("not-created");
    }
  };

  const detachListeners = () => {
    cleanupCallbacksRef.current.forEach((cleanup) => cleanup());
    cleanupCallbacksRef.current = [];
  };

  const stopProbeSession = async (reason: string, byUser: boolean) => {
    manualStopRef.current = byUser;
    setStoppedByUser(byUser);
    userRequestedPlaybackRef.current = false;
    clearTimers();
    detachListeners();
    setCurrentRetryDelayMs(null);

    const audio = audioRef.current;
    audioRef.current = null;

    if (audio) {
      try {
        audio.pause();
      } catch {
        // Ignore pause errors.
      }
      try {
        audio.removeAttribute("src");
        audio.load();
      } catch {
        // Ignore load errors.
      }
    }

    await clearWebAudioGraph();

    activeModeRef.current = "idle";
    setRunningMode("idle");
    setStatusText(`Stopped (${reason})`);
    setRmsLevel(0);
    setAvgFrequencyLevel(0);
    setManualReconnectNeeded(false);

    if (analyzerActive === "untested") {
      setAnalyzerActive("silent");
    }
  };

  const startPolling = () => {
    if (statusPollTimerRef.current !== null) {
      window.clearInterval(statusPollTimerRef.current);
      statusPollTimerRef.current = null;
    }

    statusPollTimerRef.current = window.setInterval(() => {
      updateAudioSnapshot();
    }, 250);
  };

  const scheduleStablePlaybackReset = () => {
    if (stablePlaybackTimerRef.current !== null) {
      window.clearTimeout(stablePlaybackTimerRef.current);
      stablePlaybackTimerRef.current = null;
    }

    stablePlaybackTimerRef.current = window.setTimeout(() => {
      reconnectSequenceRef.current = 0;
      setCurrentRetryDelayMs(null);
      setStatusText("Stable playback detected. Reconnect backoff reset.");
    }, STABLE_PLAYBACK_RESET_MS);
  };

  const reconnectSameElement = async (reason: string) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (manualStopRef.current || !userRequestedPlaybackRef.current || activeModeRef.current === "idle") {
      return;
    }

    const originalVolume = audio.volume;

    try {
      setStatusText(`Reconnect attempt (${reason})`);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.src = probeUrl;
      audio.volume = originalVolume;
      updateAudioSnapshot();
      await audio.play();
      setManualReconnectNeeded(false);
      pushEvent(`Reconnect succeeded (${reason})`);
    } catch (error) {
      const message = `Reconnect play() error: ${String(error)}`;
      setLastError(message);
      pushEvent(message);
      if (isLikelyAutoplayPolicyError(message)) {
        setManualReconnectNeeded(true);
      }
    }
  };

  const scheduleReconnect = (reason: string) => {
    if (!autoReconnectEnabled || manualStopRef.current || !userRequestedPlaybackRef.current) {
      return;
    }

    if (reconnectGraceTimerRef.current !== null || reconnectDelayTimerRef.current !== null) {
      return;
    }

    reconnectGraceTimerRef.current = window.setTimeout(() => {
      reconnectGraceTimerRef.current = null;

      const audio = audioRef.current;
      if (!audio || activeModeRef.current === "idle") {
        return;
      }

      const secondsSinceProgress =
        lastProgressTimestampRef.current === null
          ? Number.POSITIVE_INFINITY
          : (Date.now() - lastProgressTimestampRef.current) / 1000;

      if (!audio.paused && secondsSinceProgress < WAITING_GRACE_MS / 1000) {
        return;
      }

      const attempt = reconnectSequenceRef.current;
      const delay = delayMsForAttempt(attempt);
      reconnectSequenceRef.current = Math.min(attempt + 1, RECONNECT_DELAYS_MS.length - 1);
      setReconnectAttemptCount((previous) => previous + 1);
      setCurrentRetryDelayMs(delay);
      setStatusText(`Reconnect scheduled in ${(delay / 1000).toFixed(0)}s (${reason}).`);

      reconnectDelayTimerRef.current = window.setTimeout(() => {
        reconnectDelayTimerRef.current = null;
        void reconnectSameElement(reason);
      }, delay);
    }, WAITING_GRACE_MS);
  };

  const markEvent = (eventName: CountedMediaEvent, detail?: string) => {
    const now = Date.now();
    setEventCounts((previous) => ({
      ...previous,
      [eventName]: previous[eventName] + 1,
    }));
    setLastEventName(eventName);
    setLastEventTimestamp(now);
    pushEvent(detail ? `${eventName} ${detail}` : eventName);
  };

  const startAnalyzerMeter = () => {
    const analyser = analyserNodeRef.current;
    const data = analyserBufferRef.current;
    const frequencyData = frequencyBufferRef.current;

    if (!analyser || !data || !frequencyData) {
      return;
    }

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      analyser.getByteFrequencyData(frequencyData);

      let sumSquared = 0;
      for (let i = 0; i < data.length; i += 1) {
        const centered = (data[i] - 128) / 128;
        sumSquared += centered * centered;
      }
      const rms = Math.sqrt(sumSquared / data.length);

      let frequencyTotal = 0;
      for (let i = 0; i < frequencyData.length; i += 1) {
        frequencyTotal += frequencyData[i] / 255;
      }
      const averageFrequency = frequencyTotal / frequencyData.length;

      maxRmsRef.current = Math.max(maxRmsRef.current, rms);
      setRmsLevel(rms);
      setAvgFrequencyLevel(averageFrequency);
      setMaxRmsLevel(maxRmsRef.current);

      if (maxRmsRef.current > SILENCE_RMS_THRESHOLD) {
        setAnalyzerActive("active");
      } else if (activeModeRef.current === "reactive") {
        setAnalyzerActive("silent");
      }

      meterAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    meterAnimationFrameRef.current = window.requestAnimationFrame(tick);
  };

  const attachCommonAudioListeners = (audio: HTMLAudioElement, mode: Exclude<ProbeMode, "idle">) => {
    const listeners: Array<[keyof HTMLMediaElementEventMap, EventListener]> = [
      ["loadstart", () => markEvent("loadstart")],
      ["playing", () => {
        markEvent("playing");
        setStoppedByUser(false);
        setManualReconnectNeeded(false);
        setCurrentRetryDelayMs(null);
        clearReconnectTimers();
        scheduleStablePlaybackReset();
        if (mode === "plain") {
          setPlainOutcome((previous) => (previous === "success" ? previous : "running"));
        }
        if (mode === "reactive") {
          setReactiveOutcome((previous) => (previous === "success" ? previous : "running"));
        }
      }],
      ["waiting", () => {
        markEvent("waiting");
        scheduleReconnect("waiting");
      }],
      ["stalled", () => {
        markEvent("stalled");
        scheduleReconnect("stalled");
      }],
      ["suspend", () => {
        markEvent("suspend");
      }],
      ["pause", () => {
        markEvent("pause");
      }],
      ["ended", () => {
        markEvent("ended");
        scheduleReconnect("ended");
      }],
      ["abort", () => {
        markEvent("abort");
      }],
      ["emptied", () => {
        markEvent("emptied");
      }],
      ["timeupdate", () => updateAudioSnapshot()],
      ["error", () => {
        const message = mediaErrorToMessage(audio.error);
        markEvent("error", message);
        setLastError(`Media error (${mode}): ${message}`);
        setMediaErrorSnapshot({
          code: audio.error?.code ?? null,
          message: audio.error?.message || null,
        });
        if (mode === "plain") {
          setPlainOutcome("failed");
        }
        if (mode === "reactive") {
          setReactiveOutcome("failed");
        }
        scheduleReconnect("error");
      }],
    ];

    listeners.forEach(([eventName, handler]) => {
      audio.addEventListener(eventName, handler);
      cleanupCallbacksRef.current.push(() => {
        audio.removeEventListener(eventName, handler);
      });
    });
  };

  const createFreshAudioElement = (url: string, withCrossOrigin: boolean) => {
    const audio = new Audio();
    audio.preload = "none";
    audio.autoplay = false;
    audio.loop = false;

    if (withCrossOrigin) {
      audio.crossOrigin = "anonymous";
    }

    audio.src = url;
    audioRef.current = audio;
    return audio;
  };

  const beginProbeRun = (mode: Exclude<ProbeMode, "idle">) => {
    setRunningMode(mode);
    activeModeRef.current = mode;
    manualStopRef.current = false;
    setStoppedByUser(false);
    userRequestedPlaybackRef.current = true;
    reconnectSequenceRef.current = 0;
    setReconnectAttemptCount(0);
    setCurrentRetryDelayMs(null);
    setManualReconnectNeeded(false);
    setMediaErrorSnapshot({ code: null, message: null });
    setLastProgressTimestamp(null);
    lastProgressTimestampRef.current = null;
    lastCurrentTimeRef.current = 0;
    clearReconnectTimers();
  };

  const startPlainPlayback = async () => {
    await stopProbeSession("switching to plain playback", false);
    beginProbeRun("plain");
    setStatusText("Starting plain playback test...");
    setLastError(null);
    setPlainOutcome("running");
    setAnalyzerActive("untested");

    const audio = createFreshAudioElement(probeUrl, false);
    attachCommonAudioListeners(audio, "plain");
    startPolling();

    try {
      await audio.play();
      setStatusText("Plain playback started. Listen for audible audio.");
      pushEvent("play() resolved for plain playback");
    } catch (error) {
      const message = `Plain play() error: ${String(error)}`;
      setLastError(message);
      setPlainOutcome("failed");
      setStatusText("Plain playback failed to start.");
      setManualReconnectNeeded(isLikelyAutoplayPolicyError(message));
      pushEvent(message);
    }
  };

  const startReactivePlayback = async () => {
    await stopProbeSession("switching to reactive playback", false);
    beginProbeRun("reactive");
    maxRmsRef.current = 0;
    setStatusText("Starting reactive playback test...");
    setLastError(null);
    setReactiveOutcome("running");
    setAnalyzerActive("silent");
    setRmsLevel(0);
    setAvgFrequencyLevel(0);
    setMaxRmsLevel(0);

    const audio = createFreshAudioElement(probeUrl, true);
    attachCommonAudioListeners(audio, "reactive");

    try {
      const context = new AudioContext();
      audioContextRef.current = context;
      setAudioContextState(context.state);

      const source = context.createMediaElementSource(audio);
      mediaSourceNodeRef.current = source;

      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
      analyserNodeRef.current = analyser;

      source.connect(analyser);
      analyser.connect(context.destination);

      analyserBufferRef.current = new Uint8Array(analyser.fftSize);
      frequencyBufferRef.current = new Uint8Array(analyser.frequencyBinCount);

      startAnalyzerMeter();
      startPolling();

      await context.resume();
      setAudioContextState(context.state);

      await audio.play();
      setStatusText("Reactive playback started. Meter should move if analysis is active.");
      pushEvent("play() resolved for reactive playback");
    } catch (error) {
      const message = `Reactive setup/play error: ${String(error)}`;
      setLastError(message);
      setReactiveOutcome("failed");
      setStatusText("Reactive playback failed to initialize.");
      setManualReconnectNeeded(isLikelyAutoplayPolicyError(message));
      pushEvent(message);
    }
  };

  const triggerManualReconnect = async () => {
    if (runningMode === "idle") {
      return;
    }

    userRequestedPlaybackRef.current = true;
    manualStopRef.current = false;
    setStoppedByUser(false);
    await reconnectSameElement("manual");
  };

  useEffect(() => {
    reconnectSameElementRef.current = reconnectSameElement;
    stopProbeSessionRef.current = stopProbeSession;
  });

  const runHeaderProbe = async () => {
    setHeaderProbe({
      attempted: true,
      succeeded: false,
      icyName: null,
      icyGenre: null,
      icyUrl: null,
      locationHeader: null,
      serverHeader: null,
      accessControlAllowOrigin: null,
      httpsEndpointHint: null,
      error: null,
    });

    const abortController = new AbortController();
    const timeout = window.setTimeout(() => abortController.abort("probe timeout"), 4000);

    try {
      const response = await fetch(probeUrl, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        signal: abortController.signal,
      });

      const icyName = response.headers.get("icy-name");
      const icyGenre = response.headers.get("icy-genre");
      const icyUrl = response.headers.get("icy-url");
      const locationHeader = response.headers.get("location");
      const serverHeader = response.headers.get("server");
      const accessControlAllowOrigin = response.headers.get("access-control-allow-origin");

      let httpsEndpointHint: string | null = null;
      const values = [icyUrl, locationHeader].filter((value): value is string => Boolean(value));
      values.forEach((value) => {
        if (!httpsEndpointHint && value.startsWith("https://")) {
          httpsEndpointHint = value;
        }
      });

      setHeaderProbe({
        attempted: true,
        succeeded: true,
        icyName,
        icyGenre,
        icyUrl,
        locationHeader,
        serverHeader,
        accessControlAllowOrigin,
        httpsEndpointHint,
        error: null,
      });

      pushEvent("Header probe completed with CORS-readable response headers.");
    } catch (error) {
      const message = `Header probe error: ${String(error)}`;
      setHeaderProbe({
        attempted: true,
        succeeded: false,
        icyName: null,
        icyGenre: null,
        icyUrl: null,
        locationHeader: null,
        serverHeader: null,
        accessControlAllowOrigin: null,
        httpsEndpointHint: null,
        error: message,
      });
      pushEvent(message);
    } finally {
      window.clearTimeout(timeout);
      abortController.abort();
    }
  };

  const handleStop = async () => {
    await stopProbeSession("user requested stop", true);
  };

  const handleReset = async () => {
    await stopProbeSession("user requested reset", false);
    setProbeUrl(DEFAULT_STREAM_URL);
    setPlainOutcome("untested");
    setReactiveOutcome("untested");
    setAnalyzerActive("untested");
    setLastError(null);
    setEventLog([]);
    setEventCounts(INITIAL_EVENT_COUNTS);
    setLastEventName("none");
    setLastEventTimestamp(null);
    setLastProgressTimestamp(null);
    lastProgressTimestampRef.current = null;
    setReconnectAttemptCount(0);
    setCurrentRetryDelayMs(null);
    setStoppedByUser(false);
    setManualReconnectNeeded(false);
    setBrowserOnline(navigator.onLine);
    setMediaErrorSnapshot({ code: null, message: null });
    setHeaderProbe({
      attempted: false,
      succeeded: false,
      icyName: null,
      icyGenre: null,
      icyUrl: null,
      locationHeader: null,
      serverHeader: null,
      accessControlAllowOrigin: null,
      httpsEndpointHint: null,
      error: null,
    });
    setAudioSnapshot({
      readyState: 0,
      networkState: 0,
      currentTime: 0,
      paused: true,
      ended: false,
    });
    setStatusText("Idle");
    setRmsLevel(0);
    setAvgFrequencyLevel(0);
    setMaxRmsLevel(0);
  };

  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true);
      pushEvent("window online");
      if (autoReconnectEnabled && runningMode !== "idle" && userRequestedPlaybackRef.current) {
        void reconnectSameElementRef.current("online-event");
      }
    };

    const handleOffline = () => {
      setBrowserOnline(false);
      pushEvent("window offline");
    };

    const handleVisibility = () => {
      pushEvent(document.visibilityState === "hidden" ? "tab hidden" : "tab visible");
      if (document.visibilityState === "visible") {
        updateAudioSnapshot();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [autoReconnectEnabled, runningMode]);

  useEffect(() => {
    return () => {
      void stopProbeSessionRef.current("component unmount", false);
    };
  }, []);

  return (
    <main className="external-radio-probe">
      <section className="external-radio-probe__panel">
        <p className="external-radio-probe__eyebrow">DEV Experiment</p>
        <h1>External Internet-Radio Compatibility Probe</h1>
        <p className="external-radio-probe__lead">
          Isolated probe only. Production player code and persistent audio controller are untouched.
        </p>

        <label className="external-radio-probe__field">
          Stream URL
          <input
            value={probeUrl}
            onChange={(event) => setProbeUrl(event.target.value)}
            placeholder="http://65.109.32.21:8010/stream"
          />
        </label>

        <label className="external-radio-probe__toggle" htmlFor="auto-reconnect-toggle">
          <input
            id="auto-reconnect-toggle"
            type="checkbox"
            checked={autoReconnectEnabled}
            onChange={(event) => setAutoReconnectEnabled(event.target.checked)}
          />
          Auto reconnect (DEV-only)
        </label>

        <div className="external-radio-probe__actions">
          <button type="button" onClick={startPlainPlayback} disabled={runningMode !== "idle"}>
            Test Plain Playback
          </button>
          <button type="button" onClick={startReactivePlayback} disabled={runningMode !== "idle"}>
            Test Reactive Playback
          </button>
          <button type="button" onClick={handleStop} disabled={runningMode === "idle"}>
            Stop
          </button>
          <button type="button" onClick={handleReset}>
            Reset
          </button>
          <button type="button" onClick={runHeaderProbe}>
            Probe Headers
          </button>
          <button type="button" onClick={() => setProbeUrl(httpsCandidateUrl)}>
            Try HTTPS Form
          </button>
          <button type="button" onClick={triggerManualReconnect} disabled={runningMode === "idle"}>
            Manual Reconnect
          </button>
        </div>

        {isHttpUrl ? (
          <div className="external-radio-probe__warning" role="alert">
            HTTP-only stream warning: this URL can be tested locally during development, but browsers will
            block this IP-hosted HTTP media resource when requested from the deployed HTTPS DeepSignals
            site.
          </div>
        ) : null}

        {manualReconnectNeeded ? (
          <div className="external-radio-probe__warning" role="alert">
            Playback appears blocked by browser gesture/autoplay policy. Press Manual Reconnect after a
            user gesture.
          </div>
        ) : null}

        <dl className="external-radio-probe__grid">
          <div>
            <dt>Tested URL</dt>
            <dd>{probeUrl || "(empty)"}</dd>
          </div>
          <div>
            <dt>Protocol</dt>
            <dd>{protocol}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{runningMode}</dd>
          </div>
          <div>
            <dt>Playback status</dt>
            <dd>{statusText}</dd>
          </div>
          <div>
            <dt>currentTime</dt>
            <dd>{formatSeconds(audioSnapshot.currentTime)} s</dd>
          </div>
          <div>
            <dt>readyState</dt>
            <dd>{readyStateLabel(audioSnapshot.readyState)}</dd>
          </div>
          <div>
            <dt>networkState</dt>
            <dd>{networkStateLabel(audioSnapshot.networkState)}</dd>
          </div>
          <div>
            <dt>paused / ended</dt>
            <dd>
              {audioSnapshot.paused ? "paused" : "playing"} / {audioSnapshot.ended ? "ended" : "live"}
            </dd>
          </div>
          <div>
            <dt>AudioContext state</dt>
            <dd>{audioContextState}</dd>
          </div>
          <div>
            <dt>Analyzer RMS</dt>
            <dd>{rmsLevel.toFixed(4)}</dd>
          </div>
          <div>
            <dt>Analyzer avg freq</dt>
            <dd>{avgFrequencyLevel.toFixed(4)}</dd>
          </div>
          <div>
            <dt>Analyzer max RMS</dt>
            <dd>{maxRmsLevel.toFixed(4)}</dd>
          </div>
          <div>
            <dt>Analyzer assessment</dt>
            <dd>{analyzerActive}</dd>
          </div>
          <div>
            <dt>Plain result</dt>
            <dd>{plainOutcome}</dd>
          </div>
          <div>
            <dt>Reactive result</dt>
            <dd>{reactiveOutcome}</dd>
          </div>
          <div>
            <dt>CORS assessment</dt>
            <dd>{corsAssessment}</dd>
          </div>
          <div>
            <dt>Browser online</dt>
            <dd>{browserOnline ? "online" : "offline"}</dd>
          </div>
          <div>
            <dt>Stopped by user</dt>
            <dd>{stoppedByUser ? "yes" : "no"}</dd>
          </div>
          <div>
            <dt>Reconnect attempts</dt>
            <dd>{reconnectAttemptCount}</dd>
          </div>
          <div>
            <dt>Current retry delay</dt>
            <dd>{currentRetryDelayMs ? `${(currentRetryDelayMs / 1000).toFixed(0)} s` : "none"}</dd>
          </div>
          <div>
            <dt>Last progress timestamp</dt>
            <dd>{formatClock(lastProgressTimestamp)}</dd>
          </div>
          <div>
            <dt>Last media event</dt>
            <dd>
              {lastEventName} at {formatClock(lastEventTimestamp)}
            </dd>
          </div>
          <div>
            <dt>MediaError code</dt>
            <dd>{mediaErrorSnapshot.code ?? "n/a"}</dd>
          </div>
          <div>
            <dt>MediaError message</dt>
            <dd>{mediaErrorSnapshot.message ?? "n/a"}</dd>
          </div>
          <div>
            <dt>ICY metadata visibility</dt>
            <dd>
              {headerProbe.succeeded
                ? `icy-name=${headerProbe.icyName ?? "n/a"}; icy-genre=${headerProbe.icyGenre ?? "n/a"}; icy-url=${headerProbe.icyUrl ?? "n/a"}`
                : "Not exposed to this browser probe yet."}
            </dd>
          </div>
          <div>
            <dt>HTTPS endpoint hint</dt>
            <dd>{headerProbe.httpsEndpointHint ?? "No HTTPS endpoint discovered via browser-readable headers."}</dd>
          </div>
          <div>
            <dt>Last error</dt>
            <dd>{lastError ?? "none"}</dd>
          </div>
          <div>
            <dt>Interpretation</dt>
            <dd>{interpretation}</dd>
          </div>
        </dl>

        <section className="external-radio-probe__headers">
          <h2>Counted media events</h2>
          <ul>
            <li>loadstart: {eventCounts.loadstart}</li>
            <li>playing: {eventCounts.playing}</li>
            <li>waiting: {eventCounts.waiting}</li>
            <li>stalled: {eventCounts.stalled}</li>
            <li>suspend: {eventCounts.suspend}</li>
            <li>pause: {eventCounts.pause}</li>
            <li>ended: {eventCounts.ended}</li>
            <li>error: {eventCounts.error}</li>
            <li>abort: {eventCounts.abort}</li>
            <li>emptied: {eventCounts.emptied}</li>
          </ul>
        </section>

        <section className="external-radio-probe__headers">
          <h2>Header Probe</h2>
          <p>
            This attempts direct browser fetch access to stream headers. If blocked, that indicates CORS
            restrictions for metadata/header inspection.
          </p>
          <p>
            Status: {headerProbe.attempted ? (headerProbe.succeeded ? "success" : "failed") : "not run"}
          </p>
          {headerProbe.error ? <p>Header error: {headerProbe.error}</p> : null}
          <ul>
            <li>access-control-allow-origin: {headerProbe.accessControlAllowOrigin ?? "n/a"}</li>
            <li>server: {headerProbe.serverHeader ?? "n/a"}</li>
            <li>location: {headerProbe.locationHeader ?? "n/a"}</li>
            <li>icy-url: {headerProbe.icyUrl ?? "n/a"}</li>
          </ul>
        </section>

        <section className="external-radio-probe__events">
          <h2>Recent events</h2>
          {eventLog.length === 0 ? <p>No events yet.</p> : null}
          <ul>
            {eventLog.map((eventLine) => (
              <li key={eventLine}>{eventLine}</li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}

export default ExternalRadioProbePage;
