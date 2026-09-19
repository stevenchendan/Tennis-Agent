import { getFrame, type Frame, type Stroke } from '../drills/motion';
import { recordedContact } from '../drills/recorded-motion';
import { techniqueLibrary, movementLibrary, type TechniqueId, type MovementId } from './index';

export type StudioUnit = { id: string; label: string; category: 'Technique' | 'Movement' | 'Strategy'; status: 'Captured preview' | 'Illustrative' | 'Not available'; duration: number; contact?: number; kind?: Stroke['kind']; movement?: MovementId; cues: readonly string[] };
const kinds: Partial<Record<TechniqueId, Stroke['kind']>> = { 'partner-feed': 'feed', 'forehand-volley': 'volley', 'backhand-volley': 'backhand-volley', 'forehand-groundstroke': 'forehand', overhead: 'overhead' };
export const studioUnits: StudioUnit[] = [
  ...Object.values(techniqueLibrary).map(unit => ({ id: unit.id, label: unit.label, category: 'Technique' as const, status: (unit.clip ? unit.status === 'captured' ? 'Captured preview' : 'Illustrative' : 'Not available') as StudioUnit['status'], duration: unit.window.beforeContact + unit.window.afterContact, contact: unit.window.beforeContact, kind: kinds[unit.id], cues: unit.checkpoints })),
  ...Object.values(movementLibrary).filter(unit => unit.id !== 'stroke').map(unit => ({ id: unit.id, label: unit.label, category: 'Movement' as const, status: 'Illustrative' as const, duration: 3, movement: unit.id, cues: [unit.intent] })),
  { id: 'mercy-sequence', label: 'Approach, volley & recover', category: 'Strategy', status: 'Illustrative', duration: 16, cues: ['P2 feeds cross-court.', 'P1 approaches and volleys, then closes the net.', 'Split-step on the return; recover after the point.'] },
];

// Independent of the UI: a unit can be scrubbed, paused or sampled by tests.
export function studioFrame(unit: StudioUnit, seconds: number): Frame {
  if (unit.status === 'Not available') throw new Error(`Unit unavailable: ${unit.id}`);
  const t = Math.max(0, Math.min(unit.duration, seconds));
  if (unit.category === 'Strategy') return getFrame(t);
  const base = getFrame(0);
  const actor = { ...base.players[0], x: 0, y: 16, vx: 0, vy: 0, travel: 0, movement: unit.movement ?? 'stroke', technique: unit.kind };
  const strokes: Stroke[] = [];
  if (unit.kind && unit.contact !== undefined) {
    const [x, z, y] = recordedContact(unit.kind);
    strokes.push({ id: actor.id, time: unit.contact, kind: unit.kind, point: { x, y: 16 + y, z } });
  }
  if (unit.movement === 'split-step') strokes.push({ id: '2', time: 1.5, kind: 'forehand', point: { x: 0, y: 0, z: 1 } });
  if (unit.movement && !['ready', 'split-step'].includes(unit.movement)) {
    const u = t / unit.duration, direction = ['recover', 'reset'].includes(unit.movement) ? 1 : -1;
    actor.y += direction * (u*u*(3-2*u) - .5) * 2;
    actor.vy = direction * 12 * u * (1-u) / unit.duration;
    actor.travel = u*u*(3-2*u) * 2;
  }
  return { ...base, time: t, localTime: t, players: [actor], strokes, ball: null, trajectory: [], trail: [], cue: unit.label };
}
