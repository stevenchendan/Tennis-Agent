"use client";

import Link from "next/link";
import HomeNavigation from "@/components/HomeNavigation";
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
    <div className="home-workspace">
      <a href="#home-content" className="home-skip-link">跳至主要内容</a>
      <HomeNavigation />
      <main id="home-content" className="home-content">
        <header className="home-topbar"><span>工作台 / OVERVIEW</span><span className="home-topbar-note">LEARN. PLAY. UNDERSTAND.</span></header>
        <section className="home-hero" aria-labelledby="home-title">
          <div>
            <p className="home-eyebrow">YOUR GAME STARTS HERE</p>
            <h1 id="home-title">每一分，<br /><span>都有进步的方向。</span></h1>
            <p className="home-intro">从看懂一条球路，到打好一场比赛。学习战术、安排训练、复盘表现，在这里开启你的下一步。</p>
            <Link href="/drills" className="home-primary-link">开始今天的训练 <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="home-court-art" aria-hidden="true"><div className="home-court-lines"><i /><b /></div><span className="home-court-ball" /><span className="home-court-caption">A BETTER GAME. ONE POINT AT A TIME.</span></div>
        </section>
        <section className="home-section" aria-labelledby="quick-start-title">
          <div className="home-section-heading"><h2 id="quick-start-title">今天，从哪里开始？</h2><span>QUICK START</span></div>
          <div className="home-quick-grid">
            {[
              ["01", "/learn/cross-court", "学习战术", "看懂斜线球路与站位，跟着课程练起来。", "LEARN"],
              ["02", "/board", "设计训练", "绘制球路、编排战术，把想法带上球场。", "PRACTISE"],
              ["03", "/match", "记录比赛", "实时记分，记录每一分的关键表现。", "PLAY"],
            ].map(([number, href, title, description, tag]) => <Link href={href} className="home-quick-card" key={href}><div className="home-card-meta"><span>{number} / {tag}</span><span aria-hidden="true">↗</span></div><h3>{title}</h3><p>{description}</p></Link>)}
          </div>
        </section>
        <section id="analysis" className="home-section home-analysis" aria-labelledby="analysis-title">
          <div className="home-section-heading"><h2 id="analysis-title">比赛复盘</h2><span>VIDEO ANALYSIS</span></div>
          <p className="mb-6 text-sm leading-6 text-neutral-400">上传比赛视频或粘贴 YouTube 链接，发现可以带进下一场比赛的战术模式。</p>
          <div className="flex flex-col items-start gap-4">
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
              aria-label="YouTube 比赛视频链接"
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
        </section>

      <div className="mt-8 grid gap-6 text-center text-sm text-neutral-500 sm:grid-cols-3">
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
        <section className="mt-10 w-full">
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
      <footer className="home-footer">TENNIS AGENT <span>看懂比赛，让训练更有方向。</span></footer>
    </main>
    </div>
  );
}
