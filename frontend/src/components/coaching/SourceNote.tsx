import { book } from "@/lib/coaching/development";
import s from "./coaching.module.css";
export default function SourceNote({ pages }: { pages: string }) {
  return <details className={s.info}><summary>内容来源与使用说明</summary><p>{book}，印刷页 {pages}。原书为试行本；这里的任务、教案对应和界面是项目改编，未经教练课堂验证，不代表官方评级。按实际能力与课堂观察调整，不按年龄或课号自动升级。</p></details>;
}
