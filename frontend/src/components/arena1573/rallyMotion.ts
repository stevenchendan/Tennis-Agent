import { recordedContact } from "../../lib/drills/recorded-motion";
import type { AthletePose } from "../../lib/tennis-motion/athlete";
import type { MotionClipKey } from "../../lib/tennis-motion";

type Vec = [number, number, number];
export const COURT_SURFACE = .115;
export const BALL_RADIUS = .0335;
const gravity = 9.81;
const verticalRestitution = .79;
const horizontalRetention = .73;
const contacts = [
  [-2, 12.8], [2.6, -12.6], [2.9, 12.7], [-2.5, -12.9],
  [-3.2, 13.1], [1.5, -12.6], [.7, 12.5], [-.8, -12.7],
];
const wrap = (value: number, period: number) => (value % period + period) % period;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => t * t * (3 - 2 * t);
const distance = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export const rallyShots = contacts.map(([x, z], i) => {
  const [targetX, targetZ] = contacts[(i + 1) % contacts.length];
  const yaw = Math.atan2(x - targetX, z - targetZ);
  const kind: MotionClipKey = x * Math.sign(z) < -.5 ? "backhand" : "forehand";
  const [offsetX, height, offsetZ] = recordedContact(kind);
  const root: Vec = [
    x - offsetX * Math.cos(yaw) - offsetZ * Math.sin(yaw), 0,
    z + offsetX * Math.sin(yaw) - offsetZ * Math.cos(yaw),
  ];
  return { kind, yaw, root, contact: [x, height, z] as Vec, bounce: [0, BALL_RADIUS, 0] as Vec, air: 0, after: 0, start: 0 };
});

let duration = 0;
for (const [index, shot] of rallyShots.entries()) {
  const next = rallyShots[(index + 1) % rallyShots.length];
  shot.start = duration;
  shot.air = 1.14 + (index % 3) * .06;
  // Solve the rising part of the rebound for the next racket's contact height.
  const reboundSpeed = verticalRestitution * (gravity * shot.air / 2 + (shot.contact[1] - BALL_RADIUS) / shot.air);
  const rise = next.contact[1] - BALL_RADIUS;
  shot.after = 2 * rise / (reboundSpeed + Math.sqrt(reboundSpeed ** 2 - 2 * gravity * rise));
  const fraction = shot.air / (shot.air + horizontalRetention * shot.after);
  shot.bounce = [mix(shot.contact[0], next.contact[0], fraction), BALL_RADIUS, mix(shot.contact[2], next.contact[2], fraction)];
  duration += shot.air + shot.after;
}
export const RALLY_DURATION = duration;

function actorAt(index: number, time: number): AthletePose {
  const current = rallyShots[index];
  const next = rallyShots[(index + 2) % rallyShots.length];
  const span = wrap(next.start - current.start, duration);
  const elapsed = wrap(time - current.start, duration);
  const recovery: Vec = [
    (current.root[0] + next.root[0]) * .14, 0,
    (current.root[2] + next.root[2]) * .5 + Math.sign(next.root[2]) * .22,
  ];
  const recovering = elapsed < span * .49;
  const from = recovering ? current.root : recovery;
  const to = recovering ? recovery : next.root;
  const start = recovering ? .19 : span * .49;
  const end = recovering ? span * .47 : span - .16;
  const fraction = clamp((elapsed - start) / (end - start));
  const eased = smooth(fraction);
  const rate = 6 * fraction * (1 - fraction) / (end - start);
  const preparing = elapsed > span / 2;
  const shot = preparing ? next : current;
  const relativeTime = preparing ? elapsed - span : elapsed;
  const baseYaw = current.root[2] > 0 ? 0 : Math.PI;
  const aim = smooth(clamp(1 - (Math.abs(relativeTime) - .62) / .45));
  const yawDelta = shot.yaw - baseYaw;
  const opponentContact = current.air + current.after;
  return {
    x: mix(from[0], to[0], eased), z: mix(from[2], to[2], eased),
    vx: (to[0] - from[0]) * rate, vz: (to[2] - from[2]) * rate,
    yaw: baseYaw + aim * Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta)),
    distance: (recovering ? 0 : distance(current.root, recovery)) + distance(from, to) * eased,
    relativeTime, stroke: shot.kind, split: Math.max(0, 1 - Math.abs(elapsed - opponentContact + .04) / .19),
  };
}

export function rallyFrame(seconds: number) {
  const time = wrap(seconds, duration);
  let index = rallyShots.length - 1;
  while (index > 0 && time < rallyShots[index].start) index--;
  const shot = rallyShots[index];
  const next = rallyShots[(index + 1) % rallyShots.length];
  const elapsed = time - shot.start;
  const airborne = elapsed < shot.air;
  const from = airborne ? shot.contact : shot.bounce;
  const to = airborne ? shot.bounce : next.contact;
  const span = airborne ? shot.air : shot.after;
  const fraction = clamp((airborne ? elapsed : elapsed - shot.air) / span);
  const height = mix(from[1], to[1], fraction) + .5 * gravity * span ** 2 * fraction * (1 - fraction);
  const ball: Vec = [mix(from[0], to[0], fraction), height, mix(from[2], to[2], fraction)];
  const previous = (index + rallyShots.length - 1) % rallyShots.length;
  const players = [
    actorAt(index % 2 === 0 ? index : previous, time),
    actorAt(index % 2 === 1 ? index : previous, time),
  ];
  return { ball, players };
}
