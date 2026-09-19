"use client";
import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Drill } from "@/lib/drills/catalog";
import { DURATION, getFrame, phases, phaseTimes, lessonUrl, type Outcome } from "@/lib/drills/motion";
import { movementLabel, techniqueForStroke, techniqueLibrary, type TechniqueId } from "@/lib/tennis-motion";
import Court2D from "./Court2D";
import DrillNav from "./DrillNav";
import s from "./drills.module.css";
const Court3D = dynamic(() => import("./Court3D"), { ssr: false, loading: () => <p className={s.panel}>Loading 3D court…</p> });
class CourtBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className={s.panel}>3D is unavailable on this device. Choose 2D to keep exploring the drill.</p> : this.props.children; }
}

export default function DrillPlayer({ drill }: { drill: Drill }) {
  const [view, setView] = useState<"2D" | "3D" | "Split">("3D");
  const [presenting, setPresenting] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [outcome, setOutcome] = useState<Outcome>("rally");
  const [moonball, setMoonball] = useState(false);
  const [techniquePreview, setTechniquePreview] = useState<{ label: string; start: number; end: number } | null>(null);
  useEffect(() => {
    if (!presenting) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setPresenting(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", escape); };
  }, [presenting]);
  useEffect(() => {
    if (!playing) return;
    let id = 0, last = 0;
    const tick = (now: number) => {
      const delta = last ? Math.min((now - last) / 1000, .1) : 0;
      last = now;
      setTime(t => {
        const next = t + delta * speed;
        if (techniquePreview && next >= techniquePreview.end) return techniquePreview.start;
        return loop ? next % DURATION : Math.min(DURATION, next);
      });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, speed, loop, techniquePreview]);
  useEffect(() => { if (time === DURATION && !loop) setPlaying(false); }, [time, loop]);
  const frame = getFrame(time, outcome, moonball);
  function play() {
    if (techniquePreview) { setTechniquePreview(null); setTime(0); setPlaying(true); return; }
    if (time >= DURATION) setTime(0);
    setPlaying(!playing);
  }
  function previewTechnique(label: string, contact: number, scenario: Outcome, before: number, after: number, previewRound = frame.round) {
    const offset = previewRound * 16;
    setOutcome(scenario); setTechniquePreview({ label, start: offset + contact - before, end: offset + contact + after });
    setTime(offset + contact - before); setSpeed(.5); setPlaying(true); setView("3D");
  }
  function previewUnit(id: TechniqueId, contact: number, scenario: Outcome, previewRound = frame.round) {
    const unit = techniqueLibrary[id];
    previewTechnique(`P${id === "forehand-groundstroke" ? "2" : "1"} ${unit.label.toLowerCase()}`, contact, scenario, unit.window.beforeContact, unit.window.afterContact, previewRound);
  }
  return <main className={s.shell} lang="en"><DrillNav />
    <header className={s.intro}><div><Link href="/drills" className={s.eyebrow}>← Drill library / Singles / 020</Link><h1 className={s.heading}>{drill.title}</h1><p className={s.muted}>{drill.summary}</p><div className={s.pills}><span className={s.pill}>NTRP {drill.level}</span><span className={s.pill}>{drill.players}</span>{drill.tags.map(tag => <span className={s.pill} key={tag}>{tag}</span>)}</div></div><div className={s.eyebrow}>THE TRANSITION SERIES</div></header>
    <div className={s.workspace}><section className={`${s.stage} ${presenting ? s.presenting : ""}`} aria-label="Drill animation">
      <div className={s.stagebar}><span className={s.eyebrow}>COURT LAB <span style={{ color: "#dff786" }}> / {String(frame.round + 1).padStart(2, "0")}</span></span><div className={s.segmented} aria-label="Court view">{(["2D", "3D", "Split"] as const).map(v => <button key={v} className={s.button} aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>)}</div><button className={s.button} onClick={() => setPresenting(!presenting)}>{presenting ? "Exit presentation ✕" : "Present ↗"}</button></div>
      <div className={`${s.views} ${view === "Split" ? s.split : ""}`}>
        {view !== "3D" && <div className={s.view}><span className={s.viewLabel}>01 / TACTICAL VIEW</span><Court2D frame={frame} /></div>}
        {view !== "2D" && <div className={s.view}><CourtBoundary><Court3D frame={frame} /></CourtBoundary></div>}
      </div>
      <div className={s.controls}><div className={s.controlRow}><button className={`${s.button} ${s.primary}`} onClick={play}>{playing && !techniquePreview ? "Ⅱ Pause" : "▶ Play full drill"}</button><button className={s.button} onClick={() => { setTime(0); setPlaying(false); setTechniquePreview(null); }}>↺ Reset</button><label className={s.muted}>Speed <select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ background: "#202b22", padding: 6, borderRadius: 4 }}>{[.5, 1, 1.5, 2].map(n => <option key={n} value={n}>{n}×</option>)}</select></label><label className={s.muted}><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} /> Loop</label><span className={s.muted} style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{time.toFixed(1)} / {DURATION}s</span></div>
      <input className={s.timeline} aria-label="Drill timeline in seconds" type="range" min={0} max={DURATION} step={.05} value={time} onChange={e => setTime(Number(e.target.value))} />
      {techniquePreview && <div className={s.previewBanner}><b>TECHNIQUE LOOP</b> {techniquePreview.label} · preparation → contact → follow-through <button onClick={() => { setTechniquePreview(null); setPlaying(false); }}>Exit</button></div>}<p className={s.cue}>{frame.cue} {frame.penalty && <strong> P{frame.penalty}: −3</strong>}</p><div className={s.movementStrip}>{frame.players.map(player => <span key={player.id} style={{ borderColor: player.color }}><b>P{player.id}</b> {player.technique ? `${techniqueForStroke(player.technique).label} · ` : ""}{movementLabel(player.movement)}</span>)}</div>
      <div className={s.legend}><span className={s.orange}>● P1 · Attacker</span><span className={s.blue}>● P2 · Feeder / defender</span><span style={{ color: "#e4fa77" }}>● Ball / shot path</span></div></div>
    </section><aside className={s.sidebar}>
      <section className={s.panel}><div className={s.eyebrow}>THE SEQUENCE</div><h2 style={{ marginTop: 10 }}>Feed. Close. Compete.</h2>{phases.map((phase, i) => <button key={phase} className={`${s.step} ${frame.phase === i ? s.active : ""}`} style={{ width: "100%", textAlign: "left", cursor: "pointer" }} onClick={() => { setTime(frame.round * 16 + phaseTimes[i]); setTechniquePreview(null); setPlaying(false); }} aria-current={frame.phase === i ? "step" : undefined}><span className={s.stepNumber}>{i + 1}</span>{phase}</button>)}<button className={s.button} style={{ marginTop: 18, width: "100%" }} onClick={() => { setTime(frame.round ? 0 : 16); setTechniquePreview(null); setPlaying(false); }}>Switch diagonal ↗</button><p className={s.muted} style={{ fontSize: 12, marginTop: 16 }}>Recorded forehand volley, backhand volley, groundstroke and overhead motion. Use 0.5× speed and the Volley camera to inspect preparation, contact and recovery.</p></section>
      <section className={s.panel}><h2>Technique studio</h2><p className={s.muted} style={{ fontSize: 12 }}>Each reusable technique unit plays its complete preparation, contact and follow-through window.</p><div className={s.contactButtons} aria-label="Technique previews"><button className={s.button} onClick={() => previewUnit("forehand-volley", 3, "rally", 0)}>▶ Forehand volley</button><button className={s.button} onClick={() => previewUnit("backhand-volley", 3, "rally", 1)}>▶ Backhand volley</button><button className={s.button} onClick={() => previewUnit("forehand-groundstroke", 4.38, "rally", 0)}>▶ Groundstroke</button><button className={s.button} onClick={() => previewUnit("overhead", 7, "mercy", 0)}>▶ Overhead</button></div><label className={s.muted} htmlFor="outcome">Point scenario</label><select id="outcome" className={s.select} value={outcome} onChange={e => { setOutcome(e.target.value as Outcome); setTime(0); setTechniquePreview(null); }}><option value="rally">Successful feed → cross-court point</option><option value="mercy">Missed feed → mercy overhead</option><option value="double-miss">Two misses → −3 & reset</option></select><label className={s.muted}><input type="checkbox" checked={moonball} onChange={e => { setMoonball(e.target.checked); setTime(0); setTechniquePreview(null); }} /> Moonball first feed</label><p className={s.muted} style={{ marginTop: 14, fontSize: 12 }}>Illustrative ball paths and timing. In practice, play the point out. The animation repeats the same two players on opposite diagonals, then resets.</p></section>
    </aside></div>
    <div className={s.notes}><section><h2>01 / Set up & play</h2><p>Two-player adaptation: P1 attacks from the far side; P2 feeds from the opposite baseline and defends. P1 takes the transition volley, closes the net and plays within the highlighted cross-court halves, including the doubles alleys. Both players then reset for the other diagonal. A completed point is worth 1 to the winner.</p></section><section><h2>02 / The mercy rule</h2><p>Miss the first feed and receive one extra feed. This animation uses the overhead described in the printed drill. Make it and continue the point; making the mercy shot alone earns no point. Miss both feeds and lose 3 points, then reset for the next point. No mercy ball is given for a later rally error.</p></section><section><h2>03 / Reset & progress</h2><p>P2 touches the back fence after the point while P1 recovers. Alternate diagonals with the same two players. During practice, swap attacking and feeding roles after a timed block. Adjust the feed difficulty to the player’s level. Variation: start with a moonball and take it out of the air.</p></section></div>
    <footer className={s.footer}><a href={lessonUrl} target="_blank" rel="noreferrer" style={{ color: "#dff786" }}>Watch the reference lesson · Jorge Capestany / TennisDrills.tv ↗</a><p style={{ marginTop: 10 }}>Adapted from the original group drill for two players: P2 supplies the feeds and both players stay on court. Stroke movements use adapted Tennis-MoCap recordings; court travel, feeds, racket alignment and ball timing are illustrative. Coach review is still needed before treating the adapted motion as a technique standard.</p><p style={{marginTop:10}}>Motion source: <a href="https://github.com/jdpulgarin/Tennis-MoCap" target="_blank" rel="noreferrer">Tennis-MoCap · Pulgarin-Giraldo et al. (2017)</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>. Selected recordings were trimmed, scaled, grounded and fitted to our character. <a href="/models/tennis/mocap/ATTRIBUTION.md" target="_blank" rel="noreferrer">Source and adaptation details ↗</a></p></footer>
  </main>;
}
