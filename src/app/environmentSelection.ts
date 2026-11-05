import type { ThemeId } from "../themes/themeTypes";

export const HIDDEN_ENVIRONMENT_DROPDOWN_IDS = new Set<string>(["slime-cavern"]);

const SHUFFLE_EXCLUDED_ENVIRONMENT_IDS = new Set<string>([
  "minimal",
  "psybrazil",
  "deep-signals",
]);

export const ENVIRONMENT_GROUPS: {
  groupName: string;
  environmentIds: ThemeId[];
}[] = [
  {
    groupName: "MINIMAL",
    environmentIds: ["minimal", "signal-gradient", "signal-rain"],
  },
  {
    groupName: "DEPTH WORLDS",
    environmentIds: [
      "analog-signal-laboratory",
      "crystal-cavern",
      "dark-psy-temple",
      "deep-signals",
      "uv-reactive-jungle",
      "bioluminescent-psy-reef",
      "psybrazil",
    ],
  },
  {
    groupName: "3D EXPERIENCES",
    environmentIds: [
      "signal-runner-2",
      "cosmic-roller-coaster",
      "alien-megastructure-transit",
      "neon-hyper-racer",
      "signal-runner",
      "signal-tunnel",
      "cosmic-nexus",
      "twilight-tides",
    ],
  },
];

export const SHUFFLE_MODES = [
  { id: "shuffle-all", name: "Shuffle \u2014 All Environments", category: null },
  { id: "shuffle-depth", name: "Shuffle \u2014 Depth Worlds", category: "DEPTH WORLDS" },
  { id: "shuffle-3d", name: "Shuffle \u2014 3D Experiences", category: "3D EXPERIENCES" },
] as const;

export type ShuffleMode = (typeof SHUFFLE_MODES)[number]["id"];

export function isShuffleMode(value: string): value is ShuffleMode {
  return SHUFFLE_MODES.some((mode) => mode.id === value);
}

export function getShufflePool(modeId: ShuffleMode): ThemeId[] {
  const mode = SHUFFLE_MODES.find((candidate) => candidate.id === modeId)!;
  return ENVIRONMENT_GROUPS
    .filter((group) => mode.category === null || group.groupName === mode.category)
    .flatMap((group) => group.environmentIds)
    .filter((id) =>
      !SHUFFLE_EXCLUDED_ENVIRONMENT_IDS.has(id) &&
      !HIDDEN_ENVIRONMENT_DROPDOWN_IDS.has(id),
    );
}
