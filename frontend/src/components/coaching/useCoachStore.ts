"use client";
import { useCallback, useEffect, useState } from "react";
import { emptyStore, validateStore, migrateLegacy, STORAGE_KEY, type CoachStore } from "@/lib/coaching/store";

export function useCoachStore() {
  const [store, setStore] = useState<CoachStore>(emptyStore),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const load = () => {
      try {
        const text = localStorage.getItem(STORAGE_KEY);
        if (text) {
          try {
            const next = validateStore(JSON.parse(text));
            if (next) setStore(next);
            else throw new Error("Invalid records");
          } catch {
            localStorage.setItem(`${STORAGE_KEY}-recovery`, text);
            setNotice("记录格式异常，已保留原文副本。可在记录管理中恢复有效备份。");
          }
        } else {
          const legacy = localStorage.getItem("tennis-coaching-120-v1");
          const migrated = legacy ? migrateLegacy(JSON.parse(legacy)) : null;
          if (migrated) {
            setStore(migrated);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            setNotice("已迁移旧教案库的收藏、笔记和完成标记；原记录仍保留。");
          } else setStore(emptyStore());
        }
      } catch {
        setNotice("无法读取本地记录。仍可带课，请及时备份本次记录。");
      }
      setReady(true);
    };
    load();
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) load();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const update = useCallback(
    (fn: (previous: CoachStore) => CoachStore) => {
      const next = fn(store);
      if (!validateStore(next)) {
        setNotice("记录未保存：数据不完整，请检查输入。");
        return false;
      }
      setStore(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setNotice("已保存在此浏览器。");
        return true;
      } catch {
        setNotice("浏览器存储不可用；记录暂留本页，请立即备份，关闭后可能丢失。");
        return false;
      }
    },
    [store],
  );
  return { store, ready, notice, update, setNotice };
}
