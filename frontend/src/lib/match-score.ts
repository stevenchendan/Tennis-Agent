import type { MatchPoint, MatchTrackerState } from "@/lib/match-tracker";

export interface TennisScore {
  sets: [number, number];
  games: [number, number];
  points: [number, number];
  labels: [string, string];
}

function pointLabel(points: [number, number]): [string, string] {
  const [a, b] = points;
  if (a >= 3 && b >= 3) {
    if (a === b) return ["40", "40"];
    return a > b ? ["AD", "40"] : ["40", "AD"];
  }
  const labels = ["0", "15", "30", "40"];
  return [labels[Math.min(a, 3)], labels[Math.min(b, 3)]];
}

export function calculateTennisScore(match: MatchTrackerState): TennisScore {
  const sets: [number, number] = [0, 0];
  const games: [number, number] = [0, 0];
  const points: [number, number] = [0, 0];
  const closeGame = (winner: 0 | 1) => {
    games[winner] += 1;
    points[0] = 0; points[1] = 0;
    const other = winner === 0 ? 1 : 0;
    if (games[winner] >= 6 && games[winner] - games[other] >= 2) {
      sets[winner] += 1;
      games[0] = 0; games[1] = 0;
    }
  };
  for (const point of match.points as MatchPoint[]) {
    const winner = point.winner === "p1" ? 0 : 1;
    points[winner] += 1;
    const other = winner === 0 ? 1 : 0;
    if (points[winner] >= 4 && points[winner] - points[other] >= 2) closeGame(winner as 0 | 1);
  }
  return { sets, games, points, labels: pointLabel(points) };
}
