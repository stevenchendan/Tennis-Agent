"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function ageBand(age: number): string {
  if (age < 10) return "Under 10";
  if (age < 12) return "12-and-under pathway";
  if (age < 14) return "14-and-under pathway";
  if (age < 16) return "16-and-under pathway";
  if (age < 19) return "18-and-under pathway";
  return "Adult / open pathway";
}

export default function BenchmarkPage() {
  const [age, setAge] = useState(14);
  useEffect(() => { const saved = Number(localStorage.getItem("tennis-agent-benchmark-age")); if (saved >= 4 && saved <= 30) setAge(saved); }, []);
  function updateAge(value: number) { setAge(value); localStorage.setItem("tennis-agent-benchmark-age", String(value)); }
  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6"><Link href="/" className="text-xs uppercase tracking-[0.16em] text-neutral-500 hover:text-[#ff5a1f]">← Home</Link><p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[#ff5a1f]">High-performance benchmark</p><h1 className="mt-2 text-4xl font-bold tracking-tight text-white">Use verified evidence, never a guessed number.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">Tell us the player’s age so we can explain the correct comparison group. Age changes the context, not the rating: we will never infer a UTR number from age.</p><section className="mt-8 rounded-2xl border border-white/10 bg-[#191b19] p-5"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Player age</label><div className="mt-3 flex items-center gap-4"><input type="number" min={4} max={30} value={age} onChange={(e) => updateAge(Number(e.target.value))} className="w-28 rounded-xl border border-white/10 bg-[#101110] px-4 py-3 text-2xl font-semibold text-white outline-none focus:border-[#ff5a1f]" /><div><p className="text-sm font-semibold text-white">{ageBand(age)}</p><p className="mt-1 text-xs text-neutral-500">This is a context label only. It is not an eligibility decision.</p></div></div></section><section className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5"><p className="text-sm font-semibold text-amber-200">UTR connection required to show position</p><p className="mt-2 text-sm leading-6 text-amber-100/70">For a {age}-year-old player, we can identify the correct age context now. We cannot say where the player sits in that group until an authorized UTR rating is available. No estimate is shown.</p></section><section className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-[#191b19] p-5"><p className="text-xs uppercase tracking-wider text-neutral-500">Coach view</p><p className="mt-2 text-sm leading-6 text-neutral-300">When authorized: verified rating, age-band context, singles/doubles, as-of date, freshness, and trend history.</p></div><div className="rounded-2xl border border-white/10 bg-[#191b19] p-5"><p className="text-xs uppercase tracking-wider text-neutral-500">Player view</p><p className="mt-2 text-sm leading-6 text-neutral-300">When authorized: a plain-language explanation of the rating and the official source behind it.</p></div></section><div className="mt-8 border-t border-white/10 pt-5"><p className="text-xs leading-5 text-neutral-600">UTR Engage API access requires an approved developer application, OAuth consent, and compliance with UTR terms. We will not scrape, bulk-download, cache beyond permitted rules, or generate UTR-like ratings.</p><a href="https://www.utrsports.net/pages/engage-api" target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-[#ff9b7a] hover:text-white">Read UTR Engage API requirements ↗</a></div></main>;
}
