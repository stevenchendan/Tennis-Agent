import type { StrategyCategory, StrategyMeta, Tactic } from "@/lib/tactic";
import { demoTactic } from "@/lib/tactic";
import { templateByKey } from "@/lib/templates";

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

const meta = (
  id: string,
  category: StrategyCategory,
  title: string,
  goal: string,
  trigger: string,
  fallback: string,
  coachCue: string,
  skillFocus: string[],
  templateKey?: string,
): StrategyDefinition => ({
  id, category, title, goal, trigger, fallback, coachCue, skillFocus,
  description: `${goal} Practice the decision, not just the shot sequence.`,
  build: () => {
    const tactic = templateKey ? templateByKey(templateKey)?.build() : undefined;
    return withStrategy(tactic ?? demoTactic(), { id, category, goal, trigger, fallback, coachCue });
  },
});

/** Canonical starter catalog shared by coaches and players. */
export const STRATEGIES: StrategyDefinition[] = [
  meta("serve-wide-cross", "serve", "Wide serve + cross-court forehand", "Pull the returner wide and attack the open court.", "The returner is stretched outside the singles line.", "Reset cross-court if the return lands deep or at your feet.", "Recover before swinging at the +1 ball.", ["serve direction", "forehand"], "serve-plus-one-demo"),
  meta("serve-t-behind", "serve", "T serve + attack behind", "Use the T serve to make the returner move across, then hit behind their recovery.", "The returner is moving toward the open side.", "Play high cross-court if the returner holds position.", "Watch the opponent's recovery, not the serve result.", ["serve direction", "change direction"]),
  meta("body-serve-open", "serve", "Body serve + open court", "Jam the return and take the first ball to the space created.", "The return comes back short or central.", "Build with a deep middle ball if no space is available.", "Make the returner choose late.", ["body serve", "court opening"]),
  meta("second-serve-return-plus-one", "return", "Second-serve return +1", "Step in on a weak second serve and dictate the next ball.", "The second serve sits up inside your strike zone.", "Return deep cross-court and reset if timing is late.", "Move forward before the ball bounces.", ["return", "first strike"]),
  meta("cross-then-change", "baseline", "Cross-court pressure → change direction", "Build margin cross-court, then change direction when the opponent is off balance.", "You receive a shorter or central ball.", "Continue cross-court rather than forcing the line.", "Direction change is earned by court position.", ["rally tolerance", "direction change"]),
  meta("inside-out-inside-in", "baseline", "Inside-out forehand → inside-in finish", "Use repeated forehands to move the opponent before finishing to the other side.", "Your forehand is set up with time and space.", "Stay inside-out if the opponent recovers early.", "Recover to cover the cross-court reply.", ["forehand", "pattern building"]),
  meta("deep-middle-jam", "baseline", "Deep middle jam", "Remove angles and force a late contact from the opponent.", "The opponent is comfortable controlling the corners.", "Return to cross-court once the opponent is pushed back.", "Depth matters more than pace here.", ["depth", "neutral ball"]),
  meta("approach-volley", "transition", "Short ball → approach → volley", "Attack a short ball and close the point at net.", "The ball lands short enough to enter behind it.", "Stay back if the approach would be off balance.", "Approach behind depth, not hope.", ["approach", "volley"]),
  meta("drop-lob", "transition", "Drop shot → lob", "Bring the opponent forward, then lift the ball over their head.", "The opponent is deep and slow to change direction.", "Play deep cross-court if they read the drop early.", "Use the drop to move the opponent, not to hit a highlight shot.", ["touch", "height"]),
  meta("defensive-reset", "defense", "Defensive reset to deep middle", "Regain time and court position under pressure.", "You are pulled wide or contacting below net height.", "Counter cross-court when balance returns.", "Height and depth buy the next decision.", ["defense", "recovery"]),
  meta("doubles-poach", "doubles", "Doubles poach", "Use the net player's movement to intercept a predictable return.", "The return is travelling cross-court and the partner has covered behind.", "Hold position if the returner changes direction or lobs.", "Move on the opponent's contact, not before it.", ["poach", "communication"], "doubles-poach"),
];

export function findStrategies(query = "", category?: StrategyCategory): StrategyDefinition[] {
  const needle = query.trim().toLowerCase();
  return STRATEGIES.filter((strategy) => {
    if (category && strategy.category !== category) return false;
    return !needle || [strategy.title, strategy.description, ...strategy.skillFocus].join(" ").toLowerCase().includes(needle);
  });
}
