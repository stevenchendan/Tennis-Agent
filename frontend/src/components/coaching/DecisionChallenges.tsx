"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { decisions } from "@/lib/coaching/decisions";
import { findLesson } from "@/lib/coaching/catalog";
import DevelopmentNav from "./DevelopmentNav";
import SourceNote from "./SourceNote";
import s from "./coaching.module.css";

export default function DecisionChallenges() {
  const [index, setIndex] = useState(0), [answers, setAnswers] = useState<Record<string, number>>({});
  const marker = useId().replaceAll(":", "");
  const scene = decisions[index], chosen = answers[scene.id], answered = chosen !== undefined;
  const correct = decisions.filter(d => answers[d.id] === d.answer).length;
  const lesson = findLesson(scene.lesson)!;
  return <main className={s.shell}>
    <DevelopmentNav />
    <header className={s.hero}><p className={s.eyebrow}>Pause / Decide / Explain</p><h1>战术选择挑战</h1><p>先读局面，再决定这一拍。答案依据题目条件，不把一种球路当成所有情况下的标准答案。</p></header>
    <div className={s.phaseNav} aria-label="选择情境">{decisions.map((d, i) => <button className={s.button} key={d.id} aria-pressed={i === index} onClick={() => setIndex(i)}>情境 {i + 1}{answers[d.id] !== undefined ? " · 已练" : ""}</button>)}</div>
    <p className={s.count}>本轮已练 {Object.keys(answers).length} / {decisions.length} · 符合情境 {correct}。刷新后重新开始，不写入能力评级。</p>
    <div className={s.detailGrid}>
      <section className={s.panel}>
        <h2>{scene.title}</h2><p className={s.currentTask}>{scene.situation}</p>
        <div className={s.stack} role="group" aria-label="这一拍怎么选">{scene.choices.map((choice, i) => <button key={choice.text} className={s.button} aria-pressed={chosen === i} disabled={answered} onClick={() => setAnswers(a => ({ ...a, [scene.id]: i }))}>{choice.text}</button>)}</div>
        {answered && <div className={s.cue} style={{ marginTop: 20 }} role="status">
          <h3>{chosen === scene.answer ? "这个选择符合当前情境" : "再看看时间、平衡和对手位置"}</h3><p>{scene.choices[chosen].why}</p>
          {chosen !== scene.answer && <p>本情境建议：{scene.choices[scene.answer].text}。{scene.choices[scene.answer].why}</p>}
          <Link className={s.link} href={`/lessons/${lesson.id}`}>去练习：{lesson.title} →</Link>
        </div>}
        <div className={s.row} style={{ marginTop: 20 }}>
          <button className={s.button} disabled={index === 0} onClick={() => setIndex(index - 1)}>上一情境</button>
          <button className={s.button} disabled={index === decisions.length - 1} onClick={() => setIndex(index + 1)}>下一情境</button>
          <button className={s.button} disabled={!answered} onClick={() => setAnswers(a => { const next = { ...a }; delete next[scene.id]; return next; })}>重试本题</button>
        </div>
      </section>
      <aside className={s.panel}>
        <h2>暂停在选择前</h2>
        <svg viewBox="0 0 190 270" role="img" aria-label={`${scene.title}站位示意`} style={{ width: "100%", maxHeight: 460 }}>
          <defs><marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#d4ee80" /></marker></defs>
          <rect x="8" y="3" width="174" height="264" rx="8" fill="#143427" />
          <rect x="27" y="20" width="136" height="220" fill="#22563e" stroke="#e5efd7" />
          <path d="M39 20V240M151 20V240M39 72H151M39 188H151M95 72V188M27 130H163" stroke="#e5efd7" fill="none" />
          {answered && <path d={`M${scene.player.join(" ")}L${scene.choices[scene.answer].target.join(" ")}`} stroke="#d4ee80" strokeWidth="2" markerEnd={`url(#${marker})`} fill="none" />}
          {answered && chosen !== scene.answer && <path d={`M${scene.player.join(" ")}L${scene.choices[chosen].target.join(" ")}`} stroke="#edb97a" strokeWidth="2" strokeDasharray="4 3" fill="none" />}
          {[{ point: scene.player, name: "A", color: "#d4ee80" }, { point: scene.opponent, name: "B", color: "#e5efd7" }].map(p => <g key={p.name}><circle cx={p.point[0]} cy={p.point[1]} r="8" fill={p.color} /><text x={p.point[0]} y={p.point[1] + 3} textAnchor="middle" fontSize="9" fill="#143427">{p.name}</text></g>)}
        </svg>
        <p className={s.small}>A：你 · B：对手。{answered ? "绿色实线：建议落点方向；橙色虚线：本次不同选择。" : "选择后显示建议方向。"}图仅表达站位与方向，不表达高度、旋转和飞行轨迹。</p>
      </aside>
    </div>
    <section className={s.info}><h2>把选择理由说出来</h2><p>我有多少准备时间？身体是否平衡？对手在哪里？这一拍之后，我准备在哪里接下一球？</p><Link className={s.link} href="/development">带到真实练习中，再记录能力观察 →</Link></section>
    <SourceNote pages={scene.pages} />
  </main>;
}
