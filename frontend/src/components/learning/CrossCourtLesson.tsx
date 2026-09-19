"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DrillNav from "@/components/drills/DrillNav";
import { lesson, levels, suggestion, type Level } from "@/lib/learning/cross-court";
import s from "./learning.module.css";

type Session = { level: Level; attempts: number; successes: number; date: string };
const storageKey = "tennis-lab:cross-court:sessions:v1";
const steps = ["Learn", "Decide", "Practise"] as const;
const cues = ["Read the incoming ball and find a balanced contact position.", "Send the ball through the diagonal target with room from the lines.", "Recover toward the likely reply and prepare as your partner strikes."];

function Court({ level, phase, overlays }: { level: Level; phase: number; overlays: boolean }) {
  const target = lesson.variants[level].target;
  return <div className={s.court}>
    <svg viewBox="0 0 100 145" role="img" aria-labelledby="learning-court-title learning-court-desc">
      <title id="learning-court-title">Cross-court pattern: {lesson.variants[level].label}</title>
      <desc id="learning-court-desc">Player 1 at the near right baseline returns diagonally toward player 2. A shaded target on the far left changes with level. The dashed blue arrow shows an illustrative recovery toward the centre.</desc>
      <defs><marker id="learn-shot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L10 5 L0 10" fill="#e4fa77" /></marker><marker id="learn-move" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L10 5 L0 10" fill="#8cdbff" /></marker></defs>
      <rect x="8" y="8" width="84" height="126" fill="#254d42" />
      <g stroke="#d7e4d8" strokeWidth=".5" fill="none"><rect x="8" y="8" width="84" height="126"/><path d="M18.5 8 V134 M81.5 8 V134 M18.5 37 H81.5 M18.5 105 H81.5 M50 37 V105"/></g>
      <path d="M4 71 H96" stroke="#fff" strokeWidth="1" />
      {overlays && <><rect {...target} fill="#dff786" opacity=".25" stroke="#dff786" strokeDasharray="2 1"/><text x={target.x + target.width / 2} y={target.y + target.height / 2 + 1} textAnchor="middle" fill="#fff" fontSize="3.5">TARGET</text></>}
      {phase === 0 ? <path d="M29 13 L75 123" stroke="#e4fa77" strokeWidth="1" markerEnd="url(#learn-shot)"/> : <path d="M75 123 L31 21" stroke="#e4fa77" strokeWidth="1" markerEnd="url(#learn-shot)"/>}
      {overlays && phase === 2 && <><path d="M73 127 Q63 133 54 127" fill="none" stroke="#8cdbff" strokeWidth="1" strokeDasharray="2 1" markerEnd="url(#learn-move)"/><circle cx="52" cy="127" r="5" fill="none" stroke="#8cdbff" strokeDasharray="1 1"/></>}
      <circle cx={phase === 2 ? 52 : 75} cy="127" r="4" fill="#dff786"/><text x={phase === 2 ? 52 : 75} y="128.4" textAnchor="middle" fontSize="4" fill="#142720">1</text>
      <circle cx="28" cy="11" r="4" fill="#a8caff"/><text x="28" y="12.4" textAnchor="middle" fontSize="4" fill="#142720">2</text>
      <circle cx={phase === 0 ? 66 : 37} cy={phase === 0 ? 104 : 35} r="1.7" fill="#fff"/>
    </svg>
    <div className={s.legend}><span>━ Yellow: ball direction</span>{overlays && <><span>┄ Blue: recovery</span><span>▧ Shaded: target</span></>}</div>
    <p className={s.muted} style={{ fontSize: 12 }}>Illustrative full-court pattern. Recovery varies with the possible reply. The advanced decision considers a separate short-ball situation.</p>
  </div>;
}

