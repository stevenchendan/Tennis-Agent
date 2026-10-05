"use client";
import { useCallback, useEffect, useState } from "react";
import { emptyStore, validateStore, STORAGE_KEY, type CoachStore } from "@/lib/coaching/store";

export function useCoachStore() {
  const [store, setStore] = useState<CoachStore>(emptyStore),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const load = () => {
      try {
        const text = localStorage.getItem(STORAGE_KEY);
        if (text) {
          const next = validateStore(JSON.parse(text));
          if (next) setStore(next);
          else setNotice("保存的数据格式异常，未覆盖原数据。可在记录管理中恢复有效备份。");
        }
      } catch {
        setNotice("无法读取本地记录。仍可带课，请及时备份本次记录。");
      }
      setReady(true);
    };
    load();
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) load();
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
