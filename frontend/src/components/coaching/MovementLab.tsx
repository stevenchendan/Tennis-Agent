"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import DevelopmentNav from "./DevelopmentNav";
import SourceNote from "./SourceNote";
import s from "./coaching.module.css";

const steps = [
  { name: "读取与准备", cue: "看对手击球信息，在对手触球附近完成分腿准备，保持可向两侧启动。" },
  { name: "移动与调整", cue: "先移动到来球区域，再用小步调整距离；本例在右侧舒适位置击球。" },
  { name: "选择球路", cue: "比较斜线与直线把对手带到哪里。只有到位、平衡和来球条件合适时才考虑变线。" },
  { name: "回位再准备", cue: "根据对手可能的击球位置覆盖回球角度，不机械地跑回同一个点；下一次触球前重新准备。" },
];

function Court({ cross, step, mirror }: { cross: boolean; step: number; mirror: boolean }) {
  const arrow = useId().replaceAll(":", "");
  const x = (value: number) => mirror ? 190 - value : value;
  const target = cross ? 48 : 140, recovery = cross ? 106 : 82;
  const playerX = step === 0 ? 95 : step === 3 ? recovery : 140;
  return <svg viewBox="0 0 190 278" role="img" aria-label={`${cross ? "斜线" : "直线"}：${steps[step].name}${mirror ? "，镜像" : ""}`} style={{ width: "100%", maxHeight: 500 }}>
    <defs><marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#edb97a" /></marker></defs>
    <rect x="10" y="7" width="170" height="264" rx="8" fill="#143427" />
    <rect x="27" y="20" width="136" height="220" fill="#22563e" stroke="#e5efd7" />
    <path d="M39 20V240M151 20V240M39 72H151M39 188H151M95 72V188M27 130H163" stroke="#e5efd7" fill="none" />
    <text x="95" y="124" textAnchor="middle" fill="#e5efd7" fontSize="8">网</text>
    {step >= 1 && <path d={`M${x(95)} 246L${x(140)} 230`} stroke="#a7ddea" strokeDasharray="3 3" fill="none" />}
    {step >= 2 && <path d={`M${x(140)} 230L${x(target)} 43`} stroke="#edb97a" strokeWidth="2" markerEnd={`url(#${arrow})`} fill="none" />}
    {step === 3 && <>
      <ellipse cx={x(recovery)} cy="247" rx="14" ry="10" fill="#d4ee8033" stroke="#d4ee80" strokeDasharray="3 2" />
      <path d={`M${x(140)} 230L${x(recovery)} 247`} stroke="#a7ddea" strokeWidth="2" strokeDasharray="3 3" fill="none" />
    </>}
    <circle cx={x(step >= 2 ? target : 95)} cy="31" r="8" fill="#eef1e6" /><text x={x(step >= 2 ? target : 95)} y="34" textAnchor="middle" fontSize="9" fill="#163726">B</text>
    <circle data-player="A" cx={x(playerX)} cy={step === 1 || step === 2 ? 230 : 247} r="8" fill="#d4ee80" /><text x={x(playerX)} y={step === 1 || step === 2 ? 233 : 250} textAnchor="middle" fontSize="9" fill="#163726">A</text>
  </svg>;
}

export default function MovementLab() {
  const [step, setStep] = useState(0), [cross, setCross] = useState(true), [mirror, setMirror] = useState(false);
  const [compare, setCompare] = useState(false), [playing, setPlaying] = useState(false), [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReduced(media.matches); if (media.matches) setPlaying(false); };
    update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!playing) return;
    if (step === 3) { setPlaying(false); return; }
    const timer = setTimeout(() => setStep(n => Math.min(3, n + 1)), 1600);
    return () => clearTimeout(timer);
  }, [playing, step]);
  function select(n: number) { setPlaying(false); setStep(n); }
  return <main className={s.shell}>
    <DevelopmentNav />
    <header className={s.hero}><p className={s.eyebrow}>Read / Move / Hit / Recover</p><h1>步法与回位</h1><p>每一拍都有下一步。用同一个击球位置，比较不同球路后的回位。</p></header>
    <div className={s.row} style={{ marginBottom: 20 }}>
      <button className={s.button} aria-pressed={cross} onClick={() => { setCross(true); setPlaying(false); }}>斜线球路</button>
      <button className={s.button} aria-pressed={!cross} onClick={() => { setCross(false); setPlaying(false); }}>直线球路</button>
      <button className={s.button} aria-pressed={compare} onClick={() => setCompare(!compare)}>并排比较</button>
      <button className={s.button} aria-pressed={mirror} onClick={() => setMirror(!mirror)}>镜像场地</button>
    </div>
    <section className={s.panel}>
      <div className={s.phaseNav} aria-label="回位步骤">{steps.map((item, i) => <button key={item.name} className={s.button} aria-pressed={step === i} onClick={() => select(i)}>{i + 1} {item.name}</button>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: compare ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr", gap: 20 }}>
        {(compare ? [true, false] : [cross]).map(value => <figure key={String(value)} style={{ margin: 0 }}><figcaption className={s.count}>{value ? "斜线：本例回位距离较短" : "直线：本例需要更多横向回位"}</figcaption><Court cross={value} step={step} mirror={mirror} /></figure>)}
      </div>
      <p className={s.small}>A：学习者 · B：对手 · 橙色实线：击球方向 · 蓝色虚线：移动 · 虚线圈：示意回位区</p>
      <div className={s.cue} aria-live="polite"><strong>{step + 1} / 4 · {steps[step].name}</strong><p>{steps[step].cue}</p></div>
      <label className={s.field}>步骤进度<input aria-label="步骤进度" type="range" min="0" max="3" step="1" value={step} onChange={e => select(Number(e.target.value))} /></label>
      <div className={s.row}>
        <button className={s.button} disabled={step === 0} onClick={() => select(step - 1)}>上一步</button>
        <button className={s.button} disabled={step === 3} onClick={() => select(step + 1)}>下一步</button>
        <button className={s.button} disabled={reduced} onClick={() => { if (step === 3) setStep(0); setPlaying(!playing); }}>{playing ? "暂停演示" : "自动分步演示"}</button>
        <button className={s.button} onClick={() => select(0)}>回到开始</button>
      </div>
      {reduced && <p className={s.small}>已遵循减少动态效果偏好，请用步骤按钮或方向键控制进度。</p>}
    </section>
    <section className={s.info}><h2>把示意带到练习中</h2><p>先固定慢速喂球，观察击球后是否重新准备；再交替斜线与直线，让学员说出对手下一球可能打向哪里。</p><p>回位区和人物位置是项目绘制的教学示意，并非精确最优站位或连续回合追踪。实际位置随来球、球速、角度与个人能力变化。</p><div className={s.row}>{[["006", "击球后回家"], ["024", "到位之后再击球"], ["065", "被拉出边线后的恢复"]].map(([id, name]) => <Link className={s.button} key={id} href={`/lessons/${id}`}>{name} ↗</Link>)}</div></section>
    <SourceNote pages="46、61、155" />
  </main>;
}
