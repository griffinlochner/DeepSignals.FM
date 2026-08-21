import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import {
  createSharedSurgeQualificationState,
  updateSharedSurgeQualification,
} from "../../app/sharedSurgeQualification";
import SignalRunnerScene, {
  type SignalRunnerControlMode,
  type SignalRunnerDriveTelemetry,
} from "./SignalRunnerScene";
import {
  mapSignalRunnerChromaHue,
  SIGNAL_RUNNER_CHROMA_HUE_RESPONSE,
} from "./signalRunnerChroma";
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

const DRIVE_SEGMENT_COUNT = 9;
const BLAST_OFF_DISPLAY_MS = 1100;
const COIL_SIGNAL_INTERVAL_MS = 100;
const LED_PALETTE = ["#47f7ff", "#9cff57", "#ff7fa1"];
const GLYPH_CHARS = [
  "░",
  "▒",
  "▓",
  "▌",
  "▐",
  "┃",
  "╎",
  "╏",
  "¦",
  "†",
  "‡",
  "×",
  "⌁",
  "⌬",
  "∴",
  "⋄",
  "◊",
  "✦",
];
const MONITOR_GLYPH_CHARS = GLYPH_CHARS.filter((glyph) => glyph !== "†");
const MONITOR_LANE_COUNT = 6;
const MONITOR_GLYPH_CELLS_PER_LANE = 36;
const MONITOR_GLYPH_SEQUENCE_LENGTH = MONITOR_GLYPH_CELLS_PER_LANE / 2;
const MONITOR_LANE_BASE_DURATIONS = [1.02, 0.82, 0.94, 1.14, 0.88, 1.08];
const GLYPH_STRIP_CELLS = 7;
const PULSE_LADDER_SEGMENTS = 6;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

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
      <svg
        className="signal-runner__impulse-coil-chamber"
        viewBox="0 0 280 100"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="signal-runner-coil-core" x1="0" x2="1">
            <stop offset="0" stopColor="#47f7ff" />
            <stop offset="0.52" stopColor="#e9f8ff" />
            <stop offset="1" stopColor="#9cff57" />
          </linearGradient>
          <filter
            id="signal-runner-coil-glow"
            x="-30%"
            y="-60%"
            width="160%"
            height="220%"
          >
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          className="signal-runner__coil-shell"
          d="M17 15H263L276 50 263 85H17L4 50Z"
        />
        <path
          className="signal-runner__coil-rail signal-runner__coil-rail--top"
          d="M26 30H254"
        />
        <path
          className="signal-runner__coil-rail signal-runner__coil-rail--bottom"
          d="M26 70H254"
        />
        <path
          className="signal-runner__coil-filament"
          d="M23 50 48 40 72 61 97 35 122 58 140 42 160 64 187 37 211 60 237 39 258 50"
        />
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
        <path
          className="signal-runner__coil-discharge signal-runner__coil-discharge--left"
          d="M57 25 65 35 59 43 71 50"
        />
        <path
          className="signal-runner__coil-discharge signal-runner__coil-discharge--right"
          d="M222 75 214 65 221 57 209 50"
        />
      </svg>
    </section>
  );
}

type SignalBarProps = {
  isPlaying: boolean;
  motionEnabled: boolean;
  field: "bass" | "highs";
  variant: "ember" | "ion";
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
};

