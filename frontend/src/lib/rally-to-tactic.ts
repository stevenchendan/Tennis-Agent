import type { Rally, Shot } from "@/lib/api";
import { CX, LEN } from "@/lib/court";
import { encodeTactic, MAX_FRAMES, type Frame, type Tactic } from "@/lib/tactic";

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const DIR_LABEL: Record<string, string> = { cross: "斜线", line: "直线", middle: "中路" };
const SIDE_LABEL: Record<string, string> = { deuce: "平分区", ad: "占先区" };

function shotNote(shot: Shot): string {
  const tags = [
    shot.is_serve ? "发球" : "",
    shot.is_volley ? "截击" : "",
    shot.direction ? DIR_LABEL[shot.direction] : "",
  ]
    .filter(Boolean)
    .join("");
  return `第 ${shot.index + 1} 拍 P${shot.player_id} ${tags}`.trim();
}

/** Where a player stands when they are NOT hitting: best estimate is where
 *  they hit their next shot from; if they never hit again, center baseline. */
function restingPos(nextShotByPlayer: Shot | undefined, playerId: number): { x: number; y: number } {
  if (nextShotByPlayer) {
    const [x, y] = nextShotByPlayer.hit_position;
    return { x: clamp(x, 0.2, 10.77), y: clamp(y, 0.2, 23.57) };
  }
  return playerId === 1 ? { x: CX, y: 2 } : { x: CX, y: LEN - 2 };
}

/**
 * Convert a tracked rally into an animated tactic. One frame per shot:
 * the hitter stands at the hit position, the opponent at their next hit
 * position (so playback shows both players running into their shots),
 * and the ball path is hit → landing.
 */
export function rallyToTactic(rally: Rally): Tactic {
  const shots = rally.shots.slice(0, MAX_FRAMES);
  const truncated = rally.shots.length > MAX_FRAMES;

  const frames: Frame[] = shots.map((shot, i) => {
    const next = shots[i + 1];
    const other = shot.player_id === 1 ? 2 : 1;
    // the opponent's next contact with the ball
    const nextByOther = next && next.player_id === other ? next : undefined;

    const hitter = { id: shot.player_id, ...restingPos(shot, shot.player_id) };
    const opponent = { id: other, ...restingPos(nextByOther, other) };
    const players = shot.player_id === 1 ? [hitter, opponent] : [opponent, hitter];

    const landing = shot.landing_position;
    const paths = landing
      ? [
          {
            from: { x: round2(shot.hit_position[0]), y: round2(shot.hit_position[1]) },
            to: { x: round2(landing[0]), y: round2(landing[1]) },
          },
        ]
      : [];

    return { players, paths, note: shotNote(shot) };
  });

  if (frames.length === 0) {
    frames.push({
      players: [
        { id: 1, x: CX, y: 2 },
        { id: 2, x: CX, y: LEN - 2 },
      ],
      paths: [],
    });
  }

  return {
    v: 1,
    title: `第 ${rally.id + 1} 分回放 · P${rally.server} 发球（${
      SIDE_LABEL[rally.serve_side] ?? rally.serve_side
    }）${truncated ? ` · 前 ${MAX_FRAMES} 拍` : ""}`,
    frames,
  };
}

/** SSR-safe editor link that preloads a tactic (relative URL). */
export function boardImportHref(tactic: Tactic): string {
  return `/board?import=${encodeTactic(tactic)}`;
}
