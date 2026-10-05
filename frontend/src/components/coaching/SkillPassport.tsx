"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { emptyPassport, mergePassports, PASSPORT_KEY, ratings, recommendations, skills, validatePassport, type PassportStore, type SkillId } from "@/lib/coaching/development";
import { levels } from "@/lib/coaching/catalog";
import DevelopmentNav from "./DevelopmentNav";
import SourceNote from "./SourceNote";
import s from "./coaching.module.css";

export default function SkillPassport() {
  const [store, setStore] = useState<PassportStore>(emptyPassport);
  const [ready, setReady] = useState(false), [blocked, setBlocked] = useState(false), [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(""), [name, setName] = useState(""), [level, setLevel] = useState(1);
  const [skill, setSkill] = useState<SkillId>("serve"), [rating, setRating] = useState(1), [note, setNote] = useState("");
  const [pending, setPending] = useState<PassportStore | null>(null);
  useEffect(() => {
    function load() {
      try {
        const raw = localStorage.getItem(PASSPORT_KEY), data = raw ? validatePassport(JSON.parse(raw)) : emptyPassport();
        if (!data) throw Error("invalid");
        setStore(data); setBlocked(false);
      } catch { setBlocked(true); setNotice("无法读取能力档案，原始数据保持不变。请先导出原始数据，再检查浏览器存储或恢复备份。"); }
      setReady(true);
    }
    load();
    const sync = (e: StorageEvent) => { if (e.key === PASSPORT_KEY || e.key === null) load(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function save(change: (previous: PassportStore) => PassportStore) {
    try {
      const raw = localStorage.getItem(PASSPORT_KEY), previous = raw ? validatePassport(JSON.parse(raw)) : emptyPassport();
      if (!previous) throw Error("invalid");
      const next = validatePassport(change(previous));
      if (!next) { setNotice("未保存：已达到人数或记录上限，或输入不完整。"); return false; }
      localStorage.setItem(PASSPORT_KEY, JSON.stringify(next));
      setStore(next); setNotice("已保存在此浏览器。"); return true;
    } catch { setNotice("未保存：浏览器存储不可用或已有数据异常。输入仍留在本页，请先备份。"); return false; }
  }
  function download(raw: boolean) {
    try {
      const content = raw ? localStorage.getItem(PASSPORT_KEY) || "{}" : JSON.stringify(store, null, 2);
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = raw ? "passport-recovery.json" : "tennis-passports.json"; a.click(); URL.revokeObjectURL(url);
    } catch { setNotice("无法导出，请检查浏览器存储权限。"); }
  }
  const player = store.players.find(p => p.id === selected) || store.players[0];
  const history = store.observations.filter(o => o.playerId === player?.id).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return <main className={s.shell}>
    <DevelopmentNav />
    <header className={s.hero}><p className={s.eyebrow}>Observe / Practice / Review</p><h1>能力档案</h1><p>从一次具体观察出发，为每位学员选择下一节课。保存的是教练观察，不是自动评级。</p></header>
    <section className={s.panel}>
      <h2>学员</h2>
      <form className={s.filters} onSubmit={e => { e.preventDefault(); const id = crypto.randomUUID(); if (save(p => ({ ...p, players: [...p.players, { id, name: name.trim(), level }] }))) { setSelected(id); setName(""); } }}>
        <label className={s.field}>学员昵称<input value={name} maxLength={80} required onChange={e => setName(e.target.value)} /></label>
        <label className={s.field}>当前能力水平<select aria-label="当前能力水平" value={level} onChange={e => setLevel(Number(e.target.value))}>{levels.map(l => <option key={l.id} value={l.id}>{l.short}</option>)}</select></label>
        <button className={s.button} disabled={!ready || blocked || !name.trim() || store.players.length >= 100}>添加学员</button>
      </form>
      {player ? <div className={s.filters}>
        <label className={s.field}>选择学员<select aria-label="选择学员" value={player.id} onChange={e => { setSelected(e.target.value); setNote(""); }}>{store.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className={s.field}>调整学员水平<select aria-label="调整学员水平" disabled={blocked} value={player.level} onChange={e => { const next = Number(e.target.value); save(p => ({ ...p, players: p.players.map(x => x.id === player.id ? { ...x, level: next } : x) })); }}>{levels.map(l => <option key={l.id} value={l.id}>{l.short}</option>)}</select></label>
      </div> : <p>还没有学员。添加一个昵称，开始记录第一项能力。</p>}
    </section>
    {notice && <p className={s.notice} role="status">{notice}</p>}
    {player && <>
      <section className={s.panel} style={{ marginTop: 24 }}><h2>记录观察 · {player.name}</h2>
        <form onSubmit={e => { e.preventDefault(); if (save(p => ({ ...p, observations: [...p.observations, { id: crypto.randomUUID(), playerId: player.id, skill, rating, note: note.trim(), date: new Date().toISOString() }] }))) setNote(""); }}>
          <div className={s.filters}>
            <label className={s.field}>观察能力<select aria-label="观察能力" value={skill} onChange={e => setSkill(e.target.value as SkillId)}>{skills.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label className={s.field}>本次表现<select aria-label="本次表现" value={rating} onChange={e => setRating(Number(e.target.value))}>{ratings.map((r, i) => <option key={r} value={i}>{r}</option>)}</select></label>
          </div>
          <p>{skills.find(x => x.id === skill)?.cue}</p>
          <label className={s.field}>观察依据 / 测试条件<textarea required value={note} maxLength={1000} placeholder="例如：慢速喂球10次，受压时6次主动增加回球高度。复测保持相同条件。" onChange={e => setNote(e.target.value)} /></label>
          <button className={`${s.button} ${s.primary}`} style={{ marginTop: 12 }} disabled={blocked || !note.trim() || store.observations.length >= 5000}>保存本次观察</button>
        </form>
      </section>
      <h2 style={{ marginTop: 32 }}>能力与下一课</h2>
      <div className={s.grid}>{skills.map(x => {
        const observations = history.filter(o => o.skill === x.id), latest = observations[0], previous = observations[1];
        return <article className={s.panel} key={x.id}><h3>{x.name}</h3><p>{x.cue}</p>
          <p className={s.tag}>{latest ? ratings[latest.rating] : "尚未观察"}</p>
          {latest && <p className={s.small}>最近：{new Date(latest.date).toLocaleDateString()} · {latest.note}</p>}
          {previous && <p className={s.small}>上次：{ratings[previous.rating]} → 本次：{ratings[latest.rating]}。不同测试条件不可直接比较。</p>}
          <p className={s.small}>{latest && latest.rating >= 2 ? "巩固或增加变化" : "建议先练"} · 由教练确认适合程度</p>
          {recommendations(x.id, player.level).map(l => <p key={l.id}><Link className={s.link} href={`/lessons/${l.id}`}>{l.id} · {l.title}</Link></p>)}
          <button className={s.button} onClick={() => { setSkill(x.id); document.querySelector("form textarea")?.scrollIntoView({ block: "center" }); }}>观察这项能力</button>
        </article>;
      })}</div>
      <details className={s.info}><summary>历次观察（{history.length}）</summary>{history.length ? history.map(o => <p key={o.id}>{new Date(o.date).toLocaleString()} · {skills.find(x => x.id === o.skill)?.name} · {ratings[o.rating]} — {o.note}</p>) : <p>保存观察后，可在这里比较复测记录。</p>}</details>
    </>}
    <details className={s.info}><summary>档案备份与恢复</summary><p>仅保存在当前浏览器，最多100位学员、5000次观察。与教案库的课堂备份分开导出；导入按ID合并，同ID保留当前数据。</p>
      <div className={s.row}><button className={s.button} disabled={!ready || blocked} onClick={() => download(false)}>导出能力档案</button><button className={s.button} onClick={() => download(true)}>导出原始数据</button>
        <label className={s.field}>导入档案备份<input type="file" accept=".json,application/json" disabled={!ready} onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = ""; setPending(null); if (!file) return;
          try { if (file.size > 12_000_000) throw Error(); const data = validatePassport(JSON.parse(await file.text())); if (!data) throw Error(); setPending(data); } catch { setNotice("备份无效或超过12MB，现有档案未改动。"); }
        }} /></label></div>
      {pending && <div className={s.cue}><p>备份包含 {pending.players.length} 位学员、{pending.observations.length} 次观察。</p>
        <button className={s.button} onClick={() => {
          if (blocked) {
            try { const raw = localStorage.getItem(PASSPORT_KEY); if (raw) localStorage.setItem(`${PASSPORT_KEY}-recovery`, raw); localStorage.setItem(PASSPORT_KEY, JSON.stringify(pending)); setStore(pending); setBlocked(false); setPending(null); setNotice("已恢复备份，异常原文另存为恢复副本。"); } catch { setNotice("恢复失败，未能写入浏览器存储。"); }
          } else if (save(p => { const merged = mergePassports(p, pending); if (!merged) throw Error("capacity"); return merged; })) setPending(null);
        }}>{blocked ? "保留异常副本并恢复备份" : "确认合并档案"}</button> <button className={s.button} onClick={() => setPending(null)}>取消导入</button></div>}
    </details>
    <SourceNote pages="46、61、155、228、243–245" />
  </main>;
}
