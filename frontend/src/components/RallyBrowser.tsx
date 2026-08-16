"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Rally } from "@/lib/api";
import MiniCourt from "@/components/MiniCourt";
import { boardImportHref, rallyToTactic } from "@/lib/rally-to-tactic";
import { inferMatchStates, pointScoreLabel, type RallyScoreInfo } from "@/lib/score";

const DIR_LABEL: Record<string, string> = { cross: "斜线", line: "直线", middle: "中路" };
const ZONE_LABEL: Record<string, string> = {
  service: "发球区",
  mid: "中场",
  deep: "底线",
  front: "网前",
};
const SIDE_LABEL: Record<string, string> = { deuce: "平分区", ad: "占先区" };

const SITUATIONS = [
  { key: "all", label: "全部情境" },
  { key: "break", label: "破发点" },
  { key: "game", label: "局点" },
  { key: "serve1", label: "P1 发球局" },
  { key: "serve2", label: "P2 发球局" },
] as const;
const OUTCOMES = [
  { key: "all", label: "全部结果" },
  { key: "won1", label: "P1 得分" },
  { key: "won2", label: "P2 得分" },
] as const;
const LENGTHS = [
  { key: "all", label: "全部长度" },
  { key: "short", label: "≤4 拍" },
  { key: "mid", label: "5-8 拍" },
  { key: "long", label: "9+ 拍" },
] as const;

type Situation = (typeof SITUATIONS)[number]["key"];
type Outcome = (typeof OUTCOMES)[number]["key"];
type LengthKey = (typeof LENGTHS)[number]["key"];

