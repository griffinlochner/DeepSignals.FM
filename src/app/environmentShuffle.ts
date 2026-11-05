import type { ThemeId } from "../themes/themeTypes";
import { getShufflePool, type ShuffleMode } from "./environmentSelection";
import type { TrackSignalMetadata } from "./trackSignalMetadata";

export const SHUFFLE_FALLBACK_MS = 10 * 60_000;
export const SHUFFLE_COOLDOWN_MS = 2 * 60_000;

function normalize(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

export type ShuffleTrack = { title: string; artist: string };

export function getShuffleTrack(
  metadata: Pick<TrackSignalMetadata, "title" | "artist"> | null | undefined,
): ShuffleTrack | null {
  const title = normalize(metadata?.title);
  if (!title || /^(unknown( track| title)?|n\/a|offline|stream offline|live stream|-+)$/.test(title)) {
    return null;
  }
  const artist = normalize(metadata?.artist);
  return {
    title,
    artist: /^(unknown( artist)?|n\/a|-+)$/.test(artist) ? "" : artist,
  };
}

export class EnvironmentShuffleBag {
  private remaining: ThemeId[] = [];
  private readonly pool: readonly ThemeId[];
  private readonly random: () => number;

  constructor(
    pool: readonly ThemeId[],
    random: () => number = Math.random,
  ) {
    this.pool = pool;
    this.random = random;
  }

  next(current: ThemeId): ThemeId | null {
    if (this.remaining.length === 0) {
      this.remaining = [...this.pool];
      for (let index = this.remaining.length - 1; index > 0; index--) {
        const other = Math.floor(this.random() * (index + 1));
        [this.remaining[index], this.remaining[other]] =
          [this.remaining[other], this.remaining[index]];
      }
      const last = this.remaining.length - 1;
      if (last > 0 && this.remaining[last] === current) {
        [this.remaining[0], this.remaining[last]] =
          [this.remaining[last], this.remaining[0]];
      }
    }
    return this.remaining.pop() ?? null;
  }
}

export type EnvironmentShuffleInput = {
  mode: ShuffleMode | null;
  stationId: string | null;
  track: ShuffleTrack | null;
  playing: boolean;
  activeEnvironment: ThemeId;
};

/** Mutable timing/bag state stays outside React; only a transition publishes state. */
export class EnvironmentShuffle {
  private mode: ShuffleMode | null = null;
  private stationId: string | null = null;
  private bag: EnvironmentShuffleBag | null = null;
  private playing = false;
  private updatedAt = 0;
  private guardedAt = 0;
  private elapsed = 0;
  private track: ShuffleTrack | null = null;
  private recentTracks: ShuffleTrack[] = [];

  update(input: EnvironmentShuffleInput, now: number): ThemeId | null {
    if (this.playing && this.mode) {
      this.elapsed += Math.max(0, now - this.updatedAt);
    }
    this.updatedAt = now;
    this.playing = input.playing;

    const stationChanged = input.stationId !== this.stationId;
    const modeChanged = input.mode !== this.mode;
    if (stationChanged || modeChanged) {
      this.stationId = input.stationId;
      this.elapsed = 0;
      this.guardedAt = now;
      this.track = null;
      this.recentTracks = [];
    }
    if (modeChanged) {
      this.mode = input.mode;
      this.bag = input.mode ? new EnvironmentShuffleBag(getShufflePool(input.mode)) : null;
    }

    let trackChanged = false;
    if (input.track && !this.matchesTrack(this.track, input.track)) {
      // Remember a small bounded history to suppress metadata flapping/backtracking.
      trackChanged = this.track !== null &&
        !this.recentTracks.some((track) => this.matchesTrack(track, input.track));
      this.track = input.track;
      this.recentTracks = [...this.recentTracks, input.track].slice(-8);
    }

    // Choosing a shuffle mode is a user action, even when playback is stopped.
    if (modeChanged && this.mode) {
      return this.advance(input.activeEnvironment, now);
    }
    if (
      !this.mode || stationChanged || !input.playing ||
      now - this.guardedAt < SHUFFLE_COOLDOWN_MS
    ) {
      return null;
    }
    if (trackChanged || this.elapsed >= SHUFFLE_FALLBACK_MS) {
      return this.advance(input.activeEnvironment, now);
    }
    return null;
  }

  nextDelay(now: number): number | null {
    if (!this.mode || !this.playing) return null;
    return Math.max(
      0,
      SHUFFLE_FALLBACK_MS - this.elapsed - Math.max(0, now - this.updatedAt),
      SHUFFLE_COOLDOWN_MS - (now - this.guardedAt),
    );
  }

  private advance(current: ThemeId, now: number): ThemeId | null {
    this.elapsed = 0;
    this.guardedAt = now;
    return this.bag?.next(current) ?? null;
  }

  private matchesTrack(left: ShuffleTrack | null, right: ShuffleTrack | null): boolean {
    return left !== null && right !== null && left.title === right.title &&
      (!left.artist || !right.artist || left.artist === right.artist);
  }
}

export function scheduleEnvironmentShuffle(
  shuffle: EnvironmentShuffle,
  input: EnvironmentShuffleInput,
  onEnvironmentChange: (id: ThemeId) => void,
  clock: {
    now: () => number;
    setTimeout: (callback: () => void, delay: number) => number;
    clearTimeout: (id: number) => void;
  },
): () => void {
  let timer: number | undefined;
  const update = () => {
    const now = clock.now();
    const next = shuffle.update(input, now);
    if (next !== null) {
      input = { ...input, activeEnvironment: next };
      onEnvironmentChange(next);
    }
    const delay = shuffle.nextDelay(now);
    if (delay !== null) timer = clock.setTimeout(update, delay);
  };
  update();
  return () => {
    if (timer !== undefined) clock.clearTimeout(timer);
  };
}
