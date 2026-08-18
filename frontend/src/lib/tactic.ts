import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { COURT_THEMES, CX, LEN, W } from "@/lib/court";

export interface Point {
  x: number;
  y: number;
}

export interface PlayerPos {
  id: number;
  x: number;
  y: number;
}

export interface BallPath {
  from: Point;
  to: Point;
}

/** One keyframe: player positions at the START of the frame plus the shots hit during it. */
export interface Frame {
  players: PlayerPos[];
  paths: BallPath[];
  note?: string;
}

export interface Tactic {
  v: 1;
  title: string;
  /** court skin key (see COURT_THEMES); absent = classic */
  theme?: string;
  /** Optional strategy identity and coaching metadata for guided board demos. */
  strategy?: StrategyMeta;
  frames: Frame[];
}

export type StrategyCategory = "serve" | "return" | "baseline" | "transition" | "defense" | "doubles";

export interface StrategyMeta {
  id: string;
  category: StrategyCategory;
  goal: string;
  trigger: string;
  fallback: string;
  coachCue: string;
}

export const MAX_FRAMES = 30;
export const MAX_PLAYERS = 4;
export const MAX_PATHS_PER_FRAME = 4;
export const MAX_NOTE_LEN = 200;
export const MAX_TITLE_LEN = 50;

export function defaultTactic(): Tactic {
  return {
    v: 1,
    title: "",
    frames: [
      {
        players: [
          { id: 1, x: CX, y: 2 },
          { id: 2, x: CX, y: LEN - 2 },
        ],
        paths: [],
      },
    ],
  };
}

/** A ready-to-share example: wide serve → forced return → down-the-line winner. */
export function demoTactic(): Tactic {
  return {
    v: 1,
    title: "示例:宽角度发球 + 正手空档进攻",
    frames: [
      {
        players: [
          { id: 1, x: 6.05, y: 1.2 },
          { id: 2, x: 3.4, y: 19.5 },
        ],
        paths: [{ from: { x: 6.05, y: 1.8 }, to: { x: 2.6, y: 16.8 } }],
        note: "宽角度发球把对手拉出场外",
      },
      {
        players: [
          { id: 1, x: 5.5, y: 4.2 },
          { id: 2, x: 2.8, y: 17.6 },
        ],
        paths: [{ from: { x: 2.8, y: 17.6 }, to: { x: 8.9, y: 9.5 } }],
        note: "对手在场外被迫回出偏浅的球",
      },
      {
        players: [
          { id: 1, x: 8.2, y: 8.4 },
          { id: 2, x: 3.0, y: 19.2 },
        ],
        paths: [{ from: { x: 8.2, y: 8.4 }, to: { x: 2.3, y: 21.4 } }],
        note: "迎前正手轰向对手身后的空档,直接得分",
      },
    ],
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function toPoint(v: unknown): Point | null {
  if (typeof v !== "object" || v === null) return null;
  const { x, y } = v as Record<string, unknown>;
  const nx = toNum(x);
  const ny = toNum(y);
  if (nx === null || ny === null) return null;
  return { x: round2(clamp(nx, 0, W)), y: round2(clamp(ny, 0, LEN)) };
}

/**
 * Validate + normalize arbitrary (possibly malformed / hostile) input into a Tactic.
 * Returns null when the data is structurally unusable.
 */
export function sanitizeTactic(raw: unknown): Tactic | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { title, theme, strategy, frames } = raw as Record<string, unknown>;
  if (!Array.isArray(frames) || frames.length === 0) return null;

  const outFrames: Frame[] = [];
  for (const f of frames.slice(0, MAX_FRAMES)) {
    if (typeof f !== "object" || f === null) return null;
    const { players, paths, note } = f as Record<string, unknown>;
    if (!Array.isArray(players) || players.length === 0) return null;

    const sp: PlayerPos[] = [];
    for (const p of players.slice(0, MAX_PLAYERS)) {
      if (typeof p !== "object" || p === null) return null;
      const { id } = p as Record<string, unknown>;
      const pos = toPoint(p);
      const nid = toNum(id);
      if (!pos || nid === null) return null;
      const pid = Math.round(nid);
      if (sp.some((q) => q.id === pid)) return null;
      sp.push({ id: pid, x: pos.x, y: pos.y });
    }

    const st: BallPath[] = [];
    const pathList = Array.isArray(paths) ? paths.slice(0, MAX_PATHS_PER_FRAME) : [];
    for (const p of pathList) {
      if (typeof p !== "object" || p === null) return null;
      const { from, to } = p as Record<string, unknown>;
      const fp = toPoint(from);
      const tp = toPoint(to);
      if (!fp || !tp) return null;
      st.push({ from: fp, to: tp });
    }

    const cleanNote =
      typeof note === "string" ? note.trim().slice(0, MAX_NOTE_LEN) : "";
    outFrames.push(cleanNote ? { players: sp, paths: st, note: cleanNote } : { players: sp, paths: st });
  }

  const cleanTitle =
    typeof title === "string" && title.trim() !== ""
      ? title.trim().slice(0, MAX_TITLE_LEN)
      : "";
  const cleanTheme =
    typeof theme === "string" && COURT_THEMES[theme] ? theme : undefined;
  const cleanStrategy = sanitizeStrategy(strategy);
  const base = cleanStrategy ? { v: 1 as const, title: cleanTitle, strategy: cleanStrategy, frames: outFrames } : { v: 1 as const, title: cleanTitle, frames: outFrames };
  return cleanTheme
    ? { ...base, theme: cleanTheme }
    : base;
}

function sanitizeStrategy(raw: unknown): StrategyMeta | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const value = raw as Record<string, unknown>;
  const categories: StrategyCategory[] = ["serve", "return", "baseline", "transition", "defense", "doubles"];
  if (typeof value.id !== "string" || !/^[a-z0-9-]+$/.test(value.id)) return undefined;
  if (typeof value.category !== "string" || !categories.includes(value.category as StrategyCategory)) return undefined;
  const text = [value.goal, value.trigger, value.fallback, value.coachCue];
  if (text.some((item) => typeof item !== "string" || item.trim() === "")) return undefined;
  return {
    id: value.id,
    category: value.category as StrategyCategory,
    goal: (value.goal as string).trim().slice(0, 240),
    trigger: (value.trigger as string).trim().slice(0, 240),
    fallback: (value.fallback as string).trim().slice(0, 240),
    coachCue: (value.coachCue as string).trim().slice(0, 240),
  };
}

