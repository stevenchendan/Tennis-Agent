import { durations, lessons, type Duration } from "./catalog";

export const STORAGE_KEY = "tennis-coach-workspace-v2";
export type Difficulty = "standard" | "easier" | "harder";
export type Draft = {
  duration: Duration;
  players: number;
  difficulty: Difficulty;
  className: string;
  subject: string;
  metric: string;
  stage: number;
  remaining: number;
  deadline: number | null;
  startedAt: string | null;
  elapsed: number;
  notes: string;
  outcomes: boolean[];
};
export type SavedClass = {
  id: string;
  lessonId: string;
  date: string;
  className: string;
  subject: string;
  metric: string;
  players: number;
  difficulty: Difficulty;
  duration: Duration;
  elapsed: number;
  success: number;
  attempts: number;
  notes: string;
};
export type CourseRecord = { favorite: boolean; draft: Draft };
export type CoachStore = { version: 2; records: Record<string, CourseRecord>; history: SavedClass[] };
export const emptyStore = (): CoachStore => ({ version: 2, records: {}, history: [] });
export const newDraft = (duration: Duration = 60): Draft => ({
  duration,
  players: 4,
  difficulty: "standard",
  className: "",
  subject: "全组",
  metric: "回球入界",
  stage: 0,
  remaining: durations[duration][0] * 60,
  deadline: null,
  startedAt: null,
  elapsed: 0,
  notes: "",
  outcomes: [],
});
export const getRecord = (store: CoachStore, id: string): CourseRecord =>
  store.records[id] || { favorite: false, draft: newDraft() };
export const remainingSeconds = (draft: Draft, now = Date.now()) =>
  draft.deadline === null ? draft.remaining : Math.max(0, Math.ceil((draft.deadline - now) / 1000));
export const elapsedSeconds = (draft: Draft, now = Date.now()) =>
  draft.elapsed + Math.max(0, durations[draft.duration][draft.stage] * 60 - remainingSeconds(draft, now));

function obj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const short = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
function validDraft(v: unknown): v is Draft {
  if (!obj(v) || ![45, 60, 90].includes(v.duration as number) || !Number.isInteger(v.stage) || !finite(v.stage, 0, 5))
    return false;
  const max = durations[v.duration as Duration][v.stage as number] * 60;
  return (
    Number.isInteger(v.players) &&
    finite(v.players, 1, 6) &&
    ["standard", "easier", "harder"].includes(v.difficulty as string) &&
    short(v.className, 100) &&
    short(v.subject, 100) &&
    short(v.metric, 100) &&
    short(v.notes, 4000) &&
    finite(v.remaining, 0, max) &&
    finite(v.elapsed, 0, 1e8) &&
    (v.deadline === null || finite(v.deadline, 0, 9e12)) &&
    (v.startedAt === null || (short(v.startedAt, 50) && !Number.isNaN(Date.parse(v.startedAt as string)))) &&
    Array.isArray(v.outcomes) &&
    v.outcomes.length <= 2000 &&
    v.outcomes.every((x) => typeof x === "boolean")
  );
}
export function validateStore(value: unknown): CoachStore | null {
  if (
    !obj(value) ||
    value.version !== 2 ||
    !obj(value.records) ||
    !Array.isArray(value.history) ||
    value.history.length > 300
  )
    return null;
  const ids = new Set(lessons.map((l) => l.id));
  for (const [id, r] of Object.entries(value.records)) {
    if (!ids.has(id) || !obj(r) || typeof r.favorite !== "boolean" || !validDraft(r.draft)) return null;
  }
  const historyIds = new Set<string>();
  for (const h of value.history) {
    if (
      !obj(h) ||
      !short(h.id, 150) ||
      historyIds.has(h.id as string) ||
      !ids.has(h.lessonId as string) ||
      !short(h.date, 50) ||
      Number.isNaN(Date.parse(h.date as string)) ||
      !short(h.className, 100) ||
      !short(h.subject, 100) ||
      !short(h.metric, 100) ||
      !short(h.notes, 4000) ||
      !finite(h.players, 1, 6) ||
      !["standard", "easier", "harder"].includes(h.difficulty as string) ||
      ![45, 60, 90].includes(h.duration as number) ||
      !finite(h.elapsed, 0, 1e8) ||
      !Number.isInteger(h.attempts) ||
      !Number.isInteger(h.success) ||
      !finite(h.attempts, 0, 2000) ||
      !finite(h.success, 0, h.attempts as number)
    )
      return null;
    historyIds.add(h.id as string);
  }
  return value as unknown as CoachStore;
}

/** Legacy fieldbook records contain completion flags, not full timed classes. */
export function migrateLegacy(value: unknown): CoachStore | null {
  if (!obj(value) || !obj(value.records) || (value.version !== undefined && value.version !== 1)) return null;
  const store = emptyStore();
  for (const [id, r] of Object.entries(value.records)) {
    if (!lessons.some((l) => l.id === id) || !obj(r)) return null;
    const text = (key: string, max: number) => (typeof r[key] === "string" ? (r[key] as string).slice(0, max) : "");
    const draft = newDraft();
    draft.className = text("className", 100);
    draft.players = Math.max(1, Math.min(6, Number(r.players) || 4));
    if (!Number.isInteger(draft.players)) draft.players = 4;
    draft.notes = [text("note", 3500), text("result", 200) ? `旧版验收：${text("result", 200)}` : ""]
      .filter(Boolean)
      .join("\n");
    store.records[id] = { favorite: r.star === true, draft };
    if (r.done === true) {
      const date = text("date", 40);
      store.history.push({
        id: `legacy-${id}`,
        lessonId: id,
        date: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : new Date().toISOString(),
        className: draft.className,
        subject: "旧版完成标记",
        metric: "未记录次数",
        players: draft.players,
        difficulty: "standard",
        duration: 60,
        elapsed: 0,
        success: 0,
        attempts: 0,
        notes: draft.notes,
      });
      store.records[id].draft = { ...draft, notes: "" };
    }
  }
  return validateStore(store);
}

export function pausedSnapshot(store: CoachStore): CoachStore {
  return {
    ...store,
    records: Object.fromEntries(
      Object.entries(store.records).map(([id, r]) => [
        id,
        { ...r, draft: { ...r.draft, remaining: remainingSeconds(r.draft), deadline: null } },
      ]),
    ),
  };
}
