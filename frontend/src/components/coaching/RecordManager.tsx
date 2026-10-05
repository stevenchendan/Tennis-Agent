"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { lessons, layouts, type Layout } from "@/lib/coaching/catalog";
import { type CoachStore, validateStore, migrateLegacy, pausedSnapshot } from "@/lib/coaching/store";
import { validateLayout } from "@/lib/coaching/court-layout";
import s from "./coaching.module.css";

type Incoming = { store: CoachStore; courts: Record<string, Layout> };
export default function RecordManager({
  store,
  ready,
  update,
}: {
  store: CoachStore;
  ready: boolean;
  update: (fn: (previous: CoachStore) => CoachStore) => boolean;
}) {
  const file = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const reveal = () => {
      if (location.hash === "#records" && container.current) container.current.open = true;
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  const [pending, setPending] = useState<Incoming | null>(null),
    [message, setMessage] = useState(""),
    [lesson, setLesson] = useState(""),
    [limit, setLimit] = useState(10);
  function download() {
    const courts: Record<string, Layout> = {};
    let skipped = 0;
    for (const l of lessons) {
      try {
        const raw = localStorage.getItem(`tennis-lesson-court-v1:${l.id}`);
        if (raw) {
          const layout = validateLayout(JSON.parse(raw), layouts[l.diagram]);
          if (layout) courts[l.id] = layout;
          else skipped++;
        }
      } catch {
        skipped++;
      }
    }
    const blob = new Blob(
        [JSON.stringify({ ...pausedSnapshot(store), courts, exportedAt: new Date().toISOString() }, null, 2)],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `tennis-classes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`备份已开始下载，包含课堂、草稿、收藏和有效场地布置。${skipped ? "部分异常布置未导出。" : ""}`);
  }
  async function preview(event: ChangeEvent<HTMLInputElement>) {
    try {
      const f = event.target.files?.[0];
      if (!f) return;
      setPending(null);
      if (f.size > 3_000_000) throw Error("too large");
      const raw: unknown = JSON.parse(await f.text());
      const parsed = validateStore(raw) || migrateLegacy(raw);
      if (!parsed) throw Error("invalid");
      const courts: Record<string, Layout> = {};
      const candidate = (raw as { courts?: unknown }).courts;
      if (candidate !== undefined) {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw Error("invalid court map");
        for (const [id, value] of Object.entries(candidate)) {
          const l = lessons.find((x) => x.id === id);
          if (!l) throw Error("unknown court");
          const layout = validateLayout(value, layouts[l.diagram]);
          if (!layout) throw Error("invalid court");
          courts[id] = layout;
        }
      }
      setPending({ store: pausedSnapshot(parsed), courts });
      setMessage("已读取备份，请核对下面的合并预览。");
    } catch {
      setMessage("无法读取：请使用本项目或旧教案库导出的有效备份（不超过3MB）。原有记录未改变。");
    } finally {
      event.target.value = "";
    }
  }
  function merge() {
    if (!pending) return;
    let courtsSaved = true;
    const ok = update((previous) => {
      const byId = new Map([...previous.history, ...pending.store.history].map((h) => [h.id, h]));
      return {
        version: 2,
        records: { ...previous.records, ...pending.store.records },
        history: [...byId.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).slice(-300),
      };
    });
    if (!ok) {
      setMessage("合并后的课堂记录暂存本页，但浏览器写入失败；请立即下载备份。");
      return;
    }
    for (const [id, layout] of Object.entries(pending.courts)) {
      try {
        localStorage.setItem(`tennis-lesson-court-v1:${id}`, JSON.stringify(layout));
      } catch {
        courtsSaved = false;
      }
    }
    setPending(null);
    setMessage(courtsSaved ? "备份已合并；恢复的计时器均为暂停状态。" : "课堂记录已合并，但部分场地布置未能保存。");
  }
  const history = [...store.history].reverse().filter((h) => !lesson || h.lessonId === lesson);
  return (
    <details ref={container} className={s.records} id="records">
      <summary>
        课堂记录与备份 <span>{store.history.length} 次课堂</span>
      </summary>
      <div className={s.recordBody}>
        <p className={s.muted}>
          记录保存在当前浏览器，不自动跨设备同步。保留最近300次课堂；定期备份可长期留档。旧版完成标记不包含真实课时或命中统计。
        </p>
        <div className={s.row}>
          <button className={s.button} disabled={!ready} onClick={download}>
            备份全部记录
          </button>
          <button className={s.button} disabled={!ready} onClick={() => file.current?.click()}>
            选择备份恢复
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="选择记录备份文件"
            onChange={preview}
          />
        </div>
        <p className={s.notice} role="status">
          {message}
        </p>
        {pending && (
          <div className={s.cue}>
            <h3>合并预览</h3>
            <p>
              {Object.keys(pending.store.records).length} 份课程草稿/收藏，{pending.store.history.length} 次课堂，
              {Object.keys(pending.courts).length} 份场地布置。
            </p>
            <p className={s.small}>
              同课草稿、收藏和布置以备份为准；课堂历史按编号去重合并，保留最近300次。恢复的计时器暂停，不影响当前其他课程。
            </p>
            <div className={s.row}>
              <button className={`${s.button} ${s.primary}`} onClick={merge}>
                合并这份备份
              </button>
              <button className={s.button} onClick={() => setPending(null)}>
                取消导入
              </button>
            </div>
          </div>
        )}
        <label className={s.field} style={{ maxWidth: 420, margin: "18px 0" }}>
          查看哪一课的记录
          <select
            aria-label="查看哪一课的记录"
            value={lesson}
            onChange={(e) => {
              setLesson(e.target.value);
              setLimit(10);
            }}
          >
            <option value="">全部课堂</option>
            {lessons
              .filter((l) => store.history.some((h) => h.lessonId === l.id))
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id} · {l.title}
                </option>
              ))}
          </select>
        </label>
        {!history.length && <p className={s.muted}>还没有课堂记录。进入一节课的带课模式，结束时保存即可。</p>}
        {history.slice(0, limit).map((h) => (
          <article className={s.historyItem} key={h.id}>
            <div className={s.spread}>
              <h3>
                <Link href={`/lessons/${h.lessonId}`} className={s.link}>
                  {h.lessonId} · {lessons.find((l) => l.id === h.lessonId)?.title}
                </Link>
              </h3>
              <span className={s.small}>
                {h.id.startsWith("legacy-") ? "旧版完成标记" : new Date(h.date).toLocaleString("zh-CN")}
              </span>
            </div>
            <p>
              {h.className || "未命名班级"} · {h.players}人 · {h.duration}分钟计划 ·{" "}
              {h.difficulty === "easier" ? "降阶" : h.difficulty === "harder" ? "进阶" : "标准"}
            </p>
            <p className={s.muted}>
              {h.subject} / {h.metric}：
              {h.attempts
                ? `${h.success}/${h.attempts}（${Math.round((h.success / h.attempts) * 100)}%）`
                : "未记录次数"}
              　
              {h.id.startsWith("legacy-")
                ? "旧版未记录计时"
                : `计时累计 ${Math.floor(h.elapsed / 60)}分${Math.round(h.elapsed % 60)}秒`}
            </p>
            {h.notes && <p className={s.savedNotes}>{h.notes}</p>}
          </article>
        ))}
        {history.length > limit && (
          <button className={s.button} onClick={() => setLimit((n) => n + 10)}>
            再看10次课堂
          </button>
        )}
      </div>
    </details>
  );
}