function SignalBar({
  isPlaying,
  motionEnabled,
  field,
  variant,
  getLatestAudioSnapshot,
}: SignalBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    isPlaying,
    motionEnabled,
    field,
    getLatestAudioSnapshot,
  });

  useEffect(() => {
    stateRef.current = {
      isPlaying,
      motionEnabled,
      field,
      getLatestAudioSnapshot,
    };
  }, [isPlaying, motionEnabled, field, getLatestAudioSnapshot]);

  useEffect(() => {
    let frameId = 0;
    let lastFrameTime = performance.now();
    let level = 0;

    const render = (frameTime: number) => {
      const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
      lastFrameTime = frameTime;

      const state = stateRef.current;

      // MOTION off freezes the column at its last reading.
      if (state.motionEnabled) {
        const snapshot = state.isPlaying
          ? (state.getLatestAudioSnapshot?.() ?? null)
          : null;
        const target = snapshot ? clamp01(snapshot[state.field] ?? 0) : 0;
        const easing = 1 - Math.exp(-delta * (target > level ? 15 : 6));
        level += (target - level) * easing;

        barRef.current?.style.setProperty(
          "--signal-runner-bar-level",
          level.toFixed(3),
        );
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      className={`signal-runner__signal-bar signal-runner__signal-bar--${variant}`}
      data-active={isPlaying}
      ref={barRef}
      aria-hidden="true"
    >
      <span className="signal-runner__signal-bar-track" />
      <span className="signal-runner__signal-bar-fill" />
      <span className="signal-runner__signal-bar-cap" />
    </div>
  );
}

type HeatSensorProps = {
  isPlaying: boolean;
  motionEnabled: boolean;
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
};

function HeatSensor({
  isPlaying,
  motionEnabled,
  getLatestAudioSnapshot,
}: HeatSensorProps) {
  const sensorRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ isPlaying, motionEnabled, getLatestAudioSnapshot });

  useEffect(() => {
    stateRef.current = { isPlaying, motionEnabled, getLatestAudioSnapshot };
  }, [isPlaying, motionEnabled, getLatestAudioSnapshot]);

  useEffect(() => {
    let frameId = 0;
    let lastFrameTime = performance.now();
    let level = 0;

    const render = (frameTime: number) => {
      const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
      lastFrameTime = frameTime;

      const state = stateRef.current;

      // MOTION off freezes the column at its last (dormant) reading.
      if (state.motionEnabled) {
        const snapshot = state.isPlaying
          ? (state.getLatestAudioSnapshot?.() ?? null)
          : null;
        const kick = clamp01(snapshot?.kickPulse ?? 0);
        const target = snapshot ? clamp01(kick * 0.86 + kick * kick * 0.14) : 0;
        // Rise fast on a kick, fall back slowly so the column reads as heat.
        const easing = 1 - Math.exp(-delta * (target > level ? 26 : 4.6));
        level += (target - level) * easing;

        sensorRef.current?.style.setProperty(
          "--signal-runner-heat-level",
          level.toFixed(3),
        );
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      className="signal-runner__heat-sensor"
      data-active={isPlaying}
      data-motion={motionEnabled}
      ref={sensorRef}
      aria-hidden="true"
    >
      <span className="signal-runner__heat-sensor-track" />
      <span className="signal-runner__heat-sensor-fill" />
      <span className="signal-runner__heat-sensor-cap" />
    </div>
  );
}

const SPIRAL_PATH = (() => {
  const points: string[] = [];
  const steps = 240;
  const turns = 4.4;

  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const angle = progress * turns * Math.PI * 2;
    const radius = 2.4 + progress * 19.6;
    points.push(
      `${(24 + Math.cos(angle) * radius).toFixed(2)},${(24 + Math.sin(angle) * radius).toFixed(2)}`,
    );
  }

  return `M${points.join("L")}`;
})();

type HypnoticSpiralProps = {
  isPlaying: boolean;
  motionEnabled: boolean;
  chromaEnabled: boolean;
  actualSpeed: number;
  rotationMultiplier?: number;
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
};

function HypnoticSpiral({
  isPlaying,
  motionEnabled,
  chromaEnabled,
  actualSpeed,
  rotationMultiplier = 1,
  getLatestAudioSnapshot,
}: HypnoticSpiralProps) {
  const spiralRef = useRef<HTMLDivElement | null>(null);
  const rotorRef = useRef<SVGGElement | null>(null);
  const stateRef = useRef({
    isPlaying,
    motionEnabled,
    chromaEnabled,
    actualSpeed,
    getLatestAudioSnapshot,
  });

  useEffect(() => {
    stateRef.current = {
      isPlaying,
      motionEnabled,
      chromaEnabled,
      actualSpeed,
      getLatestAudioSnapshot,
    };
  }, [
    isPlaying,
    motionEnabled,
    chromaEnabled,
    actualSpeed,
    getLatestAudioSnapshot,
  ]);

  useEffect(() => {
    let frameId = 0;
    let lastFrameTime = performance.now();
    let angle = 0;
    let glow = 0;

    const render = (frameTime: number) => {
      const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
      lastFrameTime = frameTime;

      const state = stateRef.current;
      const active = state.isPlaying && state.motionEnabled;
      const snapshot = state.isPlaying
        ? (state.getLatestAudioSnapshot?.() ?? null)
        : null;
      const energy = clamp01(snapshot?.smoothedEnergy ?? 0);
      const kick = clamp01(snapshot?.kickPulse ?? 0);
      const speed = clamp01(state.actualSpeed / 100);

      if (active) {
        angle =
          (angle +
            delta *
              (18 + speed * speed * 520 + energy * 46) *
              rotationMultiplier) %
          360;
      }

      if (rotorRef.current) {
        rotorRef.current.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      }

      const targetGlow =
        state.chromaEnabled && state.isPlaying
          ? 0.24 + energy * 0.6 + kick * 0.28
          : 0.08;
      glow += (clamp01(targetGlow) - glow) * (1 - Math.exp(-delta * 7));

      const spiral = spiralRef.current;

      if (spiral) {
        spiral.style.setProperty(
          "--signal-runner-spiral-glow",
          glow.toFixed(3),
        );

        if (state.chromaEnabled) {
          const shift =
            Math.floor(
              (frameTime * 0.00018 + energy * 1.6 + kick * 1.9) * 1.7,
            ) % LED_PALETTE.length;
          spiral.style.setProperty(
            "--signal-runner-spiral-color-a",
            LED_PALETTE[shift],
          );
          spiral.style.setProperty(
            "--signal-runner-spiral-color-b",
            LED_PALETTE[(shift + 2) % LED_PALETTE.length],
          );
        } else {
          spiral.style.setProperty(
            "--signal-runner-spiral-color-a",
            LED_PALETTE[0],
          );
          spiral.style.setProperty(
            "--signal-runner-spiral-color-b",
            LED_PALETTE[1],
          );
        }
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, [rotationMultiplier]);

  return (
    <div
      className="signal-runner__spiral"
      data-active={isPlaying}
      data-motion={motionEnabled}
      data-chroma={chromaEnabled}
      ref={spiralRef}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="signal-runner__spiral-svg">
        <g className="signal-runner__spiral-rotor" ref={rotorRef}>
          <path
            className="signal-runner__spiral-arm signal-runner__spiral-arm--a"
            d={SPIRAL_PATH}
          />
          <path
            className="signal-runner__spiral-arm signal-runner__spiral-arm--b"
            d={SPIRAL_PATH}
            transform="rotate(180 24 24)"
          />
        </g>
        <circle
          className="signal-runner__spiral-core"
          cx="24"
          cy="24"
          r="3.2"
        />
        <circle className="signal-runner__spiral-rim" cx="24" cy="24" r="22" />
      </svg>
    </div>
  );
}

type ScannerDialProps = {
  size: "large" | "small";
  chromaEnabled: boolean;
  motionEnabled: boolean;
  isPlaying: boolean;
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
};

type ScannerPulse = {
  id: number;
  strength: number;
  energy: number;
  bass: number;
};

function ScannerDial({
  size,
  chromaEnabled,
  motionEnabled,
  isPlaying,
  getLatestAudioSnapshot,
}: ScannerDialProps) {
  const [pulses, setPulses] = useState<ScannerPulse[]>([]);
  const stateRef = useRef({ isPlaying, chromaEnabled, getLatestAudioSnapshot });
  const sequenceRef = useRef(0);

  useEffect(() => {
    stateRef.current = { isPlaying, chromaEnabled, getLatestAudioSnapshot };
  }, [chromaEnabled, getLatestAudioSnapshot, isPlaying]);

  useEffect(() => {
    if (size !== "large") {
      return;
    }

    let frameId = 0;

    const render = () => {
      const state = stateRef.current;
      const snapshot = state.isPlaying
        ? (state.getLatestAudioSnapshot?.() ?? null)
        : null;
      const acceptedSequence = snapshot?.kickPulseAcceptedEventSequence ?? 0;

      if (
        state.chromaEnabled &&
        snapshot &&
        acceptedSequence !== sequenceRef.current
      ) {
        sequenceRef.current = acceptedSequence;
        const energy = clamp01(snapshot.smoothedEnergy);
        const bass = clamp01(snapshot.bassPulse);
        setPulses((currentPulses) => [
          ...currentPulses.slice(-5),
          {
            id: acceptedSequence,
            strength: clamp01(0.5 + energy * 0.36 + bass * 0.24),
            energy,
            bass,
          },
        ]);
      } else if (!snapshot || !state.chromaEnabled) {
        sequenceRef.current = acceptedSequence;
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, [size]);

  return (
    <section
      className={`signal-runner__scanner-dial signal-runner__scanner-dial--${size}`}
      data-chroma={chromaEnabled}
      data-motion={motionEnabled}
      aria-label={`${size === "large" ? "Deep field" : "Auxiliary"} scanner`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle
          className="signal-runner__scanner-grid"
          cx="50"
          cy="50"
          r="42"
        />
        <circle
          className="signal-runner__scanner-grid"
          cx="50"
          cy="50"
          r="29"
        />
        <circle
          className="signal-runner__scanner-grid"
          cx="50"
          cy="50"
          r="15"
        />
        <path className="signal-runner__scanner-axis" d="M50 5V95M5 50H95" />
        <g className="signal-runner__scanner-sweep">
          <path
            className="signal-runner__scanner-beam"
            d="M50 50 50 7A43 43 0 0 1 80 20Z"
          />
          <circle
            className="signal-runner__scanner-orbit"
            cx="50"
            cy="50"
            r="36"
          />
        </g>
        {size === "large" && chromaEnabled
          ? pulses.map((pulse) => (
              <g
                className="signal-runner__scanner-pulse"
                key={pulse.id}
                style={
                  {
                    "--signal-runner-scanner-pulse-strength": pulse.strength,
                    "--signal-runner-scanner-pulse-energy": pulse.energy,
                    "--signal-runner-scanner-pulse-bass": pulse.bass,
                  } as CSSProperties
                }
              >
                <circle
                  className="signal-runner__scanner-pulse-core"
                  cx="50"
                  cy="50"
                  r="5"
                />
                <circle
                  className="signal-runner__scanner-pulse-ring signal-runner__scanner-pulse-ring--inner"
                  cx="50"
                  cy="50"
                  r="15"
                />
                <circle
                  className="signal-runner__scanner-pulse-ring signal-runner__scanner-pulse-ring--middle"
                  cx="50"
                  cy="50"
                  r="29"
                />
                <circle
                  className="signal-runner__scanner-pulse-ring signal-runner__scanner-pulse-ring--outer"
                  cx="50"
                  cy="50"
                  r="42"
                />
              </g>
            ))
          : null}
        <circle className="signal-runner__scanner-core" cx="50" cy="50" r="4" />
      </svg>
    </section>
  );
}

function AuxTraceWidget({
  side,
  chromaEnabled,
  motionEnabled,
  isPlaying,
  getLatestAudioSnapshot,
}: {
  side: "left" | "right";
  chromaEnabled: boolean;
  motionEnabled: boolean;
  isPlaying: boolean;
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
}) {
  const glyphRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stateRef = useRef({
    chromaEnabled,
    motionEnabled,
    isPlaying,
    getLatestAudioSnapshot,
  });

  useEffect(() => {
    stateRef.current = {
      chromaEnabled,
      motionEnabled,
      isPlaying,
      getLatestAudioSnapshot,
    };
  }, [chromaEnabled, getLatestAudioSnapshot, isPlaying, motionEnabled]);

  useEffect(() => {
    let frameId = 0;

    const render = (frameTime: number) => {
      const state = stateRef.current;
      const snapshot = state.isPlaying
        ? (state.getLatestAudioSnapshot?.() ?? null)
        : null;
      const energy = state.chromaEnabled
        ? clamp01(snapshot?.smoothedEnergy ?? 0)
        : 0;
      const hue =
        document
          .querySelector<HTMLElement>(".signal-runner")
          ?.style.getPropertyValue("--signal-runner-hud-chroma-hue") || "0deg";
      const tick = Math.floor(frameTime / 120);

      for (let index = 0; index < glyphRefs.current.length; index += 1) {
        const glyph = glyphRefs.current[index];

        if (!glyph) {
          continue;
        }

        if (state.motionEnabled) {
          const seed = tick * 31 + index * 17;
          glyph.textContent = GLYPH_CHARS[Math.abs(seed) % GLYPH_CHARS.length];
        }

        glyph.style.color = state.chromaEnabled
          ? `hsl(calc(${184 + (index % 4) * 22}deg + ${hue}) ${76 + energy * 20}% ${56 + energy * 22}% / ${0.45 + energy * 0.55})`
          : "";
        glyph.style.textShadow = state.chromaEnabled
          ? `0 0 5px hsl(calc(184deg + ${hue}) 88% 64% / ${0.12 + energy * 0.52})`
          : "";
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      className={`signal-runner__aux-trace signal-runner__aux-trace--${side}`}
      data-chroma={chromaEnabled}
      data-motion={motionEnabled}
      aria-label="Auxiliary signal trace"
    >
      <span className="signal-runner__aux-trace-glyphs" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={index}
            ref={(element) => {
              glyphRefs.current[index] = element;
            }}
          >
            {GLYPH_CHARS[(index * 3 + 2) % GLYPH_CHARS.length]}
          </span>
        ))}
      </span>
    </div>
  );
}

type HardwareLedBankProps = {
  side: "left" | "right";
  count: number;
  signal: CoilSignal;
  motionEnabled: boolean;
  chromaEnabled: boolean;
};

function HardwareLedBank({
  side,
  count,
  signal,
  motionEnabled,
  chromaEnabled,
}: HardwareLedBankProps) {
  const style = {
    "--signal-runner-hardware-energy": signal.energy,
    "--signal-runner-hardware-kick": signal.kick,
  } as CSSProperties;

  return (
    <div
      className={`signal-runner__hardware-led-bank signal-runner__hardware-led-bank--${side}`}
      data-motion={motionEnabled}
      data-chroma={chromaEnabled}
      style={style}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <i
          className={`signal-runner__hardware-led signal-runner__hardware-led--${index + 1}`}
          key={index}
        />
      ))}
    </div>
  );
}

type SignalMonitorProps = {
  actualSpeed: number;
  chromaEnabled: boolean;
  motionEnabled: boolean;
  isPlaying: boolean;
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
};

function SignalMonitor({
  actualSpeed,
  chromaEnabled,
  motionEnabled,
  isPlaying,
  getLatestAudioSnapshot,
}: SignalMonitorProps) {
  const cellRefs = useRef<Array<HTMLElement | null>>([]);
  const barRefs = useRef<Array<HTMLElement | null>>([]);
  const monitorRef = useRef<HTMLElement | null>(null);
  const stateRef = useRef({
    actualSpeed,
    chromaEnabled,
    motionEnabled,
    isPlaying,
    getLatestAudioSnapshot,
  });
  const acceptedKickSequenceRef = useRef(0);
  const flashRef = useRef(0);

  useEffect(() => {
    stateRef.current = {
      actualSpeed,
      chromaEnabled,
      motionEnabled,
      isPlaying,
      getLatestAudioSnapshot,
    };
  }, [
    actualSpeed,
    chromaEnabled,
    getLatestAudioSnapshot,
    isPlaying,
    motionEnabled,
  ]);

  useEffect(() => {
    let frameId = 0;
    let lastFrameTime = performance.now();

    const render = (frameTime: number) => {
      const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
      lastFrameTime = frameTime;
      const state = stateRef.current;
      const snapshot = state.isPlaying
        ? (state.getLatestAudioSnapshot?.() ?? null)
        : null;
      const energy = clamp01(snapshot?.smoothedEnergy ?? 0);
      const bass = clamp01(snapshot?.bassPulse ?? 0);
      const mids = clamp01(snapshot?.mids ?? 0);
      const highs = clamp01(snapshot?.highs ?? 0);
      const kick = clamp01(snapshot?.kickPulse ?? 0);
      const acceptedKickSequence =
        snapshot?.kickPulseAcceptedEventSequence ?? 0;

      if (
        state.chromaEnabled &&
        acceptedKickSequence !== acceptedKickSequenceRef.current
      ) {
        acceptedKickSequenceRef.current = acceptedKickSequence;
        flashRef.current = Math.max(flashRef.current, 0.72 + kick * 0.28);
      } else if (!state.chromaEnabled || !snapshot) {
        acceptedKickSequenceRef.current = acceptedKickSequence;
      }

      const flash = state.chromaEnabled ? flashRef.current : 0;
      flashRef.current = Math.max(0, flashRef.current - delta * 5.2);
      const hue =
        monitorRef.current
          ?.closest<HTMLElement>(".signal-runner")
          ?.style.getPropertyValue("--signal-runner-hud-chroma-hue") || "0deg";

      if (monitorRef.current) {
        const speedScale = 2.7 - clamp01(state.actualSpeed / 100) * 1.6;
        monitorRef.current.style.setProperty(
          "--signal-runner-monitor-energy",
          state.chromaEnabled ? energy.toFixed(3) : "0",
        );
        monitorRef.current.style.setProperty(
          "--signal-runner-monitor-bass",
          state.chromaEnabled ? bass.toFixed(3) : "0",
        );
        monitorRef.current.style.setProperty(
          "--signal-runner-monitor-kick",
          state.chromaEnabled ? flash.toFixed(3) : "0",
        );
        monitorRef.current.style.setProperty(
          "--signal-runner-monitor-scan",
          state.chromaEnabled ? `${((frameTime * 0.055) % 124) - 12}%` : "50%",
        );
        monitorRef.current.style.setProperty(
          "--signal-runner-monitor-hue",
          hue,
        );

        for (
          let index = 0;
          index < MONITOR_LANE_BASE_DURATIONS.length;
          index += 1
        ) {
          monitorRef.current.style.setProperty(
            `--signal-runner-monitor-line-duration-${index + 1}`,
            `${(MONITOR_LANE_BASE_DURATIONS[index] * speedScale).toFixed(3)}s`,
          );
        }
      }

      for (let index = 0; index < cellRefs.current.length; index += 1) {
        const cell = cellRefs.current[index];

        if (!cell) {
          continue;
        }

        const row = Math.floor(index / MONITOR_GLYPH_CELLS_PER_LANE);
        const column = index % MONITOR_GLYPH_CELLS_PER_LANE;
        const rowSignal = row % 3 === 0 ? highs : row % 3 === 1 ? mids : bass;
        const chatter =
          ((Math.sin(frameTime * 0.006 + index * 1.7) + 1) / 2) * 0.22;
        const level = state.chromaEnabled
          ? clamp01(
              0.18 +
                energy * 0.38 +
                rowSignal * 0.28 +
                chatter +
                (column % 5 === 0 ? flash * 0.5 : 0),
            )
          : 0;

        if (state.motionEnabled) {
          const seed = Math.floor(frameTime / 140) * 31 + index * 13;
          cell.textContent =
            MONITOR_GLYPH_CHARS[Math.abs(seed) % MONITOR_GLYPH_CHARS.length];
        }

        cell.style.color = state.chromaEnabled
          ? `hsl(calc(${184 + row * 28}deg + ${hue}) ${82 + level * 16}% ${64 + level * 18}% / ${0.54 + level * 0.46})`
          : "";
        cell.style.opacity = state.chromaEnabled
          ? (0.62 + level * 0.38).toFixed(3)
          : "";
        cell.style.textShadow =
          state.chromaEnabled && level > 0.62
            ? `0 0 5px hsl(calc(184deg + ${hue}) 90% 64% / ${level.toFixed(3)})`
            : "";
      }

      for (let index = 0; index < barRefs.current.length; index += 1) {
        const bar = barRefs.current[index];

        if (!bar) {
          continue;
        }

        const band = index < 3 ? highs : index < 6 ? mids : bass;
        const variation = (Math.sin(frameTime * 0.008 + index * 1.9) + 1) / 2;
        const level = state.chromaEnabled
          ? clamp01(
              0.22 +
                energy * 0.3 +
                band * 0.32 +
                variation * 0.16 +
                (index === 1 || index === 6 ? flash * 0.48 : 0),
            )
          : 0.4 + (index % 3) * 0.12;
        bar.style.transform = state.chromaEnabled
          ? `scaleY(${level.toFixed(3)})`
          : "";
        bar.style.opacity = state.chromaEnabled
          ? (0.3 + level * 0.7).toFixed(3)
          : "0.58";
        bar.style.background = state.chromaEnabled
          ? `hsl(calc(${184 + (index % 4) * 22}deg + ${hue}) 88% ${58 + level * 15}%)`
          : "";
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <section
      className="signal-runner__signal-monitor"
      ref={monitorRef}
      data-chroma={chromaEnabled}
      data-motion={motionEnabled}
      aria-label="Signal analysis monitor"
    >
      <div className="signal-runner__monitor-field" aria-hidden="true">
        {Array.from({ length: MONITOR_LANE_COUNT }, (_, row) => (
          <div className="signal-runner__monitor-line" key={row}>
            {Array.from(
              { length: MONITOR_GLYPH_CELLS_PER_LANE },
              (_, index) => (
                <i
                  key={index}
                  ref={(element) => {
                    cellRefs.current[
                      row * MONITOR_GLYPH_CELLS_PER_LANE + index
                    ] = element;
                  }}
                >
                  {
                    MONITOR_GLYPH_CHARS[
                      (row * 11 + (index % MONITOR_GLYPH_SEQUENCE_LENGTH) * 3) %
                        MONITOR_GLYPH_CHARS.length
                    ]
                  }
                </i>
              ),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

type DecodingGlyphStripProps = {
  chromaEnabled: boolean;
  motionEnabled: boolean;
};

function DecodingGlyphStrip({
  chromaEnabled,
  motionEnabled,
}: DecodingGlyphStripProps) {
  const cellRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stateRef = useRef({ chromaEnabled, motionEnabled });

  useEffect(() => {
    stateRef.current = { chromaEnabled, motionEnabled };
  }, [chromaEnabled, motionEnabled]);

  useEffect(() => {
    let frameId = 0;

    const render = (frameTime: number) => {
      const state = stateRef.current;

      const tick = Math.floor(frameTime / 140);

      for (let index = 0; index < GLYPH_STRIP_CELLS; index += 1) {
        const cell = cellRefs.current[index];

        if (!cell) {
          continue;
        }

        if (state.motionEnabled) {
          const seed = tick * 31 + index * 13;
          cell.textContent = GLYPH_CHARS[Math.abs(seed) % GLYPH_CHARS.length];
        }

        cell.style.color = state.chromaEnabled
          ? LED_PALETTE[Math.abs(index * 13 + tick) % LED_PALETTE.length]
          : "";
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      className="signal-runner__glyph-strip"
      data-chroma={chromaEnabled}
      data-motion={motionEnabled}
      aria-hidden="true"
    >
      {Array.from({ length: GLYPH_STRIP_CELLS }, (_, index) => (
        <span
          key={index}
          ref={(element) => {
            cellRefs.current[index] = element;
          }}
          className="signal-runner__glyph-cell"
        />
      ))}
    </div>
  );
}

type MicroPulseLadderProps = {
  isPlaying: boolean;
  motionEnabled: boolean;
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
};

function MicroPulseLadder({
  isPlaying,
  motionEnabled,
  getLatestAudioSnapshot,
}: MicroPulseLadderProps) {
  const rungRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stateRef = useRef({ isPlaying, motionEnabled, getLatestAudioSnapshot });

  useEffect(() => {
    stateRef.current = { isPlaying, motionEnabled, getLatestAudioSnapshot };
  }, [isPlaying, motionEnabled, getLatestAudioSnapshot]);

  useEffect(() => {
    let frameId = 0;
    let lastFrameTime = performance.now();
    let level = 0;

    const render = (frameTime: number) => {
      const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
      lastFrameTime = frameTime;

      const state = stateRef.current;

      // MOTION off freezes the ladder at its last dormant reading.
      if (state.motionEnabled) {
        const snapshot = state.isPlaying
          ? (state.getLatestAudioSnapshot?.() ?? null)
          : null;
        const mids = clamp01(snapshot?.mids ?? 0);
        const kick = clamp01(snapshot?.kickPulse ?? 0);
        const target = snapshot ? clamp01(mids * 0.7 + kick * 0.4) : 0;
        const easing = 1 - Math.exp(-delta * (target > level ? 20 : 5));
        level += (target - level) * easing;

        for (let index = 0; index < PULSE_LADDER_SEGMENTS; index += 1) {
          const rung = rungRefs.current[index];

          if (!rung) {
            continue;
          }

          const threshold = index / PULSE_LADDER_SEGMENTS;
          const rungLevel = clamp01(
            (level - threshold) * PULSE_LADDER_SEGMENTS,
          );
          rung.style.setProperty(
            "--signal-runner-rung-level",
            rungLevel.toFixed(3),
          );
        }
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      className="signal-runner__pulse-ladder"
      data-active={isPlaying}
      data-motion={motionEnabled}
      aria-hidden="true"
    >
      {Array.from({ length: PULSE_LADDER_SEGMENTS }, (_, index) => (
        <span
          key={index}
          ref={(element) => {
            rungRefs.current[index] = element;
          }}
          className="signal-runner__pulse-rung"
        />
      ))}
    </div>
  );
}

const MESSAGE_STREAM_GROUP = [
  { text: "WELCOME TO", color: "white", joinPrevious: false },
  { text: "DEEP", color: "green", joinPrevious: false },
  { text: "SIGNALS", color: "cyan", joinPrevious: true },
  { text: ".FM", color: "pink", joinPrevious: true },
  { text: "TUNE IN.", color: "green", joinPrevious: false },
  { text: "TRANSMIT.", color: "cyan", joinPrevious: false },
  { text: "TRANSCEND.", color: "pink", joinPrevious: false },
] as const;

function MessageStream({ blastOffVisible }: { blastOffVisible: boolean }) {
  const messageParts = blastOffVisible
    ? [{ text: "BLAST OFF!", color: "blast-off", joinPrevious: false }]
    : MESSAGE_STREAM_GROUP;

  const renderMessageGroup = (groupIndex: number) => (
    <span className="signal-runner__message-stream-group" key={groupIndex}>
      {messageParts.map(({ text, color, joinPrevious = false }) => (
        <span
          className={`signal-runner__message-stream-part signal-runner__message-stream-part--${color}${joinPrevious ? " signal-runner__message-stream-part--joined" : ""}`}
          key={text}
        >
          {text}
        </span>
      ))}
    </span>
  );

  return (
    <div
      className={`signal-runner__message-stream${blastOffVisible ? " signal-runner__message-stream--blast-off" : ""}`}
      aria-label="Signal Runner message"
    >
      <span className="signal-runner__message-stream-track">
        {renderMessageGroup(0)}
        {renderMessageGroup(1)}
      </span>
    </div>
  );
}

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
  // HUD widgets freeze while playback is stopped even though the MOTION toggle stays on.
  const motionEnabled = motionSetting && isPlaying;
  const runnerRef = useRef<HTMLDivElement | null>(null);
  const hudChromaHueRef = useRef(0);
  const [driveTelemetry, setDriveTelemetry] =
    useState<SignalRunnerDriveTelemetry>({
      controlMode,
      smoothedEnergy: 0,
      targetSpeed: isPlaying ? manualFlightSpeed : 0,
      actualSpeed: isPlaying ? manualFlightSpeed : 0,
    });
  const [blastOffVisible, setBlastOffVisible] = useState(false);
  const [coilSignal, setCoilSignal] = useState<CoilSignal>(IDLE_COIL_SIGNAL);
  const blastOffQualificationRef = useRef(
    createSharedSurgeQualificationState(),
  );
  const blastOffTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      return;
    }

    blastOffQualificationRef.current = createSharedSurgeQualificationState();
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
        energy: isPlaying
          ? Math.min(1, Math.max(0, snapshot?.smoothedEnergy ?? 0))
          : 0,
        kick: isPlaying
          ? Math.min(1, Math.max(0, snapshot?.kickPulse ?? 0))
          : 0,
        bassPulse: isPlaying
          ? Math.min(1, Math.max(0, snapshot?.bassPulse ?? 0))
          : 0,
      });
    };

    updateCoilSignal();
    const intervalId = window.setInterval(
      updateCoilSignal,
      COIL_SIGNAL_INTERVAL_MS,
    );

    return () => window.clearInterval(intervalId);
  }, [getLatestAudioSnapshot, isPlaying]);

  useEffect(() => {
    let frameId = 0;

    const updateHudChromaHue = () => {
      const snapshot = getLatestAudioSnapshot?.();
      const energy = isPlaying
        ? Math.min(1, Math.max(0, snapshot?.smoothedEnergy ?? 0))
        : 0;
      const targetHue =
        chromaEnabled && isPlaying ? mapSignalRunnerChromaHue(energy) : 0;
      hudChromaHueRef.current +=
        (targetHue - hudChromaHueRef.current) *
        SIGNAL_RUNNER_CHROMA_HUE_RESPONSE;
      runnerRef.current?.style.setProperty(
        "--signal-runner-hud-chroma-hue",
        `${hudChromaHueRef.current.toFixed(2)}deg`,
      );
      frameId = window.requestAnimationFrame(updateHudChromaHue);
    };

    frameId = window.requestAnimationFrame(updateHudChromaHue);

    return () => window.cancelAnimationFrame(frameId);
  }, [chromaEnabled, getLatestAudioSnapshot, isPlaying]);

  const handleDriveTelemetry = (telemetry: SignalRunnerDriveTelemetry) => {
    setDriveTelemetry(telemetry);
    onDriveTelemetry?.(telemetry);

    const snapshot = getLatestAudioSnapshot?.() ?? null;
    const now = performance.now();
    const acceptedSequence = snapshot?.kickPulseAcceptedEventSequence ?? 0;
    const smoothedEnergy = snapshot?.smoothedEnergy ?? 0;
    const qualification = updateSharedSurgeQualification(
      blastOffQualificationRef.current,
      {
        nowMs: now,
        smoothedEnergy,
        acceptedSequence,
        isPlaying,
        motionEnabled: motionSetting,
      },
    );
    blastOffQualificationRef.current = qualification.state;

    if (!isPlaying) {
      setBlastOffVisible(false);
      return;
    }

    if (!qualification.triggered) {
      return;
    }

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
    actualSpeed < targetSpeed - 3
      ? "ACCEL"
      : actualSpeed > targetSpeed + 3
        ? "DECEL"
        : "HOLD";
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
  const vectorDriveRef = useRef<HTMLElement | null>(null);
  const vectorDriveStateRef = useRef({
    actualSpeed,
    chromaEnabled,
    getLatestAudioSnapshot,
    isPlaying,
  });

  useEffect(() => {
    vectorDriveStateRef.current = {
      actualSpeed,
      chromaEnabled,
      getLatestAudioSnapshot,
      isPlaying,
    };
  }, [actualSpeed, chromaEnabled, getLatestAudioSnapshot, isPlaying]);

  useEffect(() => {
    let frameId = 0;
    let lastFrameTime = performance.now();
    let acceptedKickSequence = 0;
    let kickSurge = 0;

    const renderVectorDriveEffects = (frameTime: number) => {
      const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
      lastFrameTime = frameTime;
      const state = vectorDriveStateRef.current;
      const snapshot = state.isPlaying
        ? (state.getLatestAudioSnapshot?.() ?? null)
        : null;
      const energy = state.chromaEnabled
        ? clamp01(snapshot?.smoothedEnergy ?? 0)
        : 0;
      const bass = state.chromaEnabled ? clamp01(snapshot?.bassPulse ?? 0) : 0;
      const kick = state.chromaEnabled ? clamp01(snapshot?.kickPulse ?? 0) : 0;
      const nextKickSequence = snapshot?.kickPulseAcceptedEventSequence ?? 0;

      if (state.chromaEnabled && nextKickSequence !== acceptedKickSequence) {
        acceptedKickSequence = nextKickSequence;
        kickSurge = Math.max(kickSurge, 0.72 + kick * 0.28);
      } else if (!state.chromaEnabled || !snapshot) {
        acceptedKickSequence = nextKickSequence;
      }

      kickSurge = Math.max(0, kickSurge - delta * 4.8);
      const stress = state.chromaEnabled ? clamp01(state.actualSpeed / 100) : 0;
      const flicker = state.chromaEnabled
        ? clamp01(
            stress * (0.72 + ((Math.sin(frameTime * 0.037) + 1) / 2) * 0.28),
          )
        : 0;
      const vectorDrive = vectorDriveRef.current;

      if (vectorDrive) {
        vectorDrive.style.setProperty(
          "--signal-runner-vector-energy",
          energy.toFixed(3),
        );
        vectorDrive.style.setProperty(
          "--signal-runner-vector-bass",
          bass.toFixed(3),
        );
        vectorDrive.style.setProperty(
          "--signal-runner-vector-kick",
          kickSurge.toFixed(3),
        );
        vectorDrive.style.setProperty(
          "--signal-runner-vector-stress",
          stress.toFixed(3),
        );
        vectorDrive.style.setProperty(
          "--signal-runner-vector-flicker",
          flicker.toFixed(3),
        );
      }

      frameId = window.requestAnimationFrame(renderVectorDriveEffects);
    };

    frameId = window.requestAnimationFrame(renderVectorDriveEffects);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const runnerStyle = {
    "--signal-runner-hud-chroma-energy": coilSignal.energy,
    "--signal-runner-hud-chroma-kick": coilSignal.kick,
    "--signal-runner-hud-chroma-hue": "0deg",
  } as CSSProperties;

  return (
    <div
      className="signal-runner"
      ref={runnerRef}
      data-playing={isPlaying}
      data-chroma-enabled={chromaEnabled}
      style={runnerStyle}
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
        <div className="signal-runner__glass" aria-hidden="true" />
      </div>

      <div className="signal-runner__hud-pod">
        <div className="signal-runner__hud-content">
          <div className="signal-runner__hud-slot signal-runner__hud-slot--left">
            <div className="signal-runner__left-rail">
              <div className="signal-runner__left-slot signal-runner__left-slot--spiral">
                <HypnoticSpiral
                  isPlaying={isPlaying}
                  motionEnabled={motionEnabled}
                  chromaEnabled={chromaEnabled}
                  actualSpeed={actualSpeed}
                  rotationMultiplier={0.34}
                  getLatestAudioSnapshot={getLatestAudioSnapshot}
                />
              </div>
              <div className="signal-runner__left-slot signal-runner__left-slot--scan">
                <ScannerDial
                  size="large"
                  chromaEnabled={chromaEnabled}
                  motionEnabled={motionEnabled}
                  isPlaying={isPlaying}
                  getLatestAudioSnapshot={getLatestAudioSnapshot}
                />
              </div>
              <div className="signal-runner__left-slot signal-runner__left-slot--inner">
                <div className="signal-runner__sensor-row">
                  <SignalBar
                    isPlaying={isPlaying}
                    motionEnabled={motionEnabled}
                    field="bass"
                    variant="ember"
                    getLatestAudioSnapshot={getLatestAudioSnapshot}
                  />
                  <DecodingGlyphStrip
                    chromaEnabled={chromaEnabled}
                    motionEnabled={motionEnabled}
                  />
                  <MicroPulseLadder
                    isPlaying={isPlaying}
                    motionEnabled={motionEnabled}
                    getLatestAudioSnapshot={getLatestAudioSnapshot}
                  />
                  <ImpulseCoil signal={coilSignal} />
                  <HeatSensor
                    isPlaying={isPlaying}
                    motionEnabled={motionEnabled}
                    getLatestAudioSnapshot={getLatestAudioSnapshot}
                  />
                </div>
              </div>
            </div>
            <AuxTraceWidget
              side="left"
              chromaEnabled={chromaEnabled}
              motionEnabled={motionEnabled}
              isPlaying={isPlaying}
              getLatestAudioSnapshot={getLatestAudioSnapshot}
            />
            <HardwareLedBank
              side="left"
              count={8}
              signal={coilSignal}
              motionEnabled={motionEnabled}
              chromaEnabled={chromaEnabled}
            />
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
                <div className="signal-runner__scale" aria-hidden="true">
                  <span>DRIFT</span>
                  <span>CRUISE</span>
                  <span>HYPER</span>
                </div>
              </aside>
            ) : null}
          </div>

          <div className="signal-runner__center-stack">
            <MessageStream blastOffVisible={isPlaying && blastOffVisible} />
            <section
              className="signal-runner__vector-drive"
              data-chroma={chromaEnabled}
              data-blast-off={isPlaying && blastOffVisible}
              ref={vectorDriveRef}
              aria-label="Vector drive"
            >
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
              <div
                className="signal-runner__drive-meter"
                style={targetMarkerStyle}
              >
                <span
                  className="signal-runner__target-marker"
                  aria-hidden="true"
                />
                <div
                  className="signal-runner__drive-segments"
                  aria-hidden="true"
                >
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
          </div>

          <div className="signal-runner__hud-slot signal-runner__hud-slot--right">
            <div className="signal-runner__right-rail">
              <div className="signal-runner__right-slot signal-runner__right-slot--monitor">
                <SignalMonitor
                  actualSpeed={actualSpeed}
                  chromaEnabled={chromaEnabled}
                  motionEnabled={motionEnabled}
                  isPlaying={isPlaying}
                  getLatestAudioSnapshot={getLatestAudioSnapshot}
                />
              </div>
              <div className="signal-runner__right-slot signal-runner__right-slot--aux">
                <ScannerDial
                  size="small"
                  chromaEnabled={chromaEnabled}
                  motionEnabled={motionEnabled}
                  isPlaying={isPlaying}
                />
              </div>
              <div className="signal-runner__right-slot signal-runner__right-slot--spiral">
                <HypnoticSpiral
                  isPlaying={isPlaying}
                  motionEnabled={motionEnabled}
                  chromaEnabled={chromaEnabled}
                  actualSpeed={actualSpeed}
                  rotationMultiplier={1.35}
                  getLatestAudioSnapshot={getLatestAudioSnapshot}
                />
              </div>
            </div>
            <AuxTraceWidget
              side="right"
              chromaEnabled={chromaEnabled}
              motionEnabled={motionEnabled}
              isPlaying={isPlaying}
              getLatestAudioSnapshot={getLatestAudioSnapshot}
            />
            <HardwareLedBank
              side="right"
              count={8}
              signal={coilSignal}
              motionEnabled={motionEnabled}
              chromaEnabled={chromaEnabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignalRunnerExperience;