export default function CrossCourtLesson() {
  const [level, setLevel] = useState<Level>("beginner");
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState(0);
  const [overlays, setOverlays] = useState(true);
  const [answer, setAnswer] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const variant = lesson.variants[level];
  const successes = results.filter(Boolean).length;
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(saved)) setSessions(saved.filter((v): v is Session => v && levels.includes(v.level) && Number.isInteger(v.attempts) && v.attempts > 0 && Number.isInteger(v.successes) && v.successes >= 0 && v.successes <= v.attempts && typeof v.date === "string" && Number.isFinite(Date.parse(v.date))).slice(0, 20));
    } catch { setNotice("Device history is unavailable. You can still use the lesson and scorecard."); }
    setLoaded(true);
  }, []);
  function changeLevel(next: Level) {
    if (next === level) return;
    setLevel(next); setAnswer(null); setPhase(0); setResults([]); setNotice("");
  }
  function save() {
    if (!results.length || !loaded) return;
    const next = [{ level, attempts: results.length, successes, date: new Date().toISOString() }, ...sessions].slice(0, 20);
    setSessions(next); setResults([]);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setNotice("Session saved on this device."); }
    catch { setNotice("Session recorded for this visit only; device storage is unavailable."); }
  }
  return <main className={s.shell} lang="en"><DrillNav />
    <header className={s.header}><span className={s.eyebrow}>2D learning lab / 01 · Baseline</span><h1>{lesson.title}</h1><p className={s.muted}>{lesson.purpose}</p></header>
    <div className={s.row} aria-label="Skill difficulty">{levels.map(item => <button className={s.button} key={item} aria-pressed={item === level} disabled={results.length > 0 && item !== level} onClick={() => changeLevel(item)}>{lesson.variants[item].label}</button>)}</div>
    <p className={s.muted}>Choose your level for this skill. {results.length ? "Save or clear the current scorecard to change levels." : "You can change it at any time before logging attempts."}</p>
    <nav className={s.tabs} aria-label="Lesson stages">{steps.map((name, i) => <button className={s.button} key={name} aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}</nav>
    <div className={s.workspace}><div><Court level={level} phase={phase} overlays={overlays}/><label className={s.row} style={{ marginTop: 14 }}><input type="checkbox" checked={overlays} onChange={e => setOverlays(e.target.checked)}/> Show target and recovery guides</label></div>
      <section className={s.panel} aria-label={`${steps[step]}: ${variant.label}`}>
        {step === 0 && <><span className={s.eyebrow}>Understand the pattern</span><h2>{variant.goal}</h2><p>{variant.cue}</p><div className={s.row}>{["Read", "Hit", "Recover"].map((name, i) => <button key={name} className={s.button} aria-pressed={phase === i} onClick={() => setPhase(i)}>{i + 1}. {name}</button>)}</div><p className={s.feedback} aria-live="polite">{cues[phase]}</p><p className={s.muted}>Step through the pattern at your own pace. Yellow shows the shot; the dashed blue guide shows movement.</p><button className={s.button} onClick={() => { setStep(1); setPhase(0); }}>Try a decision →</button></>}
        {step === 1 && <><span className={s.eyebrow}>Read the situation</span><h2>{variant.question}</h2>{variant.options.map((option, i) => <button className={s.choice} key={option} aria-pressed={answer === i} onClick={() => setAnswer(i)}>{option}</button>)}{answer !== null && <div className={s.feedback} role="status">{variant.feedback[answer]}</div>}<p className={s.muted}>Try each option to compare the reasoning. This is a learning exercise, not a player rating.</p><button className={s.button} onClick={() => { setStep(2); setPhase(1); }}>Practise this pattern →</button></>}
        {step === 2 && <><span className={s.eyebrow}>Take it to court / about 10 minutes</span><h2>Cross-court practice</h2><h3>Set up</h3><p>{variant.setup}</p><h3>Score your block</h3><p>{variant.scoring}</p><h3>Make it manageable</h3><p className={s.muted}>{variant.adaptation}</p><div className={s.stats} aria-live="polite">{successes} / {results.length} successful attempts</div><div className={s.row}><button className={s.button} onClick={() => { setResults([...results, true]); setNotice(""); }}>+ Success</button><button className={s.button} onClick={() => { setResults([...results, false]); setNotice(""); }}>+ Miss / reset</button><button className={s.button} disabled={!results.length} onClick={() => setResults(results.slice(0, -1))}>Undo</button></div><p className={s.feedback}>{suggestion(level, results.length, successes)}</p><div className={s.row}><button className={s.button} disabled={!results.length || !loaded} onClick={save}>Save session</button><button className={s.button} disabled={!results.length} onClick={() => setResults([])}>Clear scorecard</button></div><p className={s.muted} style={{ fontSize: 12 }}>Suggestions use simple practice thresholds, not a validated ability assessment. Unsaved attempts are lost when you leave.</p></>}
      </section>
    </div>
    <section className={s.history}><h2>Your cross-court practice</h2><p role="status">{notice}</p>{sessions.filter(item => item.level === level).length ? <ul>{sessions.filter(item => item.level === level).map((item, i) => <li key={`${item.date}-${i}`}>{new Date(item.date).toLocaleDateString()} · {lesson.variants[item.level].label} · {item.successes}/{item.attempts} successful attempts</li>)}</ul> : <p className={s.muted}>No saved sessions for {variant.label.toLowerCase()} yet. Complete a practice block to start your history.</p>}<p className={s.muted}>The latest 20 sessions are kept on this browser only.</p></section>
    <footer className={s.footer}><p>{lesson.review}</p><div className={s.row}><Link href="/board">Explore the tactics board ↗</Link><Link href="/drills">Browse animated drills ↗</Link></div></footer>
  </main>;
}
