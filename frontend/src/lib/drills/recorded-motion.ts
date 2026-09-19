import recordings from './recorded-motion.json';
import { techniqueForStroke } from '../tennis-motion/index';

export type RecordedKind = keyof typeof recordings;
export const recordingFor = (kind: string): RecordedKind => {
  const clip = techniqueForStroke(kind).clip;
  if (!clip) throw new Error(`No recording available for ${kind}`);
  return clip;
};
export function recordedContact(kind: string) {
  const clip = recordings[recordingFor(kind)];
  return clip.poses[Math.round(clip.contact / clip.dt)].r;
}
// Pure sampling supports pause, scrubbing and shared 2D/3D contact positions.
export function recordedSample(kind: string, relativeTime: number) {
  const clip = recordings[recordingFor(kind)];
  const t = relativeTime + clip.contact;
  const index = Math.max(0, Math.min(clip.poses.length - 1, t / clip.dt));
  const a = Math.floor(index), b = Math.min(a + 1, clip.poses.length - 1);
  const duration = (clip.poses.length - 1) * clip.dt;
  const fade = Math.max(0, Math.min(1, t / .14, (duration - t) / .18));
  return { a: clip.poses[a], b: clip.poses[b], alpha: index - a, weight: fade * fade * (3 - 2 * fade) };
}
export const recordedReady = recordings.volley.poses[0];
