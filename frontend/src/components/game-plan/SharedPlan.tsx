"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { decodePlan, PLAN_STORAGE, readPlans, type Plan } from "@/lib/match-plan";
import PlanBrief from "./PlanBrief";
import s from "./plan.module.css";

export default function SharedPlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [compact, setCompact] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter();
  useEffect(() => {
    const read = () => { setPlan(window.location.hash.startsWith("#plan=") ? decodePlan(window.location.hash.slice(6)) : null); setLoaded(true); setNotice(""); };
    read(); window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  function saveCopy() {
    if (!plan) return;
    try {
      const plans = readPlans(localStorage.getItem(PLAN_STORAGE));
      if (plans.length >= 20) { setNotice("This browser already holds 20 plans. Print this brief to keep a copy."); return; }
      const copy = { ...plan, id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
      localStorage.setItem(PLAN_STORAGE, JSON.stringify([copy, ...plans]));
      router.push("/game-plan");
    } catch { setNotice("Could not save an editable copy on this device. You can still read or print the brief."); }
  }
  return <main className={`${s.shell} ${s.sharedShell}`} lang="en"><header className={`${s.sharedHeader} no-print`}><Link href="/game-plan">TENNIS / GAME PLAN</Link><span>PLAYER SNAPSHOT</span></header>{!loaded ? <p role="status">Opening your match brief…</p> : !plan ? <section className={s.panel}><h1>This plan link is incomplete or invalid</h1><p>Ask the sender for the complete snapshot link, including everything after #plan=. You can also import an exported plan file in the workspace.</p><Link className={s.primary} href="/game-plan">Open Game plans</Link></section> : <><div className={`${s.panel} no-print`}><p>This is a fixed copy of the plan. Later coach edits will arrive as a new link. Opening this brief does not notify the sender.</p><div className={s.row}><button className={s.button} aria-pressed={compact} onClick={() => setCompact(!compact)}>{compact ? "Show full brief" : "Courtside essentials"}</button><button className={s.button} onClick={() => window.print()}>Print / Save PDF</button><button className={s.button} onClick={saveCopy}>Save my editable copy</button></div><p role="status">{notice}</p></div><PlanBrief key={`${plan.id}-${plan.updatedAt}`} plan={plan} compact={compact}/></>}</main>;
}