/** Compress a tactic into a URL-path-safe string (lz-string URI alphabet, `+` → `_`). */
export function encodeTactic(t: Tactic): string {
  const clean = sanitizeTactic(t);
  if (!clean) throw new Error("invalid tactic");
  return compressToEncodedURIComponent(JSON.stringify(clean)).replace(/\+/g, "_");
}

/** Inverse of encodeTactic; returns null for corrupt or foreign input. */
export function decodeTactic(code: string): Tactic | null {
  try {
    let comp = code.replace(/_/g, "+");
    try {
      comp = decodeURIComponent(comp);
    } catch {
      // keep raw if it isn't percent-encoded
    }
    const json = decompressFromEncodedURIComponent(comp);
    if (!json) return null;
    return sanitizeTactic(JSON.parse(json));
  } catch {
    return null;
  }
}

export function tacticShareUrl(t: Tactic): string {
  if (typeof window === "undefined") throw new Error("tacticShareUrl requires the browser");
  return `${window.location.origin}/t/${encodeTactic(t)}`;
}

/** Default spawn point for a new player on the requested side (doubles-friendly). */
export function spawnPlayerPos(players: PlayerPos[], side: "near" | "far"): PlayerPos {
  const ids = new Set(players.map((p) => p.id));
  const id = [1, 2, 3, 4].find((i) => !ids.has(i)) ?? 5;
  const near = side === "near";
  const sameSideCount = players.filter((p) => (near ? p.y < LEN / 2 : p.y >= LEN / 2)).length;
  const offset = 1.6 + 0.5 * sameSideCount;
  return {
    id,
    x: round2(clamp(CX + (near ? offset : -offset), 0.4, W - 0.4)),
    y: round2(near ? 3 : LEN - 3),
  };
}
