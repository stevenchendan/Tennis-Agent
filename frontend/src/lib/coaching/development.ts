import { lessons } from "./catalog";

export const book = "《青少年网球教学训练大纲（试行本）》· 国家体育总局网球运动管理中心";
export const ratings = ["需要帮助", "正在形成", "基本做到", "稳定做到"] as const;
export const skills = [
  { id: "serve", name: "发球启动", cue: "观察抛球、连贯挥拍及发向目标的能力。", pages: "243、245", lessons: ["013", "027", "049", "091"] },
  { id: "return", name: "接发准备", cue: "观察提前准备，并把快球回到可控区域。", pages: "244、245", lessons: ["014", "029", "052", "075"] },
  { id: "forehand", name: "正手控制", cue: "观察舒适击球距离和方向、深度控制。", pages: "244", lessons: ["003", "022", "042", "063"] },
  { id: "backhand", name: "反手控制", cue: "观察身体协调、击球空间和连续回球。", pages: "244", lessons: ["004", "023", "043", "085"] },
  { id: "rally", name: "相持与选择", cue: "观察能否区分进攻、中性和防守来球。", pages: "244", lessons: ["007", "025", "048", "062"] },
  { id: "defend", name: "防守争取时间", cue: "观察受压时能否用高度、深度或中路恢复局面。", pages: "244", lessons: ["008", "031", "047", "086"] },
  { id: "net", name: "上网与截击", cue: "观察短球前压、网前控制和后续站位。", pages: "244–245", lessons: ["011", "034", "054", "069"] },
  { id: "pass", name: "穿越与高吊", cue: "观察面对网前对手时选择穿越或高吊的时机。", pages: "245", lessons: ["009", "035", "055", "070"] },
  { id: "move", name: "判断与到位", cue: "观察读取来球、启动和调整击球距离。", pages: "46、61", lessons: ["002", "024", "037", "068"] },
  { id: "recover", name: "击球后回位", cue: "观察是否根据自己球路与对手位置重新准备。", pages: "155", lessons: ["006", "018", "065", "089"] },
  { id: "reset", name: "专注与重置", cue: "观察失分后能否回到下一分的具体任务。", pages: "228、245", lessons: ["015", "039", "079", "108"] },
  { id: "reflect", name: "目标与复盘", cue: "观察能否描述本次目标、表现和下次调整。", pages: "245", lessons: ["020", "040", "060", "116"] },
] as const;
export type SkillId = (typeof skills)[number]["id"];
export type Player = { id: string; name: string; level: number };
export type Observation = { id: string; playerId: string; skill: SkillId; rating: number; note: string; date: string };
export type PassportStore = { version: 1; players: Player[]; observations: Observation[] };
export const PASSPORT_KEY = "tennis-development-passports-v1";
export const emptyPassport = (): PassportStore => ({ version: 1, players: [], observations: [] });
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
export function validatePassport(v: unknown): PassportStore | null {
  if (!obj(v) || v.version !== 1 || !Array.isArray(v.players) || !Array.isArray(v.observations) || v.players.length > 100 || v.observations.length > 5000) return null;
  if (!v.players.every(p => obj(p) && str(p.id, 100) && p.id.length > 0 && str(p.name, 80) && !!p.name.trim() && Number.isInteger(p.level) && Number(p.level) >= 1 && Number(p.level) <= 6)) return null;
  const ids = new Set(v.players.map(p => p.id));
  if (ids.size !== v.players.length) return null;
  if (!v.observations.every(o => obj(o) && str(o.id, 100) && o.id.length > 0 && ids.has(o.playerId) && skills.some(s => s.id === o.skill) && Number.isInteger(o.rating) && Number(o.rating) >= 0 && Number(o.rating) <= 3 && str(o.note, 1000) && str(o.date, 40) && Number.isFinite(Date.parse(o.date)))) return null;
  if (new Set(v.observations.map(o => o.id)).size !== v.observations.length) return null;
  return v as PassportStore;
}
export function recommendations(skill: SkillId, level: number) {
  const entry = skills.find(s => s.id === skill)!;
  return entry.lessons.map(id => lessons.find(l => l.id === id)!).sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level)).slice(0, 2);
}
export function mergePassports(a: PassportStore, b: PassportStore): PassportStore | null {
  const players = new Map(a.players.map(p => [p.id, p]));
  b.players.forEach(p => { if (!players.has(p.id)) players.set(p.id, p); });
  const observations = new Map(a.observations.map(o => [o.id, o]));
  b.observations.forEach(o => { if (!observations.has(o.id)) observations.set(o.id, o); });
  return validatePassport({ version: 1, players: [...players.values()], observations: [...observations.values()].sort((x, y) => Date.parse(x.date) - Date.parse(y.date)) });
}
