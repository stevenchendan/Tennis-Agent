import type { StrategyCategory, StrategyMeta, Tactic } from "@/lib/tactic";

export interface StrategyDefinition extends StrategyMeta {
  title: string;
  description: string;
  skillFocus: string[];
  build: () => Tactic;
}

export const STRATEGY_CATEGORIES: { key: StrategyCategory; label: string }[] = [
  { key: "serve", label: "Serve" },
  { key: "return", label: "Return" },
  { key: "baseline", label: "Baseline" },
  { key: "transition", label: "Transition" },
  { key: "defense", label: "Defense" },
  { key: "doubles", label: "Doubles" },
];

/** Attach stable coaching metadata without changing the editable frame model. */
export function withStrategy(tactic: Tactic, meta: StrategyMeta): Tactic {
  return { ...tactic, strategy: meta };
}
