"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type AnalysisSummary } from "@/lib/api";

const MODE_LABELS: Record<string, string> = {
  demo: "演示",
  full: "视频",
  youtube: "YouTube",
};

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  done: { text: "完成", cls: "text-emerald-400" },
  running: { text: "分析中", cls: "text-amber-400" },
  queued: { text: "排队中", cls: "text-neutral-500" },
  failed: { text: "失败", cls: "text-red-400" },
};

function fmtDate(v: number | string): string {
  const d = typeof v === "number" ? new Date(v * 1000) : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [fullReady, setFullReady] = useState(false);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [history, setHistory] = useState<AnalysisSummary[]>([]);

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setBackendUp(true);
        setFullReady(h.full_mode_ready);
        setLlmEnabled(h.llm_enabled);
        setYoutubeReady(h.youtube_ready);
      })
      .catch(() => setBackendUp(false));
    api.listAnalyses().then(setHistory).catch(() => setHistory([]));
  }, []);

  async function startDemo() {
    setBusy(true);
    setErr(null);
    try {
      const { analysis_id } = await api.createDemoAnalysis();
      router.push(`/analyses/${analysis_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function onUpload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const { video_id } = await api.uploadVideo(file);
      const { analysis_id } = await api.createFullAnalysis(video_id);
      router.push(`/analyses/${analysis_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function startYoutube() {
    const url = ytUrl.trim();
    if (!url) return;
    setBusy(true);
    setErr(null);
    try {
      const { analysis_id } = await api.createYoutubeAnalysis(url);
      router.push(`/analyses/${analysis_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const ytHint = !backendUp
    ? null
    : !youtubeReady
      ? "需要先安装 yt-dlp（backend 目录执行 pip install yt-dlp）"
      : fullReady
        ? "将使用完整检测管线：YOLO 追踪 → 逐分回放 → 模式挖掘"
        : llmEnabled
          ? "未配置 YOLO 权重：将使用 AI 视觉复盘（抽取关键帧 + 多模态 LLM），不含逐拍数据"
          : "需要配置 YOLO 权重（完整分析）或 LLM key（AI 视觉复盘）后才能分析 YouTube 视频";

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16">
      <p className="mb-3 text-sm font-medium tracking-widest text-emerald-400">
        TENNIS · TACTICS · PATTERNS
      </p>
      <h1 className="text-center text-4xl font-bold leading-tight text-neutral-50 sm:text-5xl">
        看懂网球比赛
        <span className="text-emerald-400">，</span>
        <br />
        而不只是看个热闹
      </h1>
      <p className="mt-5 max-w-xl text-center leading-relaxed text-neutral-400">
        上传一场比赛视频，Tennis-Agent 会追踪每一次击球、切分每一分，
        挖掘出真正可复用的战术模式（发球+1 球路、斜线组合、回合长度胜负关系），
        并告诉你怎么把它们用在你自己的比赛里。
      </p>

      <div className="mt-10 flex flex-col items-center gap-4">
        <button
          onClick={startDemo}
          disabled={busy}
          className="rounded-xl bg-emerald-500 px-8 py-3.5 text-lg font-semibold text-neutral-950 shadow-lg shadow-emerald-900/50 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "正在创建分析…" : "看一场演示比赛 →"}
        </button>

        <div
          className={`flex w-full max-w-xl flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <div className="text-sm font-medium text-neutral-300">
            YouTube 链接复盘
            <span className="ml-2 text-xs font-normal text-neutral-600">
              把你打过的比赛录像发上来分析
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startYoutube()}
              placeholder="https://www.youtube.com/watch?v=…"
              className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={startYoutube}
              disabled={busy || !ytUrl.trim()}
              className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              开始复盘
            </button>
          </div>
          {ytHint && <p className="text-xs leading-relaxed text-neutral-600">{ytHint}</p>}
        </div>

        <label
          className={`cursor-pointer rounded-xl border border-neutral-700 px-6 py-3 text-sm text-neutral-300 transition hover:border-emerald-600 hover:text-emerald-300 ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          上传比赛视频（需要配置 YOLO 权重）
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
        </label>

        <Link
          href="/board"
          className={`rounded-xl border border-neutral-700 px-6 py-3 text-sm text-neutral-300 transition hover:border-emerald-600 hover:text-emerald-300 ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          打开网球战术板：画好战术，生成链接分享给学生（无需登录）
        </Link>

        <Link
          href="/scouting"
          className={`rounded-xl border border-neutral-700 px-6 py-3 text-sm text-neutral-300 transition hover:border-emerald-600 hover:text-emerald-300 ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          职业球探报告：选对手 / 选场地赛事，出高阶数据赛前报告（ATP·WTA·ITF）
        </Link>

        <Link
          href="/melbourne-park"
          className={`group flex w-full max-w-xl items-center justify-between rounded-xl border border-sky-500/35 bg-sky-500/5 px-5 py-4 text-left transition hover:border-sky-400 hover:bg-sky-500/10 ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <span>
            <span className="block text-sm font-semibold text-sky-200">Melbourne Park 3D</span>
            <span className="mt-1 block text-xs text-neutral-500">Explore the Australian Open precinct and 28 selectable courts</span>
          </span>
          <span className="text-lg text-sky-300 transition group-hover:translate-x-1">→</span>
        </Link>

        {backendUp === false && (
          <p className="text-sm text-amber-400">
            后端未启动：请先运行 <code className="rounded bg-neutral-800 px-1.5 py-0.5">uvicorn app.main:app</code>
          </p>
        )}
        {backendUp && !fullReady && (
          <p className="text-xs text-neutral-600">
            演示模式随时可用；分析真实视频需设置 TENNIS_BALL_MODEL_PATH（见 README）
          </p>
        )}
        {err && <p className="text-sm text-red-400">{err}</p>}
      </div>

      <div className="mt-16 grid gap-6 text-center text-sm text-neutral-500 sm:grid-cols-3">
        {[
          ["追踪", "YOLO 检测球员与球，映射到标准球场坐标"],
          ["理解", "区分击球/落地，切分逐分逐拍，识别发球方向与球路"],
          ["应用", "模式卡片 + 教练报告 + 问答，把战术变成你的练法"],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">
            <div className="mb-1 font-semibold text-neutral-300">{t}</div>
            <div className="leading-relaxed">{d}</div>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <section className="mt-14 w-full max-w-2xl">
          <h2 className="mb-3 text-left text-sm font-semibold tracking-wider text-neutral-400">
            我的比赛 · 点击复盘
          </h2>
          <ul className="divide-y divide-neutral-900 rounded-xl border border-neutral-900 bg-neutral-950/60">
            {history.slice(0, 8).map((h) => {
              const st = STATUS_LABELS[h.status] ?? { text: h.status, cls: "text-neutral-500" };
              return (
                <li key={h.id}>
                  <Link
                    href={`/analyses/${h.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-neutral-900/60"
                  >
                    <span className="min-w-0 flex-1 truncate text-neutral-200">
                      {h.title ?? h.id}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-600">
                      {MODE_LABELS[h.mode] ?? h.mode} · {fmtDate(h.created_at)}
                    </span>
                    <span className={`shrink-0 text-xs ${st.cls}`}>{st.text}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
