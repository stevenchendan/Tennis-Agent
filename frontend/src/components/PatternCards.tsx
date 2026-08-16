"use client";

import type { PatternCard } from "@/lib/api";

const CATEGORY_LABEL: Record<string, string> = {
  serve: "发球",
  serve_plus_one: "发球+1",
  rally: "回合长度",
  direction: "球路组合",
  position: "位置",
};

export default function PatternCards({ patterns }: { patterns: PatternCard[] }) {
  if (!patterns.length) {
    return <p className="text-neutral-400">这场比赛没有挖掘出足够的战术模式（回合数太少）。</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {patterns.map((p) => (
        <div
          key={p.code}
          className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition hover:border-emerald-700/60"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300">
              {CATEGORY_LABEL[p.category] ?? p.category}
            </span>
            <span className="text-xs text-neutral-500">
              样本 {p.support} · 置信 {(p.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <h3 className="mb-1 font-semibold text-neutral-100">{p.title}</h3>
          <p className="text-sm leading-relaxed text-neutral-300">{p.description}</p>
          <div className="mt-3 rounded-lg bg-emerald-950/40 p-3 text-sm text-emerald-200">
            <span className="font-medium">怎么用在你自己的比赛里：</span>
            {p.takeaway}
          </div>
          {p.evidence_rally_ids.length > 0 && (
            <p className="mt-2 text-xs text-neutral-500">
              证据：第 {p.evidence_rally_ids.slice(0, 10).join("、")}
              {p.evidence_rally_ids.length > 10 ? " …" : ""} 分
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
