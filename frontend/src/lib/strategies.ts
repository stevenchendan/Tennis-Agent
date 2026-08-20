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
  fallbackId?: string,
): StrategyDefinition => ({
  id, category, title, goal, trigger, fallback, coachCue, skillFocus,
  fallbackId: fallbackId ?? (id === "defensive-reset" ? "cross-then-change" : "defensive-reset"),
  description: `${goal} Practice the decision, not just the shot sequence.`,
  build: () => {
    const tactic = templateKey ? templateByKey(templateKey)?.build() : undefined;
    return withStrategy(tactic ?? demoTactic(), { id, category, goal, trigger, fallback, coachCue, fallbackId: fallbackId ?? (id === "defensive-reset" ? "cross-then-change" : "defensive-reset") });
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
  meta("serve-body-kick", "serve", "Body kick serve + backhand pressure", "Jam the returner with height, then keep the next ball to their backhand.", "The returner stands close to the baseline.", "Use a wide serve when they begin leaning middle.", "Height changes the returner's contact point.", ["kick serve", "backhand"], undefined, "serve-wide-cross"),
  meta("return-chip-approach", "return", "Chip return + approach", "Take pace off the return and arrive behind a low ball.", "The opponent serves hard but leaves a short recovery window.", "Block deep cross-court and stay back against a strong passing shot.", "First priority is a low return, not a winner.", ["slice", "net approach"], undefined, "second-serve-return-plus-one"),
  meta("return-line-pressure", "return", "Return down the line", "Change direction early to expose the server's recovery lane.", "The server recovers toward the centre after serving wide.", "Return cross-court when contact is late or low.", "Only change direction with a stable base.", ["return", "direction change"], undefined, "return-chip-approach"),
  meta("backhand-cross-control", "baseline", "Backhand cross-court control", "Use height and margin to pin the opponent's backhand.", "Both players are balanced behind the baseline.", "Change direction only after forcing a shorter ball.", "Cross-court gives you more net and court margin.", ["backhand", "depth"], undefined, "cross-then-change"),
  meta("two-to-one-open", "baseline", "Two to one side → open court", "Move the opponent twice before taking the open space.", "The opponent is recovering predictably to the middle.", "Keep the third ball cross-court if they stay balanced.", "Make the second ball slightly wider, not simply harder.", ["movement", "space creation"], undefined, "inside-out-inside-in"),
  meta("middle-jam-return", "baseline", "Middle ball jam", "Take away the opponent's angle with a deep body target.", "The opponent is creating angles from the corners.", "Return to a high cross-court ball when they step inside.", "Aim at the decision, not the line.", ["middle target", "neutralization"], undefined, "deep-middle-jam"),
  meta("approach-cross-volley", "transition", "Approach cross-court + volley", "Use the safer cross-court approach to arrive with time.", "The short ball is outside your body line.", "Approach down the line when the opponent cheats cross-court.", "Split-step before the opponent contacts the pass.", ["approach", "volley"], undefined, "approach-volley"),
  meta("lob-counter", "transition", "Lob the advancing opponent", "Turn an aggressive approach into a defensive reset or passing chance.", "The opponent closes quickly but leaves space behind.", "Pass low through the open lane when the opponent stops.", "Choose height when you need time, not when you need a winner.", ["lob", "defense"], undefined, "drop-lob"),
  meta("wide-defense-reset", "defense", "Wide defense → deep middle reset", "Recover court position before trying to attack again.", "You are outside the singles line or stretched below net height.", "Counter down the line only when the opponent is late.", "Get the ball high enough to make the next shot playable.", ["recovery", "height"], undefined, "defensive-reset"),
  meta("i-formation-serve", "doubles", "I-formation serve pattern", "Hide the net player's direction and force a rushed return.", "The returner is reading the net player early.", "Switch to standard formation if the returner lobs consistently.", "Agree the movement before the point and commit.", ["doubles", "formation"], undefined, "doubles-poach"),
];

export function findStrategies(query = "", category?: StrategyCategory): StrategyDefinition[] {
  const needle = query.trim().toLowerCase();
  return STRATEGIES.filter((strategy) => {
    if (category && strategy.category !== category) return false;
    return !needle || [strategy.title, strategy.description, ...strategy.skillFocus].join(" ").toLowerCase().includes(needle);
  });
}
