// Shared full-court geometry in meters, matching docs/ARCHITECTURE.md:
// x ∈ [0, 10.97] (doubles width), y ∈ [0, 23.77] (baseline to baseline),
// net at y = 11.885. The near player sits at y=0; SVG y grows downward,
// so display y = LEN - y keeps the near player at the bottom.
export const W = 10.97;
export const LEN = 23.77;
export const SINGLES = 1.37;
export const NET = LEN / 2;
export const SVC_NEAR = NET - 6.4;
export const SVC_FAR = NET + 6.4;
export const CX = W / 2;
export const PAD = 1.2;

export const px = (x: number) => x;
export const py = (y: number) => LEN - y;

export const PLAYER_COLORS: Record<number, string> = {
  1: "#4ade80",
  2: "#f472b6",
  3: "#22d3ee",
  4: "#fb923c",
};

export const BALL_COLOR = "#fde68a";

/** Visual skin for the court. Player/ball colors stay fixed for readability. */
export interface CourtTheme {
  key: string;
  name: string;
  /** playing surface inside the lines */
  inner: string;
  /** run-off area outside the lines */
  outer: string;
  line: string;
  net: string;
}

export const COURT_THEMES: Record<string, CourtTheme> = {
  classic: {
    key: "classic",
    name: "经典",
    inner: "#17553f",
    outer: "#0b1f19",
    line: "#e8f5ee",
    net: "#fbbf24",
  },
  australian: {
    key: "australian",
    name: "澳网",
    inner: "#2b5fa3",
    outer: "#5d87c0",
    line: "#f0f6ff",
    net: "#e8f0ff",
  },
  french: {
    key: "french",
    name: "法网",
    inner: "#b0603c",
    outer: "#8a4526",
    line: "#fdf6ec",
    net: "#f8f2e8",
  },
  wimbledon: {
    key: "wimbledon",
    name: "温网",
    inner: "#4e9c45",
    outer: "#2e6b39",
    line: "#fdfdf8",
    net: "#fdfdf8",
  },
  us: {
    key: "us",
    name: "美网",
    inner: "#3b6bb0",
    outer: "#2f7d5b",
    line: "#f0f6ff",
    net: "#cfe0f5",
  },
};

export const DEFAULT_COURT_THEME = COURT_THEMES.classic;

export function resolveCourtTheme(key: string | undefined): CourtTheme {
  return (key && COURT_THEMES[key]) || DEFAULT_COURT_THEME;
}
