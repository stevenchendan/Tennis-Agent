import Link from "next/link";
import s from "./coaching.module.css";
export default function DevelopmentNav() {
  return <nav className={s.levelRow} aria-label="成长工具">
    <Link className={s.button} href="/lessons">教案库</Link>
    <Link className={s.button} href="/development">能力档案</Link>
    <Link className={s.button} href="/development/pathways">成长路线</Link>
  </nav>;
}
