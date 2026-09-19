import { recordedContact } from "./recorded-motion";
import type { DrillStrokeKind, MovementId } from "../tennis-motion/index";
// Court coordinates are metres: x across the court, y along it, z above it.
export type Point = { x: number; y: number; z: number };
export type Movement = MovementId;
export type Actor = Point & { id: string; color: string; vx: number; vy: number; travel: number; movement: Movement; technique?: DrillStrokeKind };
export type Outcome = "rally" | "mercy" | "double-miss";
export type Stroke = { id: string; time: number; point: Point; kind: DrillStrokeKind };
export const DURATION = 32;
export const phases = ["Partner feed", "Transition volley", "Close the net", "Play the point", "Touch the fence", "Reset positions"];
export const phaseTimes = [0, 3, 3.45, 4.38, 10, 13];
export const court = { width: 10.97, length: 23.77, singles: 1.37, service: 6.4 };
export const lessonUrl = "https://tennisdrills.tv/courses/featured-drills/lessons/3-mercy-shot-volley-singles/";
// The video explicitly permits doubles alleys within the active diagonal halves.
export function activeHalves(round: number) {
  return [{ x: round ? court.width / 2 : 0, y: 0 }, { x: round ? 0 : court.width / 2, y: court.length / 2 }];
}
const p = (x: number, y: number, z = 1): Point => ({ x, y, z });
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const progress = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const smooth = (u: number) => u * u * (3 - 2 * u);
type Flight = { start: number; end: number; from: Point; to: Point; gravity?: number };
export function sampleFlight(f: Flight, time: number): Point {
  const u = progress(time, f.start, f.end), point = mix(f.from, f.to, u);
  point.z += .5 * (f.gravity ?? 9.81) * (f.end - f.start) ** 2 * u * (1 - u);
  return point;
}
export function getFrame(seconds: number, outcome: Outcome = "rally", moonball = false) {
  const time = Math.max(0, Math.min(DURATION, seconds)), round = time < 16 ? 0 : 1, t = time - round * 16;
  const mirror = (point: Point): Point => round ? { ...point, x: court.width - point.x } : point;
  const approach = p(2.4, 4.6), net = p(3.1, 9.1), defender = p(8.3, 24.3);
  const attackerId = "1", defenderId = "2";
  const volleyKind: Stroke["kind"] = round ? "backhand-volley" : "volley";
  let phase = 0;
  phaseTimes.forEach((start, i) => { if (t >= start) phase = i; });
  let cue = [
    `P2 feeds P1. Split-step, then move through the transition volley.`,
    `Player ${attackerId}: meet the ball in front with a compact volley.`,
    `Follow the ball forward. Split-step as player ${defenderId} makes contact.`,
    "P2 drives the forehand cross-court. P1 split-steps, reads the ball and protects the angle.",
    `Player ${defenderId} runs back to touch the fence.`,
    "P1 and P2 reset for the opposite diagonal.",
  ][phase];
  const attackAt = (at: number) => {
    if (at < 2.7) return mix(p(2.4, 1.4), approach, smooth(progress(at, .7, 2.7)));
    if (at < 5.05) return mix(approach, net, smooth(progress(at, 3.16, 5.05)));
    if (at < 10) return net;
    if (at < 13) return mix(net, p(2.4, 1.4), smooth(progress(at, 10, 13)));
    return mix(p(2.4, 1.4), p(court.width - 2.4, 1.4), smooth(progress(at, 13, 16)));
  };
  const proAt = (at: number) => {
    if (at < 10) return defender;
    if (at < 13) return mix(defender, p(8.3, 28), smooth(progress(at, 10, 12.5)));
    return mix(p(8.3, 28), p(court.width - 8.3, 24.3), smooth(progress(at, 13, 16)));
  };
  const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
  const attackTravel = (at: number) => {
    const start = p(2.4, 1.4), reset = p(2.4, 1.4), opposite = p(court.width - 2.4, 1.4);
    const first = distance(start, approach), second = distance(approach, net), third = distance(net, reset);
    if (at < 2.7) return first * smooth(progress(at, .7, 2.7));
    if (at < 5.05) return first + second * smooth(progress(at, 3.16, 5.05));
    if (at < 10) return first + second;
    if (at < 13) return first + second + third * smooth(progress(at, 10, 13));
    return first + second + third + distance(reset, opposite) * smooth(progress(at, 13, 16));
  };
  const proTravel = (at: number) => {
    const fence = p(8.3, 28), opposite = p(court.width - 8.3, 24.3), first = distance(defender, fence);
    if (at < 10) return 0;
    if (at < 13) return first * smooth(progress(at, 10, 12.5));
    return first + distance(fence, opposite) * smooth(progress(at, 13, 16));
  };
  const players: Actor[] = [
    { ...p(2.4, 1.4), id: "1", color: "#e56843", vx: 0, vy: 0, travel: 0, movement: "ready" },
    { ...defender, id: "2", color: "#3e91cc", vx: 0, vy: 0, travel: 0, movement: "ready" },
  ];
  function place(id: string, at: (time: number) => Point, travelAt: (time: number) => number, reflect = true) {
    const a = at(t), before = at(t - .01), after = at(t + .01);
    Object.assign(players.find(a => a.id === id)!, reflect ? mirror(a) : a, {
      vx: (after.x - before.x) / .02 * (reflect && round ? -1 : 1),
      vy: (after.y - before.y) / .02,
      travel: round * travelAt(16) + travelAt(t),
    });
  }
  place(attackerId, attackAt, attackTravel); place(defenderId, proAt, proTravel);
  // Derive ball contacts from the same captured hand/racket pose as the renderer.
  // Keep both players right-handed on either diagonal; do not mirror anatomy.
  const contact = (kind: string, body: Point) => {
    const [x, height, z] = recordedContact(kind);
    const direction = body.y < court.length / 2 ? -1 : 1;
    return p(body.x + x * direction * (round ? -1 : 1), body.y + z * direction, height);
  };
  const feed = contact("feed", defender), volley = contact(volleyKind, approach);
  const groundstroke = contact("forehand", defender), finish = contact(volleyKind, net), overhead = contact("overhead", net);
  const strokes: Stroke[] = [{ id: defenderId, time: moonball ? .65 : 1.5, point: feed, kind: "feed" }, { id: attackerId, time: 3, point: volley, kind: volleyKind }];
  const flights: Flight[] = [{ start: moonball ? .65 : 1.5, end: 3, from: feed, to: volley }];
  if (outcome === "rally") {
    const bounce = p(7.25, 21.4, .034);
    strokes.push({ id: defenderId, time: 4.38, point: groundstroke, kind: "forehand" }, { id: attackerId, time: 5.35, point: finish, kind: volleyKind });
    flights.push(
      { start: 3, end: 4.1, from: volley, to: bounce }, { start: 4.1, end: 4.38, from: bounce, to: groundstroke },
      { start: 4.38, end: 5.35, from: groundstroke, to: finish },
      { start: 5.35, end: 6.15, from: finish, to: p(8.6, 19.5, .034) },
      { start: 6.15, end: 6.65, from: p(8.6, 19.5, .034), to: p(9.55, 22.6, .034) },
    );
    if (t >= 6.65 && t < 10) cue = "Example point complete: +1 to the winner. Reset, then recover and switch diagonals.";
  } else {
    strokes.push({ id: defenderId, time: 4.5, point: feed, kind: "feed" }, { id: attackerId, time: 7, point: overhead, kind: "overhead" });
    flights.push({ start: 3, end: 3.65, from: volley, to: p(2.9, 6, .034) }, { start: 4.5, end: 7, from: feed, to: overhead });
    const end = outcome === "double-miss" ? p(4.15, 11.7, .25) : p(7.25, 21.4, .034);
    flights.push({ start: 7, end: outcome === "double-miss" ? 7.25 : 7.72, from: overhead, to: end });
    if (outcome === "double-miss") flights.push({ start: 7.25, end: 7.5, from: end, to: p(4.15, 11.65, .034) });
    else {
      // Making the mercy ball keeps the point alive; it does not award a point.
      strokes.push({ id: defenderId, time: 8, point: groundstroke, kind: "forehand" }, { id: attackerId, time: 8.8, point: finish, kind: volleyKind });
      flights.push(
        { start: 7.72, end: 8, from: end, to: groundstroke },
        { start: 8, end: 8.8, from: groundstroke, to: finish },
        { start: 8.8, end: 9.5, from: finish, to: p(10.1, 20.5, .034) },
        { start: 9.5, end: 9.9, from: p(10.1, 20.5, .034), to: p(10.7, 22.9, .034) },
      );
    }
    if (t >= 3 && t < 4.5) cue = "Missed the feed. P2 prepares the mercy overhead.";
    if (t >= 4.5 && t < 7) cue = "Turn sideways, track the lob, and reach up for the overhead.";
    if (t >= 7 && t < 10) cue = outcome === "double-miss" ? `Second miss: player ${attackerId} loses 3 points and resets for the next point.` : t < 7.72 ? "Mercy overhead: put the ball in the active cross-court half." : t < 9.9 ? "Mercy ball made — keep playing. The doubles alley is in." : "Example point complete: +1 to the winner. A made mercy feed alone earns no point.";
  }
  const splitTimes = strokes.filter(stroke => stroke.id === defenderId && stroke.kind === "forehand").map(stroke => stroke.time);
  for (const actor of players) {
    const activeStroke = strokes.find(stroke => stroke.id === actor.id && Math.abs(t - stroke.time) <= (stroke.kind === "overhead" ? .8 : .62));
    if (activeStroke) { actor.movement = "stroke"; actor.technique = activeStroke.kind; }
    else if (actor.id === attackerId && splitTimes.some(hit => Math.abs(t - hit) <= .22)) actor.movement = "split-step";
    else if (t >= 13) actor.movement = "reset";
    else if (t >= 10) actor.movement = "recover";
    else if (actor.id === attackerId && t >= 3.16 && t < 5.05) actor.movement = "close";
    else if (actor.id === attackerId && t >= .7 && t < 2.7) actor.movement = "approach";
  }
  const flight = flights.find(f => t >= f.start && t <= f.end);
  const ball = flight ? mirror(sampleFlight(flight, t)) : null;
  const from = mirror(flight?.from ?? feed), to = mirror(flight?.to ?? volley);
  const trail = flight ? Array.from({ length: 25 }, (_, i) => mirror(sampleFlight(flight, Math.max(flight.start, t - .16) + Math.min(.16, t - flight.start) * i / 24))) : [];
  const trajectory = flight ? Array.from({ length: 40 }, (_, i) => mirror(sampleFlight(flight, flight.start + (flight.end - flight.start) * i / 39))) : [];
  return { time, localTime: t, outcome, players, ball, from, to, trail, trajectory, strokes: strokes.map(s => ({ ...s, point: mirror(s.point) })), phase, cue, round, penalty: outcome === "double-miss" && t >= 7.5 ? attackerId : null };
}
export type Frame = ReturnType<typeof getFrame>;
