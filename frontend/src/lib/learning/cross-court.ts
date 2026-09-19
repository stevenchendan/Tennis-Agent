export const levels = ["beginner", "intermediate", "advanced"] as const;
export type Level = typeof levels[number];
export const lesson = {
  title: "Build a reliable cross-court rally",
  purpose: "Create space above the net, use a generous target and recover before the next ball.",
  review: "Original practice progression · illustrative positioning · coach review pending",
  variants: {
    beginner: {
      label: "Beginner", goal: "Send a comfortable feed into a large diagonal target.",
      setup: "Two players, rackets and balls. Start at a comfortable distance inside the baseline. Feed gently underarm; allow a reset after every attempt.",
      scoring: "Count a success when your return lands in the highlighted area. Try 10 comfortable feeds, then swap roles.",
      cue: "Aim through the middle of the target; give yourself space above the net.",
      adaptation: "Move closer and use a slower ball if needed. For a junior session, have a coach choose a suitable court and ball; this diagram shows a full court.",
      question: "You receive a comfortable feed. Which target best supports today's consistency goal?",
      options: ["The large cross-court area", "A tiny target beside the sideline", "Try to finish with every shot"],
      feedback: ["Yes. A generous diagonal target gives you room to practise control and repeat the shot.", "That can be a later accuracy challenge. For this exercise, leave more space from the lines.", "For this cooperative exercise, a repeatable return helps both players practise."],
      preferred: 0, target: { x: 20, y: 12, width: 28, height: 29 },
    },
    intermediate: {
      label: "Intermediate", goal: "Build depth, then recover for the next cross-court ball.",
      setup: "Two players at opposite baselines, rackets and balls. Rally cooperatively through the diagonal. Restart with a comfortable feed after an error.",
      scoring: "Track 10 of your own rally shots. Count a success when the shot lands in the deep target and you recover ready before your partner strikes. Then swap diagonals.",
      cue: "Hit with margin, then recover toward the likely reply before your partner makes contact.",
      adaptation: "Widen the target or reduce pace when depth and recovery become inconsistent.",
      question: "You are pulled wide by a deep cross-court ball. What fits this rally-building exercise?",
      options: ["Force a down-the-line winner", "Return cross-court with margin and recover", "Stay wide and watch your shot"],
      feedback: ["A direction change from a difficult position adds a challenge. This exercise rewards a controlled reply and recovery.", "Yes. Give your reply margin and time, then prepare for the next ball. The best recovery spot depends on your opponent's options.", "Watching from the corner can leave space open. Follow your shot with recovery and a ready position."],
      preferred: 1, target: { x: 20, y: 12, width: 25, height: 17 },
    },
    advanced: {
      label: "Advanced", goal: "Distinguish a rally ball from an opportunity to attack.",
      setup: "Two players, rackets and balls. Begin cross-court. The feeder varies depth at a manageable pace; the receiver calls 'build' or 'attack' before contact. Play out the point after an attack.",
      scoring: "Track 10 decisions. Count a success when your partner agrees the choice fits your balance and contact position, and your shot reaches its intended target. Review disagreements together.",
      cue: "Read depth and balance before changing direction. A short ball is an opportunity, not a command.",
      adaptation: "Start with predictable deep/short feeds. Add uncertainty only when both players can control the pattern.",
      question: "A shorter ball arrives and you are balanced inside the baseline. What could you choose?",
      options: ["Attack the open space with margin", "Build cross-court if the opening is small", "Change direction regardless of balance"],
      feedback: ["A reasonable attacking choice when the opening and your contact position support it. Recover for a possible reply; a winner is not guaranteed.", "Also reasonable. Staying cross-court can preserve an advantage when the opening is small. Explain what you saw.", "Avoid an automatic rule. Read balance, contact height and the opponent's position before committing."],
      preferred: 0, target: { x: 19, y: 12, width: 23, height: 13 },
    },
  },
};
export function suggestion(level: Level, attempts: number, successes: number) {
  if (attempts < 10) return "Log at least 10 attempts before considering a variation.";
  const rate = successes / attempts;
  if (rate < 0.5) return "Try a larger target or a gentler feed next time. You can also choose an easier level.";
  if (rate >= 0.8) return level === "advanced" ? "Try more varied feeds while keeping the same decision quality." : "Consider the next level, or repeat this one to build confidence.";
  return "Repeat this variation and focus on the coaching cue. Consistency comes before extra difficulty.";
}
