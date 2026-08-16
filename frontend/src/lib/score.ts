import type { Rally } from "@/lib/api";

/**
 * The event engine tracks rallies and heuristic point winners but no score.
 * This module reconstructs an approximate score on the frontend:
 * - a change of server marks a game boundary,
 * - inside a game points are tallied by heuristic rally winner,
 * - break point / game point follow the standard "one point from the game"
 *   rule (>=3 points and leading by 1).
 * The result is explicitly labelled as inferred in the UI — point winners
 * are heuristic (winner_confidence), so treat scores as situational context,
 * not ground truth.
 */

export interface RallyScoreInfo {
  rallyId: number;
  gameNo: number;
  /** games won by P1/P2 before this point (approximate) */
  games: [number, number];
  /** points won by P1/P2 in the current game before this point */
  pointScore: [number, number];
  /** receiving player is one point from winning the game */
  isBreakPoint: boolean;
  /** serving player is one point from winning the game */
  isGamePoint: boolean;
}

export interface InferredMatchState {
  infos: RallyScoreInfo[];
  /** final games tally after all rallies */
  games: [number, number];
  /** share of rallies whose point-winner inference is low confidence (<0.5) */
  lowConfidenceRatio: number;
}

const other = (p: number) => (p === 1 ? 2 : 1);

function closeGame(pts: [number, number]): 1 | 2 | null {
  if (pts[0] > pts[1]) return 1;
  if (pts[1] > pts[0]) return 2;
  return null; // tie from noisy data: no game awarded
}

export function inferMatchStates(rallies: Rally[]): InferredMatchState {
  const games: [number, number] = [0, 0];
  let pts: [number, number] = [0, 0];
  let gameNo = 1;
  let prevServer = rallies.length ? rallies[0].server : 0;
  const infos: RallyScoreInfo[] = [];

  rallies.forEach((r, i) => {
    // server change ⇒ close the previous game (leader takes it) and start a new one
    if (i > 0 && r.server !== prevServer) {
      const w = closeGame(pts);
      if (w) games[w - 1] += 1;
      pts = [0, 0];
      gameNo += 1;
    }

    const serverPts = pts[r.server - 1];
    const receiverPts = pts[other(r.server) - 1];
    infos.push({
      rallyId: r.id,
      gameNo,
      games: [games[0], games[1]],
      pointScore: [pts[0], pts[1]],
      isBreakPoint: receiverPts >= 3 && receiverPts - serverPts >= 1,
      isGamePoint: serverPts >= 3 && serverPts - receiverPts >= 1,
    });

    if (r.winner === 1 || r.winner === 2) pts[r.winner - 1] += 1;
    prevServer = r.server;
  });

  const low =
    rallies.length === 0
      ? 0
      : rallies.filter((r) => r.winner_confidence < 0.5).length / rallies.length;

  return { infos, games: [games[0], games[1]], lowConfidenceRatio: low };
}

const POINT_NAMES = ["0", "15", "30", "40"];

/** "40-30", "平分" (deuce), "AD-P1"… in P1-P2 order for the current game. */
export function pointScoreLabel(pts: [number, number]): string {
  const [a, b] = pts;
  if (a >= 3 && b >= 3) {
    if (a === b) return "平分";
    return a > b ? "AD-40" : "40-AD";
  }
  return `${POINT_NAMES[Math.min(a, 3)]}-${POINT_NAMES[Math.min(b, 3)]}`;
}
