"use client";

import { useState } from "react";
import Link from "next/link";
import TacticPlayer from "@/components/board/TacticPlayer";
import { boardImportHref } from "@/lib/rally-to-tactic";
import { sourceAt, studySource, videoStudyDrills } from "@/lib/drills/video-study";
import DrillNav from "./DrillNav";
import s from "./video-study.module.css";

const stamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function VideoStudy() {
  const [selected, setSelected] = useState(0);
  const [loadVideo, setLoadVideo] = useState(false);
  const drill = videoStudyDrills[selected];
  return <main className={s.shell} lang="en">
    <DrillNav />
    <header className={s.hero}>
      <p className={s.kicker}>COURT FILM / STUDY 001</p>
      <h1>Watch the movement.<br /><span>Build the practice.</span></h1>
      <p>Two practice adaptations from the opening section of your court-level video. Compare the reference, explore the pattern, then take it to court.</p>
      <div className={s.status}>Manual visual study · Illustrative drill animation · Technique review pending</div>
    </header>
    <div className={s.tabs} aria-label="Choose a video-inspired drill">
      {videoStudyDrills.map((item, i) => <button key={item.id} aria-pressed={selected === i} onClick={() => setSelected(i)}><small>0{i + 1} / {stamp(item.start)}–{stamp(item.end)}</small>{item.title}</button>)}
    </div>
    <div className={s.columns}>
      <section className={s.panel} aria-label="Source video and observations">
        <p className={s.kicker}>01 / THE REFERENCE</p>
        <h2>{studySource.title}</h2>
        <p className={s.muted}>By {studySource.creator} · Selected reference {stamp(drill.start)}–{stamp(drill.end)}</p>
        <div className={s.video}>
          {loadVideo ? <iframe key={drill.id} title={`Source video: ${drill.title}`} src={`https://www.youtube-nocookie.com/embed/${studySource.id}?start=${drill.start}&end=${drill.end}&rel=0`} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /> : <div><p>Watch the original court-level footage</p><button className={s.primary} onClick={() => setLoadVideo(true)}>Load YouTube reference ▶</button></div>}
        </div>
        <a className={s.link} href={sourceAt(drill.start)} target="_blank" rel="noreferrer">Open at {stamp(drill.start)} on YouTube ↗</a>
        <p className={s.muted}>If embedded playback is unavailable, use the YouTube link. Source playback and drill playback are independent.</p>
        <h3>Observed in sampled frames</h3>
        <ul className={s.observations}>{drill.observations.map(item => <li key={item.time}><a href={sourceAt(item.time)} target="_blank" rel="noreferrer">{stamp(item.time)} ↗</a><span>{item.text}</span></li>)}</ul>
        <p className={s.evidence}>{studySource.method} Only the listed moments were inspected closely. This is not a full-match report.</p>
      </section>
      <section className={s.panel} aria-label="Adapted drill playback">
        <p className={s.kicker}>02 / YOUR PRACTICE PATTERN</p>
        <h2>{drill.title}</h2>
        <p className={s.muted}>{drill.goal}</p>
        <div className={s.animation}><TacticPlayer key={drill.id} tactic={drill.tactic} /></div>
        <p className={s.evidence}>Authored positions, feeds, ball paths and timing. The figures show tactics; their bodies do not reproduce the source player’s technique.</p>
        <Link className={s.link} href={boardImportHref(drill.tactic)}>Edit this drill on the tactics board ↗</Link>
      </section>
    </div>
    <section className={s.practice}>
      <div><p className={s.kicker}>03 / TAKE IT TO COURT</p><h2>Set up. Repeat. Progress.</h2><p>{drill.setup}</p><ol>{drill.rules.map(rule => <li key={rule}>{rule}</li>)}</ol><p className={s.progression}><b>Progression</b> {drill.progression}</p></div>
      <aside className={s.panel}><p className={s.kicker}>ANALYSIS BOUNDARY</p><h3>What this trial establishes</h3><p>The selected frames support qualitative observations about court position and broad movement. The drill is a practice interpretation of those themes.</p><h3>What still needs a local clip</h3><p>Continuous joint tracking, shot-by-shot ball detection, split-step timing and motion retargeting have not been performed. YouTube allowed browser playback but rejected the file download with HTTP 403.</p><p>Next input: a local MP4 of the selected rally. Keep the full player in frame; use the highest available frame rate and resolution. A closer side view helps with technique detail.</p></aside>
    </section>
    <section className={s.technique}><p className={s.kicker}>04 / TECHNIQUE CHECKPOINTS</p><h2>Review the action, not a similarity score.</h2><p className={s.muted}>These are suggested practice cues and review questions, not measured faults in the professional’s technique.</p><div className={s.cards}>{drill.technique.map(item => <article className={s.panel} key={item.title}><h3>{item.title}</h3><p>{item.cue}</p><p className={s.evidence}><b>Review:</b> {item.check}</p></article>)}</div></section>
    <footer className={s.footer}>Reference linked to the original creator. No source footage or extracted player motion is bundled with this study. <Link href="/movement-lab">Explore the existing motion library ↗</Link></footer>
  </main>;
}
