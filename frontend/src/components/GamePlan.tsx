"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/api";
import { boardImportHref } from "@/lib/rally-to-tactic";
import { buildGamePlan, CATEGORY_LABEL } from "@/lib/gameplan";
import { inferMatchStates } from "@/lib/score";
import { templateByKey } from "@/lib/templates";

/**
 * Printable one-page game plan derived deterministically from mined patterns:
 * opponent threats with counters, our own weapons to reinforce, each linked
 * to evidence rallies and a tactics-board drill.
 */
export default function GamePlan({
  result,
  onShowRally,
}: {
  result: AnalysisResult;
  onShowRally: (rallyId: number) => void;
}) {
  const [perspective, setPerspective] = useState(1);
  const plan = useMemo(
    () => buildGamePlan(result.patterns, perspective),
    [result.patterns, perspective],
  );
  const state = useMemo(() => inferMatchStates(result.rallies), [result.rallies]);
  const breakPoints = state.infos.filter((i) => i.isBreakPoint).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-neutral-50">作战计划</h2>
          <p className="text-xs text-neutral-500">
            由模式挖掘结果确定性生成 · 建议打印一页带去球场
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <label className="text-xs text-neutral-500">视角</label>
          <select
            value={perspective}
            onChange={(e) => setPerspective(Number(e.target.value))}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-300 outline-none"
          >
            <option value={1}>P1（近端）</option>
            <option value={2}>P2（远端）</option>
          </select>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-emerald-600 hover:text-emerald-300"
          >
            打印 / 存 PDF
          </button>
        </div>
      </div>

      {/* snapshot */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Snapshot label="总比分" value={`${result.stats.points_won["1"] ?? 0}:${result.stats.points_won["2"] ?? 0}`} sub="P1 : P2" />
        <Snapshot label="推断局数" value={`${state.games[0]}-${state.games[1]}`} sub="由逐分胜负推断" />
        <Snapshot label="破发点数" value={`${breakPoints}`} sub="推断，含未兑现" />
        <Snapshot label="平均回合" value={`${result.stats.avg_rally_length}`} sub={`最长 ${result.stats.longest_rally} 拍`} />
      </div>

      <PlanSection
        title={`对手（P${perspective === 1 ? 2 : 1}）威胁 · 反制策略`}
        items={plan.theirs}
        onShowRally={onShowRally}
        accent="pink"
      />
      <PlanSection
        title={`我方（P${perspective}）武器 · 强化要点`}
        items={plan.ours}
        onShowRally={onShowRally}
        accent="emerald"
      />

      <p className="text-xs text-neutral-600">
        说明：模式与胜负均为启发式推断；比分由逐分结果模拟，仅供准备参考。
      </p>
    </div>
  );
}

function PlanSection({
  title,
  items,
  onShowRally,
  accent,
}: {
  title: string;
  items: ReturnType<typeof buildGamePlan>["ours"];
  onShowRally: (rallyId: number) => void;
  accent: "emerald" | "pink";
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-300">{title}</h3>
      {items.length === 0 && <p className="text-sm text-neutral-600">（没有该方向的显著模式）</p>}
      {items.map((item) => {
        const tpl = templateByKey(item.drillKey);
        return (
          <div key={item.pattern.code} className="rounded-xl border border-neutral-900 bg-neutral-950/80 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-xs ${
                  accent === "emerald"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-pink-500/15 text-pink-300"
                }`}
              >
                {CATEGORY_LABEL[item.pattern.category]}
              </span>
              <span className="text-sm font-medium text-neutral-100">{item.pattern.title}</span>
              <span className="ml-auto text-xs text-neutral-600">
                样本 {item.pattern.support} · 置信 {(item.pattern.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{item.pattern.description}</p>
            <p className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm leading-relaxed text-neutral-200">
              {item.advice}
            </p>
            <div className="no-print mt-2.5 flex flex-wrap items-center gap-1.5">
              {[...new Set(item.pattern.evidence_rally_ids)].slice(0, 6).map((rid) => (
                <button
                  key={rid}
                  onClick={() => onShowRally(rid)}
                  className="rounded border border-neutral-800 px-2 py-0.5 text-xs text-neutral-400 transition hover:border-emerald-700 hover:text-emerald-300"
                >
                  第 {rid + 1} 分
                </button>
              ))}
              {tpl && (
                <Link
                  href={boardImportHref(tpl.build())}
                  className="ml-auto rounded border border-emerald-800/60 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  在战术板演练：{tpl.name.split("：")[0].split("+")[0]} →
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Snapshot({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-900 bg-neutral-950/80 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-neutral-100">{value}</div>
      {sub && <div className="text-xs text-neutral-600">{sub}</div>}
    </div>
  );
}
