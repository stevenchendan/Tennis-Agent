"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DrillNav from "@/components/drills/DrillNav";
import { emptyPlan, starterPlan, encodePlan, parsePlan, PLAN_STORAGE, readPlans, readiness, situations, type Plan } from "@/lib/match-plan";
import { playingStyles } from "@/lib/playing-styles";
import PlanBrief from "./PlanBrief";
import s from "./plan.module.css";

function Field({ label, value, onChange, placeholder = "", max = 400, single = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; max?: number; single?: boolean; type?: string }) {
  return <label className={s.field}><span>{label}</span>{single ? <input type={type} maxLength={max} value={value} onInput={e => { if (type === "date") onChange(e.currentTarget.value); }} onChange={e => onChange(e.target.value)} placeholder={placeholder}/> : <textarea rows={3} maxLength={max} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>}</label>;
}
export default function GamePlanWorkspace() {
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [savedPlans, setSavedPlans] = useState<Plan[]>([]);
  const [baseline, setBaseline] = useState("");
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<"Prepare" | "Player brief" | "Share">("Prepare");
  const [compact, setCompact] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [localPreview, setLocalPreview] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = ready && JSON.stringify(plan) !== baseline;
  const missing = readiness(plan);
  useEffect(() => {
    try {
      const plans = readPlans(localStorage.getItem(PLAN_STORAGE));
      setSavedPlans(plans);
      const initial = plans[0] ?? emptyPlan();
      setPlan(initial); setBaseline(JSON.stringify(initial));
    } catch { setNotice("Saved plans could not be read. Export your work before leaving if device storage is unavailable."); const initial = emptyPlan(); setPlan(initial); setBaseline(JSON.stringify(initial)); }
    setLocalPreview(["localhost", "127.0.0.1", "::1", "[::1]"].includes(window.location.hostname));
    setReady(true);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update(patch: Partial<Plan>) { setPlan(current => ({ ...current, ...patch })); setShareUrl(""); setNotice(""); }
  function load(next: Plan) { setPlan(next); setBaseline(JSON.stringify(next)); setShareUrl(""); setNotice(""); setStage("Prepare"); }
  function save() {
    if (!ready) return;
    if (savedPlans.length >= 20 && !savedPlans.some(item => item.id === plan.id)) { setNotice("This browser holds 20 plans. Export this plan as a file to keep it; existing plans have not been removed."); return; }
    const next = parsePlan({ ...plan, updatedAt: new Date().toISOString() });
    if (!next) { setNotice("Some fields are invalid. Check the date and field lengths before saving."); return; }
    const plans = [next, ...savedPlans.filter(item => item.id !== next.id)];
    try { localStorage.setItem(PLAN_STORAGE, JSON.stringify(plans)); setSavedPlans(plans); setPlan(next); setBaseline(JSON.stringify(next)); setShareUrl(""); setNotice("Saved on this browser. Export a file for a portable backup."); }
    catch { setNotice("Could not save to this browser. Your edits are still here; export a plan file before leaving."); }
  }
  function exportFile() {
    const clean = parsePlan({ ...plan, updatedAt: new Date().toISOString() });
    if (!clean) { setNotice("Check the plan fields before exporting."); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `tennis-game-plan-${clean.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Plan file prepared. Import it into Game plans on another device to continue.");
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 50000) { setNotice("Plan files must be smaller than 50 KB."); return; }
    try {
      const imported = parsePlan(JSON.parse(await file.text()));
      if (!imported) throw new Error("invalid");
      const copy = { ...imported, id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
      load(copy); setBaseline(""); setNotice("Imported as a new draft. Save it to keep it on this browser.");
    } catch { setNotice("This file is not a supported game plan. Your current plan has not changed."); }
  }
  async function share() {
    try {
      const snapshot = { ...plan, updatedAt: new Date().toISOString() };
      const url = `${window.location.origin}/game-plan/view#plan=${encodePlan(snapshot)}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); setNotice("Snapshot link copied. Choose how to send it to your player."); }
      catch { setNotice("Snapshot ready. Copy the link from the field below."); }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not prepare the link."); }
  }
  return <main className={s.shell} lang="en"><div className="no-print"><DrillNav/></div>
    <header className={`${s.header} no-print`}><div><p className={s.eyebrow}>Coach desk / Player preparation</p><h1>A clear plan.<br/><span>A confident player.</span></h1><p className={s.muted}>Prepare the decisions together. Give the player a brief they can use when you are off court.</p></div><div className={s.headerCard}><span>THE MATCH-DAY STANDARD</span><strong>3 priorities. 1 reset cue.</strong><p>Know your first choice. Know when to change it.</p></div></header>
    <div className={s.workspace}>
      <aside className={`${s.sidebar} no-print`}><p className={s.eyebrow}>Your plan library</p><h2>Saved on this device</h2><div className={s.row}><button className={s.button} disabled={!ready || dirty} onClick={() => load(emptyPlan())}>+ New plan</button><button className={s.button} disabled={!ready || dirty} onClick={() => { load(starterPlan()); setBaseline(""); }}>Use starter</button></div><p className={s.small}>{dirty ? "Save your changes before opening or importing another plan." : "Choose a saved plan, start from scratch or adapt the starter."}</p><div className={s.library}>{savedPlans.map(item => <button className={s.libraryItem} key={item.id} disabled={dirty} aria-current={plan.id === item.id ? "true" : undefined} onClick={() => load(item)}><strong>{item.title || "Untitled plan"}</strong><span>{item.player || "Player not set"} · {item.date || "No match date"}</span></button>)}</div>{!savedPlans.length && <p className={s.empty}>Your first saved plan will appear here.</p>}<button className={s.button} disabled={!ready || dirty} onClick={() => fileInput.current?.click()}>Import plan file</button><input ref={fileInput} type="file" accept="application/json,.json" hidden aria-label="Import plan file" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }}/><p className={s.small}>Up to 20 plans. Browser storage is not account sync.</p><Link href="/playing-styles">Explore playing styles ↗</Link></aside>
      <div className={s.main}>
        <div className={`${s.topbar} no-print`}><nav className={s.row} aria-label="Game plan workflow">{(["Prepare", "Player brief", "Share"] as const).map((name, i) => <button className={s.tab} aria-current={stage === name ? "step" : undefined} key={name} onClick={() => setStage(name)}>{i + 1}. {name}</button>)}</nav><div className={s.row}><span className={s.small}>{!ready ? "Loading…" : dirty ? "Unsaved changes" : savedPlans.some(p => p.id === plan.id) ? "Saved locally" : "New draft"}</span><button className={s.primary} disabled={!ready} onClick={save}>Save plan</button></div></div>
        <p className={`${s.status} no-print`} role="status">{notice}</p>
        {stage === "Prepare" && <div className="no-print">
          <section className={s.panel}><div className={s.sectionHeading}><span className={s.number}>01</span><div><h2>Set the match context</h2><p>One player, one match, one clear objective.</p></div></div><div className={s.twoColumns}><Field single label="Plan title" max={100} value={plan.title} onChange={title => update({ title })} placeholder="Saturday singles · build with margin"/><Field single label="Player name" max={80} value={plan.player} onChange={player => update({ player })} placeholder="Who is this plan for?"/><Field single label="Prepared by (coach or player)" max={80} value={plan.author} onChange={author => update({ author })}/><Field single label="Opponent (optional)" max={80} value={plan.opponent} onChange={opponent => update({ opponent })} placeholder="Name or unknown"/><Field single type="date" label="Match date" value={plan.date} onChange={date => update({ date })}/><label className={s.field}><span>Surface</span><select value={plan.surface} onChange={e => update({ surface: e.target.value })}>{["Hard", "Clay", "Grass", "Indoor", "Other"].map(value => <option key={value}>{value}</option>)}</select></label></div><Field label="Match objective" value={plan.objective} onChange={objective => update({ objective })} placeholder="Describe a controllable behaviour, not only the result."/></section>
          <section className={s.panel}><div className={s.sectionHeading}><span className={s.number}>02</span><div><h2>Keep the player focused</h2><p>Three short priorities they can remember between points.</p></div></div>{plan.priorities.map((priority, i) => <Field single max={180} key={i} label={`Priority ${i + 1}`} value={priority} onChange={value => { const priorities = [...plan.priorities] as Plan["priorities"]; priorities[i] = value; update({ priorities }); }}/>)}</section>
          <section className={s.panel}><div className={s.sectionHeading}><span className={s.number}>03</span><div><h2>Plan the decisions</h2><p>Write the first choice, the signal to switch and a useful fallback.</p></div></div>{situations.map(key => <fieldset className={s.situationEditor} key={key}><legend>{key === "serve" ? "When I serve" : key === "return" ? "When I return" : "During the rally"}</legend><Field label={`${key} · Plan A`} value={plan.situations[key].primary} onChange={primary => update({ situations: { ...plan.situations, [key]: { ...plan.situations[key], primary } } })}/><div className={s.twoColumns}><Field label={`${key} · Switch when…`} value={plan.situations[key].trigger} onChange={trigger => update({ situations: { ...plan.situations, [key]: { ...plan.situations[key], trigger } } })}/><Field label={`${key} · Plan B`} value={plan.situations[key].fallback} onChange={fallback => update({ situations: { ...plan.situations, [key]: { ...plan.situations[key], fallback } } })}/></div></fieldset>)}</section>
          <section className={s.panel}><div className={s.sectionHeading}><span className={s.number}>04</span><div><h2>Add context and rehearsal</h2><p>All notes here are included in the player brief and shared snapshot.</p></div></div><Field label="Opponent observations" value={plan.observations} onChange={observations => update({ observations })} placeholder="What did you observe? What still needs checking?"/><label className={s.field}><span>Observation source</span><select value={plan.evidence} onChange={e => update({ evidence: e.target.value as Plan["evidence"] })}>{["Unconfirmed", "Player report", "Coach observation", "Video review"].map(value => <option key={value}>{value}</option>)}</select></label><Field label="Between-point reset cue" value={plan.reset} onChange={reset => update({ reset })}/><Field label="Warm-up and rehearsal" value={plan.preparation} onChange={preparation => update({ preparation })}/><Field label="Message to the player" value={plan.message} onChange={message => update({ message })}/><h3>Attach visual patterns · {plan.attachments.length}/3</h3><p className={s.small}>Select examples to discuss; they are illustrative patterns, not personalised predictions.</p><div className={s.patterns}>{playingStyles.map(style => <label key={style.id}><input type="checkbox" checked={plan.attachments.includes(style.id)} disabled={!plan.attachments.includes(style.id) && plan.attachments.length >= 3} onChange={e => update({ attachments: e.target.checked ? [...plan.attachments, style.id] : plan.attachments.filter(id => id !== style.id) })}/><span>{style.name}<small>{style.tagline}</small></span></label>)}</div></section><button className={s.primary} onClick={() => setStage("Player brief")}>Review the player brief →</button>
        </div>}
        {stage === "Player brief" && <><div className={`${s.row} ${s.previewTools} no-print`}><button className={s.button} aria-pressed={compact} onClick={() => setCompact(!compact)}>{compact ? "Show full brief" : "Courtside essentials"}</button><button className={s.button} onClick={() => window.print()}>Print / Save PDF</button></div><PlanBrief key={plan.id} plan={plan} compact={compact}/></>}
        {stage === "Share" && <section className={`${s.panel} no-print`}><p className={s.eyebrow}>Player handoff</p><h2>Review, then share a snapshot</h2><p>Includes the player and author names, match details, priorities, situation plans, observations, message and selected visual patterns.</p><div className={s.shareSummary}><strong>{plan.title || "Untitled plan"}</strong><span>{plan.player || "Player not set"} · {plan.attachments.length} visual patterns</span><button className={s.button} onClick={() => setStage("Player brief")}>Preview included content</button></div>{missing.length ? <div className={s.notice}><h3>Complete these before sharing</h3><ul>{missing.map(item => <li key={item}>{item}</li>)}</ul><button className={s.button} onClick={() => setStage("Prepare")}>Finish the plan</button></div> : <p className={s.ready}>Brief complete · ready for your review and handoff</p>}<p>Anyone with this link can read its contents. It is a fixed copy: later edits require a new link. No student notification or read receipt is sent.</p>{localPreview && <p className={s.notice}>You are using a local preview. Its links work on this computer only. To send across devices, export the plan file and import it into a reachable copy of this platform, or share a printed PDF.</p>}<div className={s.row}><button className={s.primary} disabled={missing.length > 0 || !ready} onClick={() => void share()}>Copy snapshot link</button><button className={s.button} onClick={exportFile}>Export plan file</button></div>{shareUrl && <div className={s.shareLink}><label className={s.field}><span>Snapshot link · select to copy manually</span><textarea readOnly value={shareUrl} onFocus={e => e.target.select()}/></label><a className={s.button} href={shareUrl} target="_blank" rel="noreferrer">Open player snapshot ↗</a></div>}<p className={s.small}>Export also works for unfinished drafts. Imported files become new drafts so existing plans are preserved.</p></section>}
      </div>
    </div>
  </main>;
}
