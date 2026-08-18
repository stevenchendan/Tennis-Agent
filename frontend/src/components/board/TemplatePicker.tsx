"use client";

import { useMemo, useState } from "react";
import { findStrategies, STRATEGY_CATEGORIES } from "@/lib/strategies";

export default function TemplatePicker({
  onPick,
  onClose,
}: {
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const strategies = useMemo(
    () => findStrategies(query, category ? (category as Parameters<typeof findStrategies>[1]) : undefined),
    [query, category],
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-100">Strategy library</h3>
            <p className="mt-1 text-xs text-neutral-500">Choose a coach-ready pattern, then edit the frames for your player.</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-neutral-800 px-3 py-1 text-xs text-neutral-400 transition hover:text-neutral-200">Close</button>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search serve, return, forehand…"
            className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-emerald-700"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 outline-none">
            <option value="">All categories</option>
            {STRATEGY_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {strategies.map((strategy) => (
            <button key={strategy.id} onClick={() => onPick(strategy.id)} className="block rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-left transition hover:border-emerald-700 hover:bg-emerald-500/5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-neutral-100">{strategy.title}</div>
                <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">{strategy.category}</span>
              </div>
              <div className="mt-1 text-xs leading-relaxed text-neutral-500">{strategy.description}</div>
              <div className="mt-2 text-xs text-emerald-300/80">Trigger: {strategy.trigger}</div>
            </button>
          ))}
        </div>
        {strategies.length === 0 && <p className="py-8 text-center text-sm text-neutral-500">No strategies match that search.</p>}
      </div>
    </div>
  );
}
