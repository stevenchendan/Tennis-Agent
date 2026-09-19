'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import DrillNav from '../drills/DrillNav';
import { studioFrame, studioUnits } from '@/lib/tennis-motion/studio';
import type { StudioAngle } from './StudioScene';
import s from './lab.module.css';
const StudioScene=dynamic(()=>import('./StudioScene'),{ssr:false});
const Court3D=dynamic(()=>import('../drills/Court3D'),{ssr:false});
export default function MotionLab() {
  const [selected,setSelected]=useState('forehand-volley'); const [time,setTime]=useState(0); const [playing,setPlaying]=useState(false); const [speed,setSpeed]=useState(.5); const [angle,setAngle]=useState<StudioAngle>('Front');
  const unit=studioUnits.find(u=>u.id===selected)!; const available=unit.status!=='Not available';
  useEffect(()=>{ if(!playing||!available)return; let id=0,last=0; const tick=(now:number)=>{const delta=last?Math.min((now-last)/1000,.1):0;last=now;setTime(t=>(t+delta*speed)%unit.duration);id=requestAnimationFrame(tick);};id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id);},[playing,speed,unit.duration,available]);
  const seek=(value:number)=>{setPlaying(false);setTime(Math.max(0,Math.min(unit.duration,value)));};
  const frame=available?studioFrame(unit,time):null;
  const stage=unit.contact===undefined?'Movement':Math.abs(time-unit.contact)<.06?'Contact':time<unit.contact?'Preparation':'Follow-through';
  return <main className={s.shell}><DrillNav/><header className={s.header}><div><p className={s.eyebrow}>PLAYER DEVELOPMENT / MOTION LIBRARY</p><h1>Movement lab</h1><p>Inspect each movement. Build a complete point.</p></div><Link href="/drills/mercy-shot-volleys">Open Mercy Shot ↗</Link></header>
    <div className={s.summary}><span><b>4</b> captured stroke previews</span><span><b>6</b> illustrative movement previews</span><span><b>2</b> missing core techniques</span><span><b>0</b> coach-approved units</span></div>
    <p className={s.notice}>Development preview: captured strokes now use a skinned human skeleton. Grip alignment, footwork and transitions remain under review; these are not yet approved technique demonstrations.</p>
    <div className={s.layout}><aside className={s.library}>{(['Technique','Movement','Strategy'] as const).map(category=><section key={category}><h2>{category==='Technique'?'Stroke library':category==='Movement'?'Footwork & positioning':'Combine the units'}</h2>{studioUnits.filter(u=>u.category===category).map(u=><button key={u.id} aria-pressed={selected===u.id} onClick={()=>{setSelected(u.id);setTime(0);setPlaying(false);}}><span>{u.label}</span><small>{u.status}</small></button>)}</section>)}</aside>
    <section className={s.viewer}><div className={s.toolbar}><div><small>{unit.category} / {unit.status}</small><h2>{unit.label}</h2></div>{unit.category!=='Strategy'&&<div>{(['Front','Side','Rear'] as const).map(a=><button aria-pressed={angle===a} onClick={()=>setAngle(a)} key={a}>{a}</button>)}</div>}</div>
    <div className={s.stage}>{frame?(unit.category==='Strategy'?<Court3D frame={frame}/>:<StudioScene frame={frame} angle={angle} contact={unit.contact}/>):<div className={s.empty}><h2>Animation not available yet</h2><p>{unit.label} needs a selected recording, retargeting and technique review before it can play here.</p><p>No substitute stroke is shown.</p></div>}</div>
    <div className={s.controls}><div><button disabled={!available} onClick={()=>setPlaying(!playing)}>{playing?'Pause':'Play loop'}</button><button disabled={!available} onClick={()=>seek(0)}>Reset</button><button disabled={!available} onClick={()=>seek(time-1/50)} aria-label="Previous frame">− Frame</button><button disabled={!available} onClick={()=>seek(time+1/50)} aria-label="Next frame">+ Frame</button>{unit.contact!==undefined&&<button disabled={!available} onClick={()=>seek(unit.contact!)}>At contact</button>}<label>Speed <select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.25,.5,1].map(n=><option key={n} value={n}>{n}×</option>)}</select></label></div><input aria-label="Movement timeline" type="range" min={0} max={unit.duration} step={.02} value={time} disabled={!available} onChange={e=>seek(Number(e.target.value))}/><p>{time.toFixed(2)} / {unit.duration.toFixed(2)} s <span>{available?stage:'Awaiting recording'}</span></p></div>
    <div className={s.details}><section><h2>Review checkpoints</h2><ul>{unit.cues.map(cue=><li key={cue}>{cue}</li>)}</ul></section><section><h2>Ready for coaching?</h2><p>Not yet. Check foot planting, body rotation, racket grip, contact spacing and recovery from all three views.</p><p>Next: reviewed grip calibration, planted footwork and transitions. Slice, half-volley, lob, drop shot and serve variants will follow the core library.</p></section></div></section></div>
    <footer className={s.footer}>Character: <a href="/models/tennis/CHARACTER-LICENSE.md">Quaternius · CC0</a> · Motion data: <a href="https://github.com/jdpulgarin/Tennis-MoCap">Tennis-MoCap</a> · <a href="/models/tennis/mocap/ATTRIBUTION.md">Attribution & adaptations</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a></footer></main>;
}

