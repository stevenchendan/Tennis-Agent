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
