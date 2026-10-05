"use client";
import { useEffect, useState } from "react";
import { stages, type Lesson } from "@/lib/coaching/catalog";
import { type Draft, remainingSeconds, hasMentalPractice } from "@/lib/coaching/store";
import s from "./coaching.module.css";

export default function SessionRunner({
  lesson,
  draft,
  patch,
  onSave,
}: {
  lesson: Lesson;
  draft: Draft;
  patch: (patch: Partial<Draft>) => void;
  onSave: () => boolean;
}) {
  const [now, setNow] = useState(Date.now),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const plan = stages(lesson, draft.duration),
    current = plan[draft.stage],
    left = remainingSeconds(draft, now),
    running = draft.deadline !== null && left > 0;
  const success = draft.outcomes.filter(Boolean).length;
  const elapsedHere = Math.max(0, current.minutes * 60 - left);
  function selectStage(index: number) {
    patch({ stage: index, remaining: plan[index].minutes * 60, deadline: null, elapsed: draft.elapsed + elapsedHere });
    setSaved(false);
  }
  function startPause() {
    patch(
      running
        ? { remaining: remainingSeconds(draft), deadline: null }
        : {
            deadline: Date.now() + remainingSeconds(draft) * 1000,
            startedAt: draft.startedAt || new Date().toISOString(),
          },
    );
    setSaved(false);
  }
  function mark(result: boolean) {
    if (draft.outcomes.length < 2000) {
      patch({ outcomes: [...draft.outcomes, result] });
      setSaved(false);
    }
  }
  return (
    <section className={s.panel} aria-label="课堂控制台">
      <div className={s.spread}>
        <h2>正在带课</h2>
        <span className={s.tag}>阶段 {draft.stage + 1} / 6</span>
      </div>
      <div className={s.phaseNav} aria-label="课堂阶段">
        {plan.map((p, i) => (
          <button key={p.title} className={s.button} aria-pressed={draft.stage === i} onClick={() => selectStage(i)}>
            {i + 1} {p.title.split(" · ")[0]}
          </button>
        ))}
      </div>
      <div className={s.timerPanel}>
        <div>
          <p className={s.eyebrow}>{current.title}</p>
          <div className={s.timer} role="timer" aria-label="本阶段剩余时间">
            {Math.floor(left / 60)
              .toString()
              .padStart(2, "0")}
            :{(left % 60).toString().padStart(2, "0")}
          </div>
          <p className={s.small}>
            {left === 0
              ? "本阶段时间到。请确认后进入下一阶段。"
              : running
                ? "计时中 · 切到后台或刷新仍会继续"
                : "已暂停 · 准备好再开始"}
          </p>
        </div>
        <div className={s.stack}>
          <button className={`${s.button} ${s.primary}`} onClick={startPause} disabled={left === 0}>
            {running ? "暂停计时" : "开始计时"}
          </button>
          <button className={s.button} onClick={() => selectStage(draft.stage)}>
            重置本阶段
          </button>
        </div>
      </div>
      <p className={s.currentTask}>{current.body}</p>
      {draft.difficulty !== "standard" && (
        <div className={s.cue}>
          <strong>{draft.difficulty === "easier" ? "降阶执行" : "进阶执行"}：</strong>
          {draft.difficulty === "easier" ? lesson.easier : lesson.harder}
        </div>
      )}
      <div className={s.cue}>{lesson.cue}</div>
      <p className={s.muted}>
        {lesson.diagram.startsWith("doubles")
          ? draft.players < 4
            ? "当前不足4人：只练局部配合，完整双打另补。"
            : "两队上场，每5分换发接与网前角色；多余学员在场外观察轮换。"
          : draft.players === 1
            ? "教练承担喂球与对手，保留轮休。"
            : draft.players === 2
              ? "两人交替喂打，短段练习后停球反馈。"
              : "一次一组全场活球，其余人场外观察；60—90秒轮换，捡球前全场停球。"}
      </p>
      <div className={s.spread}>
        <button className={s.button} disabled={draft.stage === 0} onClick={() => selectStage(draft.stage - 1)}>
          ← 前一阶段
        </button>
        <button className={s.button} disabled={draft.stage === 5} onClick={() => selectStage(draft.stage + 1)}>
          下一阶段 →
        </button>
      </div>
      <hr className={s.divider} />
      <h3>本轮观察</h3>
      <div className={s.row}>
        <label className={s.field}>
          观察对象
          <input
            value={draft.subject}
            maxLength={100}
            disabled={draft.outcomes.length > 0}
            onChange={(e) => patch({ subject: e.target.value })}
          />
        </label>
        <label className={s.field}>
          记录指标
          <select
            aria-label="记录指标"
            value={draft.metric}
            disabled={draft.outcomes.length > 0}
            onChange={(e) => patch({ metric: e.target.value })}
          >
            {["回球入界", "命中目标", "选择合理", "发球成功"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <p className={s.counter} aria-live="polite">
        成功 {success} / {draft.outcomes.length}
        <span>{draft.outcomes.length ? `${Math.round((success / draft.outcomes.length) * 100)}%` : "尚未记录"}</span>
      </p>
      <div className={s.row}>
        <button
          className={`${s.button} ${s.primary}`}
          disabled={draft.outcomes.length >= 2000}
          onClick={() => mark(true)}
        >
          成功 +1
        </button>
        <button className={s.button} disabled={draft.outcomes.length >= 2000} onClick={() => mark(false)}>
          未成功 +1
        </button>
        <button
          className={s.button}
          disabled={!draft.outcomes.length}
          onClick={() => patch({ outcomes: draft.outcomes.slice(0, -1) })}
        >
          撤销上一球
        </button>
      </div>
      <p className={s.small}>本轮保持同一对象与指标；个体差异可写入备注。最多记录2000次观察。</p>
      <label className={s.field}>
        带课备注 / 下次调整
        <textarea
          value={draft.notes}
          maxLength={4000}
          onChange={(e) => {
            patch({ notes: e.target.value });
            setSaved(false);
          }}
          placeholder="谁在哪个环节需要减速？下次先复习什么？"
        />
      </label>
      <div className={s.row} style={{ marginTop: 18 }}>
        <button
          className={`${s.button} ${s.primary}`}
          disabled={!draft.startedAt && !draft.outcomes.length && !draft.notes.trim() && !hasMentalPractice(draft.mental)}
          onClick={() => {
            setSaved(onSave());
          }}
        >
          保存并结束本次课
        </button>
        {saved && <span role="status">本次课堂已加入记录。</span>}
      </div>
      <p className={s.small}>结束时保存当前统计与备注，再开始新的课堂草稿；不会自动判定学员升级。</p>
    </section>
  );
}
