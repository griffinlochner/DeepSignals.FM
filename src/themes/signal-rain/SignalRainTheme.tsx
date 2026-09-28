import { useEffect, useRef } from "react";
import { createRenderFpsSampler } from "../../app/renderFpsTelemetry";
import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import type { ThemeSceneProps } from "../themeTypes";
import "./signalRain.css";

type RainColumn = {
  headRow: number;
  speed: number;
  trailLength: number;
  glyphOffset: number;
  accentIndex: number;
  accentRolls: Float32Array;
  glyphs: string[];
  nextMutationAt: number;
};

type BrandedTransmission = {
  active: boolean;
  messageIndex: number;
  x: number;
  y: number;
  speed: number;
  fontSize: number;
  width: number;
  partWidths: Float32Array;
  nextSpawnAt: number;
};

const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const TELEMETRY_INTERVAL_MS = 100;
const COLUMN_WIDTH = 24;
const ROW_HEIGHT = 21;
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>[]{}\\/|+-=*.:;!?";
const ACCENT_COLORS = ["#9cff57", "#47f7ff", "#ff7fa1"];
const BASE_GLYPH_COLOR = "#778086";
const HEAD_GLYPH_COLOR = "#bac3c8";
const BRANDED_TRANSMISSIONS = [
  {
    text: "DEEPSIGNALS.FM",
    parts: [
      { text: "DEEP", color: "#9cff57" },
      { text: "SIGNALS", color: "#47f7ff" },
      { text: ".FM", color: "#ff7fa1" },
    ],
  },
  { text: "TUNE IN.", parts: [{ text: "TUNE IN.", color: "#9cff57" }] },
  { text: "TRANSMIT.", parts: [{ text: "TRANSMIT.", color: "#47f7ff" }] },
  { text: "TRANSCEND.", parts: [{ text: "TRANSCEND.", color: "#ff7fa1" }] },
] as const;

