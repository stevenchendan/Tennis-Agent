import type { Metadata } from "next";
import BoardEditor from "@/components/board/BoardEditor";

export const metadata: Metadata = {
  title: "网球战术板 · Tennis-Agent",
  description: "拖拽球员、绘制击球线路、编排多帧战术，一键生成链接分享给学生。",
};

export default function BoardPage() {
  return <BoardEditor />;
}
