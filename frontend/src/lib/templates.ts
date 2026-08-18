import type { Tactic } from "@/lib/tactic";

// Ready-made tactic templates inspired by pro game-planning frameworks
// (serve targets, serve+1, poach, drop/lob). Each build() returns a fresh
// editable tactic; coaches load one and adjust positions to their players.
export interface TacticTemplate {
  key: string;
  name: string;
  desc: string;
  build: () => Tactic;
}

const f = (
  players: [id: number, x: number, y: number][],
  path: [[number, number], [number, number]] | null,
  note: string,
) => ({
  players: players.map(([id, x, y]) => ({ id, x, y })),
  paths: path ? [{ from: { x: path[0][0], y: path[0][1] }, to: { x: path[1][0], y: path[1][1] } }] : [],
  note,
});

export const TEMPLATES: TacticTemplate[] = [
  {
    key: "serve-plus-one-demo",
    name: "Server +1: wide serve, cross-court forehand",
    desc: "A practical three-step pattern: serve wide, recover inside the court, then attack the open cross-court space with the first forehand.",
    build: () => ({
      v: 1,
      title: "Server +1: wide serve, cross-court forehand",
      frames: [
        f(
          [[1, 6.7, 1.2], [2, 3.3, 20.4]],
          [[6.7, 1.7], [1.8, 17.2]],
          "1 · Serve wide to pull the returner off the court. Recover toward the singles centre mark.",
        ),
        f(
          [[1, 6.1, 2.6], [2, 1.6, 19.0]],
          [[1.6, 19.0], [8.7, 8.0]],
          "2 · Expect the stretched return and stay balanced inside the baseline for the +1 ball.",
        ),
        f(
          [[1, 8.0, 7.0], [2, 2.8, 19.8]],
          [[8.0, 7.0], [2.5, 21.2]],
          "3 · Drive the first forehand cross-court into the open space, then recover for the next ball.",
        ),
      ],
    }),
  },
  {
    key: "deuce-wide-forehand",
    name: "平分区外角发球 + 正手空档进攻",
    desc: "把接发者拉出场外，第三拍打向身后空档。现代网球最经典的“设计分”。",
    build: () => ({
      v: 1,
      title: "平分区外角发球 + 正手空档进攻",
      frames: [
        f([[1, 7.3, 1.2], [2, 2.7, 20.5]], [[7.3, 1.6], [1.8, 16.8]], "平分区外角发球，把接发者拉出场外"),
        f([[1, 6.6, 2.2], [2, 1.5, 19.0]], [[1.5, 19.0], [9.4, 7.6]], "对手在场地外被迫回出偏浅的球"),
        f([[1, 8.4, 7.2], [2, 2.6, 19.8]], [[8.4, 7.2], [2.4, 21.5]], "迎前正手打向对手身后的空档"),
      ],
    }),
  },
  {
    key: "ad-t-approach",
    name: "占先区 T 点发球 + 随上进攻",
    desc: "发球压向中路逼出软球，随上到网前截击收尾。",
    build: () => ({
      v: 1,
      title: "占先区 T 点发球 + 随上进攻",
      frames: [
        f([[1, 3.7, 1.2], [2, 7.5, 20.5]], [[3.7, 1.6], [5.3, 17.0]], "占先区 T 点发球压向中路"),
        f([[1, 4.8, 1.8], [2, 6.3, 19.3]], [[6.3, 19.3], [4.4, 11.0]], "逼出中路偏软的回球"),
        f([[1, 4.6, 8.2], [2, 6.5, 19.0]], [[4.6, 8.2], [7.9, 21.6]], "深球压制后立刻随上"),
        f([[1, 5.3, 10.3], [2, 7.8, 21.3]], [[5.3, 10.3], [8.8, 20.6]], "网前截击打进对手留下的空档"),
      ],
    }),
  },
  {
    key: "serve-plus-one-cross",
    name: "发球+1：第三拍大斜线压制",
    desc: "发球占住场区中心，第三拍用大斜线连续压制对手弱侧。",
    build: () => ({
      v: 1,
      title: "发球+1：第三拍大斜线压制",
      frames: [
        f([[1, 6.5, 1.2], [2, 3.5, 20.8]], [[6.5, 1.6], [5.0, 17.0]], "平分区 T 点发球，占据中心"),
        f([[1, 6.2, 2.2], [2, 4.6, 19.2]], [[4.6, 19.2], [7.1, 7.4]], "对手斜线回向正手位"),
        f([[1, 7.4, 6.4], [2, 3.3, 20.2]], [[7.4, 6.4], [3.2, 20.6]], "第三拍大斜线连续压制同一侧"),
      ],
    }),
  },
  {
    key: "return-down-line",
    name: "接发抢攻直线",
    desc: "提前迎击外角发球，直线打向发球者身后未回位的空档。",
    build: () => ({
      v: 1,
      title: "接发抢攻直线",
      frames: [
        f([[2, 3.6, 22.6], [1, 8.6, 21.0]], [[3.6, 22.3], [8.3, 6.2]], "对手外角发球拉开角度"),
        f([[2, 5.8, 21.8], [1, 7.9, 5.6]], [[7.9, 5.6], [3.1, 21.8]], "提前迎击，直线打向发球者身后"),
      ],
    }),
  },
  {
    key: "doubles-poach",
    name: "双打：发球抢网（Poach）",
    desc: "网前伙伴在第三拍横移抢网，穿越接发的中路回球。",
    build: () => ({
      v: 1,
      title: "双打：发球抢网（Poach）",
      frames: [
        f(
          [[1, 7.2, 1.2], [3, 8.2, 10.2], [2, 2.6, 20.5], [4, 7.8, 13.6]],
          [[7.2, 1.6], [1.9, 16.8]],
          "外角发球拉开接发角度",
        ),
        f(
          [[1, 6.9, 1.8], [3, 7.6, 10.6], [2, 2.0, 19.2], [4, 7.8, 13.6]],
          [[2.0, 19.2], [6.2, 12.4]],
          "接发被迫走中路——正是抢网目标",
        ),
        f(
          [[1, 6.6, 2.4], [3, 4.8, 12.0], [2, 2.4, 19.6], [4, 7.6, 13.8]],
          [[4.8, 12.0], [8.6, 21.6]],
          "网前伙伴横移抢网，截击直接穿越",
        ),
      ],
    }),
  },
  {
    key: "drop-lob",
    name: "放短 + 上旋挑高球",
    desc: "放短把对手调上网，随后上旋挑高球越过头顶完成压制。",
    build: () => ({
      v: 1,
      title: "放短 + 上旋挑高球",
      frames: [
        f([[1, 5.5, 4.0], [2, 4.0, 20.5]], [[4.0, 20.5], [5.8, 5.2]], "底线相持，等待浅球机会"),
        f([[1, 6.0, 5.5], [2, 4.4, 18.0]], [[6.0, 5.5], [4.9, 13.8]], "反手放短，把对手调上网"),
        f([[1, 5.6, 4.6], [2, 4.9, 14.4]], [[5.6, 4.6], [3.4, 22.4]], "上旋挑高球越过对手头顶"),
      ],
    }),
  },
];

export function templateByKey(key: string): TacticTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key);
}
