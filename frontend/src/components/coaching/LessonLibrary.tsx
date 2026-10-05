"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { lessons, levels, topics, topic } from "@/lib/coaching/catalog";
import CourtPreview from "./CourtPreview";
import RecordManager from "./RecordManager";
import DevelopmentNav from "./DevelopmentNav";
import { useCoachStore } from "./useCoachStore";
import { getRecord } from "@/lib/coaching/store";
import s from "./coaching.module.css";

export default function LessonLibrary() {
  const params = useSearchParams(),
    router = useRouter();
  const q = params.get("q") || "",
    level = params.get("level") || "",
    subject = params.get("topic") || "全部主题";
  const [limit, setLimit] = useState(24);
  const { store, ready, notice, update: save } = useCoachStore();
  const saved = params.get("saved") || "";
  function update(key: string, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    setLimit(24);
    // Filters are client-side; update the shareable URL without a server navigation per keystroke.
    window.history.replaceState(null, "", `/lessons?${next}`);
  }
  const filtered = lessons.filter(
    (l) =>
      (!level || String(l.level) === level) &&
      (subject === "全部主题" || topic(l) === subject) &&
      (!q || `${l.id} ${l.title} ${l.objective} ${l.drillA} ${l.drillB}`.includes(q.trim())) &&
      (!saved ||
        (saved === "favorites"
          ? getRecord(store, l.id).favorite
          : saved === "taught"
            ? store.history.some((h) => h.lessonId === l.id)
            : !!getRecord(store, l.id).draft.startedAt)),
  );
  return (
    <main className={s.shell}>
      <nav className={s.nav}>
        <Link href="/">TENNIS AGENT / 网球工作台</Link>
        <Link href="/board">自由战术板 ↗</Link>
      </nav>
      <header className={s.hero}>
        <p className={s.eyebrow}>Coach workspace / 120 sessions</p>
        <h1>
          下一节课，
          <br />
          从这里开始。
        </h1>
        <p>按学员能力选一课。看清场地、理解练法，把时间留给真正的带课。</p>
      </header>
      <DevelopmentNav />
      <div className={s.levelRow} aria-label="筛选学员水平">
        <button aria-pressed={!level} onClick={() => update("level", "")}>
          全部水平
        </button>
        {levels.map((l) => (
          <button key={l.id} aria-pressed={level === String(l.id)} onClick={() => update("level", String(l.id))}>
            {l.id.toString().padStart(2, "0")} / {l.short}
          </button>
        ))}
      </div>
      <div className={s.filters}>
        <label className={`${s.field} ${s.search}`}>
          搜索课题或课号
          <input
            type="search"
            value={q}
            onChange={(e) => update("q", e.target.value)}
            placeholder="反手、二发、双打、096…"
          />
        </label>
        <label className={s.field}>
          训练主题
          <select aria-label="训练主题" value={subject} onChange={(e) => update("topic", e.target.value)}>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className={s.field}>
          我的教案
          <select aria-label="我的教案" value={saved} onChange={(e) => update("saved", e.target.value)}>
            <option value="">全部教案</option>
            <option value="favorites">已收藏</option>
            <option value="taught">带过的课</option>
            <option value="active">未结束课堂</option>
          </select>
        </label>
        <button
          className={s.button}
          onClick={() => {
            setLimit(24);
            router.replace("/lessons", { scroll: false });
          }}
        >
          清除筛选
        </button>
      </div>
      <RecordManager store={store} ready={ready} update={save} />
      {notice && <p className={s.notice}>{notice}</p>}
      {level && levels[Number(level) - 1] && <p className={s.count}>{levels[Number(level) - 1].entry}</p>}
      <p className={s.count} role="status">
        找到 {filtered.length} 节课 · 每课可选45 / 60 / 90分钟
      </p>
      <div className={s.grid}>
        {filtered.slice(0, limit).map((l) => (
          <article className={s.card} key={l.id}>
            <div className={s.preview}>
              <CourtPreview diagram={l.diagram} label={`${l.title}场地预览`} />
            </div>
            <div className={s.cardBody}>
              <div className={s.meta}>
                <span>
                  {l.id} / {levels[l.level - 1].short}
                </span>
                <span>{topic(l)}</span>
                <button
                  className={s.button}
                  disabled={!ready}
                  aria-label={`${getRecord(store, l.id).favorite ? "取消收藏" : "收藏"}教案${l.id}`}
                  aria-pressed={getRecord(store, l.id).favorite}
                  onClick={() =>
                    save((previous) => {
                      const r = getRecord(previous, l.id);
                      return { ...previous, records: { ...previous.records, [l.id]: { ...r, favorite: !r.favorite } } };
                    })
                  }
                >
                  {getRecord(store, l.id).favorite ? "★" : "☆"}
                </button>
              </div>
              <h2>
                <Link href={`/lessons/${l.id}`}>{l.title}</Link>
              </h2>
              <p>{l.objective}</p>
              {store.history.some((h) => h.lessonId === l.id) && (
                <p className={s.small}>已带 {store.history.filter((h) => h.lessonId === l.id).length} 次</p>
              )}
              {getRecord(store, l.id).draft.startedAt && <span className={s.tag}>有未结束课堂</span>}
            </div>
            <Link className={s.cardFooter} href={`/lessons/${l.id}`} aria-label={`打开教案${l.id}：${l.title}`}>
              <span>查看教案</span>
              <span aria-hidden>↗</span>
            </Link>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className={s.empty}>
          <h2>没有找到这类课程</h2>
          <p className={s.muted}>试试较短的关键词，或清除水平与主题限制。</p>
          <button className={s.button} onClick={() => router.replace("/lessons")}>
            查看全部120课
          </button>
        </div>
      )}
      {filtered.length > limit && (
        <div className={s.loadMore}>
          <button className={s.button} onClick={() => setLimit((x) => x + 24)}>
            再看24节 · 剩余 {filtered.length - limit} 节
          </button>
        </div>
      )}
      <details className={s.info}>
        <summary>怎样使用这120课</summary>
        <p>
          六级各20课，按实际回球能力选课，不按课号自动升级。默认1片场地、4名学员；完整双打需要4人。所有验收阈值是课堂建议，记录结果再决定复练或进阶。课程为原创教学设计，尚未经过真实课堂效果验证。
        </p>
      </details>
    </main>
  );
}
