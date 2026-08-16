"use client";

import { useState } from "react";
import type { Rally } from "@/lib/api";
import MiniCourt from "@/components/MiniCourt";

const DIR_LABEL: Record<string, string> = { cross: "斜线", line: "直线", middle: "中路" };
const ZONE_LABEL: Record<string, string> = {
  service: "发球区",
  mid: "中场",
  deep: "底线",
  front: "网前",
};
const SIDE_LABEL: Record<string, string> = { deuce: "平分区", ad: "占先区" };

export default function RallyBrowser({ rallies }: { rallies: Rally[] }) {
  const [active, setActive] = useState(rallies.length ? Math.min(rallies.length - 1, 5) : 0);
  if (!rallies.length) return <p className="text-neutral-400">没有可回放的回合。</p>;
  const rally = rallies[active];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {rallies.map((r) => {
            const won = r.winner === 1;
            return (
              <button
                key={r.id}
                onClick={() => setActive(r.id)}
                className={`h-9 w-9 rounded-md border text-xs font-medium transition ${
                  r.id === active
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-600"
                } ${won ? "shadow-[inset_0_-3px_0_#4ade80]" : "shadow-[inset_0_-3px_0_#f472b6]"}`}
                title={`第 ${r.id + 1} 分 · ${r.shots.length} 拍 · P${r.winner} 胜`}
              >
                {r.id + 1}
              </button>
            );
          })}
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
        </div>
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
