import source from "../../../public/coaching/lessons.json";

export type Lesson = (typeof source.lessons)[number];
export type Level = (typeof source.levels)[number];
export type Layout = {
  name: string;
  note: string;
  players: [number, number, string][];
  zones: number[][];
  shots: number[][];
  moves: number[][];
};
export const lessons: Lesson[] = source.lessons;
export const levels = source.levels;
export const layouts = source.diagrams as unknown as Record<string, Layout>;
export const findLesson = (id: string) => lessons.find((l) => l.id === id);
export type Duration = 45 | 60 | 90;
export const durations: Record<Duration, number[]> = {
  45: [6, 5, 10, 10, 10, 4],
  60: [8, 7, 15, 15, 10, 5],
  90: [10, 10, 23, 23, 17, 7],
};
export const topics = ["全部主题", "底线与移动", "发球与第三拍", "接发球", "网前与转换", "双打", "比赛与复盘"];
export function topic(l: Lesson) {
  if (l.diagram.startsWith("doubles")) return "双打";
  if (["serve", "serveplus"].includes(l.diagram)) return "发球与第三拍";
  if (l.diagram === "return") return "接发球";
  if (["net", "approach", "lob"].includes(l.diagram)) return "网前与转换";
  if (l.diagram === "match") return "比赛与复盘";
  return "底线与移动";
}
export function stages(l: Lesson, duration: Duration) {
  const lev = levels[l.level - 1];
  const contents = [
    ["热身与状态检查", lev.warm],
    ["示范与任务", `${l.objective}。${l.cue}`],
    ["练习 A · 建立能力", l.drillA],
    ["练习 B · 加入变化", l.drillB],
    ["比赛与游戏应用", l.game],
    ["复盘与验收", l.assessment],
  ];
  let start = 0;
  return contents.map(([title, body], i) => {
    const minutes = durations[duration][i];
    const stage = { title, body, minutes, start };
    start += minutes;
    return stage;
  });
}
