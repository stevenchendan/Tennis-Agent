import type { PatternCard, PatternCategory } from "@/lib/api";

/**
 * Deterministic game-plan generation: for each mined pattern we produce a
 * counter (opponent's weapon) or reinforcement note (our own weapon) plus a
 * related tactics-board drill template. No LLM involved — texts are stable
 * category-based templates, consistent with the project's honest-heuristics
 * philosophy.
 */

export interface GamePlanItem {
  pattern: PatternCard;
  /** counter strategy (opponent) or reinforcement note (ours) */
  advice: string;
  /** key into TEMPLATES for the related board drill */
  drillKey: string;
}

const COUNTERS: Record<PatternCategory, string> = {
  serve:
    "接发站位向外多让一步压缩角度；回球优先打向发球者身后的中线深区，破坏其发球+1布置；关键分上可偶发抢攻直线。",
  serve_plus_one:
    "接发后的下一拍提前落位：把回球顶深中路并抬高过网高度，逼其第三拍在移动和肩部以上处理；对其惯用进攻线路提前预判侧身。",
  rally:
    "回合长度博弈：看清双方各自占优的回合长度区间，通过一发成功率和回球深度把比分拖进自己占优的区间，避免跟着对手节奏打。",
  direction:
    "线路反制：其连续走同一线路时可提前移动到位，并在第二拍主动变线（打向其身后或弱侧），打乱其连续球路的习惯。",
  position:
    "网前反制：出现随上信号（浅球后上网）时，优先选择低平穿越或上旋挑高球，直接降低其网前转化率。",
};

const REINFORCE: Record<PatternCategory, string> = {
  serve: "保持发球落点占比优势，配合发球+1套路把落点优势转化为得分。",
  serve_plus_one: "把该套路固化成常规武器：发球后提前迎前，第三拍果断打向布置好的区域。",
  rally: "主动经营回合长度：用稳定性把比赛拖入自己占优的拍数区间。",
  direction: "强化该连续线路组合，并在关键时刻反向变线制造突然性。",
  position: "继续创造上网机会：随上球保证深度，网前第一拍截击打向空档。",
};

const DRILL_KEY: Record<PatternCategory, string> = {
  serve: "return-down-line",
  serve_plus_one: "serve-plus-one-cross",
  rally: "drop-lob",
  direction: "deuce-wide-forehand",
  position: "drop-lob",
};

export const CATEGORY_LABEL: Record<PatternCategory, string> = {
  serve: "发球",
  serve_plus_one: "发球+1",
  rally: "回合长度",
  direction: "球路组合",
  position: "网前",
};

/** Patterns belong to `ours` (player_id === perspective) or the opponent. */
export function buildGamePlan(
  patterns: PatternCard[],
  perspective: number,
): { ours: GamePlanItem[]; theirs: GamePlanItem[] } {
  const items = patterns.map((p) => ({
    pattern: p,
    advice:
      p.player_id === perspective
        ? REINFORCE[p.category]
        : COUNTERS[p.category],
    drillKey: DRILL_KEY[p.category],
  }));
  return {
    ours: items.filter((i) => i.pattern.player_id === perspective),
    theirs: items.filter((i) => i.pattern.player_id !== perspective),
  };
}
