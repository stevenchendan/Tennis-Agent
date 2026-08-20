"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { JUNIOR_EVENTS, type EventImportance, type JuniorCategory } from "@/lib/junior-calendar";

const categories: Array<JuniorCategory | "All"> = ["All", "Championship", "J30", "J60", "J100", "J200", "J300", "J500", "JGS"];
const regions = ["All", "Australia/Oceania", "Asia", "Europe", "Americas", "Africa", "Global"];
const fmt = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function CalendarPage() {
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [region, setRegion] = useState("All");
  const [importance, setImportance] = useState<EventImportance | "all">("all");
  const events = useMemo(() => JUNIOR_EVENTS.filter((event) => (category === "All" || event.category === category) && (region === "All" || event.region === region) && (importance === "all" || event.importance === importance)), [category, region, importance]);

  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6">
    <header className="border-b border-white/10 pb-6"><Link href="/" className="text-xs uppercase tracking-[0.16em] text-neutral-500 hover:text-[#ff5a1f]">← Home</Link><p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#ff5a1f]">Junior competition desk</p><h1 className="mt-2 text-4xl font-bold tracking-tight text-white">Plan the season before it starts.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">ITF World Tennis Tour Juniors and important regional championships in one coach-friendly view. Dates are source-attributed and visibly marked when ITF has not confirmed them.</p></header>
    <section className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#191b19] p-3"><select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="rounded-lg border border-white/10 bg-[#101110] px-3 py-2 text-xs text-neutral-300">{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-lg border border-white/10 bg-[#101110] px-3 py-2 text-xs text-neutral-300">{regions.map((item) => <option key={item}>{item}</option>)}</select><div className="flex rounded-lg border border-white/10 p-1">{(["all", "important", "tour"] as const).map((item) => <button key={item} onClick={() => setImportance(item)} className={`rounded-md px-3 py-1.5 text-xs capitalize ${importance === item ? "bg-[#ff5a1f] text-white" : "text-neutral-400"}`}>{item}</button>)}</div></section>
    <section className="mt-6 space-y-3">{events.map((event) => <article key={event.id} className="rounded-2xl border border-white/10 bg-[#191b19] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${event.importance === "important" ? "bg-[#ff5a1f]/20 text-[#ff9b7a]" : "bg-white/10 text-neutral-400"}`}>{event.importance === "important" ? "Important" : event.category}</span>{event.dateStatus === "to-be-confirmed" && <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-wider text-amber-300">Dates TBC</span>}</div><h2 className="mt-3 text-xl font-semibold text-white">{event.name}</h2><p className="mt-1 text-sm text-neutral-400">{event.city}, {event.country} · {event.region} · {event.surface ?? "Surface TBC"}</p></div><div className="text-right"><p className="text-sm font-semibold text-white">{fmt(event.startDate)} — {fmt(event.endDate)}</p><p className="mt-1 text-xs text-neutral-500">Verified {fmt(event.lastVerified)}</p></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3"><p className="text-xs text-neutral-500">Source: official ITF Junior calendar</p><a href={event.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#ff9b7a] hover:text-white">Verify on ITF ↗</a></div></article>)}</section>
    {!events.length && <p className="mt-12 text-center text-sm text-neutral-500">No events match these filters.</p>}
    <p className="mt-8 text-center text-xs text-neutral-600">This is a planning aid, not an entry or eligibility guarantee. Always verify the official tournament page before booking travel.</p>
  </main>;
}
