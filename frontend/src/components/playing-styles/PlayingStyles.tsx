"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useState, type ReactNode } from "react";
import DrillNav from "@/components/drills/DrillNav";
import TacticCourt from "@/components/board/TacticCourt";
import { playingStyles, sampleStyle, SHOT_SECONDS, styleTactic, type PlayingStyle } from "@/lib/playing-styles";
import s from "./styles.module.css";

const Court3D = dynamic(() => import("@/components/board/TacticCourt3D"), { ssr: false, loading: () => <p className={s.loading}>Loading 3D court…</p> });
class CourtBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Demo({ style }: { style: PlayingStyle }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<"2D" | "3D" | "Split">("Split");
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const frame = sampleStyle(style, time);
  const tactic = styleTactic(style);
  tactic.frames[frame.index].paths = frame.paths;
  const duration = frame.duration;
  useEffect(() => {
    if (!playing) return;
    let id = 0, previous: number | null = null;
    function tick(now: number) {
      const delta = previous === null ? 0 : Math.min((now - previous) / 1000, .1);
      previous = now;
      setTime(value => loop ? (value + delta * speed) % duration : Math.min(duration, value + delta * speed));
      id = requestAnimationFrame(tick);
    }
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, speed, duration, loop]);
  useEffect(() => { if (time >= duration && !loop) setPlaying(false); }, [time, duration, loop]);
  const court2d = <TacticCourt tactic={tactic} frameIndex={frame.index} playersOverride={frame.players} ballAt={frame.ball} height={420} />;
  return <>
    <section className={s.intro} aria-label={`${style.name} overview`}><div><p className={s.eyebrow}>{style.tagline}</p><h2>{style.name}</h2><p>{style.description}</p></div><div><h3>Watch P1 · green</h3><p>{style.watch}</p><h3>The tradeoff</h3><p className={s.muted}>{style.tradeoff}</p></div></section>
    <section className={s.stage} aria-label="Playing style demonstration">
      <div className={s.toolbar}><div className={s.row} aria-label="Court view">{(["2D", "3D", "Split"] as const).map(item => <button className={s.button} key={item} aria-pressed={view === item} onClick={() => setView(item)}>{item}</button>)}</div><span className={s.muted}>P1 green: featured style · P2 pink: opponent</span></div>
      <div className={view === "Split" ? s.split : s.single}>
        {view !== "3D" && <div className={s.court}><p className={s.eyebrow}>2D / See the pattern</p>{court2d}</div>}
        {view !== "2D" && <div className={s.court}><p className={s.eyebrow}>3D / See the space</p><CourtBoundary fallback={<><p role="status">3D is unavailable on this device. The same demonstration continues in 2D.</p>{court2d}</>}><Court3D cameraPosition={[0, 23, -25]} players={frame.players} paths={frame.paths} ball={frame.ball} height={420}/></CourtBoundary><p className={s.hint}>Drag to orbit · Scroll to zoom</p></div>}
      </div>
      <div className={s.controls}><div className={s.row}><button className={s.button} onClick={() => { if (time >= duration) setTime(0); setPlaying(!playing); }}>{playing ? "Pause" : time >= duration ? "Replay" : "Play demo"}</button><button className={s.button} onClick={() => { setTime(0); setPlaying(false); }}>Reset</button><label>Speed <select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[.5, 1, 1.5].map(n => <option key={n} value={n}>{n}×</option>)}</select></label><label><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)}/> Loop</label><span className={s.muted}>{time.toFixed(1)} / {duration.toFixed(1)}s</span></div><input className={s.timeline} type="range" aria-label="Demo timeline" min={0} max={duration} step={.01} value={time} onChange={e => { setTime(Number(e.target.value)); setPlaying(false); }}/><p className={s.cue} aria-live="polite">{frame.index + 1}. {style.cues[frame.index]}{time >= duration && " Example complete — this does not imply the point was won."}</p></div>
    </section>
    <div className={s.bottom}><section className={s.panel}><h3>Step through the decisions</h3>{style.cues.map((cue, i) => <button key={cue} className={s.step} aria-current={frame.index === i ? "step" : undefined} onClick={() => { setPlaying(false); setTime(i * SHOT_SECONDS); }}><span>{i + 1}</span>{cue}</button>)}</section><section className={s.panel}><p className={s.eyebrow}>Try the idea at your level</p><h3>Start with control</h3><p>{style.practice}</p><p className={s.muted}>Use slower feeds and larger targets first. For a harder version, vary the incoming depth and decide when this pattern is appropriate.</p><Link href={style.id === "serve-volley" || style.id === "all-court" ? "/drills/mercy-shot-volleys" : "/learn/cross-court"}>Open a related practice exercise ↗</Link></section></div>
  </>;
}

export default function PlayingStyles() {
  const [selected, setSelected] = useState(playingStyles[0].id);
  const style = playingStyles.find(item => item.id === selected)!;
  return <main className={s.shell} lang="en"><DrillNav/><header className={s.header}><p className={s.eyebrow}>The playing-style library / 06 demonstrations</p><h1>Different ways<br/>to build a point.</h1><p>Explore how positioning, shot choices and movement change with a player&apos;s approach. Most players blend styles; these are patterns to explore, not fixed labels or ability levels.</p></header><nav className={s.cards} aria-label="Choose a playing style">{playingStyles.map(item => <button key={item.id} className={s.card} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><strong>{item.name}</strong><span>{item.tagline}</span></button>)}</nav><Demo key={style.id} style={style}/><footer className={s.footer}><p>Original illustrative point sequences; coach review pending. Players are position markers, not stroke-technique animations. Ball arcs and timing are schematic. Both views use the same player and ball state.</p><p>Style terminology informed by <a href="https://www.atptour.com/en/news/insights-playing-styles" target="_blank" rel="noreferrer">ATP: Playing Styles Explained</a> and <a href="https://www.usta.com/en/home/improve/tips-and-instruction/national/tactical-tennis--playing-the-serve-and-volleyer.html" target="_blank" rel="noreferrer">USTA: Playing a Serve-and-Volleyer</a>. The patient-baseliner example separates rally construction from counterattacking for teaching purposes.</p></footer></main>;
}


