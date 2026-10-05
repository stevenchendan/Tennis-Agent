import { type Layout } from "./catalog";

export function validateLayout(raw: unknown, original: Layout): Layout | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Layout;
  if (
    !Array.isArray(value.players) ||
    value.players.length !== original.players.length ||
    !value.players.every(
      (p, i) =>
        Array.isArray(p) &&
        p.length === 3 &&
        p[2] === original.players[i][2] &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]) &&
        p[0] >= 10 &&
        p[0] <= 180 &&
        p[1] >= 10 &&
        p[1] <= 254,
    )
  )
    return null;
  for (const key of ["zones", "shots", "moves"] as const) {
    if (
      !Array.isArray(value[key]) ||
      value[key].length !== original[key].length ||
      !value[key].every(
        (a) => Array.isArray(a) && a.length === 4 && a.every((n) => Number.isFinite(n) && n >= 0 && n <= 264),
      )
    )
      return null;
  }
  if (!value.zones.every(([x, y, w, h]) => w > 0 && h > 0 && x + w <= 180 && y + h <= 250)) return null;
  return { ...original, players: value.players, zones: value.zones, shots: value.shots, moves: value.moves };
}
