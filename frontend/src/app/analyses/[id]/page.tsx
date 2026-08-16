"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, type AnalysisJob } from "@/lib/api";
import StageProgress from "@/components/StageProgress";
import PatternCards from "@/components/PatternCards";
import RallyBrowser from "@/components/RallyBrowser";
import CoachChat from "@/components/CoachChat";
import GamePlan from "@/components/GamePlan";

type Tab = "report" | "patterns" | "plan" | "rallies" | "chat";

const TABS: { key: Tab; label: string }[] = [
  { key: "report", label: "战术报告" },
  { key: "patterns", label: "模式卡片" },
  { key: "plan", label: "作战计划" },
  { key: "rallies", label: "逐分回放" },
  { key: "chat", label: "教练问答" },
];

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("report");
  const [rallyId, setRallyId] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setJob(await api.getAnalysis(id));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const running = job?.status === "queued" || job?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(refresh, 1200);
    return () => clearInterval(t);
  }, [running, refresh]);

  if (err) {
    return <Center>加载失败：{err}（后端是否在运行？分析结果会在重启后保留）</Center>;
  }
  if (!job) return <Center>加载中…</Center>;

  if (job.status === "failed") {
    return (
      <Center>
        <p className="mb-2 text-red-400">分析失败</p>
        <p className="text-sm text-neutral-400">{job.error}</p>
      </Center>
    );
  }

  if (running) {
    return (
      <Center>
        <p className="mb-1 text-lg font-medium text-neutral-200">正在分析比赛…</p>
        <p className="mb-6 text-sm text-neutral-500">
          {job.mode === "demo" ? "演示模式（合成比赛）" : job.video_id ?? ""}
        </p>
        <StageProgress stages={job.stages} />
      </Center>
    );
  }

  const r = job.result;
  if (!r) return <Center>等待结果…</Center>;
  const s = r.stats;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="no-print mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-50">战术分析</h1>
          <p className="text-sm text-neutral-500">
            {r.source} · {s.points} 分 · {r.rallies.length} 个回合 ·{" "}
            {r.report_generated_by === "llm" ? "LLM 报告" : "规则报告"}
          </p>
        </div>
        {r.notes.length > 0 && (
          <p className="max-w-md text-xs text-amber-500/80">{r.notes.join("；")}</p>
        )}
      </header>

      {/* stats strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="总比分" value={`${s.points_won["1"] ?? 0} : ${s.points_won["2"] ?? 0}`} sub="P1 : P2" />
        <Stat label="平均回合" value={`${s.avg_rally_length}`} sub="拍" />
        <Stat label="最长回合" value={`${s.longest_rally}`} sub="拍" />
        <Stat label="P1 斜线" value={`${s.direction_counts["1"]?.cross ?? 0}`} sub={`直线 ${s.direction_counts["1"]?.line ?? 0}`} />
        <Stat label="P2 斜线" value={`${s.direction_counts["2"]?.cross ?? 0}`} sub={`直线 ${s.direction_counts["2"]?.line ?? 0}`} />
        <Stat label="截击" value={`${(s.volleys["1"] ?? 0) + (s.volleys["2"] ?? 0)}`} sub={`P1 ${s.volleys["1"] ?? 0} / P2 ${s.volleys["2"] ?? 0}`} />
      </div>

      <nav className="no-print mb-6 flex gap-1 border-b border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? "border-emerald-400 text-emerald-300"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "report" && (
        <article className="mx-auto max-w-3xl">
          <Markdown text={r.report ?? "（无报告）"} />
        </article>
      )}
      {tab === "patterns" && <PatternCards patterns={r.patterns} />}
      {tab === "plan" && (
        <GamePlan
          result={r}
          onShowRally={(rid) => {
            setRallyId(rid);
            setTab("rallies");
          }}
        />
      )}
      {tab === "rallies" && <RallyBrowser rallies={r.rallies} activeId={rallyId} onSelect={setRallyId} />}
      {tab === "chat" && <CoachChat analysisId={r.id} />}
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {children}
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-900 bg-neutral-950/80 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-neutral-100">{value}</div>
      {sub && <div className="text-xs text-neutral-600">{sub}</div>}
    </div>
  );
}

/** Minimal markdown rendering: headings, bold, lists, paragraphs. */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = (key: string) => {
    if (list.length) {
      out.push(
        <ul key={key} className="my-3 list-disc space-y-1 pl-6 text-neutral-300">
          {list.map((li, i) => (
            <li key={i}>{bold(li)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  lines.forEach((line, i) => {
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const li = /^\s*[-*]\s+(.*)$/.exec(line) || /^\s*\d+\.\s+(.*)$/.exec(line);
    if (li) {
      list.push(li[1]);
      return;
    }
    flushList(`l${i}`);
    if (h) {
      const level = h[1].length;
      const size = level <= 2 ? "text-xl" : "text-base";
      out.push(
        <h2 key={i} className={`mt-6 mb-2 font-semibold text-neutral-100 ${size}`}>
          {bold(h[2])}
        </h2>
      );
    } else if (line.trim() === "---") {
      out.push(<hr key={i} className="my-4 border-neutral-800" />);
    } else if (line.trim()) {
      out.push(
        <p key={i} className="my-2 leading-relaxed text-neutral-300">
          {bold(line)}
        </p>
      );
    }
  });
  flushList("last");
  return <div className="text-sm">{out}</div>;
}

function bold(s: string): React.ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-neutral-100">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
