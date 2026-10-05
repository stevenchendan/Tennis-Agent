"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { findLesson, levels } from "@/lib/coaching/catalog";
import { ageContexts, pathways } from "@/lib/coaching/pathways";
import DevelopmentNav from "./DevelopmentNav";
import SourceNote from "./SourceNote";
import s from "./coaching.module.css";

export default function DevelopmentPathways() {
  const params = useSearchParams();
  const requested = Number(params.get("level"));
  const level = Number.isInteger(requested) && requested >= 1 && requested <= 6 ? requested : 1;
  const age = ageContexts.find(a => a.id === params.get("age")) || ageContexts[0];
  const path = pathways[level - 1], band = levels[level - 1];
  function update(key: string, value: string) {
    const next = new URLSearchParams(window.location.search); next.set(key, value);
    window.history.replaceState(null, "", `/development/pathways?${next}`);
  }
  return <main className={s.shell}>
    <DevelopmentNav />
    <header className={s.hero}><p className={s.eyebrow}>A route, at your pace</p><h1>成长路线</h1><p>先观察能力，再选择学习顺序。每一站都可以复练；完成课程不会自动升级。</p></header>
    <div className={s.filters}>
      <label className={s.field}>年龄背景<select aria-label="年龄背景" value={age.id} onChange={e => update("age", e.target.value)}>{ageContexts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label className={s.field}>实际能力<select aria-label="实际能力" value={level} onChange={e => update("level", e.target.value)}>{levels.map(l => <option key={l.id} value={l.id}>{l.short}</option>)}</select></label>
      <Link href="/development" className={s.button}>先做能力观察 ↗</Link>
    </div>
    <section className={s.panel}><h2>本次教学侧重</h2><p>{age.focus}</p><p className={s.small}>年龄说明改编自原书印刷页20–21；课程序列为项目设计。年龄与能力分开选择，不把原书训练时数直接作为课堂要求。</p></section>
    <header className={s.hero}><h2>{path.title}</h2><p>{band.entry}</p><p>球与场地：{band.ball}</p></header>
    <div className={s.grid}>{path.ids.map((id, index) => {
      const lesson = findLesson(id)!;
      return <article className={s.panel} key={id}>
        <p className={s.eyebrow}>第 {index + 1} 站 / {index === 3 ? "复盘与复测" : "学习与练习"}</p>
        <h2>{lesson.title}</h2><p>{lesson.objective}</p>
        <h3>观察这一点</h3><p>{path.checkpoints[index]}</p>
        <h3>本课具体验收</h3><p>{lesson.assessment}</p>
        <Link className={`${s.button} ${s.primary}`} href={`/lessons/${id}`}>打开第{id}课</Link>
      </article>;
    })}</div>
    <section className={s.info}><h2>练完后怎样选下一步？</h2><p>还需要帮助：回到本课降阶练法。能在同样条件下完成：进入下一站。遇到比赛变化就不稳定：保持当前水平，增加变化并重新观察。</p><p>{band.gate}</p><Link className={s.link} href="/development">记录复测，比较能力档案 →</Link></section>
    <SourceNote pages="20–21" />
  </main>;
}
