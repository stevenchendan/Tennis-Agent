import type { PlayerPos, Point, Tactic } from "./tactic";

export type PlayingStyle = {
  id: string; name: string; tagline: string; description: string;
  watch: string; tradeoff: string; practice: string;
  contacts: Point[]; cues: string[]; heights: number[];
};
const points = (...pairs: [number, number][]): Point[] => pairs.map(([x, y]) => ({ x, y }));
export const playingStyles: PlayingStyle[] = [
  {
    id: "aggressive-baseliner", name: "Aggressive baseliner", tagline: "Take time away",
    description: "Uses depth and early attacking opportunities to put the opponent under pressure from the baseline.",
    watch: "P1 steps inside the baseline when the reply becomes shorter, then changes direction.",
    tradeoff: "Attacking from a poor contact position can give away errors. A deep reply may call for another building shot.",
    practice: "Start with gentle cross-court feeds. Step in only on a comfortable short ball; aim well inside the lines.",
    contacts: points([8, 1], [3, 23], [8, 2], [2, 23], [7, 5], [8.5, 22]),
    cues: ["P1 builds cross-court pressure.", "P2 returns into the same diagonal.", "P1 pushes the opponent wider.", "P2's shorter reply creates an opportunity.", "P1 steps in and attacks the other side."], heights: [1.5, 1.7, 1.5, 1.9, 1.4],
  },
  {
    id: "patient-baseliner", name: "Patient baseliner", tagline: "Build with margin",
    description: "Uses repeatable depth and generous targets to sustain rallies and wait for a clearer opening.",
    watch: "P1 stays near the baseline and repeats the diagonal instead of forcing a direction change.",
    tradeoff: "Predictable placement can let an opponent take control. Patience still needs purposeful depth.",
    practice: "Cooperate with a partner to make four cross-court shots. Widen the target before increasing pace.",
    contacts: points([8, .5], [3, 23], [7.5, .5], [3.5, 23], [8, .8], [3, 23]),
    cues: ["P1 starts with a generous cross-court target.", "P2 sends a deep reply.", "P1 repeats the diagonal with height.", "P2 keeps the rally neutral.", "P1 builds again; the rally can continue."], heights: [2.3, 2, 2.5, 2, 2.3],
  },
  {
    id: "counterpuncher", name: "Counterpuncher", tagline: "Defend, then turn the point",
    description: "Absorbs pressure, restores balance and redirects the ball when an attacking chance appears.",
    watch: "P1 first buys time from a wide position, then takes a shorter ball into the opposite corner.",
    tradeoff: "Repeated defending costs court position. The counterattack needs balance and an available opening.",
    practice: "Use a manageable wide feed followed by a shorter feed. Recover after the first ball and choose a large target for the second.",
    contacts: points([9, .4], [3, 23], [2, .5], [8, 22], [4, 4], [2.5, 22.5]),
    cues: ["P1 lifts a defensive ball to gain time.", "P2 attacks the opposite corner.", "P1 reaches the ball and sends a deep reset.", "P2 leaves the next ball shorter.", "P1 moves forward and redirects into space."], heights: [3.2, 1.4, 3, 1.8, 1.5],
  },
  {
    id: "big-server", name: "Big server", tagline: "Set up the first attack",
    description: "Builds the point around serve placement and a strong next shot when the return is attackable.",
    watch: "P1 uses a wide serve to create space, then plays the first groundstroke into the other side.",
    tradeoff: "A strong return can remove the advantage. Serve placement and a reliable second serve matter alongside pace.",
    practice: "Serve at controlled pace to a large service-box target. Have a partner return gently, then practise your next shot.",
    contacts: points([4, .3], [8.5, 22], [7, 3], [2.5, 22]),
    cues: ["P1 serves wide into the diagonal service box.", "P2 blocks the return back.", "P1 attacks the open side with the next groundstroke."], heights: [1.2, 1.8, 1.5],
  },
  {
    id: "serve-volley", name: "Serve-and-volley", tagline: "Follow the serve forward",
    description: "Moves in behind the serve to play the next ball near the net and pressure the returner.",
    watch: "P1 advances during the serve and return, then closes farther for the next volley.",
    tradeoff: "Low returns, passing shots and lobs demand quick adjustments. The first volley may need depth rather than a finish.",
    practice: "Begin with a gentle feed and walk-in approach. Practise a controlled first volley before adding a serve and faster movement.",
    contacts: points([4, .3], [8.5, 22], [6.5, 8], [3, 22], [4.5, 10], [8.5, 20]),
    cues: ["P1 serves wide and begins moving in.", "P2 returns while P1 approaches.", "P1 sends the first volley deep.", "P2 attempts a passing reply.", "P1 closes and angles the next volley."], heights: [1.2, 1.5, 1.4, 1.3, 1.1],
  },
  {
    id: "all-court", name: "All-court player", tagline: "Adapt and move forward",
    description: "Combines baseline construction, approaches and net play, choosing an option to fit the incoming ball.",
    watch: "P1 begins at the baseline, approaches on a shorter reply and follows it toward the net.",
    tradeoff: "More options require clear decisions. Coming in behind a weak approach can expose the player to a pass.",
    practice: "Use a three-ball sequence: deep rally ball, short approach ball, then an easy volley. Add uncertainty once comfortable.",
    contacts: points([8, 1], [3, 23], [7, 6], [8.5, 22], [6, 10], [2.5, 20]),
    cues: ["P1 builds from the baseline.", "P2's shorter reply invites P1 forward.", "P1 approaches down the line and follows in.", "P2 tries to pass the advancing player.", "P1 intercepts with a volley toward the open side."], heights: [2, 1.8, 1.5, 1.3, 1.2],
  },
];