export default function RallyBrowser({
  rallies,
  activeId,
  onSelect,
}: {
  rallies: Rally[];
  activeId: number;
  onSelect: (id: number) => void;
}) {
  const [situation, setSituation] = useState<Situation>("all");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [lengthFilter, setLengthFilter] = useState<LengthKey>("all");

  const state = useMemo(() => inferMatchStates(rallies), [rallies]);
  const infoById = useMemo(() => {
    const m = new Map<number, RallyScoreInfo>();
    state.infos.forEach((i) => m.set(i.rallyId, i));
    return m;
  }, [state]);

  const filtered = useMemo(
    () =>
      rallies.filter((r) => {
        const info = infoById.get(r.id);
        if (!info) return false;
        if (situation === "break" && !info.isBreakPoint) return false;
        if (situation === "game" && !info.isGamePoint) return false;
        if (situation === "serve1" && r.server !== 1) return false;
        if (situation === "serve2" && r.server !== 2) return false;
        if (outcome === "won1" && r.winner !== 1) return false;
        if (outcome === "won2" && r.winner !== 2) return false;
        const n = r.shots.length;
        if (lengthFilter === "short" && n > 4) return false;
        if (lengthFilter === "mid" && (n < 5 || n > 8)) return false;
        if (lengthFilter === "long" && n < 9) return false;
        return true;
      }),
    [rallies, situation, outcome, lengthFilter, infoById],
  );

  // keep a valid selection when filters change
  useEffect(() => {
    if (filtered.length && !filtered.some((r) => r.id === activeId)) {
      onSelect(filtered[0].id);
    }
  }, [filtered, activeId, onSelect]);

  if (!rallies.length) return <p className="text-neutral-400">没有可回放的回合。</p>;
  const rally = rallies.find((r) => r.id === activeId) ?? rallies[0];
  const info = infoById.get(rally.id);
  const filtering = situation !== "all" || outcome !== "all" || lengthFilter !== "all";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        {/* situation filters (score context is inferred, see caveat below) */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[
            { value: situation, set: setSituation, options: SITUATIONS },
            { value: outcome, set: setOutcome, options: OUTCOMES },
            { value: lengthFilter, set: setLengthFilter, options: LENGTHS },
          ].map(({ value, set, options }, gi) => (
            <select
              key={gi}
              value={value}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-300 outline-none"
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
          <span className="text-xs text-neutral-600">
            {filtering ? `${filtered.length}/${rallies.length} 分` : `共 ${rallies.length} 分`}
          </span>
        </div>
        {state.lowConfidenceRatio > 0.3 && (
          <p className="mb-3 text-xs text-amber-500/80">
            {Math.round(state.lowConfidenceRatio * 100)}% 的逐分胜负为低置信推断，破发点/局点筛选仅供参考。
          </p>
        )}

        <div className="mb-3 flex flex-wrap gap-1.5">
          {filtered.map((r) => {
            const won = r.winner === 1;
            const ri = infoById.get(r.id);
            return (
              <button
                key={r.id}
                onClick={() => onSelect(r.id)}
                className={`h-9 w-9 rounded-md border text-xs font-medium transition ${
                  r.id === activeId
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-600"
                } ${won ? "shadow-[inset_0_-3px_0_#4ade80]" : "shadow-[inset_0_-3px_0_#f472b6]"}`}
                title={
                  ri
                    ? `第 ${r.id + 1} 分 · ${r.shots.length} 拍 · P${r.winner} 胜 · 推断比分 第${ri.gameNo}局 ${pointScoreLabel(ri.pointScore)}${ri.isBreakPoint ? " · 破发点" : ""}${ri.isGamePoint ? " · 局点" : ""}`
                    : `第 ${r.id + 1} 分`
                }
              >
                {r.id + 1}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-2 text-sm text-neutral-500">当前筛选没有符合的回合。</p>
          )}
        </div>
        <MiniCourt rally={rally} height={460} />
      </div>

      <div className="space-y-2">
        <div className="rounded-lg bg-neutral-900/70 p-3 text-sm text-neutral-300">
          第 {rally.id + 1} 分 · {rally.shots.length} 拍 · P{rally.server} 发球（
          {SIDE_LABEL[rally.serve_side] ?? rally.serve_side}） · 胜者 P{rally.winner}
          <span className="ml-2 text-xs text-neutral-500">
            ({rally.end_reason} · 置信 {(rally.winner_confidence * 100).toFixed(0)}%)
          </span>
          {info && (
            <div className="mt-1.5 text-xs text-neutral-500">
              推断比分：局数 {info.games[0]}-{info.games[1]} · 第 {info.gameNo} 局{" "}
              {pointScoreLabel(info.pointScore)}
              {info.isBreakPoint && (
                <span className="ml-1.5 rounded bg-pink-500/15 px-1.5 py-0.5 text-pink-300">破发点</span>
              )}
              {info.isGamePoint && (
                <span className="ml-1.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">局点</span>
              )}
            </div>
          )}
        </div>

        <Link
          href={boardImportHref(rallyToTactic(rally))}
          className="block rounded-lg border border-emerald-800/60 bg-emerald-500/10 px-3 py-2.5 text-center text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        >
          转为战术板动画 →（可编辑后分享）
        </Link>

        <ol className="space-y-1.5">
          {rally.shots.map((s) => (
            <li
              key={s.index}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                s.player_id === 1 ? "bg-emerald-950/40 text-emerald-100" : "bg-pink-950/40 text-pink-100"
              }`}
            >
              <span className="w-8 font-mono text-xs text-neutral-400">{s.time_s.toFixed(1)}s</span>
              <span className="font-medium">P{s.player_id}</span>
              {s.is_serve && <Tag>发球</Tag>}
              {s.is_volley && <Tag>截击</Tag>}
              {s.direction && <Tag>{DIR_LABEL[s.direction]}</Tag>}
              {s.zone && <Tag>{ZONE_LABEL[s.zone]}</Tag>}
              {s.speed_kmh != null && (
                <span className="ml-auto font-mono text-xs text-neutral-400">{s.speed_kmh} km/h</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-neutral-300">{children}</span>
  );
}
