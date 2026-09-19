import Link from "next/link";
import s from "./drills.module.css";
export default function DrillNav() {
  return <nav className={s.nav} aria-label="Tennis navigation"><Link className={s.brand} href="/">TENNIS<span> / </span>LAB</Link><div className={s.links}><Link href="/game-plan">Game plans</Link><Link href="/learn/cross-court">Learn & practise</Link><Link href="/playing-styles">Playing styles</Link><Link href="/drills">Drill library</Link><Link href="/video-study">Video study</Link><Link href="/movement-lab">Movement lab</Link><Link href="/board">Tactics board ↗</Link></div></nav>;
}
