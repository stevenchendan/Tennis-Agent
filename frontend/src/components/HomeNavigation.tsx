"use client";

import Link from "next/link";
import { useState } from "react";

const groups = [
  { title: "学习与训练 / LEARN", links: [
    ["/learn/cross-court", "斜线战术课", "Cross-court lesson"],
    ["/drills", "动态训练库", "Drill library"],
    ["/video-study", "视频学习", "Video study"],
    ["/movement-lab", "动作实验室", "Movement lab"],
    ["/board", "战术板", "Tactics board"],
  ] },
  { title: "比赛与分析 / MATCH", links: [
    ["/#analysis", "比赛复盘", "Video analysis"],
    ["/match", "现场记分", "Match tracker"],
    ["/scouting", "球探报告", "Scouting"],
    ["/calendar", "赛事日历", "Tournament calendar"],
    ["/benchmark", "球员基准", "Player benchmark"],
  ] },
  { title: "球场探索 / EXPLORE", links: [
    ["/melbourne-park", "Melbourne Park", "3D precinct"],
    ["/1573-arena", "1573 Arena", "Court atlas"],
  ] },
];

export default function HomeNavigation() {
  const [open, setOpen] = useState(false);
  return <aside className="home-sidebar no-print">
    <div className="home-brand-row">
      <Link href="/" className="home-brand" aria-label="Tennis Agent 首页">
        <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="currentColor"/><path d="M6 6c13 0 7 20 20 20M26 6C13 6 19 26 6 26" stroke="#101110" strokeWidth="1.5"/></svg>
        <span>TENNIS<span className="home-brand-sub">AGENT / 你的网球工作台</span></span>
      </Link>
      <button type="button" className="home-menu-button" aria-expanded={open} aria-controls="home-navigation" onClick={() => setOpen(!open)}>{open ? "关闭 ✕" : "导航 ☰"}</button>
    </div>
    <nav id="home-navigation" aria-label="主导航" className={`home-navigation ${open ? "is-open" : ""}`}>
      <Link href="/" aria-current="page" className="home-nav-overview" onClick={() => setOpen(false)}><span>首页概览</span><span aria-hidden="true">↗</span></Link>
      {groups.map(group => <div className="home-nav-group" key={group.title}>
        <p>{group.title}</p>
        {group.links.map(([href, label, subtitle]) => <Link href={href} key={href} onClick={() => setOpen(false)} className="home-nav-link"><span>{label}<small>{subtitle}</small></span><span aria-hidden="true">↗</span></Link>)}
      </div>)}
      <p className="home-nav-footer">看懂战术 · 练好每一分</p>
    </nav>
  </aside>;
}