const SILENT_SNAPSHOT: AudioReactiveSnapshot = {
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

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

function createColumn(rowCount: number): RainColumn {
  const trailLength = 14 + Math.floor(Math.random() * 11);
  const glyphs = new Array<string>(trailLength);
  const accentRolls = new Float32Array(trailLength);

  for (let index = 0; index < trailLength; index += 1) {
    glyphs[index] = randomGlyph();
    accentRolls[index] = Math.random();
  }

  return {
    headRow: Math.random() * rowCount,
    speed: 3 + Math.random() * 5,
    trailLength,
    glyphOffset: Math.floor(Math.random() * trailLength),
    accentIndex: Math.floor(Math.random() * ACCENT_COLORS.length),
    accentRolls,
    glyphs,
    nextMutationAt: performance.now() + 80 + Math.random() * 420,
  };
}

function SignalRainTheme({
  isPlaying,
  motionEnabled = true,
  chromaEnabled = true,
  reducedMotion,
  getLatestAudioSnapshot,
  onRuntimeTelemetry,
}: ThemeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    isPlaying,
    motionEnabled,
    chromaEnabled,
    reducedMotion,
    getLatestAudioSnapshot,
    onRuntimeTelemetry,
  });

  useEffect(() => {
    stateRef.current = {
      isPlaying,
      motionEnabled,
      chromaEnabled,
      reducedMotion,
      getLatestAudioSnapshot,
      onRuntimeTelemetry,
    };
  }, [
    chromaEnabled,
    getLatestAudioSnapshot,
    isPlaying,
    motionEnabled,
    onRuntimeTelemetry,
    reducedMotion,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) {
      return undefined;
    }

    let columns: RainColumn[] = [];
    let columnCount = 0;
    let rowCount = 0;
    let averageSpeed = 0;
    let frameId = 0;
    let lastRenderedAt = 0;
    let lastTelemetryAt = 0;
    let travelPosition = 0;
    const transmission: BrandedTransmission = {
      active: true,
      messageIndex: 0,
      x: 0,
      y: 0,
      speed: 48,
      fontSize: 22,
      width: 0,
      partWidths: new Float32Array(3),
      nextSpawnAt: 0,
    };

    const renderFpsSampler = createRenderFpsSampler((renderFps) => {
      stateRef.current.onRuntimeTelemetry?.({ renderFps });
    });

    const layoutTransmission = (
      width: number,
      height: number,
      startingY: number | null,
    ) => {
      const message = BRANDED_TRANSMISSIONS[transmission.messageIndex];
      transmission.fontSize = width < 560 ? 18 : 22;
      context.font = `700 ${transmission.fontSize}px Consolas, monospace`;
      transmission.width = 0;
      transmission.partWidths.fill(0);
      for (let index = 0; index < message.parts.length; index += 1) {
        const partWidth = context.measureText(message.parts[index].text).width;
        transmission.partWidths[index] = partWidth;
        transmission.width += partWidth;
      }
      const horizontalMargin = transmission.width / 2 + COLUMN_WIDTH;
      transmission.x = width < 700
        ? width / 2
        : horizontalMargin +
          Math.random() * Math.max(0, width - horizontalMargin * 2);
      transmission.y =
        startingY ?? Math.max(transmission.fontSize * 2, height * 0.12);
      transmission.active = true;
    };

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        MAX_DEVICE_PIXEL_RATIO,
      );
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      columnCount = Math.max(1, Math.ceil(width / COLUMN_WIDTH));
      rowCount = Math.max(1, Math.ceil(height / ROW_HEIGHT));
      columns = new Array<RainColumn>(columnCount);
      averageSpeed = 0;

      for (let index = 0; index < columnCount; index += 1) {
        const column = createColumn(rowCount);
        columns[index] = column;
        averageSpeed += column.speed;
      }
      averageSpeed /= columnCount;
      layoutTransmission(width, height, null);
    };

    const activateNextTransmission = () => {
      transmission.messageIndex =
        (transmission.messageIndex + 1) % BRANDED_TRANSMISSIONS.length;
      transmission.speed = 46 + Math.random() * 12;
      layoutTransmission(
        Math.max(1, canvas.clientWidth),
        Math.max(1, canvas.clientHeight),
        -transmission.fontSize * 2,
      );
    };

    const mutateColumn = (
      column: RainColumn,
      timestamp: number,
      mids: number,
    ) => {
      if (timestamp < column.nextMutationAt) {
        return;
      }

      const mutationIndex = Math.floor(Math.random() * column.trailLength);
      column.glyphs[mutationIndex] = randomGlyph();
      column.glyphOffset = (column.glyphOffset + 1) % column.trailLength;
      column.nextMutationAt = timestamp + 110 + Math.random() * (430 - mids * 250);
    };

    const drawFrame = (timestamp: number, deltaSeconds: number) => {
      const state = stateRef.current;
      const snapshot = state.getLatestAudioSnapshot?.() ?? SILENT_SNAPSHOT;
      const motionActive =
        state.isPlaying && state.motionEnabled && !state.reducedMotion;
      const reactiveEnergy = state.chromaEnabled
        ? clamp(snapshot.smoothedEnergy)
        : 0;
      const bass = state.chromaEnabled ? clamp(snapshot.bass) : 0;
      const mids = state.chromaEnabled ? clamp(snapshot.mids) : 0;
      const highs = state.chromaEnabled ? clamp(snapshot.highs) : 0;
      const accentActivity = state.chromaEnabled
        ? 0.12 + reactiveEnergy * 0.55 + mids * 0.25
        : 0.08;

      context.globalAlpha = 1;
      context.fillStyle = "#000000";
      context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      context.font = "600 16px Consolas, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";

      if (motionActive && transmission.active) {
        transmission.y += transmission.speed * deltaSeconds;
        if (transmission.y - transmission.fontSize > canvas.clientHeight) {
          transmission.active = false;
          transmission.nextSpawnAt = timestamp + 2500 + Math.random() * 3000;
        }
      } else if (
        motionActive &&
        !transmission.active &&
        timestamp >= transmission.nextSpawnAt
      ) {
        activateNextTransmission();
      }

      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const column = columns[columnIndex];
        if (motionActive) {
          column.headRow += column.speed * deltaSeconds;
          mutateColumn(column, timestamp, mids);
          if (column.headRow - column.trailLength > rowCount) {
            column.headRow = -Math.random() * rowCount * 0.35;
          }
        }

        const headRow = Math.floor(column.headRow);
        const x = columnIndex * COLUMN_WIDTH + COLUMN_WIDTH / 2;
        for (let trailIndex = 0; trailIndex < column.trailLength; trailIndex += 1) {
          const row = headRow - trailIndex;
          if (row < 0 || row >= rowCount) {
            continue;
          }

          const glyphY = row * ROW_HEIGHT + ROW_HEIGHT / 2;
          if (
            transmission.active &&
            Math.abs(x - transmission.x) < transmission.width / 2 + 12 &&
            Math.abs(glyphY - transmission.y) < transmission.fontSize + 8
          ) {
            continue;
          }

          const glyphIndex =
            (column.glyphOffset + trailIndex) % column.trailLength;
          const trailProgress = trailIndex / column.trailLength;
          const trailStrength = (1 - trailProgress) * (1 - trailProgress);
          const leadingGlyph = trailIndex === 0;
          const accentThreshold =
            accentActivity * (leadingGlyph ? 0.9 : 0.22 + trailStrength * 0.18);
          const accented =
            column.accentRolls[glyphIndex] < accentThreshold;

          context.fillStyle = accented
            ? ACCENT_COLORS[(column.accentIndex + trailIndex) % ACCENT_COLORS.length]
            : leadingGlyph
              ? HEAD_GLYPH_COLOR
              : BASE_GLYPH_COLOR;
          context.globalAlpha = Math.min(
            0.92,
            0.08 + trailStrength * 0.62 +
              (accented ? reactiveEnergy * 0.18 + bass * 0.08 : 0) +
              (leadingGlyph ? highs * 0.12 : 0),
          );
          context.fillText(column.glyphs[glyphIndex], x, glyphY);
        }
      }

      if (transmission.active) {
        const message = BRANDED_TRANSMISSIONS[transmission.messageIndex];
        let textX = transmission.x - transmission.width / 2;
        context.globalAlpha = 0.96;
        context.font = `700 ${transmission.fontSize}px Consolas, monospace`;
        context.textAlign = "left";
        context.shadowBlur = 8;
        for (let index = 0; index < message.parts.length; index += 1) {
          const part = message.parts[index];
          context.fillStyle = part.color;
          context.shadowColor = part.color;
          context.fillText(part.text, textX, transmission.y);
          textX += transmission.partWidths[index];
        }
        context.shadowBlur = 0;
      }

      context.globalAlpha = 1;
      if (motionActive) {
        travelPosition += averageSpeed * deltaSeconds;
      }

      if (timestamp - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryAt = timestamp;
        canvas.dataset.motionActive = String(motionActive);
        canvas.dataset.chromaEnergy = reactiveEnergy.toFixed(3);
        canvas.dataset.travelPosition = travelPosition.toFixed(3);
        canvas.dataset.transmission = transmission.active
          ? BRANDED_TRANSMISSIONS[transmission.messageIndex].text
          : "";
        canvas.dataset.transmissionY = transmission.y.toFixed(2);
        state.onRuntimeTelemetry?.({
          motionTargetSpeed: motionActive ? averageSpeed : 0,
          motionSpeed: motionActive ? averageSpeed : 0,
          travelPosition,
        });
      }
    };

    const animate = (timestamp: number) => {
      frameId = window.requestAnimationFrame(animate);
      const elapsed = timestamp - lastRenderedAt;
      if (lastRenderedAt > 0 && elapsed < FRAME_INTERVAL_MS - 1) {
        return;
      }

      const deltaSeconds =
        lastRenderedAt === 0 ? FRAME_INTERVAL_MS / 1000 : Math.min(elapsed / 1000, 0.1);
      lastRenderedAt = timestamp;
      drawFrame(timestamp, deltaSeconds);
      renderFpsSampler.sample(timestamp);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderFpsSampler.dispose();
      columns = [];
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="signal-rain-canvas"
      data-renderer="canvas2d"
      aria-hidden="true"
    />
  );
}

export default SignalRainTheme;