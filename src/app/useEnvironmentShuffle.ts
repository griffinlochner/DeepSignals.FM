import { useCallback, useEffect, useState } from "react";
import type { ThemeId } from "../themes/themeTypes";
import { isShuffleMode, type ShuffleMode } from "./environmentSelection";
import {
  EnvironmentShuffle,
  scheduleEnvironmentShuffle,
  type ShuffleTrack,
} from "./environmentShuffle";

type Props = {
  stationId: string | null;
  track: ShuffleTrack | null;
  playing: boolean;
  activeEnvironment: ThemeId;
  onEnvironmentChange: (id: ThemeId) => void;
};

export function useEnvironmentShuffle({
  stationId,
  track,
  playing,
  activeEnvironment,
  onEnvironmentChange,
}: Props) {
  const [mode, setMode] = useState<ShuffleMode | null>(null);
  const [shuffle] = useState(() => new EnvironmentShuffle());
  const title = track?.title;
  const artist = track?.artist;

  useEffect(() => scheduleEnvironmentShuffle(shuffle, {
    mode, stationId, track: title ? { title, artist: artist ?? "" } : null,
    playing, activeEnvironment,
  }, onEnvironmentChange, {
    now: () => performance.now(),
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (id) => window.clearTimeout(id),
  }), [shuffle, mode, stationId, title, artist, playing, activeEnvironment, onEnvironmentChange]);

  const selectEnvironment = useCallback((id: ThemeId) => {
    if (isShuffleMode(id)) {
      setMode(id);
    } else {
      setMode(null);
      onEnvironmentChange(id);
    }
  }, [onEnvironmentChange]);

  return { selectedEnvironment: mode ?? activeEnvironment, selectEnvironment };
}
