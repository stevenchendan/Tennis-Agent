"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { drills } from "@/lib/drills/catalog";
import { getFrame } from "@/lib/drills/motion";
import Court2D from "./Court2D";
import DrillNav from "./DrillNav";
import s from "./drills.module.css";
export default function DrillLibrary() {
  const params = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useOptimistic(params.get("q") || "");
  const [, startTransition] = useTransition();
  const category = params.get("category") || "all";
  const matches = drills.filter(d => (category === "all" || d.category === category) && `${d.title} ${d.tags.join(" ")} ${d.summary}`.toLowerCase().includes(query.toLowerCase()));
  function filter(key: string, value: string) { const next = new URLSearchParams(params.toString()); if (!value || value === "all") next.delete(key); else next.set(key, value); startTransition(() => { if (key === "q") setQuery(value); router.replace(`/drills${next.size ? `?${next}` : ""}`, { scroll: false }); }); }
  return <main className={s.shell} lang="en"><DrillNav /><header className={s.intro}><div><p className={s.eyebrow}>PRACTICE WITH PURPOSE</p><h1 className={s.heading}>Better patterns.<br /><span style={{ color: "#dff786" }}>Better tennis.</span></h1><p className={s.muted}>Explore the drill. See the movement. Take it to court.</p></div><span className={s.eyebrow}>THE DRILL LIBRARY / {drills.length.toString().padStart(3, "0")}</span></header>
    <div className={s.search}><input type="search" aria-label="Search drills" placeholder="Search by drill, skill or pattern…" value={query} onChange={e => filter("q", e.target.value)} /><select aria-label="Drill category" className={s.select} value={category} onChange={e => filter("category", e.target.value)}><option value="all">All categories</option><option value="singles">Singles</option><option value="doubles">Doubles</option></select></div>
    <p className={s.eyebrow} style={{ marginBottom: 20 }}>{matches.length} {matches.length === 1 ? "drill" : "drills"} / Animated in 2D & 3D</p><div className={s.grid}>{matches.map(d => <Link className={s.card} href={`/drills/${d.slug}`} key={d.id}><div className={s.thumbnail}><Court2D frame={getFrame(3.9)} /></div><div className={s.cardBody}><p className={s.eyebrow}>{d.category} / NTRP {d.level}</p><h2>{d.title}</h2><p className={s.muted}>{d.summary}</p><div className={s.pills}>{d.tags.slice(0, 3).map(t => <span className={s.pill} key={t}>{t}</span>)}</div><p style={{ color: "#dff786", marginTop: 24, fontSize: 13 }}>Explore drill ↗</p></div></Link>)}</div>
    {!matches.length && <div className={s.panel}><h2>No matching drills yet.</h2><p className={s.muted}>Try a different skill or reset your filters.</p><button className={s.button} onClick={() => router.replace("/drills")} style={{ marginTop: 15 }}>Clear filters</button></div>}
    <footer className={s.footer}>A growing collection of court-tested patterns. Start with the transition volley.</footer></main>;
}
