export type TrackingDepth = "basic" | "intermediate" | "advanced";
export type PointResult = "p1" | "p2";

export interface MatchPoint {
  id: string;
  winner: PointResult;
  server: 1 | 2;
  kind: "serve" | "return" | "rally";
  outcome: "winner" | "forced-error" | "unforced-error" | "other";
  rallyLength?: number;
  createdAt: string;
}

export interface MatchTrackerState {
  playerOne: string;
  playerTwo: string;
  server: 1 | 2;
  depth: TrackingDepth;
  points: MatchPoint[];
}

export const emptyMatch = (): MatchTrackerState => ({
  playerOne: "Player 1",
  playerTwo: "Player 2",
  server: 1,
  depth: "basic",
  points: [],
});

export function summarizeMatch(match: MatchTrackerState) {
  const wins = [0, 0];
  const winners = [0, 0];
  const errors = [0, 0];
  let rallyTotal = 0;
  let rallyCount = 0;
  for (const point of match.points) {
    wins[point.winner === "p1" ? 0 : 1] += 1;
    if (point.outcome === "winner") winners[point.winner === "p1" ? 0 : 1] += 1;
    if (point.outcome === "unforced-error" || point.outcome === "forced-error") {
      errors[point.winner === "p1" ? 1 : 0] += 1;
    }
    if (point.rallyLength) { rallyTotal += point.rallyLength; rallyCount += 1; }
  }
  return { points: wins, winners, errors, averageRally: rallyCount ? Math.round((rallyTotal / rallyCount) * 10) / 10 : 0 };
}
