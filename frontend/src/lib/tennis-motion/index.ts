export type Handedness = "right" | "left" | "either";
export type MotionStatus = "captured" | "illustrative" | "planned";
export type MotionClipKey = "volley" | "backhand-volley" | "forehand" | "overhead";

export type TechniqueId =
  | "partner-feed"
  | "forehand-volley"
  | "backhand-volley"
  | "forehand-groundstroke"
  | "backhand-groundstroke"
  | "overhead"
  | "serve";

export type MovementId = "ready" | "approach" | "stroke" | "close" | "split-step" | "recover" | "reset";

export type TechniqueUnit = {
  id: TechniqueId;
  label: string;
  family: "feed" | "volley" | "groundstroke" | "overhead" | "serve";
  handedness: Handedness;
  clip: MotionClipKey | null;
  status: MotionStatus;
  window: { beforeContact: number; afterContact: number };
  checkpoints: readonly string[];
  source: "Tennis-MoCap" | "authored" | "unassigned";
};

export type MovementUnit = {
  id: MovementId;
  label: string;
  intent: string;
  racketState: "neutral" | "prepared" | "stroke-driven";
};

export const techniqueLibrary: Record<TechniqueId, TechniqueUnit> = {
  "partner-feed": {
    id: "partner-feed", label: "Partner feed", family: "feed", handedness: "right", clip: "volley", status: "illustrative",
    window: { beforeContact: .42, afterContact: .45 }, checkpoints: ["Balanced base", "Controlled release", "Recover to ready"], source: "authored",
  },
  "forehand-volley": {
    id: "forehand-volley", label: "Forehand volley", family: "volley", handedness: "right", clip: "volley", status: "captured",
    window: { beforeContact: .62, afterContact: .78 }, checkpoints: ["Split-step", "Compact unit turn", "Contact in front", "Stable racket face", "Move through the ball"], source: "Tennis-MoCap",
  },
  "backhand-volley": {
    id: "backhand-volley", label: "Backhand volley", family: "volley", handedness: "right", clip: "backhand-volley", status: "captured",
    window: { beforeContact: .62, afterContact: .78 }, checkpoints: ["Split-step", "Shoulder turn", "Contact in front", "Firm wrist", "Balanced recovery"], source: "Tennis-MoCap",
  },
  "forehand-groundstroke": {
    id: "forehand-groundstroke", label: "Forehand groundstroke", family: "groundstroke", handedness: "right", clip: "forehand", status: "captured",
    window: { beforeContact: .65, afterContact: .78 }, checkpoints: ["Unit turn", "Load outside leg", "Racket drop", "Contact in front", "Across-body recovery"], source: "Tennis-MoCap",
  },
  "backhand-groundstroke": {
    id: "backhand-groundstroke", label: "Backhand groundstroke", family: "groundstroke", handedness: "right", clip: null, status: "planned",
    window: { beforeContact: .72, afterContact: .82 }, checkpoints: ["Early shoulder turn", "Set spacing", "Contact in front", "Complete recovery"], source: "unassigned",
  },
  overhead: {
    id: "overhead", label: "Overhead", family: "overhead", handedness: "right", clip: "overhead", status: "captured",
    window: { beforeContact: .82, afterContact: .72 }, checkpoints: ["Turn sideways", "Track with non-hitting hand", "Reach to contact", "Pronate", "Land balanced"], source: "Tennis-MoCap",
  },
  serve: {
    id: "serve", label: "Serve", family: "serve", handedness: "right", clip: null, status: "planned",
    window: { beforeContact: 1.25, afterContact: 1 }, checkpoints: ["Balanced start", "Consistent toss", "Leg drive", "Racket drop", "Reach and pronate", "Land inside court"], source: "unassigned",
  },
};

export const movementLibrary: Record<MovementId, MovementUnit> = {
  ready: { id: "ready", label: "Ready", intent: "Balanced athletic base with the racket supported in front.", racketState: "neutral" },
  approach: { id: "approach", label: "Approach", intent: "Move forward under control while reading the feed.", racketState: "prepared" },
  stroke: { id: "stroke", label: "Stroke", intent: "Technique clip controls the full body and racket through contact.", racketState: "stroke-driven" },
  close: { id: "close", label: "Close the net", intent: "Follow the volley forward and establish net position.", racketState: "prepared" },
  "split-step": { id: "split-step", label: "Split-step", intent: "Land as the opponent strikes, ready to move in either direction.", racketState: "prepared" },
  recover: { id: "recover", label: "Recover", intent: "Regain court position with efficient crossover and adjustment steps.", racketState: "neutral" },
  reset: { id: "reset", label: "Reset", intent: "Return to the next drill starting position.", racketState: "neutral" },
};

export type DrillStrokeKind = "feed" | "volley" | "backhand-volley" | "forehand" | "overhead";

const strokeTechnique: Record<DrillStrokeKind, TechniqueId> = {
  feed: "partner-feed",
  volley: "forehand-volley",
  "backhand-volley": "backhand-volley",
  forehand: "forehand-groundstroke",
  overhead: "overhead",
};

export function techniqueForStroke(kind: DrillStrokeKind | string) {
  const id = strokeTechnique[kind as DrillStrokeKind] ?? kind;
  const unit = techniqueLibrary[id as TechniqueId];
  if (!unit) throw new Error(`Unknown tennis technique: ${kind}`);
  return unit;
}

export function movementLabel(id: MovementId) {
  return movementLibrary[id].label;
}
