"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { emptyMatch, summarizeMatch, type MatchTrackerState, type PointResult, type TrackingDepth } from "@/lib/match-tracker";

const STORAGE_KEY = "tennis-agent-match-v1";
const depthCopy: Record<TrackingDepth, string> = {
  basic: "Score only — two large buttons for live use.",
  intermediate: "Add point outcome and serve context.",
  advanced: "Add rally length for coach-grade review.",
};

export default function MatchPage() {
  const [match, setMatch] = useState<MatchTrackerState>(emptyMatch);
  const [saved, setSaved] = useState(false);
  useEffect(() => { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setMatch(JSON.parse(raw)); } catch { /* ignore */ } }, []);
  const summary = useMemo(() => summarizeMatch(match), [match]);
  function update(patch: Partial<MatchTrackerState>) { setMatch((current) => ({ ...current, ...patch })); setSaved(false); }
  function addPoint(winner: PointResult) {
    const point = { id: crypto.randomUUID(), winner, server: match.server, kind: "rally" as const, outcome: "other" as const, createdAt: new Date().toISOString() };
    setMatch((current) => ({ ...current, points: [...current.points, point] })); setSaved(false);
  }
  function undo() { setMatch((current) => ({ ...current, points: current.points.slice(0, -1) })); setSaved(false); }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(match)); setSaved(true); }

  return <main className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-6">
    <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-5">
      <div><Link href="/" className="text-xs uppercase tracking-[0.16em] text-neutral-500 hover:text-[#ff5a1f]">← Home</Link><p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#ff5a1f]">Live match desk</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Track the match. Keep the evidence.</h1></div>
      <button onClick={save} className="rounded-lg bg-[#ff5a1f] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">{saved ? "Saved" : "Save match"}</button>
    </header>
    <section className="grid gap-4 sm:grid-cols-2">
      <label className="surface-card rounded-2xl border p-4 text-xs uppercase tracking-wide text-neutral-500">Player 1<input value={match.playerOne} onChange={(e) => update({ playerOne: e.target.value })} className="mt-2 w-full bg-transparent text-lg font-semibold normal-case tracking-normal text-white outline-none" /></label>
      <label className="surface-card rounded-2xl border p-4 text-xs uppercase tracking-wide text-neutral-500">Player 2<input value={match.playerTwo} onChange={(e) => update({ playerTwo: e.target.value })} className="mt-2 w-full bg-transparent text-lg font-semibold normal-case tracking-normal text-white outline-none" /></label>
    </section>
    <section className="mt-4 surface-card rounded-2xl border p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Tracking depth</p><p className="mt-1 text-sm text-neutral-300">Choose the detail you can realistically capture on court.</p></div><div className="flex rounded-xl border border-white/10 p-1">{(["basic", "intermediate", "advanced"] as TrackingDepth[]).map((depth) => <button key={depth} onClick={() => update({ depth })} className={`rounded-lg px-3 py-2 text-xs capitalize ${match.depth === depth ? "bg-[#ff5a1f] text-white" : "text-neutral-400"}`}>{depth}</button>)}</div></div><p className="text-xs text-neutral-500">{depthCopy[match.depth]}</p></section>
    <section className="mt-4 grid gap-4 sm:grid-cols-2"><button onClick={() => addPoint("p1")} className="rounded-2xl bg-white p-8 text-left text-[#101110] transition hover:bg-[#ffede7]"><span className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">Point winner</span><strong className="mt-3 block text-2xl">{match.playerOne}</strong><span className="mt-2 block text-sm text-neutral-500">Tap after every point</span></button><button onClick={() => addPoint("p2")} className="rounded-2xl bg-[#ff5a1f] p-8 text-left text-white transition hover:bg-[#ff7040]"><span className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Point winner</span><strong className="mt-3 block text-2xl">{match.playerTwo}</strong><span className="mt-2 block text-sm text-white/70">Tap after every point</span></button></section>
    <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{[["Points", `${summary.points[0]} — ${summary.points[1]}`],["Winners", `${summary.winners[0]} — ${summary.winners[1]}`],["Errors", `${summary.errors[0]} — ${summary.errors[1]}`],["Avg rally", summary.averageRally ? `${summary.averageRally}` : "—"],["Server", match.server === 1 ? match.playerOne : match.playerTwo]].map(([label, value]) => <div key={label} className="surface-card rounded-xl border p-3"><p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p><p className="mt-2 truncate text-sm font-semibold text-white">{value}</p></div>)}</section>
    <section className="mt-6 flex items-center justify-between border-t border-white/10 pt-4"><p className="text-xs text-neutral-500">{match.points.length} points captured locally. Your next step: annotate the decisive patterns in the tactics board.</p><button onClick={undo} disabled={!match.points.length} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-neutral-400 disabled:opacity-40">Undo last point</button></section>
  </main>;
}
