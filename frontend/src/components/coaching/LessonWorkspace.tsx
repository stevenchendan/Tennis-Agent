"use client";
import Link from "next/link";
import { useState } from "react";
import { type Lesson, type Duration, levels, stages, topic } from "@/lib/coaching/catalog";
import CourtWorkbench from "./CourtWorkbench";
import SessionRunner from "./SessionRunner";
import MentalPracticeCard from "./MentalPracticeCard";
import { useCoachStore } from "./useCoachStore";
import { getRecord, newDraft, elapsedSeconds, type Draft } from "@/lib/coaching/store";
import s from "./coaching.module.css";

export default function LessonWorkspace({ lesson: l }: { lesson: Lesson }) {
  const [live, setLive] = useState(false);
  const { store, ready, notice, update } = useCoachStore();
  const record = getRecord(store, l.id),
    draft = record.draft,
    duration = draft.duration;
  function patch(change: Partial<Draft>) {
    update((previous) => {
      const r = getRecord(previous, l.id);
      return { ...previous, records: { ...previous.records, [l.id]: { ...r, draft: { ...r.draft, ...change } } } };
    });
  }
  function saveClass() {
    return update((previous) => {
      const r = getRecord(previous, l.id),
        d = r.draft;
      return {
        ...previous,
        records: {
          ...previous.records,
          [l.id]: {
            ...r,
            draft: {
              ...newDraft(d.duration),
              players: d.players,
              difficulty: d.difficulty,
              className: d.className,
              subject: d.subject,
              metric: d.metric,
            },
          },
        },
        history: [
          ...previous.history,
          {
            id: crypto.randomUUID(),
            lessonId: l.id,
            date: new Date().toISOString(),
            className: d.className,
            subject: d.subject,
            metric: d.metric,
            players: d.players,
            difficulty: d.difficulty,
            duration: d.duration,
            elapsed: elapsedSeconds(d),
            success: d.outcomes.filter(Boolean).length,
            attempts: d.outcomes.length,
            notes: d.notes,
            mental: d.mental,
          },
        ].slice(-300),
      };
    });
  }
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
      <header className={`${s.hero} ${live ? s.compactHero : ""}`}>
        <p className={s.eyebrow}>
          Lesson {l.id} / 第{l.sequence}课
        </p>
        <h1>{l.title}</h1>
        <p>{l.objective}</p>
        <div className={s.row}>
          {([45, 60, 90] as Duration[]).map((d) => (
            <button
              className={s.button}
              key={d}
              disabled={!ready || !!draft.startedAt}
              aria-pressed={duration === d}
              onClick={() =>
                patch({ duration: d, stage: 0, remaining: newDraft(d).remaining, deadline: null, elapsed: 0 })
              }
            >
              {d}分钟
            </button>
          ))}
          <span className={s.tag}>1片场地 · {draft.players}人</span>
        </div>
        <div className={s.headerActions}>
          <button
            className={s.button}
            disabled={!ready}
            aria-pressed={record.favorite}
            onClick={() =>
              update((previous) => {
                const r = getRecord(previous, l.id);
                return { ...previous, records: { ...previous.records, [l.id]: { ...r, favorite: !r.favorite } } };
              })
            }
          >
            {record.favorite ? "★ 已收藏" : "☆ 收藏本课"}
          </button>
          <button className={s.button} aria-pressed={!live} onClick={() => setLive(false)}>
            备课阅读
          </button>
          <button
            className={`${s.button} ${s.primary}`}
            disabled={!ready}
            aria-pressed={live}
            onClick={() => setLive(true)}
          >
            {draft.startedAt ? "继续本次带课" : "进入带课模式"}
          </button>
        </div>
        {draft.startedAt && (
          <p className={s.small}>本课有未结束的课堂。计时在后台继续；进入带课模式可暂停。结束本次课后可更换课时。</p>
        )}
      </header>
      <details className={s.info} open={!live} style={{ marginBottom: 24 }}>
        <summary>
          本次设置 · {draft.players}人 · {duration}分钟 · {draft.className || "未命名班级"}
        </summary>
        <div className={s.filters} style={{ marginTop: 12 }}>
          <label className={s.field}>
            班级 / 学员
            <input
              disabled={!ready}
              value={draft.className}
              maxLength={100}
              placeholder="例如：周六成人班"
              onChange={(e) => patch({ className: e.target.value })}
            />
          </label>
          <label className={s.field}>
            本次人数
            <select
              aria-label="本次人数"
              disabled={!ready}
              value={draft.players}
              onChange={(e) => patch({ players: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}人
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            练习难度
            <select
              aria-label="练习难度"
              disabled={!ready}
              value={draft.difficulty}
              onChange={(e) => patch({ difficulty: e.target.value as Draft["difficulty"] })}
            >
              <option value="standard">标准练法</option>
              <option value="easier">先降阶</option>
              <option value="harder">增加挑战</option>
            </select>
          </label>
          <Link className={s.link} href="/lessons#records">
            查看课堂记录（{store.history.filter((h) => h.lessonId === l.id).length}次）
          </Link>
        </div>
      </details>
      {notice && (
        <p className={s.notice} role="status">
          {notice}
        </p>
      )}
      <div className={s.detailGrid}>
        <div className={s.stack}>
          <MentalPracticeCard draft={draft} patch={patch} ready={ready} live={live} />
          {live ? (
            <SessionRunner lesson={l} draft={draft} patch={patch} onSave={saveClass} />
          ) : (
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
          )}
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
          <CourtWorkbench key={l.id} lesson={l} />
          <Link className={s.button} href="/development/movement">学习击球后的步法与回位 ↗</Link>
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
