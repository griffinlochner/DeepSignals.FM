import { useEffect, useRef, type CSSProperties } from "react";
import type { AudioReactiveSnapshot } from "../../app/playerTypes";
import type { ThemeSceneProps } from "../themeTypes";
import "./signalGradient.css";

const UPDATE_INTERVAL_MS = 1000 / 30;

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mapSignalGradientChroma(snapshot: AudioReactiveSnapshot) {
  const bass = clamp(snapshot.bass);
  const mids = clamp(snapshot.mids);
  const highs = clamp(snapshot.highs);
  const energy = clamp(snapshot.smoothedEnergy);
  const transient = clamp(snapshot.transient);
  const kick = clamp(snapshot.kickPulse);
  const intensity = clamp((energy - 0.025) / 0.42);

  return {
    hueDegrees:
      intensity *
      (mids * 170 + highs * 310 - bass * 130 + transient * 190 + kick * 110),
    saturation: 1 + intensity * (0.35 + bass * 0.35 + highs * 0.2),
  };
}

function SignalGradientTheme({
  chromaEnabled = true,
  subscribeToAudioSnapshots,
  onRuntimeTelemetry,
}: ThemeSceneProps) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const telemetryRef = useRef(onRuntimeTelemetry);

  useEffect(() => {
    telemetryRef.current = onRuntimeTelemetry;
  }, [onRuntimeTelemetry]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !chromaEnabled || !subscribeToAudioSnapshots) {
      telemetryRef.current?.({ hue: 0 });
      return undefined;
    }

    let lastUpdateMs = -Infinity;
    return subscribeToAudioSnapshots((snapshot, nowMs) => {
      if (nowMs - lastUpdateMs < UPDATE_INTERVAL_MS) {
        return;
      }
      lastUpdateMs = nowMs;

      const chroma = mapSignalGradientChroma(snapshot);
      scene.style.setProperty("--signal-gradient-hue", `${chroma.hueDegrees}deg`);
      scene.style.setProperty(
        "--signal-gradient-saturation",
        String(chroma.saturation),
      );
      telemetryRef.current?.({ hue: chroma.hueDegrees });
    });
  }, [chromaEnabled, subscribeToAudioSnapshots]);

  const staticStyle = {
    "--signal-gradient-hue": "0deg",
    "--signal-gradient-saturation": 1,
  } as CSSProperties;

  return (
    <div
      ref={sceneRef}
      className="signal-gradient-scene"
      data-chroma-enabled={chromaEnabled}
      style={staticStyle}
      aria-hidden="true"
    />
  );
}

export default SignalGradientTheme;