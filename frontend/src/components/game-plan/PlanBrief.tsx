"use client";
import Link from "next/link";
import { useState } from "react";
import { readiness, situations, type Plan } from "@/lib/match-plan";
import { playingStyles, styleTactic } from "@/lib/playing-styles";
import { encodeTactic } from "@/lib/tactic";
import TacticCourt from "@/components/board/TacticCourt";
import s from "./plan.module.css";

export default function PlanBrief({ plan, compact = false }: { plan: Plan; compact?: boolean }) {
  const [checks, setChecks] = useState<string[]>([]);
  const missing = readiness(plan);
  return <article className={s.brief} aria-label="Player game-plan briefing">
    <header className={s.briefHeader}><p className={s.eyebrow}>{missing.length ? "Draft brief" : "Match brief"} · {plan.surface}</p><h2>{plan.title || "Untitled game plan"}</h2><p>{plan.player || "Player to be added"}{plan.opponent ? ` vs ${plan.opponent}` : " · Opponent to be confirmed"}{plan.date ? ` · ${plan.date}` : ""}</p>{plan.author && <p className={s.muted}>Prepared by {plan.author}</p>}<p className={s.objective}>{plan.objective || "Add the one outcome you want to focus on."}</p></header>
    {missing.length > 0 && <p className={s.notice}>This draft has {missing.length} incomplete {missing.length === 1 ? "section" : "sections"}. Confirm the missing details before using it.</p>}
    <section className={s.prioritySection}><p className={s.eyebrow}>Your three priorities</p><ol className={s.priorities}>{plan.priorities.map((priority, i) => <li key={i}><span>0{i + 1}</span><strong>{priority || "Priority not set"}</strong></li>)}</ol></section>
    <section className={s.situationGrid} aria-label="Situation plans">{situations.map(key => <div className={s.situation} key={key}><p className={s.eyebrow}>{key === "serve" ? "01 / My serve" : key === "return" ? "02 / My return" : "03 / In the rally"}</p><h3>Plan A</h3><p>{plan.situations[key].primary || "Not set"}</p><div className={s.fallback}><h4>If…</h4><p>{plan.situations[key].trigger || "Switch trigger not set"}</p><h4>Then…</h4><p>{plan.situations[key].fallback || "Plan B not set"}</p></div></div>)}</section>
    <section className={s.reset}><p className={s.eyebrow}>Between points / one cue</p><p>{plan.reset || "Reset cue not set"}</p></section>
    {!compact && <>
      {(plan.observations || plan.message) && <section className={s.twoColumns}>{plan.observations && <div className={s.panel}><h3>What we know about the opponent</h3><p className={s.tag}>{plan.evidence}</p><p>{plan.observations}</p><p className={s.muted}>Check this against what happens early in the match.</p></div>}{plan.message && <div className={s.panel}><h3>Message to the player</h3><p>{plan.message}</p></div>}</section>}
      <section className={s.panel}><p className={s.eyebrow}>Before you play</p><h3>Rehearse the plan</h3><p>{plan.preparation || "Review your priorities and rehearse the first pattern before the match."}</p><div className={`no-print ${s.checklist}`}>{["I can explain my three priorities", "I know when to switch to Plan B", "I have rehearsed my reset cue"].map(label => <label key={label}><input type="checkbox" checked={checks.includes(label)} onChange={e => setChecks(e.target.checked ? [...checks, label] : checks.filter(item => item !== label))}/>{label}</label>)}</div><p className={`no-print ${s.small}`}>Personal checklist for this visit. It does not notify your coach.</p></section>
      {!!plan.attachments.length && <section><h3 className={s.sectionTitle}>Watch the pattern before you practise</h3><div className={s.attachments}>{plan.attachments.map(id => { const style = playingStyles.find(item => item.id === id); if (!style) return null; const tactic = styleTactic(style); return <div className={s.attachment} key={id}><TacticCourt tactic={tactic} frameIndex={0} height={180}/><h4>{style.name}</h4><p>{style.tagline}</p><Link className="no-print" href={`/t/${encodeTactic(tactic)}`} target="_blank" rel="noreferrer">Watch 2D / 3D pattern ↗</Link><p className={s.small}>Illustrative position sequence.</p></div>; })}</div></section>}
    </>}
    <footer className={s.briefFooter}>Plan snapshot · Updated {plan.updatedAt.slice(0, 10)} · Review the plan with the player; adapt it to their skills and match conditions.</footer>
  </article>;
}
