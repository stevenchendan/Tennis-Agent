"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import TacticPlayer from "@/components/board/TacticPlayer";
import { decodeTactic } from "@/lib/tactic";

export default function TacticViewPage({ params }: { params: Promise<{ data: string }> }) {
  const { data } = use(params);
  const tactic = useMemo(() => decodeTactic(data), [data]);

  if (!tactic) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-4xl">🎾</p>
        <h1 className="text-xl font-semibold text-neutral-100">链接无效或已损坏</h1>
        <p className="text-sm leading-relaxed text-neutral-500">
          这个战术链接无法解析，可能复制时被截断了。请让教练重新生成完整链接。
        </p>
        <div className="mt-2 flex gap-3">
          <Link
            href="/board"
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-400"
          >
            自己创建一个战术
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-neutral-700 px-5 py-2.5 text-sm text-neutral-300 transition hover:border-neutral-500"
          >
            回首页
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5 text-center">
        <p className="mb-2 text-xs font-medium tracking-widest text-emerald-400">TENNIS TACTIC</p>
        <h1 className="text-2xl font-bold text-neutral-50">
          {tactic.title.trim() || "未命名战术"}
        </h1>
        <p className="mt-1 text-xs text-neutral-500">共 {tactic.frames.length} 帧</p>
      </div>
      <TacticPlayer tactic={tactic} />
      <p className="mt-8 text-center text-xs text-neutral-600">
        由 Tennis-Agent 战术板生成 ·{" "}
        <Link href="/board" className="text-emerald-500/80 transition hover:text-emerald-400">
          我也来创建一个 →
        </Link>
      </p>
    </main>
  );
}
