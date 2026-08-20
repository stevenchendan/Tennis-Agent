"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import TacticCourt from "@/components/board/TacticCourt";
import type { Ball3D } from "@/components/board/TacticCourt3D";
import { COURT_THEMES } from "@/lib/court";
import type { PlayerPos, Point, Tactic } from "@/lib/tactic";
import { findStrategies } from "@/lib/strategies";

// three.js chunk is only fetched when the 3D view is actually used
const TacticCourt3D = dynamic(() => import("@/components/board/TacticCourt3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] w-full items-center justify-center text-sm text-neutral-500">
      3D 球场加载中…
    </div>
  ),
});

const FRAME_MS = 1500;
const SPEEDS = [0.5, 1, 2] as const;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function TacticPlayer({ tactic }: { tactic: Tactic }) {
  const [branch, setBranch] = useState<"primary" | "fallback">("primary");
  const fallback = tactic.strategy?.fallbackId ? findStrategies().find((item) => item.id === tactic.strategy?.fallbackId)?.build() : null;
  const activeTactic = branch === "fallback" && fallback ? fallback : tactic;
  const n = activeTactic.frames.length;
  const total = n * FRAME_MS;

  const [playing, setPlaying] = useState(true);
  const [speedIx, setSpeedIx] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  // 3D is the default student-facing view; 2D stays one click away
  const [view3d, setView3d] = useState(true);
  // local theme override (viewer-side only, does not change the shared link)
  const [themeOverride, setThemeOverride] = useState<string | null>(null);
  const elapsedRef = useRef(0);
  const rafRef = useRef(0);

  const courtTactic = useMemo(
    () => ({ ...activeTactic, theme: themeOverride ?? activeTactic.theme }),
    [activeTactic, themeOverride],
  );

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      elapsedRef.current = Math.min(elapsedRef.current + dt * SPEEDS[speedIx], total);
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= total) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, speedIx, total]);

  function seek(t: number) {
    const v = Math.min(Math.max(t, 0), total);
    elapsedRef.current = v;
    setElapsed(v);
  }
  function togglePlay() {
    if (!playing && elapsedRef.current >= total) seek(0);
    setPlaying((p) => !p);
  }
  function stepToFrame(k: number) {
    setPlaying(false);
    seek(k * FRAME_MS);
  }

  const frameIndex = Math.min(Math.floor(elapsed / FRAME_MS), n - 1);
  const localT = clamp01((elapsed - frameIndex * FRAME_MS) / FRAME_MS);
  const cur = activeTactic.frames[frameIndex];
  const next = activeTactic.frames[frameIndex + 1];

  // players ease toward their next-frame positions across the frame
  const players: PlayerPos[] = next
    ? cur.players.map((p) => {
        const np = next.players.find((q) => q.id === p.id);
        if (!np) return p;
        const e = easeInOutCubic(localT);
        return { id: p.id, x: p.x + (np.x - p.x) * e, y: p.y + (np.y - p.y) * e };
      })
    : cur.players;

  // shots of the frame play sequentially; ball hidden once all have flown.
  // Arc height is synthesized from shot distance (no z in the data model).
  const ball: (Point & Pick<Ball3D, "z">) | null = (() => {
    const paths = cur.paths;
    if (paths.length === 0) return null;
    const pos = localT * paths.length;
    if (pos >= paths.length) return null;
    const i = Math.floor(pos);
    const t = pos - i;
    const p = paths[i];
    const dist = Math.hypot(p.to.x - p.from.x, p.to.y - p.from.y);
    const peak = Math.min(0.3 + dist * 0.09, 2.3);
    return {
      x: p.from.x + (p.to.x - p.from.x) * t,
      y: p.from.y + (p.to.y - p.from.y) * t,
      z: Math.sin(Math.PI * t) * peak,
    };
  })();

  const ended = !playing && elapsed >= total;

  return (
    <div className="flex flex-col gap-4">
      {tactic.title.toLowerCase().includes("server +1") && (
        <div className="rounded-xl border border-amber-700/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold text-amber-300">Server +1: what to watch</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
            Follow the three decisions: pull the returner wide, recover to a balanced court position, then
            attack the first ball into the open court. Pause or step frame-by-frame to rehearse each decision.
          </p>
        </div>
      )}
      {tactic.strategy && (
        <div className="grid gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-xs text-neutral-300 sm:grid-cols-3">
          <div><span className="font-semibold text-emerald-300">Goal</span><p className="mt-1 text-neutral-400">{tactic.strategy.goal}</p></div>
          <div><span className="font-semibold text-amber-300">Trigger</span><p className="mt-1 text-neutral-400">{tactic.strategy.trigger}</p></div>
          <div><span className="font-semibold text-sky-300">Fallback</span><p className="mt-1 text-neutral-400">{tactic.strategy.fallback}</p></div>
        </div>
      )}
      {tactic.strategy?.fallbackId && fallback && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs">
          <span className="mr-1 text-neutral-500">Plan:</span>
          <button onClick={() => { setBranch("primary"); seek(0); }} className={`rounded-lg px-2.5 py-1.5 ${branch === "primary" ? "bg-emerald-500 text-neutral-950" : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"}`}>Primary sequence</button>
          <button onClick={() => { setBranch("fallback"); seek(0); }} className={`rounded-lg px-2.5 py-1.5 ${branch === "fallback" ? "bg-amber-400 text-neutral-950" : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"}`}>If neutralized</button>
        </div>
      )}
      <div className="rounded-2xl border border-neutral-900 bg-neutral-950 p-3">
        {view3d ? (
          <TacticCourt3D
            theme={courtTactic.theme}
            players={players}
            paths={cur.paths}
            ball={ball}
            height={560}
          />
        ) : (
          <TacticCourt tactic={courtTactic} frameIndex={frameIndex} playersOverride={players} ballAt={ball} height={560} />
        )}
      </div>
      {view3d && <p className="-mt-2 text-center text-xs text-neutral-600">拖动旋转视角 · 滚轮缩放</p>}

      {/* progress bar with frame ticks, click/drag to seek */}
      <div
        role="slider"
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={n}
        aria-valuenow={frameIndex + 1}
        tabIndex={0}
        className="group relative h-6 cursor-pointer"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const seekTo = (clientX: number) =>
            seek(((clientX - r.left) / r.width) * total);
          seekTo(e.clientX);
          const move = (ev: PointerEvent) => seekTo(ev.clientX);
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-neutral-800" />
        <div
          className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-full bg-emerald-500"
          style={{ width: `${(elapsed / total) * 100}%` }}
        />
        {Array.from({ length: n - 1 }, (_, k) => (
          <span
            key={k}
            className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-neutral-600"
            style={{ left: `${((k + 1) / n) * 100}%` }}
          />
        ))}
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => stepToFrame(Math.max(frameIndex - 1, 0))}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-600"
        >
          ◀ 上一帧
        </button>
        <button
          onClick={togglePlay}
          className="rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-900/50 transition hover:bg-emerald-400"
        >
          {playing ? "⏸ 暂停" : ended ? "↺ 重播" : "▶ 播放"}
        </button>
        <button
          onClick={() => stepToFrame(Math.min(frameIndex + 1, n - 1))}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-600"
        >
          下一帧 ▶
        </button>
        <button
          onClick={() => setSpeedIx((i) => (i + 1) % SPEEDS.length)}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-600"
        >
          {SPEEDS[speedIx]}x
        </button>
        <button
          onClick={() => setView3d((v) => !v)}
          className={`rounded-lg border px-3 py-2 text-sm transition ${
            view3d
              ? "border-emerald-700 bg-emerald-500/10 text-emerald-300"
              : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600"
          }`}
        >
          {view3d ? "3D" : "2D"}
        </button>
        <select
          value={themeOverride ?? tactic.theme ?? "classic"}
          onChange={(e) => setThemeOverride(e.target.value)}
          title="球场主题（仅本地预览）"
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-sm text-neutral-300 outline-none"
        >
          {Object.values(COURT_THEMES).map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="ml-1 text-sm text-neutral-500">
          第 {frameIndex + 1} / {n} 帧
        </span>
      </div>

      {/* current frame note */}
      <div className="rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-sm leading-relaxed text-neutral-300">
        <span className="mr-2 font-semibold text-emerald-400">第 {frameIndex + 1} 帧</span>
        {cur.note?.trim() ? cur.note : <span className="text-neutral-600">（本帧没有备注）</span>}
      </div>
    </div>
  );
}
