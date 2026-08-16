"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import TacticCourt, { type BoardMode } from "@/components/board/TacticCourt";
import TacticPlayer from "@/components/board/TacticPlayer";
import TemplatePicker from "@/components/board/TemplatePicker";
import { COURT_THEMES } from "@/lib/court";
import {
  decodeTactic,
  defaultTactic,
  demoTactic,
  encodeTactic,
  MAX_FRAMES,
  MAX_NOTE_LEN,
  MAX_PATHS_PER_FRAME,
  MAX_PLAYERS,
  MAX_TITLE_LEN,
  spawnPlayerPos,
  tacticShareUrl,
  type BallPath,
  type Frame,
  type PlayerPos,
  type Tactic,
} from "@/lib/tactic";
import { templateByKey } from "@/lib/templates";

const DRAFT_KEY = "tactics-board-draft-v1";

const MODES: { key: BoardMode; label: string; hint: string }[] = [
  { key: "move", label: "移动球员", hint: "拖动球场上的圆点，调整球员在这一帧的站位" },
  { key: "path", label: "画击球线", hint: "在球场上按住并拖拽：从击球点画到落点，松开确定" },
  { key: "erase", label: "删除", hint: "点击球员或击球线将其删除" },
];

export default function BoardEditor() {
  const [tactic, setTactic] = useState<Tactic>(defaultTactic);
  const [frameIndex, setFrameIndex] = useState(0);
  const [mode, setMode] = useState<BoardMode>("move");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function flash(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  // On mount: a `?import=` tactic (converted rally / template drill) wins over
  // the locally saved draft.
  useEffect(() => {
    try {
      const imp = new URLSearchParams(window.location.search).get("import");
      if (imp) {
        const t = decodeTactic(imp);
        if (t) {
          setTactic(t);
          setFrameIndex(0);
          flash("已载入战术，可自由修改后分享");
          return;
        }
        flash("导入的战术数据无效");
      }
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const t = decodeTactic(raw);
        if (t) {
          setTactic(t);
          setFrameIndex(0);
        }
      }
    } catch {
      // ignore corrupted drafts
    }
  }, []);

  // autosave draft
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, encodeTactic(tactic));
    } catch {
      // storage full/blocked: sharing still works
    }
  }, [tactic]);

  const idx = Math.min(frameIndex, tactic.frames.length - 1);
  const frame = tactic.frames[idx];

  function updateFrame(i: number, fn: (f: Frame) => Frame) {
    setTactic((t) => ({ ...t, frames: t.frames.map((f, k) => (k === i ? fn(f) : f)) }));
  }

  function movePlayer(i: number, playerId: number, pos: PlayerPos) {
    updateFrame(i, (f) => ({
      ...f,
      players: f.players.map((p) => (p.id === playerId ? { ...pos, id: playerId } : p)),
    }));
  }
  function addPath(i: number, path: BallPath) {
    if (tactic.frames[i].paths.length >= MAX_PATHS_PER_FRAME) {
      flash(`本帧击球线已达上限（${MAX_PATHS_PER_FRAME} 条），可拆到下一帧`);
      return;
    }
    updateFrame(i, (f) => ({ ...f, paths: [...f.paths, path] }));
  }
  function deletePath(i: number, pathIndex: number) {
    updateFrame(i, (f) => ({ ...f, paths: f.paths.filter((_, k) => k !== pathIndex) }));
  }
  function deletePlayer(i: number, playerId: number) {
    if (tactic.frames[i].players.length <= 1) {
      flash("每帧至少要有一名球员");
      return;
    }
    updateFrame(i, (f) => ({ ...f, players: f.players.filter((p) => p.id !== playerId) }));
  }
  function addPlayer(side: "near" | "far") {
    if (frame.players.length >= MAX_PLAYERS) return;
    updateFrame(idx, (f) => ({ ...f, players: [...f.players, spawnPlayerPos(f.players, side)] }));
  }

  function addFrame(copyAll: boolean) {
    if (tactic.frames.length >= MAX_FRAMES) {
      flash(`帧数已达上限（${MAX_FRAMES} 帧）`);
      return;
    }
    setTactic((t) => {
      const cur = t.frames[idx];
      const nf: Frame = copyAll
        ? { players: cur.players.map((p) => ({ ...p })), paths: cur.paths.map((p) => ({ ...p })), note: cur.note }
        : { players: cur.players.map((p) => ({ ...p })), paths: [] };
      return { ...t, frames: [...t.frames.slice(0, idx + 1), nf, ...t.frames.slice(idx + 1)] };
    });
    setFrameIndex(idx + 1);
  }
  function deleteFrame(i: number) {
    if (tactic.frames.length <= 1) {
      flash("至少要保留一帧");
      return;
    }
    setTactic((t) => ({ ...t, frames: t.frames.filter((_, k) => k !== i) }));
    setFrameIndex(Math.min(i, tactic.frames.length - 2));
  }

  function share() {
    try {
      setShareUrl(tacticShareUrl(tactic));
      setCopied(false);
    } catch {
      flash("生成链接失败，请重试");
    }
  }
  async function copyUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      urlInputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
  }

  const activeMode = MODES.find((m) => m.key === mode)!;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-neutral-900 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3">
          <Link href="/" className="text-sm text-neutral-500 transition hover:text-emerald-400">
            ← 首页
          </Link>
          <input
            value={tactic.title}
            onChange={(e) => setTactic((t) => ({ ...t, title: e.target.value.slice(0, MAX_TITLE_LEN) }))}
            placeholder="给战术起个名字，例如：发球上网套路"
            className="min-w-40 flex-1 bg-transparent text-lg font-semibold text-neutral-100 outline-none placeholder:text-neutral-700"
          />
          <button
            onClick={() => setTemplateOpen(true)}
            className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200"
          >
            模板
          </button>
          <button
            onClick={() => {
              setTactic(demoTactic());
              setFrameIndex(0);
              flash("已载入示例战术，可以直接改");
            }}
            className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200"
          >
            示例
          </button>
          <button
            onClick={() => {
              if (window.confirm("清空当前战术，重新开始？")) {
                setTactic(defaultTactic());
                setFrameIndex(0);
              }
            }}
            className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200"
          >
            清空
          </button>
          <button
            onClick={() => setPreviewOpen(true)}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-emerald-600 hover:text-emerald-300"
          >
            ▶ 预览
          </button>
          <button
            onClick={share}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-neutral-950 shadow-lg shadow-emerald-900/50 transition hover:bg-emerald-400"
          >
            分享 →
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-neutral-800 bg-neutral-900/60 p-1">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  mode === m.key
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => addPlayer("near")}
            disabled={frame.players.length >= MAX_PLAYERS}
            className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300 transition hover:border-neutral-600 disabled:opacity-40"
          >
            + 近端球员
          </button>
          <button
            onClick={() => addPlayer("far")}
            disabled={frame.players.length >= MAX_PLAYERS}
            className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300 transition hover:border-neutral-600 disabled:opacity-40"
          >
            + 远端球员（{frame.players.length}/{MAX_PLAYERS}）
          </button>
          <span className="text-xs text-neutral-600">{activeMode.hint}</span>
        </div>

        {/* court theme picker (stored in the tactic, travels with the share link) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">球场主题</span>
          {Object.values(COURT_THEMES).map((t) => {
            const active = (tactic.theme ?? "classic") === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTactic((prev) => ({ ...prev, theme: t.key }))}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                  active
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full border border-black/40"
                  style={{ background: `linear-gradient(135deg, ${t.inner} 50%, ${t.outer} 50%)` }}
                />
                {t.name}
              </button>
            );
          })}
        </div>

        {/* court */}
        <div className="rounded-2xl border border-neutral-900 bg-neutral-950 p-3">
          <TacticCourt
            tactic={tactic}
            frameIndex={idx}
            mode={mode}
            onMovePlayer={movePlayer}
            onAddPath={addPath}
            onDeletePath={deletePath}
            onDeletePlayer={deletePlayer}
            height={560}
          />
        </div>

        {/* frame note */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-500">
            第 {idx + 1} 帧备注（学生播放到这一帧时会看到）
          </label>
          <textarea
            value={frame.note ?? ""}
            onChange={(e) => updateFrame(idx, (f) => ({ ...f, note: e.target.value.slice(0, MAX_NOTE_LEN) }))}
            rows={2}
            maxLength={MAX_NOTE_LEN}
            placeholder="例如：发球后立刻向前，回球压向对手反手位"
            className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200 outline-none placeholder:text-neutral-700 focus:border-emerald-700"
          />
        </div>

        {/* frame timeline */}
        <div className="space-y-2 rounded-2xl border border-neutral-900 bg-neutral-950 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">
              时间轴（{tactic.frames.length}/{MAX_FRAMES} 帧）· 新帧会承接当前站位
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => addFrame(false)}
                disabled={tactic.frames.length >= MAX_FRAMES}
                className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-300 transition hover:border-emerald-700 hover:text-emerald-300 disabled:opacity-40"
              >
                + 添加帧
              </button>
              <button
                onClick={() => addFrame(true)}
                disabled={tactic.frames.length >= MAX_FRAMES}
                className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-300 transition hover:border-emerald-700 hover:text-emerald-300 disabled:opacity-40"
              >
                复制本帧
              </button>
              <button
                onClick={() => deleteFrame(idx)}
                disabled={tactic.frames.length <= 1}
                className="rounded-lg border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-red-800 hover:text-red-400 disabled:opacity-40"
              >
                删除本帧
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tactic.frames.map((f, i) => (
              <button
                key={i}
                onClick={() => setFrameIndex(i)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                  i === idx
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                帧 {i + 1}
                {f.paths.length > 0 && <span className="ml-1 text-amber-300/80">{f.paths.length}线</span>}
                {f.note?.trim() && <span className="ml-1 text-emerald-500/70">注</span>}
              </button>
            ))}
          </div>
        </div>

        <p className="pb-4 text-center text-xs text-neutral-600">
          战术会自动保存在本机浏览器；「分享」生成的链接包含全部数据，无需登录、永久有效。
        </p>
      </main>

      {/* template picker modal */}
      {templateOpen && (
        <TemplatePicker
          onClose={() => setTemplateOpen(false)}
          onPick={(key) => {
            const tpl = templateByKey(key);
            if (tpl) {
              setTactic(tpl.build());
              setFrameIndex(0);
              flash(`已载入模板：${tpl.name}`);
            }
            setTemplateOpen(false);
          }}
        />
      )}

      {/* preview modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-100">
                学生视角预览{tactic.title.trim() ? `：${tactic.title}` : ""}
              </h3>
              <button
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg border border-neutral-800 px-3 py-1 text-xs text-neutral-400 hover:text-neutral-200"
              >
                关闭
              </button>
            </div>
            <TacticPlayer key={encodeTactic(tactic)} tactic={tactic} />
          </div>
        </div>
      )}

      {/* share modal */}
      {shareUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setShareUrl(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 font-semibold text-neutral-100">分享战术</h3>
            <p className="mb-3 text-xs leading-relaxed text-neutral-500">
              链接里包含全部战术数据。学生打开即可播放动画，无需登录、永久有效。
            </p>
            <div className="flex gap-2">
              <input
                ref={urlInputRef}
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none"
              />
              <button
                onClick={copyUrl}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  copied
                    ? "bg-emerald-600 text-neutral-50"
                    : "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
                }`}
              >
                {copied ? "已复制 ✓" : "复制"}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-emerald-600 hover:text-emerald-300"
              >
                打开学生视角 ↗
              </a>
              <span className="text-xs text-neutral-600">{shareUrl.length} 字符</span>
            </div>
            {shareUrl.length > 1800 && (
              <p className="mt-3 text-xs leading-relaxed text-amber-400">
                链接较长，部分聊天软件可能截断链接；建议让对面直接复制完整文本打开。
              </p>
            )}
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs text-neutral-200 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
