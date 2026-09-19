import type { Tactic } from "@/lib/tactic";

export const studySource = {
  id: "qXtJDJ1U7_8",
  title: "Court Level View Best Points · Tennis On Another Level Part 6",
  creator: "Roger That Tennis",
  url: "https://www.youtube.com/watch?v=qXtJDJ1U7_8",
  method: "Manual review of sampled browser frames. No pose model or ball tracker was run.",
};

export type VideoStudyDrill = {
  id: string;
  title: string;
  start: number;
  end: number;
  goal: string;
  observations: { time: number; text: string }[];
  setup: string;
  rules: string[];
  technique: { title: string; cue: string; check: string }[];
  progression: string;
  tactic: Tactic;
};

// These coordinates and timings are authored practice examples, never measurements
// from the linked video. Source timestamps refer only to inspected visual frames.
export const videoStudyDrills: VideoStudyDrill[] = [
  {
    id: "short-ball-transition",
    title: "Read short. Move forward. Get ready.",
    start: 5,
    end: 16,
    goal: "Recognise a shorter feed and move from the baseline into a balanced attacking position.",
    observations: [
      { time: 5, text: "The near player in orange is around the baseline." },
      { time: 10, text: "The near player has moved into the forecourt, close to the net." },
      { time: 15, text: "A later sampled frame shows a wide, lowered ready position inside the baseline. It is not treated as a continuous tracked trajectory." },
    ],
    setup: "Two players. P1 starts near the baseline; P2 feeds from the opposite baseline. Mark a generous deep target with flat markers.",
    rules: [
      "P2 alternates a comfortable deep feed with a clearly shorter feed. These feeds are our practice design.",
      "P1 returns the deep ball, then moves forward for the short ball and sends it toward the deep target.",
      "P1 gets ready for P2’s next contact, then plays one controlled volley. Reset after the exchange.",
      "Play 8 sequences each, then swap roles. Count a success when the approach reaches the target and the next ball is controlled.",
    ],
    technique: [
      { title: "Read and move", cue: "Start forward when the shorter ball is recognised; use smaller adjustment steps near contact.", check: "On your own recording, compare the start of forward movement with the incoming ball. No reaction time has been measured here." },
      { title: "Approach balance", cue: "Choose contact spacing that lets you finish the shot and continue forward under control.", check: "Check the full body before, during and after contact. One still frame cannot establish balance through the stroke." },
      { title: "Ready for the reply", cue: "Prepare for the opponent’s next contact instead of continuing to run through it.", check: "Inspect split-step timing in a continuous clip; the sampled reference frames do not establish its exact timing." },
    ],
    progression: "Begin with predictable feeds. Later let P2 choose deep or short, and let the point continue after the approach.",
    tactic: {
      v: 1, title: "Short ball to controlled net position", theme: "australian",
      frames: [
        { players: [{ id: 1, x: 5.5, y: 1 }, { id: 2, x: 5.5, y: 22.5 }], paths: [{ from: { x: 5.5, y: 22.5 }, to: { x: 7.5, y: 2 } }], note: "Authored drill: P2 supplies a comfortable deep feed." },
        { players: [{ id: 1, x: 7.5, y: 1 }, { id: 2, x: 5.5, y: 22.5 }], paths: [{ from: { x: 7.5, y: 1 }, to: { x: 5.5, y: 21.5 } }], note: "P1 returns with margin and recovers." },
        { players: [{ id: 1, x: 5.5, y: 2 }, { id: 2, x: 5.5, y: 22.5 }], paths: [{ from: { x: 5.5, y: 22.5 }, to: { x: 7, y: 7 } }], note: "P2 feeds shorter. P1 recognises the forward opportunity." },
        { players: [{ id: 1, x: 7, y: 6 }, { id: 2, x: 5.5, y: 22.5 }], paths: [{ from: { x: 7, y: 6 }, to: { x: 7.5, y: 21.5 } }], note: "P1 approaches to a generous deep target." },
        { players: [{ id: 1, x: 6.5, y: 9 }, { id: 2, x: 7.5, y: 22.5 }], paths: [{ from: { x: 7.5, y: 22.5 }, to: { x: 6, y: 9 } }], note: "Get ready for the reply. This path ends at volley interception, not a bounce." },
        { players: [{ id: 1, x: 6, y: 9 }, { id: 2, x: 7.5, y: 22.5 }], paths: [{ from: { x: 6, y: 9 }, to: { x: 3, y: 19 } }], note: "Control the volley, then reset. Ball arc and timing are illustrative." },
      ],
    },
  },
  {
    id: "wide-ball-recovery",
    title: "Handle width. Recover for the next ball.",
    start: 20,
    end: 32,
    goal: "Practise moving to a wide ball and returning to a useful ready position for the next shot.",
    observations: [
      { time: 20, text: "The near player is in a serve action; the scoreboard shows Federer and Goffin." },
      { time: 25, text: "The near player is stretched toward the left side of the image with the ball nearby." },
      { time: 30, text: "The near player is back nearer the middle of the baseline in a ready position." },
    ],
    setup: "Two players at opposite baselines. P2 feeds at comfortable pace; P1 practises the wide-ball recovery. Start with a feed rather than reproducing the professional serve.",
    rules: [
      "P2 feeds wide to one side. P1 returns with a generous cross-court margin.",
      "P1 recovers toward a position that covers P2’s likely reply. Centre is a starting reference, not a compulsory spot after every shot.",
      "P2 sends the next ball toward the middle. P1 controls it and resets.",
      "Play 6 repetitions on each side, then swap roles. Count successful pairs of controlled returns, not winners.",
    ],
    technique: [
      { title: "Spacing on the wide ball", cue: "Move early and leave room for the swing; reduce feed width if you cannot control the return.", check: "Review your position relative to the ball. The reference does not supply a measured contact distance or grip." },
      { title: "Recovery decision", cue: "Recover after the shot while watching the opponent, then prepare for their contact.", check: "Compare the wide position with the later ready position. Intermediate footwork has not been extracted." },
      { title: "Repeatable preparation", cue: "Keep the racket available and adjust the feet before the next swing.", check: "Use a closer side view to assess swing detail. This court view does not establish racket-face angle or 3D joint rotation." },
    ],
    progression: "Make the second feed unpredictable only after the player controls both returns consistently. Add serve + rally as a later variation.",
    tactic: {
      v: 1, title: "Wide ball and recovery practice", theme: "australian",
      frames: [
        { players: [{ id: 1, x: 5.5, y: 1 }, { id: 2, x: 5.5, y: 22.5 }], paths: [{ from: { x: 5.5, y: 22.5 }, to: { x: 2, y: 2 } }], note: "Authored drill: P2 feeds wide at a manageable pace." },
        { players: [{ id: 1, x: 2, y: 1 }, { id: 2, x: 5.5, y: 22.5 }], paths: [{ from: { x: 2, y: 1 }, to: { x: 8, y: 21.5 } }], note: "P1 returns cross-court with margin. Direction is a practice choice, not a measured source shot." },
        { players: [{ id: 1, x: 4.5, y: 1 }, { id: 2, x: 8, y: 22.5 }], paths: [{ from: { x: 8, y: 22.5 }, to: { x: 5.5, y: 2 } }], note: "P1 recovers and gets ready while P2 supplies the central ball." },
        { players: [{ id: 1, x: 5.5, y: 1 }, { id: 2, x: 5.5, y: 22.5 }], paths: [{ from: { x: 5.5, y: 1 }, to: { x: 5.5, y: 21.5 } }], note: "Control the second return, then reset. Practise the opposite side in the next set." },
      ],
    },
  },
];

export const sourceAt = (seconds: number) => `${studySource.url}&t=${seconds}s`;
