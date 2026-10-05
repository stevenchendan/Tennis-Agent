"use client";
import Link from "next/link";
import { newMentalPractice, type Draft, type MentalPractice } from "@/lib/coaching/store";
import SourceNote from "./SourceNote";
import s from "./coaching.module.css";

export default function MentalPracticeCard({ draft, patch, ready, live }: { draft: Draft; patch: (value: Partial<Draft>) => void; ready: boolean; live: boolean }) {
  const mental = draft.mental || newMentalPractice();
  const change = (value: Partial<MentalPractice>) => patch({ mental: { ...mental, ...value } });
  return <details className={s.panel} open={live}>
    <summary>心理训练 · 目标、重置与复盘</summary>
    <p className={s.muted}>与技术练习一起记录。关注可执行的行为，不用比赛输赢评价专注或信心。</p>
    <label className={s.field}>今天的过程目标<input disabled={!ready} maxLength={160} value={mental.goal} placeholder="例如：每次失分后，回到下一球的大目标。" onChange={e => change({ goal: e.target.value })} /></label>
    <h3>两分之间：停一下，再开始</h3>
    <ol><li>放下上一分，松开握拍，平稳呼吸。</li><li>看向下一分的目标，用一句简单提示回到任务。</li><li>选择落点，回到准备位置。</li></ol>
    <label className={s.field}>我的重置提示词<input disabled={!ready} maxLength={80} value={mental.cue} placeholder="例如：看球，打大区。" onChange={e => change({ cue: e.target.value })} /></label>
    <p aria-live="polite">本次已完成重置 {mental.resets} 次（教练或学员主动记录）</p>
    <div className={s.row}>
      <button className={s.button} disabled={!ready || mental.resets >= 2000} onClick={() => change({ resets: mental.resets + 1 })}>完成一次重置 +1</button>
      <button className={s.button} disabled={!ready || mental.resets === 0} onClick={() => change({ resets: mental.resets - 1 })}>撤销一次重置</button>
    </div>
    <label className={s.field} style={{ marginTop: 18 }}>课后反思 / 下次行动<textarea disabled={!ready} maxLength={600} value={mental.reflection} placeholder="什么情境下保持了目标？哪次重置有帮助？下次保留一个行动。" onChange={e => change({ reflection: e.target.value })} /></label>
    <p className={s.small}>输入随本课草稿保存；进入带课模式并“保存并结束本次课”后，随课堂记录归档。下一次课堂从空白目标开始。</p>
    <div className={s.row}><Link className={s.link} href="/lessons/039">练习失误后的下一分</Link><Link className={s.link} href="/lessons/108">练习连续丢分后的重置</Link></div>
    <SourceNote pages="228、245；三步重置流程为项目设计" />
  </details>;
}
