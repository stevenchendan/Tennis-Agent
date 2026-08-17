"use client";

import type { Stage } from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-neutral-800 text-neutral-500",
  running: "bg-amber-500/20 text-amber-300 animate-pulse",
  done: "bg-emerald-500/20 text-emerald-300",
  failed: "bg-red-500/20 text-red-300",
  skipped: "bg-neutral-800 text-neutral-400",
};

const LABELS: Record<string, string> = {
  download: "下载",
  ingest: "读取",
  detect: "检测",
  map: "球场映射",
  events: "事件识别",
  tactics: "战术挖掘",
  report: "报告生成",
};

export default function StageProgress({ stages }: { stages: Stage[] }) {
  if (!stages.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((s) => (
        <div
          key={s.name}
          className={`rounded-lg px-3 py-2 text-sm ${STATUS_STYLE[s.status] ?? STATUS_STYLE.pending}`}
          title={s.detail || s.name}
        >
          <span className="font-medium">{LABELS[s.name] ?? s.name}</span>
          {s.detail && <span className="ml-2 text-xs opacity-70">{s.detail}</span>}
        </div>
      ))}
    </div>
  );
}
