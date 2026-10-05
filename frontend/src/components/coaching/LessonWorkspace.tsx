"use client";
import Link from "next/link";
import { useState } from "react";
import { type Lesson, type Duration, levels, layouts, stages, topic } from "@/lib/coaching/catalog";
import CourtPreview from "./CourtPreview";
import s from "./coaching.module.css";

export default function LessonWorkspace({ lesson: l }: { lesson: Lesson }) {
  const [duration, setDuration] = useState<Duration>(60);
  const level = levels[l.level - 1],
    plan = stages(l, duration);
  return (
    <main className={s.shell}>
      <nav className={s.nav}>
        <Link href="/lessons">← 教案库</Link>
        <span>
          {l.id} / {level.short} / {topic(l)}
        </span>
        <Link href="/">工作台</Link>
      </nav>
      <header className={s.hero}>
        <p className={s.eyebrow}>
          Lesson {l.id} / 第{l.sequence}课
        </p>
        <h1>{l.title}</h1>
        <p>{l.objective}</p>
        <div className={s.row}>
          {([45, 60, 90] as Duration[]).map((d) => (
            <button className={s.button} key={d} aria-pressed={duration === d} onClick={() => setDuration(d)}>
              {d}分钟
            </button>
          ))}
          <span className={s.tag}>1片场地 · 默认4人</span>
        </div>
      </header>
      <div className={s.detailGrid}>
        <div className={s.stack}>
          <section className={s.panel}>
            <div className={s.spread}>
              <h2>带课流程</h2>
              <span className={s.small}>含轮换、饮水与捡球时间</span>
            </div>
            {plan.map((stage) => (
              <section className={s.stage} key={stage.title}>
                <div className={s.time}>
                  {stage.start}—{stage.start + stage.minutes}′<strong>{stage.minutes}′</strong>
                </div>
                <div>
                  <h3>{stage.title}</h3>
                  <p>{stage.body}</p>
                </div>
              </section>
            ))}
          </section>
          <section className={s.panel}>
            <h2>如何观察与调整</h2>
            <div className={s.cue}>{l.cue}</div>
            <h3>本课验收</h3>
            <p>{l.assessment}</p>
            <h3>太难时</h3>
            <p>{l.easier}</p>
            <h3>稳定后</h3>
            <p>{l.harder}</p>
            <p className={s.muted}>{level.gate}</p>
          </section>
        </div>
        <aside className={`${s.stack} ${s.sidebar}`}>
          <section className={s.panel}>
            <h2>场地布置</h2>
            <div className={s.court}>
              <CourtPreview diagram={l.diagram} label={layouts[l.diagram].name} />
            </div>
            <p className={s.muted}>{layouts[l.diagram].note}</p>
            <span className={s.tag}>球路与站位示意</span>
          </section>
          <section className={s.panel}>
            <h2>上场前</h2>
            <h3>学员条件</h3>
            <p>{level.entry}</p>
            <h3>球与场地</h3>
            <p>{level.ball}</p>
            <h3>器材</h3>
            <p>球拍、约24球、8个扁平标志碟、球筐和计时器。标志不要放在落脚路线。</p>
            <details className={s.info}>
              <summary>人数与安全轮换</summary>
              <p>
                {l.diagram.startsWith("doubles")
                  ? "4人两队同时上场，每5分交换发接与网前角色。"
                  : "全场只开一组活球：两人练、两人在围网外观察，约60—90秒轮换。"}
                1对1由教练当对手并保留休息；5—6人增加场外观察站。捡球前全场停球。
              </p>
            </details>
          </section>
        </aside>
      </div>
      <div className={`${s.spread} ${s.info}`}>
        {Number(l.id) > 1 ? (
          <Link className={s.button} href={`/lessons/${String(Number(l.id) - 1).padStart(3, "0")}`}>
            ← 上一课
          </Link>
        ) : (
          <span />
        )}
        {Number(l.id) < 120 && (
          <Link className={s.button} href={`/lessons/${String(Number(l.id) + 1).padStart(3, "0")}`}>
            下一课 →
          </Link>
        )}
      </div>
    </main>
  );
}