export const SHOT_SECONDS = 2.4;
export function styleTactic(style: PlayingStyle): Tactic {
  return { v: 1, title: style.name, frames: style.cues.map((note, i) => ({
    note, players: positions(style, i), paths: [{ from: style.contacts[i], to: style.contacts[i + 1] }],
  })) };
}
function positions(style: PlayingStyle, index: number): PlayerPos[] {
  return [0, 1].map(side => {
    const contactIndex = index % 2 === side ? index : Math.max(0, index - 1);
    const point = index === 0 && side === 1 ? style.contacts[1] : style.contacts[contactIndex];
    return { id: side + 1, ...point };
  });
}
export function sampleStyle(style: PlayingStyle, time: number) {
  const duration = style.cues.length * SHOT_SECONDS;
  const clamped = Math.max(0, Math.min(time, duration));
  const index = Math.min(style.cues.length - 1, Math.floor(clamped / SHOT_SECONDS));
  const t = Math.min(1, (clamped - index * SHOT_SECONDS) / SHOT_SECONDS);
  const from = style.contacts[index], to = style.contacts[index + 1];
  const start = positions(style, index), end = positions(style, index + 1);
  // Begin closing during the shot preceding each net contact, without teleporting.
  if (style.id === "serve-volley" || style.id === "all-court") {
    for (const [list, i] of [[start, index], [end, index + 1]] as const) {
      if (i % 2 === 1 && style.contacts[i + 1]?.y < 12) {
        list[0] = { id: 1, x: (style.contacts[i - 1].x + style.contacts[i + 1].x) / 2, y: (style.contacts[i - 1].y + style.contacts[i + 1].y) / 2 };
      }
    }
  }
  const players = start.map((p, i) => ({ id: p.id, x: p.x + (end[i].x - p.x) * t, y: p.y + (end[i].y - p.y) * t }));
  const serve = index === 0 && (style.id === "big-server" || style.id === "serve-volley");
  const volley = (style.id === "serve-volley" || style.id === "all-court") && index % 2 === 1 && to.y > 7;
  // Schematic trajectories: one bounce before groundstroke contacts, none before volleys.
  const bounce = serve ? { x: 7.6, y: 17 } : { x: to.x * .88 + from.x * .12, y: to.y * .88 + from.y * .12 };
  const mix = (a: number, b: number, u: number) => a + (b - a) * u;
  let ball;
  if (volley) ball = { x: mix(from.x, to.x, t), y: mix(from.y, to.y, t), z: 1 + Math.sin(Math.PI * t) * style.heights[index] };
  else if (t < .72) {
    const u = t / .72;
    ball = { x: mix(from.x, bounce.x, u), y: mix(from.y, bounce.y, u), z: (serve ? 2.6 : 1) * (1 - u) + Math.sin(Math.PI * u) * style.heights[index] };
  } else {
    const u = (t - .72) / .28;
    ball = { x: mix(bounce.x, to.x, u), y: mix(bounce.y, to.y, u), z: u };
  }
  return { index, players, ball, duration, paths: [{ from, to: serve ? bounce : to }] };
}
