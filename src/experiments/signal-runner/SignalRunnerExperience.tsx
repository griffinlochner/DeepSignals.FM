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
const LED_ROW_SIZE = 4;
const LED_COUNT = LED_ROW_SIZE * 2;
const LED_PALETTE = ["#47f7ff", "#9cff57", "#ff7fa1"];
const LED_BASE_COLOR_INDEXES = [0, 1, 0, 1, 2, 0, 1, 2];
const GLYPH_CHARS = ["░", "▒", "▓", "▌", "▐", "┃", "╎", "╏", "¦", "†", "‡", "×", "⌁", "⌬", "∴", "⋄", "◊", "✦"];
const GLYPH_STRIP_CELLS = 7;
const PULSE_LADDER_SEGMENTS = 6;
const SLOGAN_TEXT = "TUNE IN. TRANSMIT. TRANSCEND.";
const SLOGAN_SCRAMBLE_MS = 2200;
const SLOGAN_DECODE_MS = 1100;
const SLOGAN_RESOLVED_MS = 2600;
const SLOGAN_DEGRADE_MS = 1400;
const SLOGAN_CYCLE_MS =
  SLOGAN_SCRAMBLE_MS + SLOGAN_DECODE_MS + SLOGAN_RESOLVED_MS + SLOGAN_DEGRADE_MS;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function scrambleSlogan(seed: number, revealCount: number) {
  let result = "";

  for (let index = 0; index < SLOGAN_TEXT.length; index += 1) {
    const char = SLOGAN_TEXT[index];

    if (index < revealCount || char === " ") {
      result += char;
      continue;
    }

    const glyphSeed = seed * 37 + index * 11;
    result += GLYPH_CHARS[Math.abs(glyphSeed) % GLYPH_CHARS.length];
  }

  return result;
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
  const stateRef = useRef({ isPlaying, motionEnabled, field, getLatestAudioSnapshot });

  useEffect(() => {
    stateRef.current = { isPlaying, motionEnabled, field, getLatestAudioSnapshot };
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
          ? state.getLatestAudioSnapshot?.() ?? null
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

function HeatSensor({ isPlaying, motionEnabled, getLatestAudioSnapshot }: HeatSensorProps) {
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
          ? state.getLatestAudioSnapshot?.() ?? null
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
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
};

function HypnoticSpiral({
  isPlaying,
  motionEnabled,
  chromaEnabled,
  actualSpeed,
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
  }, [isPlaying, motionEnabled, chromaEnabled, actualSpeed, getLatestAudioSnapshot]);

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
        ? state.getLatestAudioSnapshot?.() ?? null
        : null;
      const energy = clamp01(snapshot?.smoothedEnergy ?? 0);
      const kick = clamp01(snapshot?.kickPulse ?? 0);
      const speed = clamp01(state.actualSpeed / 100);

      if (active) {
        angle = (angle + delta * (18 + speed * speed * 520 + energy * 46)) % 360;
      }

      if (rotorRef.current) {
        rotorRef.current.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      }

      // MOTION off freezes glow/color reactivity alongside rotation.
      if (state.motionEnabled) {
        const targetGlow = state.isPlaying ? 0.24 + energy * 0.6 + kick * 0.28 : 0;
        glow += (clamp01(targetGlow) - glow) * (1 - Math.exp(-delta * 7));

        const spiral = spiralRef.current;

        if (spiral) {
          spiral.style.setProperty("--signal-runner-spiral-glow", glow.toFixed(3));

          if (state.chromaEnabled && snapshot) {
            const shift =
              Math.floor((energy * 1.6 + kick * 1.9) * 1.7) % LED_PALETTE.length;
            spiral.style.setProperty(
              "--signal-runner-spiral-color-a",
              LED_PALETTE[shift],
            );
            spiral.style.setProperty(
              "--signal-runner-spiral-color-b",
              LED_PALETTE[(shift + 2) % LED_PALETTE.length],
            );
          } else {
            spiral.style.setProperty("--signal-runner-spiral-color-a", LED_PALETTE[0]);
            spiral.style.setProperty("--signal-runner-spiral-color-b", LED_PALETTE[2]);
          }
        }
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      className="signal-runner__spiral"
      data-active={isPlaying}
      data-motion={motionEnabled}
      ref={spiralRef}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="signal-runner__spiral-svg">
        <g className="signal-runner__spiral-rotor" ref={rotorRef}>
          <path className="signal-runner__spiral-arm signal-runner__spiral-arm--a" d={SPIRAL_PATH} />
          <path
            className="signal-runner__spiral-arm signal-runner__spiral-arm--b"
            d={SPIRAL_PATH}
            transform="rotate(180 24 24)"
          />
        </g>
        <circle className="signal-runner__spiral-core" cx="24" cy="24" r="3.2" />
        <circle className="signal-runner__spiral-rim" cx="24" cy="24" r="22" />
      </svg>
    </div>
  );
}

type ChromaLedBankProps = {
  isPlaying: boolean;
  chromaEnabled: boolean;
  getLatestAudioSnapshot?: (() => AudioReactiveSnapshot) | null;
};

function ChromaLedBank({
  isPlaying,
  chromaEnabled,
  getLatestAudioSnapshot,
}: ChromaLedBankProps) {
  const ledRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stateRef = useRef({ isPlaying, chromaEnabled, getLatestAudioSnapshot });

  useEffect(() => {
    stateRef.current = { isPlaying, chromaEnabled, getLatestAudioSnapshot };
  }, [isPlaying, chromaEnabled, getLatestAudioSnapshot]);

  useEffect(() => {
    let frameId = 0;
    let lastFrameTime = performance.now();
    let kickFlash = 0;
    let lastKickSequence = -1;
    const renderedLevels = new Array<number>(LED_COUNT).fill(0.04);

    const render = (frameTime: number) => {
      const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
      lastFrameTime = frameTime;

      const state = stateRef.current;
      const snapshot = state.isPlaying
        ? state.getLatestAudioSnapshot?.() ?? null
        : null;
      const energy = clamp01(snapshot?.smoothedEnergy ?? 0);
      const bass = clamp01(snapshot?.bass ?? 0);
      const bassPulse = clamp01(snapshot?.bassPulse ?? 0);
      const mids = clamp01(snapshot?.mids ?? 0);
      const highs = clamp01(snapshot?.highs ?? 0);

      kickFlash = Math.max(0, kickFlash - delta * 3.6);

      if (snapshot) {
        const sequence = snapshot.kickPulseAcceptedEventSequence ?? -1;

        if (sequence !== lastKickSequence) {
          lastKickSequence = sequence;
          kickFlash = 1;
        }
      } else {
        lastKickSequence = -1;
      }

      const chromaShift = state.chromaEnabled
        ? Math.floor(
            (bass * 1.1 + highs * 1.7 + mids * 0.8 + kickFlash * 1.4) * 1.8,
          )
        : 0;
      const phase = frameTime * 0.0042;

      for (let index = 0; index < LED_COUNT; index += 1) {
        const led = ledRefs.current[index];

        if (!led) {
          continue;
        }

        const isSecondary = index >= LED_ROW_SIZE;
        let level = 0.04;

        if (snapshot && state.chromaEnabled) {
          const wave =
            (Math.sin(phase * (isSecondary ? 1.7 : 1) - index * 0.8) + 1) / 2;
          const bandInfluence = isSecondary
            ? mids * 0.2 + highs * 0.3
            : bassPulse * 0.28 + bass * 0.12;

          level =
            0.1 +
            energy * 0.42 +
            wave * (0.12 + energy * 0.26) +
            kickFlash * (index % 2 === 0 ? 0.5 : 0.18) +
            bandInfluence;
        } else if (snapshot) {
          level = 0.12 + energy * (isSecondary ? 0.52 : 0.68);
        }

        const colorIndex =
          (LED_BASE_COLOR_INDEXES[index] + chromaShift) % LED_PALETTE.length;
        const easing = state.chromaEnabled ? 1 : 1 - Math.exp(-delta * 3.2);
        renderedLevels[index] += (clamp01(level) - renderedLevels[index]) * easing;

        led.style.setProperty(
          "--signal-runner-led-level",
          renderedLevels[index].toFixed(3),
        );
        led.style.setProperty("--signal-runner-led-color", LED_PALETTE[colorIndex]);
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <section
      className="signal-runner__led-bank"
      data-active={isPlaying}
      data-chroma={chromaEnabled}
      aria-hidden="true"
    >
      {Array.from({ length: LED_COUNT }, (_, index) => (
        <span
          key={index}
          ref={(element) => {
            ledRefs.current[index] = element;
          }}
          className={`signal-runner__led${
            index >= LED_ROW_SIZE ? " signal-runner__led--secondary" : ""
          }`}
        />
      ))}
    </section>
  );
}

type DecodingGlyphStripProps = {
  chromaEnabled: boolean;
  motionEnabled: boolean;
};

function DecodingGlyphStrip({ chromaEnabled, motionEnabled }: DecodingGlyphStripProps) {
  const cellRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stateRef = useRef({ chromaEnabled, motionEnabled });

  useEffect(() => {
    stateRef.current = { chromaEnabled, motionEnabled };
  }, [chromaEnabled, motionEnabled]);

  useEffect(() => {
    let frameId = 0;

    const render = (frameTime: number) => {
      const state = stateRef.current;

      // MOTION off freezes the readout on its last decoded frame.
      if (state.motionEnabled) {
        const tick = Math.floor(frameTime / 140);

        for (let index = 0; index < GLYPH_STRIP_CELLS; index += 1) {
          const cell = cellRefs.current[index];

          if (!cell) {
            continue;
          }

          const seed = tick * 31 + index * 13;
          cell.textContent = GLYPH_CHARS[Math.abs(seed) % GLYPH_CHARS.length];
          cell.style.color = state.chromaEnabled
            ? LED_PALETTE[Math.abs(seed + tick) % LED_PALETTE.length]
            : "";
        }
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
          ? state.getLatestAudioSnapshot?.() ?? null
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
          const rungLevel = clamp01((level - threshold) * PULSE_LADDER_SEGMENTS);
          rung.style.setProperty("--signal-runner-rung-level", rungLevel.toFixed(3));
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

type SloganDecodeStripProps = {
  chromaEnabled: boolean;
  motionEnabled: boolean;
};

function SloganDecodeStrip({ chromaEnabled, motionEnabled }: SloganDecodeStripProps) {
  const textRefA = useRef<HTMLSpanElement | null>(null);
  const textRefB = useRef<HTMLSpanElement | null>(null);
  const stateRef = useRef({ chromaEnabled, motionEnabled });

  useEffect(() => {
    stateRef.current = { chromaEnabled, motionEnabled };
  }, [chromaEnabled, motionEnabled]);

  useEffect(() => {
    let frameId = 0;
    const cycleStart = performance.now();

    const render = (frameTime: number) => {
      const state = stateRef.current;
      let text: string;

      if (!state.motionEnabled) {
        // Reduced motion: rest on the fully decoded slogan.
        text = SLOGAN_TEXT;
      } else {
        const elapsed = (frameTime - cycleStart) % SLOGAN_CYCLE_MS;
        const tick = Math.floor(frameTime / 90);
        let revealFraction: number;

        if (elapsed < SLOGAN_SCRAMBLE_MS) {
          revealFraction = 0;
        } else if (elapsed < SLOGAN_SCRAMBLE_MS + SLOGAN_DECODE_MS) {
          revealFraction = (elapsed - SLOGAN_SCRAMBLE_MS) / SLOGAN_DECODE_MS;
        } else if (elapsed < SLOGAN_SCRAMBLE_MS + SLOGAN_DECODE_MS + SLOGAN_RESOLVED_MS) {
          revealFraction = 1;
        } else {
          const degradeElapsed =
            elapsed - SLOGAN_SCRAMBLE_MS - SLOGAN_DECODE_MS - SLOGAN_RESOLVED_MS;
          revealFraction = 1 - clamp01(degradeElapsed / SLOGAN_DEGRADE_MS) * 0.65;
        }

        const revealCount = Math.round(clamp01(revealFraction) * SLOGAN_TEXT.length);
        text = scrambleSlogan(tick, revealCount);
      }

      if (textRefA.current) {
        textRefA.current.textContent = text;
      }

      if (textRefB.current) {
        textRefB.current.textContent = text;
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      className="signal-runner__slogan-strip"
      data-chroma={chromaEnabled}
      data-motion={motionEnabled}
      aria-hidden="true"
    >
      <div className="signal-runner__slogan-track">
        <span className="signal-runner__slogan-text" ref={textRefA} />
        <span className="signal-runner__slogan-text" ref={textRefB} />
      </div>
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
            <div className="signal-runner__sensor-row">
              <SignalBar
                isPlaying={isPlaying}
                motionEnabled={motionEnabled}
                field="bass"
                variant="ember"
                getLatestAudioSnapshot={getLatestAudioSnapshot}
              />
              <DecodingGlyphStrip chromaEnabled={chromaEnabled} motionEnabled={motionEnabled} />
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

          <div className="signal-runner__hud-slot signal-runner__hud-slot--right">
            <div className="signal-runner__spiral-row">
              <SignalBar
                isPlaying={isPlaying}
                motionEnabled={motionEnabled}
                field="highs"
                variant="ion"
                getLatestAudioSnapshot={getLatestAudioSnapshot}
              />
              <HypnoticSpiral
                isPlaying={isPlaying}
                motionEnabled={motionEnabled}
                chromaEnabled={chromaEnabled}
                actualSpeed={actualSpeed}
                getLatestAudioSnapshot={getLatestAudioSnapshot}
              />
            </div>
            <div className="signal-runner__lower-row">
              <ChromaLedBank
                isPlaying={isPlaying}
                chromaEnabled={chromaEnabled}
                getLatestAudioSnapshot={getLatestAudioSnapshot}
              />
              <SloganDecodeStrip chromaEnabled={chromaEnabled} motionEnabled={motionEnabled} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignalRunnerExperience;