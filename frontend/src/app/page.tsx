"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [fullReady, setFullReady] = useState(false);

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setBackendUp(true);
        setFullReady(h.full_mode_ready);
      })
      .catch(() => setBackendUp(false));
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
    </main>
  );
}
